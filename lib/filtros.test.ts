import { describe, it, expect } from "vitest";
import {
  leerFiltros,
  aQuerystring,
  hayFiltrosActivos,
  cuentaFiltros,
  alternar,
  FILTROS_VACIOS,
} from "./filtros";

describe("leerFiltros", () => {
  it("lee listas separadas por coma", () => {
    const f = leerFiltros({ cat: "tira-de-pedreria,piedra-suelta", color: "oro" });
    expect(f.categorias).toEqual(["tira-de-pedreria", "piedra-suelta"]);
    expect(f.colores).toEqual(["oro"]);
  });

  it("quita vacíos y repetidos sin alterar el orden", () => {
    expect(leerFiltros({ cat: "a,,b, a ,b,c" }).categorias).toEqual(["a", "b", "c"]);
  });

  it("acepta el string[] que Next entrega cuando la llave viene repetida", () => {
    expect(leerFiltros({ cat: ["copas", "botones"] }).categorias).toEqual(["copas"]);
  });

  it("descarta propiedades desconocidas en vez de romperse", () => {
    // Un link viejo con una propiedad que ya no existe debe seguir sirviendo.
    const f = leerFiltros({ prop: "brillante,inventada,bordado" });
    expect(f.propiedades).toEqual(["brillante", "bordado"]);
  });

  it("ignora un precio máximo que no es número o no es positivo", () => {
    expect(leerFiltros({ max: "abc" }).precioMax).toBeNull();
    expect(leerFiltros({ max: "-5" }).precioMax).toBeNull();
    expect(leerFiltros({ max: "0" }).precioMax).toBeNull();
    expect(leerFiltros({ max: "50" }).precioMax).toBe(50);
  });

  it("solo prende disponibilidad con el valor exacto '1'", () => {
    expect(leerFiltros({ disp: "1" }).soloDisponibles).toBe(true);
    expect(leerFiltros({ disp: "true" }).soloDisponibles).toBe(false);
    expect(leerFiltros({}).soloDisponibles).toBe(false);
  });

  it("sin parámetros devuelve los filtros vacíos", () => {
    expect(leerFiltros({})).toEqual(FILTROS_VACIOS);
    expect(leerFiltros()).toEqual(FILTROS_VACIOS);
  });
});

describe("aQuerystring", () => {
  it("omite lo que está en su valor por defecto", () => {
    expect(aQuerystring(FILTROS_VACIOS)).toBe("");
  });

  it("da la vuelta completa: leer → serializar → leer", () => {
    const original = {
      q: "piedra",
      categorias: ["tira-de-pedreria", "copas"],
      colores: ["oro"],
      propiedades: ["brillante" as const],
      precioMax: 50,
      soloDisponibles: true,
    };
    expect(leerFiltros(Object.fromEntries(new URLSearchParams(aQuerystring(original))))).toEqual(
      original
    );
  });

  it("escapa el texto de búsqueda", () => {
    const qs = aQuerystring({ ...FILTROS_VACIOS, q: "tul & encaje" });
    expect(leerFiltros(Object.fromEntries(new URLSearchParams(qs))).q).toBe("tul & encaje");
  });
});

describe("hayFiltrosActivos / cuentaFiltros", () => {
  it("no cuenta la búsqueda de texto como filtro", () => {
    // La caja de búsqueda tiene su propia X para limpiarse; el contador del
    // botón de filtros solo debe hablar de los chips.
    const soloTexto = { ...FILTROS_VACIOS, q: "tul" };
    expect(hayFiltrosActivos(soloTexto)).toBe(true);
    expect(cuentaFiltros(soloTexto)).toBe(0);
  });

  it("suma categorías, colores, propiedades, precio y disponibilidad", () => {
    expect(
      cuentaFiltros({
        q: "",
        categorias: ["a", "b"],
        colores: ["oro"],
        propiedades: ["brillante"],
        precioMax: 50,
        soloDisponibles: true,
      })
    ).toBe(6);
  });
});

describe("alternar", () => {
  it("prende un valor que no estaba", () => {
    expect(alternar(FILTROS_VACIOS, "categorias", "copas").categorias).toEqual(["copas"]);
  });

  it("apaga un valor que ya estaba", () => {
    const con = { ...FILTROS_VACIOS, categorias: ["copas", "botones"] };
    expect(alternar(con, "categorias", "copas").categorias).toEqual(["botones"]);
  });

  it("no muta los filtros que recibe", () => {
    const antes = { ...FILTROS_VACIOS, categorias: ["copas"] };
    alternar(antes, "categorias", "botones");
    expect(antes.categorias).toEqual(["copas"]);
  });

  it("apagar el último valor deja la URL limpia", () => {
    const con = { ...FILTROS_VACIOS, categorias: ["copas"] };
    expect(aQuerystring(alternar(con, "categorias", "copas"))).toBe("");
  });
});
