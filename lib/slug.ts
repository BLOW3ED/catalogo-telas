/**
 * Slug url-safe: sin acentos, alfanumérico con guiones.
 * Mismo comportamiento que el slugify del script de ingesta — la BD exige
 * slugs únicos y el frontend los usa en /tela/[slug].
 */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
