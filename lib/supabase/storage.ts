const BUCKET = "telas";

/**
 * Construye la URL pública de una foto a partir de su ruta relativa
 * dentro del bucket `telas`. La BD guarda solo la ruta (ej. "chifon-lunares/azul-1.jpg").
 */
export function publicImageUrl(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = ruta.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${clean}`;
}

export const STORAGE_BUCKET = BUCKET;
