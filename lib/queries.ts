import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogoTela } from "@/lib/types";

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
 * Lee la vista `catalogo_telas` (una fila por variante).
 * Server-side, llave anon → respeta RLS de lectura pública.
 *
 * Con `q`: busca por nombre de modelo, color o SKU usando la función
 * `buscar_telas` (f_unaccent + pg_trgm → insensible a acentos). Si esa función
 * aún no existe en la BD, cae a un ILIKE básico para no romper la búsqueda.
 */
export async function getCatalogo(
  { limit = 48, offset = 0, q }: { limit?: number; offset?: number; q?: string } = {}
): Promise<ResultadoCatalogo> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, configurado: false };
  }

  const supabase = await createClient();
  const termino = q?.trim();

  if (termino) {
    const { data, error } = await supabase.rpc("buscar_telas", { termino });
    // PGRST202 = la función no existe todavía → fallback ILIKE (sin acentos).
    if (error?.code === "PGRST202") {
      return buscarConIlike(supabase, termino);
    }
    if (error) {
      return { data: [], error: error.message, configurado: true };
    }
    return { data: (data ?? []) as CatalogoTela[], error: null, configurado: true };
  }

  const { data, error } = await supabase
    .from("catalogo_telas")
    .select("*")
    .order("tela_nombre", { ascending: true })
    .order("color_nombre", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return { data: [], error: error.message, configurado: true };
  }

  return { data: (data ?? []) as CatalogoTela[], error: null, configurado: true };
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
  return { data: (data ?? []) as CatalogoTela[], error: null, configurado: true };
}

/**
 * Todas las variantes (colores) de un modelo, por su slug.
 * Para la página de detalle `/tela/[slug]`. Lista vacía → 404 en la página.
 */
export async function getTelaPorSlug(slug: string): Promise<CatalogoTela[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_telas")
    .select("*")
    .eq("tela_slug", slug)
    .order("color_nombre", { ascending: true });

  if (error) return [];
  return (data ?? []) as CatalogoTela[];
}
