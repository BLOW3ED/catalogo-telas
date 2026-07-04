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
- `pnpm ingest` — genera `catalog-manifest.csv` (revisión manual, NO sube nada)
- `pnpm ingest --upload` — tras aprobar el CSV: sube fotos al bucket y hace upsert idempotente
- `pnpm backfill:derivados` — genera derivados WebP para fotos con `derivados IS NULL`
  (idempotente; acepta `--limit=N`)

## Modelo de datos (ver `catalogo_telas_supabase.sql`)
`tela` (modelo) → `variante` (SKU/color, con precio/stock/propiedades ópticas) → `foto`
(en bucket Storage `telas`). N:N: `tela↔caso_uso`, `tela↔oportunidad`. Lookups: `color`
(con hex), `categoria`, `acabado`, `caso_uso`, `oportunidad`.
- Usar la **vista `catalogo_telas`** (una fila por variante) para listados/filtros.
- `sku` es UNIQUE pero NULLABLE: hay fotos sin SKU; **nunca inventar SKU**.
- `variante.orden` (sección 11 del SQL) = orden manual de colores; se edita con
  drag & drop en `/admin/tela/[id]` y la vista lo expone como `variante_orden`.
- Búsqueda full-text con `f_unaccent` + `pg_trgm` (insensible a acentos, soporta substrings).

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
4. ⏳ Filtros + detalle + selector de color (detalle y selector listos; filtros pendientes)
5. ⏳ Cotización + WhatsApp (carrito y envío listos; pulido pendiente)
6. ✅ Admin con Auth (allowlist `ADMIN_EMAILS`): precio/stock en `/admin`, editor
   completo de telas/variantes/fotos en `/admin/tela/[id]`, altas en
   `/admin/tela/nueva`, inventario con kardex en `/admin/inventario`
   (tabla `movimiento_inventario`, sección 10 del SQL)
7. ⏳ Pulido visual, rendimiento, tests (README listo)
