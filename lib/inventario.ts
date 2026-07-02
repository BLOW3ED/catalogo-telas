/**
 * Lógica pura de inventario (kardex). Sin dependencias de Next/Supabase para
 * poder probarla con vitest; la server action la usa para calcular el stock
 * resultante antes de escribir `variante.stock` + `movimiento_inventario`.
 */

export const TIPOS_MOVIMIENTO = ["entrada", "salida", "merma", "ajuste"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export function esTipoMovimiento(valor: string): valor is TipoMovimiento {
  return (TIPOS_MOVIMIENTO as readonly string[]).includes(valor);
}

/** Etiquetas para la UI del admin. */
export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: "Entrada (llegó tela)",
  salida: "Salida (venta/corte)",
  merma: "Merma (daño/pérdida)",
  ajuste: "Ajuste (conteo físico)",
};

/**
 * Metros bajo los cuales una variante se considera "stock bajo" en el
 * tablero de inventario. Ajustable por env sin tocar código.
 */
export function umbralStockBajo(): number {
  const env = Number(process.env.INVENTARIO_UMBRAL_BAJO);
  return Number.isFinite(env) && env > 0 ? env : 10;
}

/**
 * Aplica un movimiento al stock actual y regresa el stock resultante.
 *
 * Reglas de negocio:
 * - `entrada` suma; stock null (desconocido) se trata como 0: registrar una
 *   entrada implica que a partir de ahora SÍ llevamos la cuenta.
 * - `salida` y `merma` restan y NO pueden dejar stock negativo: si el sistema
 *   dice que hay menos tela de la que se está sacando, el conteo está mal y
 *   lo honesto es corregirlo primero con un `ajuste`.
 * - `ajuste` fija el stock al valor absoluto `cantidad` (resultado de un
 *   conteo físico), sin importar el valor anterior.
 * - `cantidad` siempre es ≥ 0; el TIPO define la dirección.
 */
export function aplicarMovimiento(
  stockActual: number | null,
  tipo: TipoMovimiento,
  cantidad: number
): number {
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw new Error(`Cantidad inválida: "${cantidad}". Usa un número mayor o igual a 0.`);
  }
  const cant = Math.round(cantidad * 100) / 100; // numeric(10,2)
  const actual = stockActual ?? 0;

  switch (tipo) {
    case "entrada":
      return Math.round((actual + cant) * 100) / 100;
    case "salida":
    case "merma": {
      if (cant > actual) {
        throw new Error(
          `No hay stock suficiente: se quieren sacar ${cant} m y el sistema registra ${actual} m. ` +
            `Si el conteo del sistema está mal, corrige primero con un ajuste.`
        );
      }
      return Math.round((actual - cant) * 100) / 100;
    }
    case "ajuste":
      return cant;
  }
}
