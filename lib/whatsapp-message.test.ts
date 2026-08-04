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
    expect(msg).toContain("- 3 metros de Chifón Seda color Rojo (SKU: CH-ROJO-01)");
  });

  it("omite color y SKU cuando no existen", () => {
    const msg = buildQuoteMessage([item({ color_nombre: null, sku: null })]);
    expect(msg).toContain("- 3 metros de Chifón Seda");
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
    expect(msg).toContain("- 1 metro de Tul Ilusión — precio por confirmar");
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

describe("buildQuoteMessage · unidad de venta", () => {
  it("cuenta cada artículo en SU unidad, no siempre en metros", () => {
    // El mensaje lo lee quien surte el pedido: "2m de Piedra 1404" no se
    // puede despachar, porque esa piedra se vende por bolsa.
    const msg = buildQuoteMessage([
      item({ tela_nombre: "Piedra 1404", unidad_venta: "bolsa", cantidad: 2, color_nombre: null, sku: null }),
    ]);
    expect(msg).toContain("- 2 bolsas de Piedra 1404");
    expect(msg).not.toContain("2m");
  });

  it("dice cuántas piezas trae cada empaque", () => {
    const msg = buildQuoteMessage([
      item({ tela_nombre: "Piedra 1404", unidad_venta: "bolsa", piezas_por_unidad: 25, cantidad: 2, color_nombre: null, sku: null }),
    ]);
    expect(msg).toContain("- 2 bolsas (25 pz c/u) de Piedra 1404");
  });

  it("concuerda el singular", () => {
    const msg = buildQuoteMessage([
      item({ tela_nombre: "Botón BO12", unidad_venta: "pieza", cantidad: 1, color_nombre: null, sku: null }),
    ]);
    expect(msg).toContain("- 1 pieza de Botón BO12");
  });

  it("un carrito guardado antes de esta columna sigue contándose en metros", () => {
    // Los carritos viven en localStorage: los que ya estaban ahí no traen
    // `unidad_venta` y a nadie se le debe cambiar el pedido por eso.
    const msg = buildQuoteMessage([item({ cantidad: 3, unidad_venta: undefined })]);
    expect(msg).toContain("- 3 metros de Chifón Seda");
  });

  it("mezcla unidades en un mismo pedido sin confundirlas", () => {
    const msg = buildQuoteMessage([
      item({ tela_nombre: "Chifón Seda", cantidad: 2.5, color_nombre: null, sku: null }),
      item({ id: "v2", tela_nombre: "Botón BO12", unidad_venta: "pieza", cantidad: 12, color_nombre: null, sku: null }),
    ]);
    expect(msg).toContain("- 2.5 metros de Chifón Seda");
    expect(msg).toContain("- 12 piezas de Botón BO12");
  });
});
