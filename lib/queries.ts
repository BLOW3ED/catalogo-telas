import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogoTela } from "@/lib/types";
import { aplicarPreciosDemo } from "@/lib/demo-prices";

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
};

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

const listarCatalogoCached = unstable_cache(
  async (limit: number, offset: number): Promise<CatalogoTela[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("catalogo_telas")
      .select("*")
      .order("tela_nombre", { ascending: true })
      .order("color_nombre", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return (data ?? []) as CatalogoTela[];
  },
  ["catalogo-listado"],
  { revalidate: REVALIDATE_SEGUNDOS, tags: ["catalogo"] }
);

const telaPorSlugCached = unstable_cache(
  async (slug: string): Promise<CatalogoTela[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("catalogo_telas")
      .select("*")
      .eq("tela_slug", slug)
      .order("color_nombre", { ascending: true });

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
 * Sin `q`: listado cacheado por (limit, offset), revalida cada 60s.
 * Con `q`: busca EN VIVO por nombre de modelo, color o SKU usando la función
 * `buscar_telas` (f_unaccent + pg_trgm → insensible a acentos). Los términos
 * de búsqueda son de cola larga, así que cachearlos aporta poco. Si esa función
 * aún no existe en la BD, cae a un ILIKE básico para no romper la búsqueda.
 */
export async function getCatalogo(
  { limit = 48, offset = 0, q }: { limit?: number; offset?: number; q?: string } = {}
): Promise<ResultadoCatalogo> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, configurado: false };
  }

  const termino = q?.trim();
  if (termino) {
    return buscarCatalogo(termino);
  }

  try {
    const data = await listarCatalogoCached(limit, offset);
    return { data: aplicarPreciosDemo(data), error: null, configurado: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    return { data: [], error: mensaje, configurado: true };
  }
}

async function buscarCatalogo(termino: string): Promise<ResultadoCatalogo> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("buscar_telas", { termino });

  // PGRST202 = la función no existe todavía → fallback ILIKE (sin acentos).
  if (error?.code === "PGRST202") {
    return buscarConIlike(supabase, termino);
  }
  if (error) {
    return { data: [], error: error.message, configurado: true };
  }
  return {
    data: aplicarPreciosDemo((data ?? []) as CatalogoTela[]),
    error: null,
    configurado: true,
  };
}

/**
 * Fallback de búsqueda mientras `buscar_telas` no esté creada en la BD.
 * ILIKE sobre la vista: funciona, pero es sensible a acentos. Se limpia el
 * término de caracteres que rompen la sintaxis del filtro `.or()` de PostgREST.
 */
async function buscarConIlike(
  supabase: SupabaseClient,
  termino: string
): Promise<ResultadoCatalogo> {
  const patron = `%${termino.replace(/[,()"\\]/g, " ")}%`;
  const { data, error } = await supabase
    .from("catalogo_telas")
    .select("*")
    .or(
      `tela_nombre.ilike.${patron},color_nombre.ilike.${patron},sku.ilike.${patron}`
    )
    .order("tela_nombre", { ascending: true })
    .order("color_nombre", { ascending: true });

  if (error) {
    return { data: [], error: error.message, configurado: true };
  }
  return {
    data: aplicarPreciosDemo((data ?? []) as CatalogoTela[]),
    error: null,
    configurado: true,
  };
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
