import { describe, expect, it } from "vitest";
import { agruparPorModelo, type CatalogoTela } from "./types";

function variante(overrides: Partial<CatalogoTela> = {}): CatalogoTela {
  return {
    variante_id: "var-1",
    tela_id: "tela-1",
    tela_slug: "chifon-seda",
    tela_nombre: "Chifón Seda",
    descripcion: null,
    categoria: "Chifón",
    categoria_slug: "chifon",
    sku: null,
    color_nombre: null,
    color_slug: null,
    color_hex: null,
    acabado: null,
    precio_metro: null,
    gramaje: null,
    stock: null,
    es_bordado: false,
    es_brillante: false,
    es_traslucida: false,
    es_tornasol: false,
    foto_principal: null,
    casos_uso: [],
    oportunidades: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("agruparPorModelo", () => {
  it("agrupa variantes por tela_id en un solo modelo", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1" }),
      variante({ variante_id: "v2" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].variantes).toHaveLength(2);
  });

  it("separa modelos distintos por tela_id", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1", tela_id: "a" }),
      variante({ variante_id: "v2", tela_id: "b" }),
    ]);
    expect(grupos).toHaveLength(2);
  });

  it("precio_desde toma el menor precio entre las variantes con precio", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1", precio_metro: 120 }),
      variante({ variante_id: "v2", precio_metro: 89 }),
      variante({ variante_id: "v3", precio_metro: null }),
    ]);
    expect(grupos[0].precio_desde).toBe(89);
  });

  it("precio_desde es null cuando ninguna variante tiene precio", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1", precio_metro: null }),
      variante({ variante_id: "v2", precio_metro: null }),
    ]);
    expect(grupos[0].precio_desde).toBeNull();
  });

  it("precio_desde_es_referencia refleja si el precio mínimo actual es demo", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1", precio_metro: 100, precio_es_referencia: true }),
    ]);
    expect(grupos[0].precio_desde_es_referencia).toBe(true);
  });

  it("un precio real más bajo actualiza precio_desde_es_referencia a false", () => {
    const grupos = agruparPorModelo([
      variante({ variante_id: "v1", precio_metro: 100, precio_es_referencia: true }),
      variante({ variante_id: "v2", precio_metro: 50, precio_es_referencia: false }),
    ]);
    expect(grupos[0].precio_desde).toBe(50);
    expect(grupos[0].precio_desde_es_referencia).toBe(false);
  });
});
