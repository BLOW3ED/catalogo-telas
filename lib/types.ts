/**
 * Tipos del dominio. `CatalogoTela` refleja 1:1 la vista `catalogo_telas`
 * (una fila por variante/SKU).
 */

/** Un tamaño derivado de una foto: ruta dentro del bucket + dimensiones reales. */
export type DerivadoImagen = {
  ruta: string;
  ancho: number;
  alto: number;
};

/**
 * Contenido de `foto.derivados` (jsonb): versiones WebP pre-generadas del
 * original (sm=grid, md=detalle, lg=zoom/WhatsApp). Todas las claves son
 * opcionales para tolerar fotos procesadas con estrategias anteriores.
 */
export type DerivadosFoto = {
  sm?: DerivadoImagen;
  md?: DerivadoImagen;
  lg?: DerivadoImagen;
  /** ISO timestamp de cuándo se generaron (auditoría/reproceso). */
  generado_en?: string;
};

export type CatalogoTela = {
  variante_id: string;
  tela_id: string;
  tela_slug: string;
  tela_nombre: string;
  descripcion: string | null;
  categoria: string | null;
  categoria_slug: string | null;
  sku: string | null;
  color_nombre: string | null;
  color_slug: string | null;
  color_hex: string | null;
  acabado: string | null;
  /**
   * ALIAS DEPRECADO de `precio`. El nombre engaña desde el lote de mercería:
   * es el precio por UNIDAD DE VENTA, que solo es el metro cuando
   * `unidad_venta === "metro"`. La vista sigue exponiendo ambos con el mismo
   * valor; para saber de qué unidad se habla, ver `unidad_venta`.
   */
  precio_metro: number | null;
  /**
   * Cómo se cobra y cómo se cuenta: metro | pieza | par | bolsa | rollo |
   * juego. Opcional porque la columna solo existe tras correr la sección 13
   * del SQL; sin ella todo se trata como metro, que es como se trataba antes.
   */
  unidad_venta?: string | null;
  /** Piezas que trae cada unidad empaquetada (una bolsa de 25 piedras). */
  piezas_por_unidad?: number | null;
  gramaje: number | null;
  stock: number | null;
  es_bordado: boolean;
  es_brillante: boolean;
  es_traslucida: boolean;
  es_tornasol: boolean;
  foto_principal: string | null;
  casos_uso: string[];
  oportunidades: string[];
  created_at: string;
  updated_at: string;
  /**
   * Posición manual del color dentro de su tela (menor = primero). Opcional
   * porque la columna solo existe tras correr la sección 11 del SQL; las
   * queries caen a ordenar por nombre de color si aún no está.
   */
  variante_orden?: number | null;
  /**
   * Derivados WebP de la foto principal. Opcional porque la columna solo
   * existe tras correr la sección 12 del SQL; sin ella el frontend cae al
   * original vía next/image.
   */
  foto_principal_derivados?: DerivadosFoto | null;
  /**
   * NO viene de la vista: lo añade `aplicarPreciosDemo` cuando rellena un
   * precio vacío con uno de referencia. Permite que la UI y el mensaje de
   * WhatsApp distingan precio real (BD) de precio demo.
   */
  precio_es_referencia?: boolean;
  /**
   * Talla/medida libre (diámetro de flor, ancho de tira, talla de copa…).
   * Opcional porque la columna solo existe tras correr la sección 14 del SQL.
   */
  medida?: string | null;
  /**
   * NULL = pendiente de revisión de catálogo. Con fecha = ya la revisó el
   * rol revisor. Opcional porque la columna solo existe tras la sección 14.
   */
  revisado_en?: string | null;
  /**
   * Nota libre del revisor (duda, pendiente, aviso a la tienda) — no es un
   * dato del producto, es un comentario sobre la revisión. Opcional porque
   * la columna solo existe tras correr la sección 15 del SQL.
   */
  nota?: string | null;
};

/**
 * Vista agrupada por modelo para el grid: una card por `tela`,
 * con todas sus variantes de color anidadas.
 */
export type TelaAgrupada = {
  tela_id: string;
  tela_slug: string;
  tela_nombre: string;
  categoria: string | null;
  precio_desde: number | null;
  /** ¿El `precio_desde` proviene de un precio demo (no capturado en la BD)? */
  precio_desde_es_referencia: boolean;
  /**
   * Unidad de la variante que puso el `precio_desde` — no la del modelo: es el
   * precio de ESA variante el que se muestra, así que el sufijo tiene que ser
   * el suyo o la card diría "$18/m" de algo que se cobra por bolsa.
   */
  precio_desde_unidad: string | null;
  variantes: CatalogoTela[];
};

/** Agrupa filas de la vista (por variante) en modelos para el grid. */
export function agruparPorModelo(filas: CatalogoTela[]): TelaAgrupada[] {
  const mapa = new Map<string, TelaAgrupada>();

  for (const fila of filas) {
    let grupo = mapa.get(fila.tela_id);
    if (!grupo) {
      grupo = {
        tela_id: fila.tela_id,
        tela_slug: fila.tela_slug,
        tela_nombre: fila.tela_nombre,
        categoria: fila.categoria,
        precio_desde: null,
        precio_desde_es_referencia: false,
        precio_desde_unidad: null,
        variantes: [],
      };
      mapa.set(fila.tela_id, grupo);
    }
    grupo.variantes.push(fila);

    // precio "desde" = el menor precio entre las variantes con precio;
    // arrastra si ese precio es real o de referencia (demo)
    if (fila.precio_metro != null) {
      if (grupo.precio_desde == null || fila.precio_metro < grupo.precio_desde) {
        grupo.precio_desde = fila.precio_metro;
        grupo.precio_desde_es_referencia = fila.precio_es_referencia ?? false;
        grupo.precio_desde_unidad = fila.unidad_venta ?? null;
      }
    }
  }

  return [...mapa.values()];
}
