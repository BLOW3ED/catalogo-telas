import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogoTela } from "@/lib/types";
import { aplicarPreciosDemo } from "@/lib/demo-prices";
import {
  type Filtros,
  FILTROS_VACIOS,
  PROPIEDADES,
  aQuerystring,
} from "@/lib/filtros";

/** ¿Están las variables de entorno de Supabase configuradas? */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export type ResultadoCatalogo = {
  data: CatalogoTela[];
  error: string | null;
  configurado: boolean;
  /**
   * Cuántos MODELOS cumplen los filtros en total — no cuántas filas ni cuántos
   * se están mostrando. Es el número del contador y lo que decide si queda
   * "Ver más".
   */
  totalModelos: number;
};

/** Cuántos modelos trae cada "Ver más". */
export const MODELOS_POR_PAGINA = 48;

/**
 * Caché de datos (no de ruta): las páginas son dinámicas porque leen
 * `searchParams`, así que el `revalidate` a nivel página no aplica. En cambio,
 * `unstable_cache` sí cachea el RESULTADO de la query entre requests, con
 * revalidación cada 60s → cada visita ya no pega a Supabase.
 *
 * Las funciones cacheadas LANZAN en error: `unstable_cache` no guarda
 * excepciones, así que un fallo transitorio no queda cacheado 60s.
 */
const REVALIDATE_SEGUNDOS = 60;

/** 42703 = "undefined_column": la sección 11 del SQL (variante_orden) aún no corre. */
const COLUMNA_INEXISTENTE = "42703";
/** PGRST202 = la función `buscar_telas` todavía no existe en la BD. */
const FUNCION_INEXISTENTE = "PGRST202";

/**
 * PostgREST devuelve el mismo builder en cada `.in()/.eq()/.gt()`, pero
 * tiparlo exactamente obliga a arrastrar los genéricos de la vista por todo el
 * módulo. Este alias acota el `any` a un solo lugar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = any;

/**
 * Traduce los filtros a condiciones SQL sobre la vista `catalogo_telas`.
 *
 * FILTRA A NIVEL VARIANTE, no modelo: al filtrar "oro", la card del modelo
 * muestra solo sus variantes doradas (un swatch), no todos sus colores. Es lo
 * que espera quien filtró —pidió oro, ve oro— y además hace que el "desde $X"
 * de la card corresponda a lo que quedó visible.
 *
 * El precio NO se filtra aquí: los precios de demo se rellenan en JS después
 * de la query (`aplicarPreciosDemo`), así que un `lte` en SQL descartaría
 * productos que en pantalla sí muestran un precio dentro del tope.
 */
function aplicarFiltros(q: Consulta, f: Filtros): Consulta {
  if (f.categorias.length) q = q.in("categoria_slug", f.categorias);
  if (f.colores.length) q = q.in("color_slug", f.colores);
  // Varias propiedades = intersección: "bordado + brillante" pide las dos.
  for (const clave of f.propiedades) {
    const prop = PROPIEDADES.find((p) => p.clave === clave);
    if (prop) q = q.eq(prop.columna, true);
  }
  if (f.soloDisponibles) q = q.gt("stock", 0);
  return q;
}

/** Se aplica tras los precios de demo, para filtrar por lo que se ve en pantalla. */
function filtrarPorPrecio(filas: CatalogoTela[], precioMax: number | null): CatalogoTela[] {
  if (precioMax == null) return filas;
  // Sin precio no se puede afirmar que esté dentro del tope: se descarta.
  return filas.filter((f) => f.precio_metro != null && f.precio_metro <= precioMax);
}

/**
 * Ordena las filas de una consulta igual que el grid: por modelo, y dentro de
 * cada modelo por el orden manual de colores. `variante_orden` solo existe tras
 * la sección 11 del SQL, de ahí el reintento sin ella.
 */
async function leerOrdenado(consulta: () => Consulta): Promise<CatalogoTela[]> {
  const conOrdenManual = () =>
    consulta()
      .order("tela_nombre", { ascending: true })
      .order("variante_orden", { ascending: true })
      .order("color_nombre", { ascending: true });

  const sinOrdenManual = () =>
    consulta()
      .order("tela_nombre", { ascending: true })
      .order("color_nombre", { ascending: true });

  let { data, error } = await conOrdenManual();
  if (error?.code === COLUMNA_INEXISTENTE) ({ data, error } = await sinOrdenManual());

  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogoTela[];
}

