/**
 * Tipos del dominio. `CatalogoTela` refleja 1:1 la vista `catalogo_telas`
 * (una fila por variante/SKU).
 */
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
  precio_metro: number | null;
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
        variantes: [],
      };
      mapa.set(fila.tela_id, grupo);
    }
    grupo.variantes.push(fila);

    // precio "desde" = el menor precio entre las variantes con precio
    if (fila.precio_metro != null) {
      grupo.precio_desde =
        grupo.precio_desde == null
          ? fila.precio_metro
          : Math.min(grupo.precio_desde, fila.precio_metro);
    }
  }

  return [...mapa.values()];
}
