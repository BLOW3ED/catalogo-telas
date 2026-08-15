import type { DerivadosFoto } from "@/lib/types";

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

/** Orden canónico de los tamaños derivados, de menor a mayor. */
export const TAMANOS_DERIVADOS = ["sm", "md", "lg"] as const;
export type TamanoDerivado = (typeof TAMANOS_DERIVADOS)[number];

/**
 * Ruta dentro del bucket del derivado WebP de una foto original.
 * "chifon-lunares/azul-1.jpg" → "derivados/md/chifon-lunares/azul-1.webp".
 * El prefijo `derivados/` se puede borrar completo sin tocar originales.
 */
export function rutaDerivado(ruta: string, tamano: TamanoDerivado): string {
  const sinExt = ruta.replace(/^\/+/, "").replace(/\.[^./]+$/, "");
  return `derivados/${tamano}/${sinExt}.webp`;
}

/** Las tres rutas derivadas de un original (para borrarlas junto con él). */
export function rutasDerivados(ruta: string): string[] {
  return TAMANOS_DERIVADOS.map((t) => rutaDerivado(ruta, t));
}

/**
 * Sello de versión del lote de derivados, para romper caché cuando se vuelven
 * a generar.
 *
 * Las rutas de los derivados son deterministas, así que al re-hornear una foto
 * la URL NO cambia — y Supabase los sirve con `cache-control: max-age=3600`.
 * Sin esto, un visitante que ya cargó el catálogo sigue viendo la imagen vieja
 * hasta una hora. Medido tras la re-subida: la versión cacheada de una tira
 * traía el relleno espejo (banda superior sd 15.24) mientras el CDN ya servía
 * la corregida (sd 0.01).
 *
 * `generado_en` ya lo escribe `procesarFoto` en cada pasada, así que el sello
 * se mueve solo. Si falta, no se agrega nada (URL idéntica a la de antes).
 */
function sello(derivados: DerivadosFoto): string {
  const t = Date.parse(derivados.generado_en ?? "");
  return Number.isNaN(t) ? "" : `?v=${t}`;
}

/**
 * Arma el atributo `srcset` con los derivados disponibles usando su ancho
 * REAL (guardado al generarlos; en fotos verticales el ancho no es el lado
 * largo). Devuelve null si no hay ninguno → el caller cae al original.
 */
export function srcsetDerivados(
  derivados: DerivadosFoto | null | undefined
): string | null {
  if (!derivados) return null;
  const v = sello(derivados);
  const partes: string[] = [];
  for (const tamano of TAMANOS_DERIVADOS) {
    const d = derivados[tamano];
    const url = d && publicImageUrl(d.ruta);
    if (d && url) partes.push(`${url}${v} ${d.ancho}w`);
  }
  return partes.length > 0 ? partes.join(", ") : null;
}

/** URL del derivado preferido (con fallback en cascada) o null si no hay. */
export function urlDerivado(
  derivados: DerivadosFoto | null | undefined,
  preferido: TamanoDerivado
): string | null {
  if (!derivados) return null;
  const orden: TamanoDerivado[] = [
    preferido,
    ...TAMANOS_DERIVADOS.filter((t) => t !== preferido),
  ];
  const v = sello(derivados);
  for (const tamano of orden) {
    const url = publicImageUrl(derivados[tamano]?.ruta);
    if (url) return `${url}${v}`;
  }
  return null;
}

export const STORAGE_BUCKET = BUCKET;
