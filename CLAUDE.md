# Telas La Jalisciense — Catálogo digital

Catálogo web (capa de presentación de un esquema Supabase) para una tienda de telas al
menudeo en Fresnillo. También alimenta un agente de ventas por WhatsApp. Dos perfiles de
uso: cliente final que navega, y vendedor en tablet que arma cotizaciones.

## Stack
- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Supabase**: `@supabase/supabase-js` + `@supabase/ssr`
  - cliente `anon` → lectura pública (Server Components)
  - `service_role` → SOLO en server actions / route handlers (`lib/supabase/admin.ts`). NUNCA en el cliente.
- **next/image** para imágenes. Tipografías: **Anton** (display de marca Ápice) + **Inter** (cuerpo).
- **lucide-react** para iconos. Sin librerías de UI pesadas: componentes propios.

## Comandos (gestor: **pnpm**)
- `pnpm dev` — servidor de desarrollo
- `pnpm build` / `pnpm start` — producción
- `pnpm preparar --in=<carpeta>` — RAW de cámara (.ARW…) → JPEG recortado al producto
  (`sips` + `lib/images/recorte.ts`; macOS-only, el original no se toca). Correr ANTES de
  la ingesta cuando las fotos vengan en RAW o sin encuadrar.
  `--exposicion=2` sube la exposición al 200% (default 1 = sin cambio); las tomas de
  mercería sobre fondo negro vienen subexpuestas y sin esto el color no se distingue.
  Medido sobre el lote: solo 0,6% de los pixeles llega al techo, así que a 200% no se
  queman las altas luces — el brillo especular de la pedrería se conserva.
  Escala los tres canales RGB por igual, que es lo único que aclara SIN mover el tono
  (matiz y saturación HSV son razones entre canales). NO usar `modulate({brightness})`:
  desatura entre 19% y 36% y el rosa se va a malva gris — hay pruebas que lo fijan.
  NO enfoca: el sharpening es del pipeline de derivados, aplicarlo aquí deja halos dobles.
- `pnpm ingest` — genera `catalog-manifest.csv` (revisión manual, NO sube nada).
  Volver a correrlo **fusiona**: lo capturado a mano gana y lo deducido del nombre de
  archivo solo rellena celdas vacías, así reprocesar un lote no borra horas de captura
  (`lib/ingesta/fusion.ts`, con pruebas). Las notas automáticas van marcadas `[auto]`
  para poder tirarlas al regenerar sin tocar las que escribió la tienda.
  `--forzar` regenera desde cero. El sidecar `catalog-manifest.auto.json` recuerda qué
  puso el parser, para poder corregirlo sin pisar lo que capturó la tienda.
- `pnpm etiquetas:bolsitas` — vuelca sobre el CSV el código/cantidad/precio que están
  escritos A MANO en la etiqueta de cada bolsita (se leyeron de la foto, ningún parser
  los saca). Idempotente; los precios van marcados para confirmar.
- `pnpm ingest --upload` — tras aprobar el CSV: sube fotos al bucket y hace upsert idempotente
- `pnpm backfill:derivados` — genera derivados WebP para fotos con `derivados IS NULL`
  (idempotente; acepta `--limit=N`)
- `pnpm clasificar` — sobre lo YA SUBIDO: asigna categoría a cada tela según el prefijo
  de su código (`lib/ingesta/categorias.ts`) y le quita a las bolsitas de piedra el
  número de cámara del nombre. **Simulacro por defecto**: `--aplicar` escribe,
  `--forzar` repone categorías ya asignadas (enumera qué reemplaza, porque puede pisar
  lo capturado a mano desde /admin). Idempotente.

## Modelo de datos (ver `catalogo_telas_supabase.sql`)
El catálogo ya no es solo tela: también hay **mercería/avíos** (pedrería, flores, copas,
botones, cinta). Por eso `variante.precio` NO es siempre por metro — `unidad_venta`
(metro/pieza/par/bolsa/rollo/juego) y `piezas_por_unidad` dicen qué se está cobrando.
La vista sigue exponiendo `precio_metro` como **alias deprecado** de `precio`.

**`lib/unidades.ts` es la única fuente de esa vocabulario.** No hardcodear "/m" ni
pasos de 0.5 en ningún lado: la unidad decide el sufijo del precio, el plural del
stepper y —lo importante— el PASO y el MÍNIMO con que se cuenta. La tela se corta a
medios metros; un botón no se parte a la mitad. Está usada en `ProductCard`,
`/tela/[slug]`, `AddToCart`, `CartDrawer`, `lib/whatsapp-message.ts` y los dos
formularios de `/admin`. `unidadDe(null)` cae a **metro** a propósito: es como se
comportaba todo antes de que existiera la columna, así que un dato faltante —o un
carrito ya guardado en localStorage— no le cambia el pedido a nadie.

