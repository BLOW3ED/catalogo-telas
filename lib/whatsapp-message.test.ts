import { describe, expect, it } from "vitest";
import { buildQuoteMessage } from "./whatsapp-message";
import type { CartItem } from "./store";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "v1",
    tela_nombre: "Chifón Seda",
    color_nombre: "Rojo",
    sku: "CH-ROJO-01",
    precio: 89,
    cantidad: 3,
    foto_principal: null,
    ...overrides,
  };
}

describe("buildQuoteMessage", () => {
  it("incluye cantidad, tela, color y SKU de cada artículo", () => {
    const msg = buildQuoteMessage([item()]);
    expect(msg).toContain("- 3m de Chifón Seda color Rojo (SKU: CH-ROJO-01)");
  });

  it("omite color y SKU cuando no existen", () => {
    const msg = buildQuoteMessage([item({ color_nombre: null, sku: null })]);
    expect(msg).toContain("- 3m de Chifón Seda");
    expect(msg).not.toContain("color");
    expect(msg).not.toContain("SKU");
  });

  it("con todos los precios definidos, muestra 'Total estimado' y no pide precios", () => {
    const msg = buildQuoteMessage([item({ precio: 89, cantidad: 2 })]);
    expect(msg).toContain("Total estimado: $178.00 MXN.");
    expect(msg).toContain("¿Me confirman disponibilidad?");
    expect(msg).not.toContain("¿Me confirman precios y disponibilidad?");
  });

  it("con un artículo sin precio, marca 'por confirmar' y usa 'Total parcial'", () => {
    const msg = buildQuoteMessage([
      item({ precio: 89, cantidad: 1 }),
      item({
        id: "v2",
        tela_nombre: "Tul Ilusión",
        precio: null,
        sku: null,
        color_nombre: null,
        cantidad: 1,
      }),
    ]);
    expect(msg).toContain("- 1m de Tul Ilusión — precio por confirmar");
    expect(msg).toContain("Total parcial (sin los artículos por confirmar): $89.00 MXN.");
    expect(msg).toContain("¿Me confirman precios y disponibilidad?");
  });

  it("cuando el precio es de referencia (demo), también pide confirmar precios", () => {
    const msg = buildQuoteMessage([item({ precio_referencia: true })]);
    expect(msg).toContain("¿Me confirman precios y disponibilidad?");
  });

  it("con carrito vacío, no incluye línea de total", () => {
    const msg = buildQuoteMessage([]);
    expect(msg).not.toContain("Total");
    expect(msg).toContain("Hola, me interesa cotizar el siguiente pedido:");
  });

  it("con total en cero (todos sin precio), no incluye línea de total", () => {
    const msg = buildQuoteMessage([item({ precio: null })]);
    expect(msg).not.toContain("Total");
  });
});
