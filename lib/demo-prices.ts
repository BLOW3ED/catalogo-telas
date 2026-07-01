/**
 * Precios de DEMO (capa de presentación, reversible).
 *
 * En la BD `variante.precio_metro` es NULLABLE y hoy muchos están vacíos
 * ("Precio a consultar"). Para las demos comerciales queremos que el catálogo
 * se vea completo con precios realistas, SIN tocar datos reales.
 *
 * Se activa SOLO con NEXT_PUBLIC_DEMO_PRICES=true. Si el flag está apagado,
 * `resolveDemoPrice` no hace nada y el precio real (o null) pasa intacto.
 *
 * Precios base por categoría en MXN/metro, pensados para venta al menudeo en
 * Fresnillo. Editables: cambia estos números para ajustar la demo.
 */

/** Precio base por `categoria_slug` (MXN por metro). */
const PRECIO_BASE_POR_CATEGORIA: Record<string, number> = {
  chifon: 59,
  tul: 45,
  "tul-bordado": 149,
  encaje: 129,
  saten: 89,
  organza: 69,
  // Extras por si el catálogo crece (aún no en el seed):
  terciopelo: 159,
  lino: 119,
  mezclilla: 95,
  popelina: 55,
  algodon: 55,
  lentejuela: 199,
  bordado: 199,
};

/** Precio de referencia cuando la categoría no está en el mapa. */
const PRECIO_DEFAULT = 79;

/** ¿Está activo el modo de precios demo? */
export function demoPricesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_PRICES === "true";
}

/**
 * Hash determinista y estable de un id → entero pequeño.
 * Da un offset reproducible (mismo id ⇒ mismo precio entre recargas), para que
 * las variantes de un mismo modelo no muestren todas el mismo número exacto.
 */
function offsetDeterminista(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  // 0..4 pasos de $5 ⇒ +$0, +$5, +$10, +$15, +$20
  return (Math.abs(h) % 5) * 5;
}

/**
 * Devuelve el precio demo para una fila del catálogo.
 * - Si el modo demo está apagado: regresa el precio real tal cual (puede ser null).
 * - Si ya hay precio real: lo respeta (no lo sobreescribe).
 * - Si el precio es null: calcula base(categoría) + offset(variante_id).
 */
export function resolveDemoPrice(row: {
  variante_id: string;
  categoria_slug: string | null;
  precio_metro: number | null;
}): number | null {
  if (!demoPricesEnabled()) return row.precio_metro;
  if (row.precio_metro != null) return row.precio_metro;

  const base =
    (row.categoria_slug && PRECIO_BASE_POR_CATEGORIA[row.categoria_slug]) ||
    PRECIO_DEFAULT;
  return base + offsetDeterminista(row.variante_id);
}

/**
 * Aplica `resolveDemoPrice` a una lista de filas del catálogo, devolviendo
 * copias con `precio_metro` resuelto. No muta las filas originales.
 */
export function aplicarPreciosDemo<
  T extends { variante_id: string; categoria_slug: string | null; precio_metro: number | null }
>(filas: T[]): T[] {
  if (!demoPricesEnabled()) return filas;
  return filas.map((f) => ({ ...f, precio_metro: resolveDemoPrice(f) }));
}
