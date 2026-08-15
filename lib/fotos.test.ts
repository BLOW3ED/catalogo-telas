import { describe, expect, it } from "vitest";
import { construirSlides, contarFotosPorVariante, type FotoVariante } from "./fotos";
import type { CatalogoTela } from "./types";

function variante(overrides: Partial<CatalogoTela> = {}): CatalogoTela {
  return {
    variante_id: "var-1",
    tela_id: "tela-1",
    tela_slug: "gema",
    tela_nombre: "Gema",
    descripcion: null,
    categoria: "Piedra suelta",
    categoria_slug: "piedra-suelta",
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

function foto(overrides: Partial<FotoVariante> = {}): FotoVariante {
  return {
    id: "f1",
    variante_id: "var-1",
    ruta: "gema/gema00003.jpg",
    orden: 0,
    alt: null,
    derivados: null,
    ...overrides,
  };
}

describe("contarFotosPorVariante", () => {
  it("agrupa las fotos por variante", () => {
    const conteo = contarFotosPorVariante([
      { variante_id: "v1" },
      { variante_id: "v2" },
      { variante_id: "v1" },
      { variante_id: "v1" },
    ]);
    expect(conteo.get("v1")).toBe(3);
    expect(conteo.get("v2")).toBe(1);
  });

  it("una variante sin fotos no aparece en el mapa (el admin la lee como 0)", () => {
    const conteo = contarFotosPorVariante([{ variante_id: "v1" }]);
    expect(conteo.get("v2")).toBeUndefined();
    expect(conteo.get("v2") ?? 0).toBe(0);
  });

  it("sin fotos devuelve un mapa vacío", () => {
    expect(contarFotosPorVariante([]).size).toBe(0);
  });
});

describe("construirSlides", () => {
  it("expone TODAS las fotos de una variante única (el caso BNK3111)", () => {
    const v = variante({ variante_id: "v1", sku: "BNK3111" });
    const slides = construirSlides({
      variantes: [v],
      fotos: [
        foto({ id: "f1", variante_id: "v1", orden: 0 }),
        foto({ id: "f2", variante_id: "v1", orden: 1 }),
      ],
      seleccionada: v,
    });
    expect(slides.map((s) => s.id)).toEqual(["f1", "f2"]);
  });

  it("no toca la URL cuando no hay navegación por color", () => {
    const v = variante({ variante_id: "v1", color_slug: "oro", color_nombre: "Oro" });
    const slides = construirSlides({
      variantes: [v],
      fotos: [foto({ id: "f1", variante_id: "v1" }), foto({ id: "f2", variante_id: "v1", orden: 1 })],
      seleccionada: v,
    });
    // Un solo color direccionable → deslizar no debe reescribir `?color=`.
    expect(slides.every((s) => s.colorSlug === null)).toBe(true);
  });

  it("recorre todos los colores con sus fotos, en orden de variante", () => {
    const azul = variante({ variante_id: "v1", color_slug: "azul", color_nombre: "Azul" });
    const oro = variante({ variante_id: "v2", color_slug: "oro", color_nombre: "Oro" });
    const slides = construirSlides({
      variantes: [azul, oro],
      fotos: [
        foto({ id: "b2", variante_id: "v1", orden: 1 }),
        foto({ id: "b1", variante_id: "v1", orden: 0 }),
        foto({ id: "o1", variante_id: "v2", orden: 0 }),
      ],
      seleccionada: azul,
    });
    expect(slides.map((s) => s.id)).toEqual(["b1", "b2", "o1"]);
    expect(slides.map((s) => s.colorSlug)).toEqual(["azul", "azul", "oro"]);
  });

  it("deduplica por color: dos SKUs del mismo color no rebotan el carrusel", () => {
    // `?color=azul` siempre resuelve a la primera variante azul; si la segunda
    // aportara slides, deslizar hasta ella devolvería el scroll a la primera.
    const azul1 = variante({ variante_id: "v1", color_slug: "azul", sku: "A-1" });
    const azul2 = variante({ variante_id: "v2", color_slug: "azul", sku: "A-2" });
    const oro = variante({ variante_id: "v3", color_slug: "oro" });
    const slides = construirSlides({
      variantes: [azul1, azul2, oro],
      fotos: [
        foto({ id: "a1", variante_id: "v1" }),
        foto({ id: "a2", variante_id: "v2" }),
        foto({ id: "o1", variante_id: "v3" }),
      ],
      seleccionada: azul1,
    });
    expect(slides.map((s) => s.id)).toEqual(["a1", "o1"]);
  });

  it("excluye variantes sin color cuando la tela sí navega por color", () => {
    // Su foto mostraría el precio/SKU de otra variante: no es direccionable.
    const sinColor = variante({ variante_id: "v0" });
    const azul = variante({ variante_id: "v1", color_slug: "azul" });
    const oro = variante({ variante_id: "v2", color_slug: "oro" });
    const slides = construirSlides({
      variantes: [sinColor, azul, oro],
      fotos: [
        foto({ id: "x1", variante_id: "v0" }),
        foto({ id: "a1", variante_id: "v1" }),
        foto({ id: "o1", variante_id: "v2" }),
      ],
      seleccionada: azul,
    });
    expect(slides.map((s) => s.id)).toEqual(["a1", "o1"]);
  });

  it("cae a la variante hermana cuando la seleccionada no tiene fotos", () => {
    // Flor O4: quedó una variante vacía capturada de más y era la que salía
    // elegida — la ficha mostraba el marcador gris teniendo 3 fotos al lado.
    const vacia = variante({ variante_id: "v0" });
    const oro = variante({ variante_id: "v1", color_slug: "oro", color_nombre: "Oro" });
    const slides = construirSlides({
      variantes: [vacia, oro],
      fotos: [foto({ id: "o1", variante_id: "v1" }), foto({ id: "o2", variante_id: "v1", orden: 1 })],
      seleccionada: vacia,
    });
    expect(slides.map((s) => s.id)).toEqual(["o1", "o2"]);
  });

  it("devuelve lista vacía si ninguna variante tiene fotos", () => {
    const v = variante({ variante_id: "v1" });
    expect(construirSlides({ variantes: [v], fotos: [], seleccionada: v })).toEqual([]);
  });

  it("arrastra derivados y alt de cada foto", () => {
    const v = variante({ variante_id: "v1" });
    const derivados = { md: { ruta: "derivados/md/gema/gema00003.webp", ancho: 1600, alto: 1600 } };
    const [slide] = construirSlides({
      variantes: [v],
      fotos: [foto({ variante_id: "v1", alt: "Gema cristal", derivados })],
      seleccionada: v,
    });
    expect(slide.alt).toBe("Gema cristal");
    expect(slide.derivados).toEqual(derivados);
  });
});
