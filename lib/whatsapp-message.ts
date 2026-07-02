import type { CartItem } from "./store";

export const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/**
 * Arma el texto del pedido que se envía por WhatsApp desde el carrito.
 *
 * Honestidad de precios: si hay artículos sin precio o con precio de
 * referencia (demo), el mensaje lo dice explícito para que el cliente no
 * llegue citando un total que la tienda no fijó.
 */
export function buildQuoteMessage(items: CartItem[]): string {
  const total = items.reduce(
    (acc, item) => acc + (item.precio ?? 0) * item.cantidad,
    0
  );
  const haySinPrecio = items.some((item) => item.precio == null);
  const hayReferencia = items.some((item) => item.precio_referencia);

  let msg = "Hola, me interesa cotizar el siguiente pedido:\n\n";
  items.forEach((item) => {
    msg += `- ${item.cantidad}m de ${item.tela_nombre}`;
    if (item.color_nombre) msg += ` color ${item.color_nombre}`;
    if (item.sku) msg += ` (SKU: ${item.sku})`;
    if (item.precio == null) msg += " — precio por confirmar";
    msg += "\n";
  });
  if (total > 0) {
    msg += haySinPrecio
      ? `\nTotal parcial (sin los artículos por confirmar): ${pesos.format(total)} MXN.`
      : `\nTotal estimado: ${pesos.format(total)} MXN.`;
  }
  msg += hayReferencia || haySinPrecio
    ? "\n¿Me confirman precios y disponibilidad?"
    : "\n¿Me confirman disponibilidad?";
  return msg;
}
