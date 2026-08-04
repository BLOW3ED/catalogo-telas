import { describe, it, expect } from "vitest";
import { contarFacetas, recortarAModelos } from "./queries";

/** Una fila de la vista, con lo mínimo que mira `contarFacetas`. */
function fila(over: Partial<Parameters<typeof contarFacetas>[0][number]> = {}) {
  return {
    tela_id: "t1",
    categoria: "Piedra suelta",
    categoria_slug: "piedra-suelta",
    color_nombre: null,
    color_slug: null,
    color_hex: null,
    stock: null,
    es_bordado: false,
    es_brillante: false,
    es_traslucida: false,
    es_tornasol: false,
    ...over,
  } as Parameters<typeof contarFacetas>[0][number];
}

describe("contarFacetas", () => {
  it("cuenta MODELOS, no variantes: la card del grid es un modelo", () => {
    // Un modelo con tres colores es UNA card, no tres.
    const f = contarFacetas([
      fila({ tela_id: "t1", color_slug: "oro", color_nombre: "Oro" }),
      fila({ tela_id: "t1", color_slug: "plata", color_nombre: "Plata" }),
      fila({ tela_id: "t1", color_slug: "hueso", color_nombre: "Hueso" }),
    ]);
    expect(f.categorias).toEqual([{ slug: "piedra-suelta", nombre: "Piedra suelta", conteo: 1 }]);
  });

  it("cuenta un modelo una sola vez por color aunque repita ese color", () => {
    const f = contarFacetas([
      fila({ tela_id: "t1", color_slug: "oro", color_nombre: "Oro" }),
      fila({ tela_id: "t1", color_slug: "oro", color_nombre: "Oro" }),
      fila({ tela_id: "t2", color_slug: "oro", color_nombre: "Oro" }),
    ]);
    expect(f.colores).toEqual([{ slug: "oro", nombre: "Oro", hex: null, conteo: 2 }]);
  });

  it("ordena por cantidad y desempata por nombre en español", () => {
    const f = contarFacetas([
      fila({ tela_id: "t1", categoria: "Copas", categoria_slug: "copas" }),
      fila({ tela_id: "t2", categoria: "Botones", categoria_slug: "botones" }),
      fila({ tela_id: "t3", categoria: "Botones", categoria_slug: "botones" }),
      fila({ tela_id: "t4", categoria: "Ánfora", categoria_slug: "anfora" }),
    ]);
    expect(f.categorias.map((c) => c.nombre)).toEqual(["Botones", "Ánfora", "Copas"]);
  });

  it("omite las filas sin categoría o sin color en vez de inventar un cajón", () => {
    const f = contarFacetas([
      fila({ categoria: null, categoria_slug: null }),
      fila({ tela_id: "t2", color_slug: null, color_nombre: null }),
    ]);
    expect(f.categorias.map((c) => c.slug)).toEqual(["piedra-suelta"]);
    expect(f.colores).toEqual([]);
  });

  it("solo devuelve las propiedades que algún producto tiene", () => {
    // Sin esto la portada pinta cuatro chips que no filtran nada.
    const f = contarFacetas([
      fila({ tela_id: "t1", es_bordado: true }),
      fila({ tela_id: "t2", es_bordado: true }),
      fila({ tela_id: "t3" }),
    ]);
    expect(f.propiedades).toEqual([{ clave: "bordado", etiqueta: "Bordado", conteo: 2 }]);
  });

  it("avisa si nadie tiene stock capturado, para no pintar ese chip", () => {
    expect(contarFacetas([fila({ stock: null }), fila({ stock: 0 })]).hayStock).toBe(false);
    expect(contarFacetas([fila({ stock: 3 })]).hayStock).toBe(true);
  });

  it("un catálogo vacío no truena", () => {
    expect(contarFacetas([])).toEqual({
      categorias: [],
      colores: [],
      propiedades: [],
      hayStock: false,
    });
  });
});

describe("recortarAModelos", () => {
  /** Filas de la vista: una por variante, varias por modelo. */
  const filas = (...pares: [string, string][]) =>
    pares.map(([tela_id, color]) => ({ tela_id, color_slug: color })) as never[];

  it("corta por MODELO, no por fila: nunca parte un modelo a la mitad", () => {
    // Éste es el bug que motivó paginar así: si se corta por filas, la card
    // del modelo B saldría con un solo color y un "desde $X" equivocado.
    const r = recortarAModelos(
      filas(["A", "rojo"], ["A", "azul"], ["B", "oro"], ["B", "plata"], ["C", "negro"]),
      2
    );
    expect(r.filas.map((f) => f.tela_id)).toEqual(["A", "A", "B", "B"]);
    expect(r.totalModelos).toBe(3);
  });

  it("cuenta modelos, no filas, en el total", () => {
    const r = recortarAModelos(filas(["A", "r"], ["A", "a"], ["A", "v"]), 48);
    expect(r.totalModelos).toBe(1);
    expect(r.filas).toHaveLength(3);
  });

  it("respeta el orden en que llegan los modelos", () => {
    const r = recortarAModelos(filas(["C", "x"], ["A", "y"], ["B", "z"]), 2);
    expect(r.filas.map((f) => f.tela_id)).toEqual(["C", "A"]);
  });

  it("devuelve todo cuando caben todos", () => {
    const r = recortarAModelos(filas(["A", "x"], ["B", "y"]), 48);
    expect(r.filas).toHaveLength(2);
    expect(r.totalModelos).toBe(2);
  });

  it("no truena con lista vacía", () => {
    expect(recortarAModelos([], 48)).toEqual({ filas: [], totalModelos: 0 });
  });

  it("junta las filas de un modelo aunque lleguen separadas", () => {
    // Defensivo: si el orden de SQL intercalara dos modelos, el recorte no
    // debe dejar fuera la mitad de uno que sí entró.
    const r = recortarAModelos(filas(["A", "x"], ["B", "y"], ["A", "z"]), 1);
    expect(r.filas.map((f) => f.tela_id)).toEqual(["A", "A"]);
  });
});
