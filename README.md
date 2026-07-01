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
# y el número de WhatsApp del negocio (formato internacional sin '+', ej. 5249xxxxxxxx).

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

## Editar precios, stock y telas HOY (admin provisional)

Aún no existe el panel `/admin` (fase 6 del roadmap). Mientras tanto, la forma
segura de editar el catálogo es el **Table Editor de Supabase Studio** — no
requiere código y las escrituras pasan por el dashboard, nunca por la llave
pública:

1. Entra a [supabase.com](https://supabase.com) → tu proyecto → **Table Editor**.
2. Para **precios y stock**: abre la tabla **`variante`** y edita las columnas
   `precio_metro` (MXN por metro) y `stock` (metros disponibles). Cada fila es
   un color/SKU concreto.
3. Para **nombres y descripciones**: tabla **`tela`** (campos `nombre`,
   `descripcion`).
4. Para **colores, categorías, usos y ocasiones**: tablas `color`, `categoria`,
   `caso_uso`, `oportunidad`.

Los cambios aparecen en el sitio en **menos de 60 segundos** (las lecturas del
catálogo se cachean 60s; ver `lib/queries.ts`).

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
6. Admin con Auth (mientras tanto: Supabase Studio, ver arriba)
7. Pulido visual, rendimiento, README

Más contexto para desarrollo (convenciones, paleta, fases) en [`CLAUDE.md`](./CLAUDE.md).