/**
 * Una página del catálogo, PAGINADA POR MODELO.
 * ---------------------------------------------------------------------------
 * La vista trae una fila por VARIANTE pero el grid pinta una card por MODELO,
 * así que paginar por filas parte un modelo entre dos páginas: la card sale
 * con la mitad de sus colores y el "desde $X" cambia según en qué página caiga.
 * Por eso son dos lecturas:
 *
 *   1. Qué modelos cumplen los filtros, en orden. Proyección mínima
 *      (tela_id + nombre), que es barata aunque el catálogo crezca, y de paso
 *      da el TOTAL honesto de productos para el contador.
 *   2. Todas las filas de los modelos de esta página. Vuelve a aplicar los
 *      filtros de variante para que "oro" siga mostrando solo los dorados.
 *
 * Los grupos se reordenan al final según la lista del paso 1: si dos modelos
 * se llaman igual, el orden entre ellos ya no depende de cómo desempate SQL en
 * cada una de las dos consultas.
 */
const paginaCatalogoCached = unstable_cache(
  async (
    filtrosJson: string,
    hasta: number
  ): Promise<{ filas: CatalogoTela[]; totalModelos: number }> => {
    const filtros = JSON.parse(filtrosJson) as Filtros;
    const supabase = createPublicClient();

    const ordenados = await leerOrdenado(() =>
      aplicarFiltros(supabase.from("catalogo_telas").select("tela_id,tela_nombre"), filtros)
    );

    // Dedupe preservando el orden: una fila por variante, un id por modelo.
    const ids: string[] = [];
    const vistos = new Set<string>();
    for (const f of ordenados) {
      if (vistos.has(f.tela_id)) continue;
      vistos.add(f.tela_id);
      ids.push(f.tela_id);
    }

    const pagina = ids.slice(0, hasta);
    if (pagina.length === 0) return { filas: [], totalModelos: ids.length };

    const filas = await leerOrdenado(() =>
      aplicarFiltros(supabase.from("catalogo_telas").select("*"), filtros).in("tela_id", pagina)
    );

    const posicion = new Map(pagina.map((id, i) => [id, i]));
    filas.sort((a, b) => (posicion.get(a.tela_id) ?? 0) - (posicion.get(b.tela_id) ?? 0));

    return { filas, totalModelos: ids.length };
  },
  ["catalogo-pagina"],
  { revalidate: REVALIDATE_SEGUNDOS, tags: ["catalogo"] }
);

const telaPorSlugCached = unstable_cache(
  async (slug: string): Promise<CatalogoTela[]> => {
    const supabase = createPublicClient();
    let { data, error } = await supabase
      .from("catalogo_telas")
      .select("*")
      .eq("tela_slug", slug)
      .order("variante_orden", { ascending: true })
      .order("color_nombre", { ascending: true });

    if (error?.code === COLUMNA_INEXISTENTE) {
      ({ data, error } = await supabase
        .from("catalogo_telas")
        .select("*")
        .eq("tela_slug", slug)
        .order("color_nombre", { ascending: true }));
    }

    if (error) throw new Error(error.message);
    return (data ?? []) as CatalogoTela[];
  },
  ["catalogo-tela"],
  { revalidate: REVALIDATE_SEGUNDOS, tags: ["catalogo"] }
);

/**
 * Lee la vista `catalogo_telas` (una fila por variante).
 * Server-side, llave anon → respeta RLS de lectura pública.
 *
 * Sin `q`: listado cacheado por (filtros, limit, offset), revalida cada 60s.
 * Con `q`: busca EN VIVO por nombre de modelo, color o SKU usando la función
 * `buscar_telas` (f_unaccent + pg_trgm → insensible a acentos). Los términos
 * de búsqueda son de cola larga, así que cachearlos aporta poco. Si esa función
 * aún no existe en la BD, cae a un ILIKE básico para no romper la búsqueda.
 *
 * Los filtros de chip se aplican en AMBOS caminos: buscar "piedra" y luego
 * acotar a "Piedra suelta" tiene que funcionar igual que sin búsqueda.
 */
