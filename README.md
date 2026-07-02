# Telas La Jalisciense — Catálogo digital

Catálogo web para una tienda de telas al menudeo en Fresnillo. Los clientes
exploran las telas, arman su pedido en metros y lo envían por WhatsApp; el
mismo catálogo sirve al vendedor en tablet para armar cotizaciones y alimenta
un agente de ventas por WhatsApp.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase
(Postgres + Storage) · pnpm.

---

## Puesta en marcha

Requisitos: Node 20+, pnpm, y un proyecto de [Supabase](https://supabase.com) (el plan gratuito alcanza).

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env.local
# Llena las llaves desde Supabase → Project Settings → API:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# el número de WhatsApp del negocio (formato internacional sin '+', ej. 5249xxxxxxxx)
# y ADMIN_EMAILS para el panel /admin (ver "Administrar el catálogo").

# 3. Esquema de la base de datos
# En Supabase → SQL Editor, pega y corre `catalogo_telas_supabase.sql`.
# Es idempotente: se puede correr varias veces sin romper nada.

# 4. Bucket de fotos
# En Supabase → Storage, crea el bucket `telas` y márcalo como PÚBLICO.

# 5. A correr
pnpm dev
```

Sin llaves configuradas el sitio no truena: muestra instrucciones de setup.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm ingest` | Genera `catalog-manifest.csv` para revisión manual (**no sube nada**) |
| `pnpm ingest --upload` | Tras aprobar el CSV: sube fotos al bucket y hace upsert idempotente en la BD |

## Cargar telas (ingesta de fotos)

El flujo es en dos pasos a propósito — primero revisas, luego subes:

1. Pon las fotos en `./FOTOS_TELAS/` (o pasa `--dir=<ruta>`). El nombre del
   archivo codifica SKU, modelo y color (ej. `CHLU99-ChifonLunares-Azul.jpg`).
2. `pnpm ingest` → genera `catalog-manifest.csv`. **Ábrelo y revísalo**:
   corrige modelos/colores mal parseados directamente en el CSV.
3. `pnpm ingest --upload` → sube las imágenes al bucket `telas` y hace upsert
   de `tela` → `variante` → `foto`. Es idempotente: correrlo dos veces no
   duplica nada. Respeta SKUs existentes y **nunca inventa SKUs**.

## Administrar el catálogo

### Panel `/admin`

El panel en **`/admin`** cubre la operación diaria completa. Los cambios salen
al sitio público **al instante** (invalida el caché con `revalidateTag`):

- **Edición rápida** (portada de `/admin`): precio por metro y stock de cada
  variante, con búsqueda por tela/color/SKU. Deja un campo vacío para
  "a consultar" — no es lo mismo que 0.
- **Editor completo** (`/admin/tela/[id]`, botón de lápiz en cada fila):
  nombre, URL, descripción, categoría, casos de uso y oportunidades del
  modelo; alta/edición/baja de variantes (SKU, color, acabado, gramaje,
  propiedades ópticas); y **fotos**: subir (JPG/PNG/WebP), reordenar (la
  primera es la portada) y eliminar — también se borran del bucket.
- **Alta de telas** (`/admin/tela/nueva`): crea el modelo y te lleva al
  editor para agregar variantes y fotos.
- **Inventario** (`/admin/inventario`): kardex de movimientos — entrada,
  salida, merma y ajuste por conteo físico — con historial (quién, cuándo,
  por qué), resumen de variantes sin existencia / stock bajo / sin conteo, y
  lista de "por resurtir". El umbral de stock bajo es de 10 m, ajustable con
  `INVENTARIO_UMBRAL_BAJO`. Requiere la **sección 10** de
  `catalogo_telas_supabase.sql` (el archivo es idempotente: córrelo completo
  en el editor SQL de Supabase Studio).

Para habilitarlo (una sola vez):

1. En Supabase → **Authentication → Users → Add user**: crea el usuario del
   admin (correo + contraseña, marca "Auto Confirm User").
2. En `.env.local` (y en las variables del hosting) agrega ese correo a
   `ADMIN_EMAILS` (separados por comas si son varios).

La sesión sola no basta: solo los correos de `ADMIN_EMAILS` pueden administrar
(los proyectos de Supabase permiten registro público por default). Sin la
variable, nadie entra.

### Catálogos de apoyo: Supabase Studio

Los **lookups** (nuevos colores, categorías, acabados, usos y ocasiones) se
dan de alta en el **Table Editor de Supabase Studio**: tablas `color`,
`categoria`, `acabado`, `caso_uso`, `oportunidad`. Para carga masiva de fotos
sigue existiendo `pnpm ingest`.

> ⚠️ La vista `catalogo_telas` es de solo lectura — edita siempre las tablas
> base (`variante`, `tela`, etc.).

### Precios de demostración

Con `NEXT_PUBLIC_DEMO_PRICES=true` (en `.env.local` o en las variables del
hosting), las variantes **sin precio en la BD** muestran un precio de
referencia realista por categoría, con la etiqueta "precio de referencia".
Los precios reales capturados en la BD **siempre tienen prioridad** y nunca se
sobreescriben. Para producción con precios reales, apaga el flag. Los montos
base se editan en `lib/demo-prices.ts`.

## Modelo de datos (resumen)

```
tela (modelo)  →  variante (SKU/color: precio, stock, propiedades)  →  foto (bucket `telas`)
tela ↔ caso_uso (N:N)      tela ↔ oportunidad (N:N)
lookups: color (con hex), categoria, acabado
```

- El frontend lee la **vista `catalogo_telas`** (una fila por variante).
- Búsqueda insensible a acentos con `f_unaccent` + `pg_trgm` (función `buscar_telas`).
- `sku` es UNIQUE pero NULLABLE: hay fotos sin SKU y eso está bien.
- En la BD se guarda la **ruta relativa** de cada foto dentro del bucket, no la URL.

## Seguridad

- **RLS activo** en todas las tablas: lectura pública (`anon` SELECT), escritura
  solo con `service_role`.
- La llave `service_role` vive solo en el servidor (`lib/supabase/admin.ts` usa
  `import "server-only"`: el build falla si se importa desde código de cliente).
- Nunca subas llaves reales al repo: `.env.local` está gitignoreado y
  `.env.example` es la plantilla vacía.

## Roadmap

1. ✅ Esquema SQL (`catalogo_telas_supabase.sql`)
2. ✅ Scaffolding + conexión de lectura + grid
3. ✅ Script de ingesta (manifest CSV → upload)
4. ⏳ Filtros + detalle + selector de color (detalle y selector listos; filtros pendientes)
5. ⏳ Cotización + WhatsApp (carrito y envío listos; pulido pendiente)
6. ✅ Admin con Auth (precio/stock, altas/edición de telas y variantes, fotos e inventario con kardex)
7. ⏳ Pulido visual, rendimiento, tests

Más contexto para desarrollo (convenciones, paleta, fases) en [`CLAUDE.md`](./CLAUDE.md).