`tela` (modelo) → `variante` (SKU/color, con precio/stock/propiedades ópticas) → `foto`
(en bucket Storage `telas`). N:N: `tela↔caso_uso`, `tela↔oportunidad`. Lookups: `color`
(con hex), `categoria`, `acabado`, `caso_uso`, `oportunidad`.
- Usar la **vista `catalogo_telas`** (una fila por variante) para listados/filtros.
- `sku` es UNIQUE pero NULLABLE: hay fotos sin SKU; **nunca inventar SKU**.
- `variante.orden` (sección 11 del SQL) = orden manual de colores; se edita con
  drag & drop en `/admin/tela/[id]` y la vista lo expone como `variante_orden`.
- Búsqueda full-text con `f_unaccent` + `pg_trgm` (insensible a acentos, soporta substrings).
- **Categoría desde el código**: la tienda codifica el tipo de producto en las letras del
  código (`HE`=hebilla, `BO`=botones, `JR`=corchetes, `BNK`/`KP`=tira de pedrería,
  `TGL`/`TG`/`G`=galón de ENCAJE —no es pedrería—, `BT`/`CT`/`TC`=cintillo, `D`/`DB`/`MC`=
  aplicación, `PCC`/`I`=piedra suelta, `B`+dígito=fleco). Las reglas viven en
  `lib/ingesta/categorias.ts`, **verificadas abriendo la foto de cada familia**, no
  deducidas del texto. El ORDEN de las reglas importa: cinco familias empiezan con B.

## Storage e imágenes
- Bucket **`telas`** (público). En la BD se guarda la **ruta relativa** dentro del bucket,
  no la URL absoluta. El frontend construye la URL pública con el cliente de Supabase.
- **Pipeline de derivados** (`lib/images/derivados.ts`, sección 12 del SQL): por cada
  original se generan WebP sm/800px, md/1600px, lg/2400px (sRGB forzado, sharpen
  post-resize) bajo el prefijo `derivados/{tamano}/` — el original NUNCA se toca.
  Corre solo: en `/admin` vía `after()` (server action `subirFotos`) y en la ingesta;
  fallos dejan `derivados = null` y los recoge `pnpm backfill:derivados`.
- `foto.derivados` (jsonb) guarda rutas + dimensiones reales; la vista lo expone como
  `foto_principal_derivados`. `TelaImage` usa `<img srcset>` directo al CDN de Supabase
  (sin recompresión de next/image) y cae a `next/image` sobre el original si es null.
  El `lg` también es para el agente de WhatsApp (n8n), que lee Storage directo.

## Convenciones
- Paleta (tokens en `app/globals.css`): tinta `#1A1714`, fondo hueso `#FAF8F5`,
  ámbar primario `#B45309`, ámbar secundario `#C2843A`, borde sutil `#E7E1D8`.
- `rounded-xl`/`rounded-2xl` consistente en cards, botones, inputs, modales. Sombras suaves.
- Accesibilidad AA: contraste, focus visible, navegable por teclado, `alt` en imágenes.
- Estado de filtros/búsqueda en la **URL (querystring)** para que sea compartible.
- No traer todo el catálogo al cliente: paginación/scroll infinito; cachear lecturas en Server Components.

## Seguridad
- RLS activo: lectura pública (anon SELECT), escritura solo `service_role`.
- Llaves reales nunca al repo. Ver `.env.example`.

## Orden de trabajo (por fases, mostrar antes de avanzar)
1. ✅ Esquema SQL (`catalogo_telas_supabase.sql`)
2. ✅ Scaffolding + conexión lectura + grid mínimo
3. ✅ Script de ingesta (manifest CSV primero)
4. ✅ Filtros + detalle + selector de color. Los filtros son chips server-rendered
   (`components/Filtros.tsx`) con el estado en la URL (`lib/filtros.ts`): categoría,
   color, acabado y disponibilidad. Las facetas (`getFacetas`) se calculan sobre el
   catálogo COMPLETO y solo se pinta el chip de lo que algún producto tiene, así que
   la barra crece sola conforme la tienda captura más datos. La paginación es POR
   MODELO (`?ver=N`, 48 por tanda): la vista trae una fila por variante pero el grid
   pinta una card por modelo, así que cortar por filas partiría un modelo entre dos
   páginas y la card saldría con la mitad de sus colores. `paginaCatalogoCached` hace
   dos lecturas —qué modelos cumplen (proyección mínima, da el total honesto) y luego
   las filas de esa página— y `recortarAModelos` hace lo mismo en el camino de
   búsqueda. Cambiar un filtro o la búsqueda resetea `ver`.
5. ⏳ Cotización + WhatsApp (carrito y envío listos; pulido pendiente)
6. ✅ Admin con Auth (allowlist `ADMIN_EMAILS`): precio/stock en `/admin`, editor
   completo de telas/variantes/fotos en `/admin/tela/[id]`, altas en
   `/admin/tela/nueva`, inventario con kardex en `/admin/inventario`
   (tabla `movimiento_inventario`, sección 10 del SQL)
7. ⏳ Pulido visual, rendimiento, tests (README listo)