export async function getCatalogo(
  { hasta = MODELOS_POR_PAGINA, filtros = FILTROS_VACIOS }:
    { hasta?: number; filtros?: Filtros } = {}
): Promise<ResultadoCatalogo> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, configurado: false, totalModelos: 0 };
  }

  const termino = filtros.q?.trim();
  if (termino) return buscarCatalogo(termino, filtros, hasta);

  try {
    // El JSON de filtros forma parte de la llave de caché: dos combinaciones
    // distintas no pueden compartir resultado.
    const { filas, totalModelos } = await paginaCatalogoCached(JSON.stringify(filtros), hasta);
    return {
      data: filtrarPorPrecio(aplicarPreciosDemo(filas), filtros.precioMax),
      error: null,
      configurado: true,
      totalModelos,
    };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    return { data: [], error: mensaje, configurado: true, totalModelos: 0 };
  }
}

/**
 * Recorta un resultado de búsqueda a los primeros `hasta` MODELOS.
 * La búsqueda no se pagina en SQL —`buscar_telas` devuelve el conjunto
 * completo y el propio término ya lo acota— así que se corta aquí, cuidando
 * de no partir un modelo: se cuentan modelos, no filas.
 */
export function recortarAModelos(
  filas: CatalogoTela[],
  hasta: number
): { filas: CatalogoTela[]; totalModelos: number } {
  const orden: string[] = [];
  const vistos = new Set<string>();
  for (const f of filas) {
    if (vistos.has(f.tela_id)) continue;
    vistos.add(f.tela_id);
    orden.push(f.tela_id);
  }
  const permitidos = new Set(orden.slice(0, hasta));
  return {
    filas: filas.filter((f) => permitidos.has(f.tela_id)),
    totalModelos: orden.length,
  };
}

async function buscarCatalogo(
  termino: string,
  filtros: Filtros,
  hasta: number
): Promise<ResultadoCatalogo> {
  const supabase = createPublicClient();
  const { data, error } = await aplicarFiltros(
    supabase.rpc("buscar_telas", { termino }),
    filtros
  );

  if (error?.code === FUNCION_INEXISTENTE) return buscarConIlike(supabase, termino, filtros, hasta);
  if (error) return { data: [], error: error.message, configurado: true, totalModelos: 0 };

  const conPrecio = filtrarPorPrecio(
    aplicarPreciosDemo((data ?? []) as CatalogoTela[]),
    filtros.precioMax
  );
  const { filas, totalModelos } = recortarAModelos(conPrecio, hasta);
  return { data: filas, error: null, configurado: true, totalModelos };
}

/**
 * Fallback de búsqueda mientras `buscar_telas` no esté creada en la BD.
 * ILIKE sobre la vista: funciona, pero es sensible a acentos. Se limpia el
 * término de caracteres que rompen la sintaxis del filtro `.or()` de PostgREST.
 */
async function buscarConIlike(
  supabase: SupabaseClient,
  termino: string,
  filtros: Filtros,
  hasta: number
): Promise<ResultadoCatalogo> {
  const patron = `%${termino.replace(/[,()"\\]/g, " ")}%`;
  const { data, error } = await aplicarFiltros(
    supabase.from("catalogo_telas").select("*"),
    filtros
  )
    .or(`tela_nombre.ilike.${patron},color_nombre.ilike.${patron},sku.ilike.${patron}`)
    .order("tela_nombre", { ascending: true })
    .order("color_nombre", { ascending: true });

  if (error) return { data: [], error: error.message, configurado: true, totalModelos: 0 };

  const conPrecio = filtrarPorPrecio(
    aplicarPreciosDemo((data ?? []) as CatalogoTela[]),
    filtros.precioMax
  );
  const { filas, totalModelos } = recortarAModelos(conPrecio, hasta);
  return { data: filas, error: null, configurado: true, totalModelos };
}

/**
 * Todas las variantes (colores) de un modelo, por su slug.
 * Para la página de detalle `/tela/[slug]`. Lista vacía → 404 en la página.
 * Lectura cacheada (60s), igual que el listado.
 */
