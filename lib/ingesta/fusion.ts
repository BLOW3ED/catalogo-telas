/**
 * Fusión del manifest de ingesta.
 *
 * Volver a correr `pnpm ingest` es normal — llegan fotos nuevas, se reprocesa
 * un lote con otra exposición — pero para entonces la tienda ya lleva horas
 * tecleando nombres y precios en el CSV. Regenerarlo desde cero borraría eso
 * sin avisar y sin forma de recuperarlo, así que las corridas posteriores
 * fusionan: lo capturado a mano gana, lo deducido del nombre de archivo solo
 * rellena huecos.
 */

/**
 * Columnas que llena la tienda y que la fusión NUNCA pisa. Quedan fuera las
 * que se derivan del nombre del archivo (`archivo`, `grupo`, `orden`), donde
 * manda el parser, y `notas`, que es mixta y se mezcla aparte.
 */
export const EDITABLES = [
  "sku", "modelo", "color", "precio", "unidad_venta", "piezas_por_unidad",
  "gramaje", "stock", "es_bordado", "es_brillante", "es_traslucida",
  "es_tornasol", "categoria", "casos_uso",
] as const;

export type Fila = Record<string, string>;

/**
 * Marca de las notas que escribe el parser. Existe porque `notas` es la única
 * columna mixta: sin distinguir el origen, la fusión no puede saber si
 * "corte SKU/toma dudoso" lo dedujo una corrida vieja (y hay que tirarlo
 * cuando deja de aplicar) o lo escribió la tienda (y hay que respetarlo).
 * De paso, al revisar el CSV se ve de un vistazo qué texto es generado.
 */
export const MARCA_AUTO = "[auto]";

/**
 * Mezcla `notas`: primero las deducidas en ESTA corrida, luego lo escrito a
 * mano. Las deducidas de corridas anteriores se tiran por su marca, así un
 * aviso que dejó de aplicar desaparece y ninguno se acumula duplicado.
 */
export function fusionaNotas(deducidas: string[], notaPrevia: string): string {
  const marcadas = deducidas.map((n) => `${MARCA_AUTO} ${n}`);
  const yaDeducida = new Set(deducidas);
  const propias = notaPrevia
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !s.startsWith(MARCA_AUTO))
    // Descarta también las que coinciden EXACTO con una deducida de ahora:
    // son notas automáticas escritas antes de que existiera la marca, y
    // conservarlas las duplicaría contra su propia versión marcada.
    .filter((s) => !yaDeducida.has(s));
  return [...marcadas, ...propias].join("; ");
}

/**
 * Lo que el parser dedujo en la corrida anterior, por archivo y columna.
 *
 * Sin esto la fusión no distingue "lo tecleó la tienda" de "lo dedujo un
 * parser más tonto que el de ahora", y conserva ambos. Pasó de verdad: al
 * añadirse la regla de flores, `Flor5Piedra20` pasó a leerse como diámetro 5,
 * pero el CSV seguía mostrando el `Flor5 Piedra20` que había producido el
 * parser genérico, porque la celda no estaba vacía. Comparando contra lo que
 * el parser puso la vez pasada se sabe si la celda sigue intacta.
 */
export type Procedencia = Record<string, Record<string, string>>;

/**
 * Devuelve la fila que debe quedar en el CSV. `nueva` es lo deducido ahora;
 * `previa` es la fila del CSV anterior (o undefined en la primera corrida);
 * `autoPrevio` es lo que el parser dedujo entonces para esa fila.
 *
 * Solo se considera "capturado" un valor no vacío tras `trim` y distinto de lo
 * que el parser había puesto. Una celda vacía no impide que el parser la
 * rellene después; una que el parser escribió, el parser la puede corregir.
 *
 * Sin `autoPrevio` (CSV de antes de que existiera el registro) se conserva
 * todo lo no vacío: es la opción prudente, porque confundir captura con
 * deducción y pisarla destruye trabajo, mientras que conservar de más solo
 * deja un valor viejo que se ve al revisar.
 */
export function fusionaFila(
  nueva: Fila,
  previa: Fila | undefined,
  deducidas: string[],
  autoPrevio?: Record<string, string>
): { fila: Fila; conservo: boolean } {
  const soloAuto = fusionaNotas(deducidas, "");
  const fila: Fila = { ...nueva, notas: soloAuto };
  if (!previa) return { fila, conservo: false };

  let conservo = false;
  for (const col of EDITABLES) {
    const valor = (previa[col] ?? "").trim();
    if (!valor || valor === fila[col]) continue;
    if (autoPrevio && (autoPrevio[col] ?? "") === valor) continue;  // lo puso el parser
    fila[col] = valor;
    conservo = true;
  }

  const notas = fusionaNotas(deducidas, previa.notas ?? "");
  if (notas !== soloAuto) conservo = true;
  fila.notas = notas;

  return { fila, conservo };
}

/** Lo que el parser dedujo para una fila, para compararlo en la próxima corrida. */
export function registroAuto(nueva: Fila): Record<string, string> {
  const reg: Record<string, string> = {};
  for (const col of EDITABLES) {
    const v = (nueva[col] ?? "").trim();
    if (v) reg[col] = v;
  }
  return reg;
}
