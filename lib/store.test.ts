// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "./store";
import type { CatalogoTela } from "./types";

function variante(overrides: Partial<CatalogoTela> = {}): CatalogoTela {
  return {
    variante_id: "var-1",
    tela_id: "tela-1",
    tela_slug: "chifon-seda",
    tela_nombre: "Chifón Seda",
    descripcion: null,
    categoria: "Chifón",
    categoria_slug: "chifon",
    sku: "CH-01",
    color_nombre: "Rojo",
    color_slug: "rojo",
    color_hex: "#B91C1C",
    acabado: null,
    precio_metro: 89,
    gramaje: null,
    stock: 10,
    es_bordado: false,
    es_brillante: false,
    es_traslucida: false,
    es_tornasol: false,
    foto_principal: "chifon-seda/rojo.jpg",
    casos_uso: [],
    oportunidades: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false });
});

describe("useCartStore", () => {
  it("addItem agrega una variante nueva y abre el carrito", () => {
    useCartStore.getState().addItem(variante(), 2);
    const { items, isOpen } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "var-1", cantidad: 2, precio: 89 });
    expect(isOpen).toBe(true);
  });

  it("addItem con la misma variante suma cantidades en lugar de duplicar", () => {
    useCartStore.getState().addItem(variante(), 2);
    useCartStore.getState().addItem(variante(), 1.5);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].cantidad).toBe(3.5);
  });

  it("variantes distintas quedan como líneas separadas", () => {
    useCartStore.getState().addItem(variante({ variante_id: "var-1" }), 1);
    useCartStore.getState().addItem(variante({ variante_id: "var-2" }), 1);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("removeItem quita solo la línea indicada", () => {
    useCartStore.getState().addItem(variante({ variante_id: "var-1" }), 1);
    useCartStore.getState().addItem(variante({ variante_id: "var-2" }), 1);
    useCartStore.getState().removeItem("var-1");
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("var-2");
  });

  it("updateQuantity cambia la cantidad de una línea existente", () => {
    useCartStore.getState().addItem(variante(), 1);
    useCartStore.getState().updateQuantity("var-1", 5);
    expect(useCartStore.getState().items[0].cantidad).toBe(5);
  });

  it("clearCart vacía el carrito", () => {
    useCartStore.getState().addItem(variante(), 1);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("marca precio_referencia cuando la variante viene con precio_es_referencia", () => {
    useCartStore.getState().addItem(variante({ precio_es_referencia: true }), 1);
    expect(useCartStore.getState().items[0].precio_referencia).toBe(true);
  });
});