export async function getTelaPorSlug(slug: string): Promise<CatalogoTela[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const data = await telaPorSlugCached(slug);
    return aplicarPreciosDemo(data);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Facetas: qué chips pintar y con cuántos productos cada uno
// ---------------------------------------------------------------------------

export type Faceta = {
  slug: string;
  nombre: string;
  /** Solo colores: para pintar el punto del chip. */
  hex?: string | null;
  /** Cuántos MODELOS (no variantes) caen aquí. */
  conteo: number;
};

export type Facetas = {
  categorias: Faceta[];
  colores: Faceta[];
  propiedades: { clave: string; etiqueta: string; conteo: number }[];
  /** ¿Alguien tiene stock capturado? Si no, el chip de disponibilidad sobra. */
  hayStock: boolean;
};

export const FACETAS_VACIAS: Facetas = {
  categorias: [],
  colores: [],
  propiedades: [],
  hayStock: false,
};

/** Fila mínima para contar facetas: se pide poco para que la lectura sea barata. */
type FilaFaceta = Pick<
  CatalogoTela,
  | "tela_id"
  | "categoria"
  | "categoria_slug"
  | "color_nombre"
  | "color_slug"
  | "color_hex"
  | "stock"
  | "es_bordado"
  | "es_brillante"
  | "es_traslucida"
  | "es_tornasol"
>;

const COLUMNAS_FACETA =
  "tela_id,categoria,categoria_slug,color_nombre,color_slug,color_hex,stock," +
  PROPIEDADES.map((p) => p.columna).join(",");

const facetasCached = unstable_cache(
  async (): Promise<Facetas> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("catalogo_telas").select(COLUMNAS_FACETA);
    if (error) throw new Error(error.message);
    return contarFacetas((data ?? []) as unknown as FilaFaceta[]);
  },
  ["catalogo-facetas"],
  { revalidate: REVALIDATE_SEGUNDOS, tags: ["catalogo"] }
);

/**
 * Cuenta MODELOS por faceta, no variantes: la card del grid es un modelo, así
 * que "Flores (5)" tiene que querer decir cinco cards, no cinco fotos.
 *
 * Exportada para poder probarla sin BD.
 */
export function contarFacetas(filas: FilaFaceta[]): Facetas {
  const porCategoria = new Map<string, { nombre: string; telas: Set<string> }>();
  const porColor = new Map<string, { nombre: string; hex: string | null; telas: Set<string> }>();
  const porPropiedad = new Map<string, Set<string>>();
  let hayStock = false;

  for (const f of filas) {
    if (f.categoria_slug && f.categoria) {
      const e = porCategoria.get(f.categoria_slug) ?? { nombre: f.categoria, telas: new Set() };
      e.telas.add(f.tela_id);
      porCategoria.set(f.categoria_slug, e);
    }
    if (f.color_slug && f.color_nombre) {
      const e =
        porColor.get(f.color_slug) ?? { nombre: f.color_nombre, hex: f.color_hex, telas: new Set() };
      e.telas.add(f.tela_id);
      porColor.set(f.color_slug, e);
    }
    for (const p of PROPIEDADES) {
      if (!f[p.columna]) continue;
      const s = porPropiedad.get(p.clave) ?? new Set<string>();
      s.add(f.tela_id);
      porPropiedad.set(p.clave, s);
    }
    if (f.stock != null && f.stock > 0) hayStock = true;
  }

  const porConteoLuegoNombre = (a: Faceta, b: Faceta) =>
    b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, "es");

  return {
    categorias: [...porCategoria.entries()]
      .map(([slug, e]) => ({ slug, nombre: e.nombre, conteo: e.telas.size }))
      .sort(porConteoLuegoNombre),
    colores: [...porColor.entries()]
      .map(([slug, e]) => ({ slug, nombre: e.nombre, hex: e.hex, conteo: e.telas.size }))
      .sort(porConteoLuegoNombre),
    // Solo las propiedades que alguien tiene: sin esto la portada pinta cuatro
    // chips ("Bordado", "Brillante"…) que no filtran nada porque nadie las
    // capturó. Los chips aparecen solos conforme la tienda llene esos datos.
    propiedades: PROPIEDADES.filter((p) => porPropiedad.has(p.clave)).map((p) => ({
      clave: p.clave,
      etiqueta: p.etiqueta,
      conteo: porPropiedad.get(p.clave)!.size,
    })),
    hayStock,
  };
}

/**
 * Facetas del catálogo COMPLETO, no del resultado filtrado: los conteos de los
 * chips no bailan al picar uno, y nunca queda un chip que ya no se puede
 * despicar porque desapareció de la lista.
 */
export async function getFacetas(): Promise<Facetas> {
  if (!isSupabaseConfigured()) return FACETAS_VACIAS;
  try {
    return await facetasCached();
  } catch {
    return FACETAS_VACIAS;
  }
}

/** Firma estable de unos filtros; útil como `key` de Suspense en la portada. */
export function firmaFiltros(filtros: Filtros): string {
  return aQuerystring(filtros);
}
