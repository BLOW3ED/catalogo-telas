-- ============================================================================
-- Telas La Jalisciense — Catálogo digital
-- Esquema de Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- Jerarquía:  tela  →  variante (SKU/color)  →  foto
--             tela ↔ caso_uso        (N:N)
--             tela ↔ oportunidad     (N:N)
--
-- Decisiones de diseño aprobadas:
--   • categoría, acabado, color, caso_uso, oportunidad = tablas lookup
--   • propiedades ópticas, gramaje, precio y stock = nivel VARIANTE (cada SKU)
--   • sku es UNIQUE pero NULLABLE (Postgres permite múltiples NULL en UNIQUE)
--   • lectura pública vía RLS (anon SELECT); escritura solo service_role
--   • búsqueda full-text con unaccent + pg_trgm (tolerante a acentos y substrings)
--
-- Idempotente: se puede correr varias veces sin romper (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";   -- uuid_generate_v4()
create extension if not exists unaccent with schema extensions;  -- quitar acentos en búsqueda
create extension if not exists pg_trgm;        -- índices de similitud / substring (ILIKE %x%)

-- unaccent() NO es IMMUTABLE por defecto (depende de un diccionario), así que no
-- se puede indexar directo. Lo envolvemos en una función IMMUTABLE para poder
-- crear índices funcionales sobre texto normalizado.
create or replace function f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent($1)
$$;

-- ---------------------------------------------------------------------------
-- 1. Trigger genérico para updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tablas lookup (catálogos controlados)
-- ---------------------------------------------------------------------------

-- Colores con su hex real para los swatches del frontend
create table if not exists color (
  id    uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug   text not null unique,
  hex    text not null check (hex ~* '^#[0-9a-f]{6}$')  -- formato #RRGGBB
);

create table if not exists categoria (
  id     uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug   text not null unique
);

create table if not exists acabado (
  id     uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug   text not null unique
);

create table if not exists caso_uso (
  id     uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug   text not null unique
);

create table if not exists oportunidad (
  id     uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug   text not null unique
);

-- ---------------------------------------------------------------------------
-- 3. Núcleo: tela → variante → foto
-- ---------------------------------------------------------------------------

-- "tela" = el modelo base (ej. "Chifón Lunares"). Agrupa todas las variantes de color.
create table if not exists tela (
  id           uuid primary key default uuid_generate_v4(),
  slug         text not null unique,                 -- para /tela/[slug]
  nombre       text not null,
  categoria_id uuid references categoria(id) on delete set null,
  descripcion  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_tela_updated_at on tela;
create trigger trg_tela_updated_at
  before update on tela
  for each row execute function set_updated_at();

-- "variante" = un SKU concreto: un color de una tela, con su precio/stock/propiedades.
create table if not exists variante (
  id            uuid primary key default uuid_generate_v4(),
  tela_id       uuid not null references tela(id) on delete cascade,
  sku           text unique,                         -- UNIQUE pero NULLABLE (no inventamos SKU)
  color_id      uuid references color(id) on delete set null,
  acabado_id    uuid references acabado(id) on delete set null,
  precio_metro  numeric(10,2) check (precio_metro is null or precio_metro >= 0),  -- MXN por metro
  gramaje       integer       check (gramaje is null or gramaje >= 0),            -- g/m²
  stock         numeric(10,2) check (stock is null or stock >= 0),                -- metros disponibles
  es_bordado    boolean not null default false,
  es_brillante  boolean not null default false,
  es_traslucida boolean not null default false,
  es_tornasol   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_variante_updated_at on variante;
create trigger trg_variante_updated_at
  before update on variante
  for each row execute function set_updated_at();

create index if not exists idx_variante_tela    on variante(tela_id);
create index if not exists idx_variante_color   on variante(color_id);
create index if not exists idx_variante_precio  on variante(precio_metro);

-- "foto" = imagen en el bucket de Storage `telas`. Pertenece a una variante (color).
create table if not exists foto (
  id          uuid primary key default uuid_generate_v4(),
  variante_id uuid not null references variante(id) on delete cascade,
  ruta        text not null,            -- ruta DENTRO del bucket `telas` (no URL absoluta)
  orden       integer not null default 0,
  alt         text,
  created_at  timestamptz not null default now(),
  unique (variante_id, ruta)
);

create index if not exists idx_foto_variante on foto(variante_id, orden);

-- ---------------------------------------------------------------------------
-- 4. Relaciones N:N (a nivel modelo/tela)
-- ---------------------------------------------------------------------------
create table if not exists tela_caso_uso (
  tela_id     uuid not null references tela(id) on delete cascade,
  caso_uso_id uuid not null references caso_uso(id) on delete cascade,
  primary key (tela_id, caso_uso_id)
);

create table if not exists tela_oportunidad (
  tela_id        uuid not null references tela(id) on delete cascade,
  oportunidad_id uuid not null references oportunidad(id) on delete cascade,
  primary key (tela_id, oportunidad_id)
);

-- ---------------------------------------------------------------------------
-- 5. Índices de búsqueda (unaccent + trigram)
--    Permiten ILIKE '%texto%' rápido e insensible a acentos sobre nombre y SKU.
-- ---------------------------------------------------------------------------
create index if not exists idx_tela_nombre_trgm
  on tela using gin (f_unaccent(lower(nombre)) gin_trgm_ops);

create index if not exists idx_variante_sku_trgm
  on variante using gin (f_unaccent(lower(coalesce(sku, ''))) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 6. Vista aplanada para el frontend: catalogo_telas
--    Una fila por VARIANTE (SKU/color). El grid agrupa por tela_id para mostrar
--    una card por modelo con todos sus swatches.
-- ---------------------------------------------------------------------------
create or replace view catalogo_telas as
select
  v.id                       as variante_id,
  t.id                       as tela_id,
  t.slug                     as tela_slug,
  t.nombre                   as tela_nombre,
  t.descripcion              as descripcion,
  cat.nombre                 as categoria,
  cat.slug                   as categoria_slug,
  v.sku                      as sku,
  col.nombre                 as color_nombre,
  col.slug                   as color_slug,
  col.hex                    as color_hex,
  ac.nombre                  as acabado,
  v.precio_metro             as precio_metro,
  v.gramaje                  as gramaje,
  v.stock                    as stock,
  v.es_bordado               as es_bordado,
  v.es_brillante             as es_brillante,
  v.es_traslucida            as es_traslucida,
  v.es_tornasol              as es_tornasol,
  -- foto principal = la de menor orden de esta variante
  (select f.ruta
     from foto f
    where f.variante_id = v.id
    order by f.orden asc, f.created_at asc
    limit 1)                 as foto_principal,
  -- casos de uso y oportunidades (a nivel modelo) como arrays para filtrar/mostrar
  coalesce((
    select array_agg(cu.slug order by cu.nombre)
      from tela_caso_uso tcu
      join caso_uso cu on cu.id = tcu.caso_uso_id
     where tcu.tela_id = t.id
  ), '{}')                   as casos_uso,
  coalesce((
    select array_agg(o.slug order by o.nombre)
      from tela_oportunidad tox
      join oportunidad o on o.id = tox.oportunidad_id
     where tox.tela_id = t.id
  ), '{}')                   as oportunidades,
  t.created_at               as created_at,
  t.updated_at               as updated_at
from variante v
join tela t       on t.id = v.tela_id
left join categoria cat on cat.id = t.categoria_id
left join color col     on col.id = v.color_id
left join acabado ac    on ac.id = v.acabado_id;

-- ============================================================================
-- 7. Row Level Security
--    Lectura pública (anon) sobre el catálogo; escritura SOLO service_role,
--    que por defecto IGNORA RLS, así que basta con NO crear políticas de write.
-- ============================================================================
alter table color            enable row level security;
alter table categoria        enable row level security;
alter table acabado          enable row level security;
alter table caso_uso         enable row level security;
alter table oportunidad      enable row level security;
alter table tela             enable row level security;
alter table variante         enable row level security;
alter table foto             enable row level security;
alter table tela_caso_uso    enable row level security;
alter table tela_oportunidad enable row level security;

-- Política de SOLO lectura para anon + authenticated en todas las tablas del catálogo.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'color','categoria','acabado','caso_uso','oportunidad',
    'tela','variante','foto','tela_caso_uso','tela_oportunidad'
  ] loop
    execute format('drop policy if exists "lectura_publica" on %I;', tbl);
    execute format(
      'create policy "lectura_publica" on %I for select to anon, authenticated using (true);',
      tbl
    );
  end loop;
end $$;

-- ============================================================================
-- 8. Seed starter (editable luego desde /admin)
--    ON CONFLICT DO NOTHING → idempotente.
-- ============================================================================

insert into color (nombre, slug, hex) values
  ('Azul',        'azul',        '#2E5BB7'),
  ('Hueso',       'hueso',       '#EFE7D8'),
  ('Lila',        'lila',        '#B57EDC'),
  ('Menta',       'menta',       '#9ED9C0'),
  ('Verde Limón', 'verde-limon', '#B5D44B'),
  ('Magenta',     'magenta',     '#C2186A'),
  ('Negro',       'negro',       '#1A1714'),
  ('Cedrón',      'cedron',      '#E8743B')   -- "Shedron" en los archivos (coral/naranja)
on conflict (slug) do nothing;

insert into categoria (nombre, slug) values
  ('Chifón',      'chifon'),
  ('Tul',         'tul'),
  ('Tul Bordado', 'tul-bordado'),
  ('Encaje',      'encaje'),
  ('Satén',       'saten'),
  ('Organza',     'organza')
on conflict (slug) do nothing;

insert into acabado (nombre, slug) values
  ('Mate',      'mate'),
  ('Brillante', 'brillante'),
  ('Satinado',  'satinado'),
  ('Texturado', 'texturado')
on conflict (slug) do nothing;

insert into caso_uso (nombre, slug) values
  ('Vestido de noche', 'vestido-de-noche'),
  ('Vestido de fiesta','vestido-de-fiesta'),
  ('Velos',            'velos'),
  ('Decoración',       'decoracion'),
  ('Disfraces',        'disfraces'),
  ('Cortinas',         'cortinas'),
  ('Manualidades',     'manualidades')
on conflict (slug) do nothing;

insert into oportunidad (nombre, slug) values
  ('XV años',       'xv-anos'),
  ('Bodas',         'bodas'),
  ('Graduaciones',  'graduaciones'),
  ('Bautizos',      'bautizos'),
  ('Día de Muertos','dia-de-muertos'),
  ('Navidad',       'navidad'),
  ('Halloween',     'halloween')
on conflict (slug) do nothing;

-- ============================================================================
-- 9. Búsqueda de catálogo: buscar_telas(termino)
--    Envuelve la vista `catalogo_telas` (mismo tipo de retorno, `setof`) y
--    filtra con f_unaccent + ILIKE sobre nombre del modelo, color y SKU.
--    → insensible a acentos y a mayúsculas, soporta substrings ("limon"
--      encuentra "Verde Limón"; "CHLU99" encuentra el SKU). Reutiliza los
--      índices trigram de la sección 5.
--    Se llama desde el frontend vía RPC con la llave anon:
--      supabase.rpc('buscar_telas', { termino })
-- ============================================================================
create or replace function buscar_telas(termino text)
returns setof catalogo_telas
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
    from catalogo_telas c
   where f_unaccent(lower(c.tela_nombre))
           ilike '%' || f_unaccent(lower(termino)) || '%'
      or f_unaccent(lower(coalesce(c.color_nombre, '')))
           ilike '%' || f_unaccent(lower(termino)) || '%'
      or f_unaccent(lower(coalesce(c.sku, '')))
           ilike '%' || f_unaccent(lower(termino)) || '%'
   order by c.tela_nombre, c.color_nombre;
$$;

-- Lectura pública: la BD ya da SELECT a anon en las tablas base (sección 7);
-- aquí solo aseguramos que anon pueda EJECUTAR la función vía RPC.
grant execute on function buscar_telas(text) to anon, authenticated;

-- ============================================================================
-- 10. Inventario: kardex de movimientos por variante
--     Libro append-only que explica CADA cambio de stock (entrada, salida,
--     merma, ajuste). `variante.stock` sigue siendo la verdad "actual"; el
--     kardex es la historia. Lo escribe solo service_role (server actions
--     de /admin/inventario); lectura pública NO: es dato interno de tienda,
--     así que NO se crea política de SELECT para anon.
-- ============================================================================
create table if not exists movimiento_inventario (
  id               uuid primary key default uuid_generate_v4(),
  variante_id      uuid not null references variante(id) on delete cascade,
  -- entrada = llegó tela | salida = se vendió/cortó | merma = daño/pérdida
  -- ajuste = conteo físico: `cantidad` es el NUEVO stock absoluto, no un delta
  tipo             text not null check (tipo in ('entrada','salida','merma','ajuste')),
  cantidad         numeric(10,2) not null check (cantidad >= 0),   -- metros
  stock_resultante numeric(10,2) check (stock_resultante is null or stock_resultante >= 0),
  nota             text,
  usuario_email    text,                                           -- quién lo registró
  created_at       timestamptz not null default now()
);

create index if not exists idx_movimiento_variante
  on movimiento_inventario(variante_id, created_at desc);
create index if not exists idx_movimiento_fecha
  on movimiento_inventario(created_at desc);

alter table movimiento_inventario enable row level security;
-- Sin políticas: solo service_role (que ignora RLS) puede leer/escribir.

  -- ============================================================================
  -- 11. Orden manual de variantes (colores) dentro de cada tela
  --     El admin arrastra los colores en /admin/tela/[id] y ese orden manda en
  --     el selector de color del catálogo público. Menor `orden` = primero.
  -- ============================================================================
  alter table variante add column if not exists orden integer not null default 0;

  -- Backfill: conservar el orden actual (por antigüedad) para telas existentes.
  update variante v
    set orden = sub.rn
    from (
      select id, row_number() over (partition by tela_id order by created_at) - 1 as rn
        from variante
    ) sub
  where sub.id = v.id
    and v.orden = 0;          -- idempotente: no pisa un orden ya personalizado

  create index if not exists idx_variante_orden on variante(tela_id, orden);

  -- La vista gana `variante_orden` (al FINAL: `create or replace view` solo
  -- permite agregar columnas al final). El frontend ordena por ella.
  create or replace view catalogo_telas as
  select
    v.id                       as variante_id,
    t.id                       as tela_id,
    t.slug                     as tela_slug,
    t.nombre                   as tela_nombre,
    t.descripcion              as descripcion,
    cat.nombre                 as categoria,
    cat.slug                   as categoria_slug,
    v.sku                      as sku,
    col.nombre                 as color_nombre,
    col.slug                   as color_slug,
    col.hex                    as color_hex,
    ac.nombre                  as acabado,
    v.precio_metro             as precio_metro,
    v.gramaje                  as gramaje,
    v.stock                    as stock,
    v.es_bordado               as es_bordado,
    v.es_brillante             as es_brillante,
    v.es_traslucida            as es_traslucida,
    v.es_tornasol              as es_tornasol,
    (select f.ruta
      from foto f
      where f.variante_id = v.id
      order by f.orden asc, f.created_at asc
      limit 1)                 as foto_principal,
    coalesce((
      select array_agg(cu.slug order by cu.nombre)
        from tela_caso_uso tcu
        join caso_uso cu on cu.id = tcu.caso_uso_id
      where tcu.tela_id = t.id
    ), '{}')                   as casos_uso,
    coalesce((
      select array_agg(o.slug order by o.nombre)
        from tela_oportunidad tox
        join oportunidad o on o.id = tox.oportunidad_id
      where tox.tela_id = t.id
    ), '{}')                   as oportunidades,
    t.created_at               as created_at,
    t.updated_at               as updated_at,
    v.orden                    as variante_orden
  from variante v
  join tela t       on t.id = v.tela_id
  left join categoria cat on cat.id = t.categoria_id
  left join color col     on col.id = v.color_id
  left join acabado ac    on ac.id = v.acabado_id;

-- ============================================================================
-- 12. Derivados de imagen (pipeline sharp) — REQUIERE haber corrido la 11
--     (la vista de abajo incluye variante_orden).
--
--     `foto.derivados` (jsonb) guarda las versiones WebP pre-generadas del
--     original, que NO se toca:
--       { "sm": {"ruta": "derivados/sm/….webp", "ancho": 800,  "alto": 533},
--         "md": {…}, "lg": {…}, "generado_en": "2026-07-03T…" }
--     Las genera lib/images/derivados.ts (subida en /admin, ingesta y
--     `pnpm backfill:derivados`). NULL = pendiente de procesar.
-- ============================================================================
alter table foto add column if not exists derivados jsonb;

comment on column foto.derivados is
  'Versiones WebP pre-generadas (sm/md/lg) bajo derivados/ en el bucket. NULL = sin procesar.';

-- La vista vuelve a crecer SOLO por el final (create or replace no permite
-- reordenar columnas): se añade foto_principal_derivados tras variante_orden.
create or replace view catalogo_telas as
select
    v.id                       as variante_id,
    t.id                       as tela_id,
    t.slug                     as tela_slug,
    t.nombre                   as tela_nombre,
    t.descripcion              as descripcion,
    cat.nombre                 as categoria,
    cat.slug                   as categoria_slug,
    v.sku                      as sku,
    col.nombre                 as color_nombre,
    col.slug                   as color_slug,
    col.hex                    as color_hex,
    ac.nombre                  as acabado,
    v.precio_metro             as precio_metro,
    v.gramaje                  as gramaje,
    v.stock                    as stock,
    v.es_bordado               as es_bordado,
    v.es_brillante             as es_brillante,
    v.es_traslucida            as es_traslucida,
    v.es_tornasol              as es_tornasol,
    (select f.ruta
      from foto f
      where f.variante_id = v.id
      order by f.orden asc, f.created_at asc
      limit 1)                 as foto_principal,
    coalesce((
      select array_agg(cu.slug order by cu.nombre)
        from tela_caso_uso tcu
        join caso_uso cu on cu.id = tcu.caso_uso_id
      where tcu.tela_id = t.id
    ), '{}')                   as casos_uso,
    coalesce((
      select array_agg(o.slug order by o.nombre)
        from tela_oportunidad tox
        join oportunidad o on o.id = tox.oportunidad_id
      where tox.tela_id = t.id
    ), '{}')                   as oportunidades,
    t.created_at               as created_at,
    t.updated_at               as updated_at,
    v.orden                    as variante_orden,
    -- derivados de la MISMA foto que foto_principal (mismo order by)
    (select f.derivados
      from foto f
      where f.variante_id = v.id
      order by f.orden asc, f.created_at asc
      limit 1)                 as foto_principal_derivados
  from variante v
  join tela t       on t.id = v.tela_id
  left join categoria cat on cat.id = t.categoria_id
  left join color col     on col.id = v.color_id
  left join acabado ac    on ac.id = v.acabado_id;

-- PostgREST cachea el esquema: avisarle que cambió.
notify pgrst, 'reload schema';

-- ============================================================================
-- FIN del esquema
-- ============================================================================
