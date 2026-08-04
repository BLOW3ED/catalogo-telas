import { describe, it, expect } from "vitest";
import {
  unidadDe,
  ajustaCantidad,
  cantidadCorta,
  cantidadLarga,
  etiquetaStepper,
  UNIDADES_VENTA,
} from "./unidades";

describe("unidadDe", () => {
  it("reconoce las seis unidades del check del SQL", () => {
    for (const clave of UNIDADES_VENTA) {
      expect(unidadDe(clave).clave).toBe(clave);
    }
  });

  it("cae a metro cuando el dato falta", () => {
    // Es lo que había antes de que existiera la columna: un dato faltante
    // tiene que comportarse igual que siempre.
    expect(unidadDe(null).clave).toBe("metro");
    expect(unidadDe(undefined).clave).toBe("metro");
    expect(unidadDe("").clave).toBe("metro");
  });

  it("cae a metro ante una unidad desconocida en vez de tronar", () => {
    expect(unidadDe("kilogramo").clave).toBe("metro");
  });

  it("tolera mayúsculas y espacios", () => {
    expect(unidadDe(" Bolsa ").clave).toBe("bolsa");
  });
});

describe("paso y mínimo", () => {
  it("la tela se corta a medios metros", () => {
    expect(unidadDe("metro").paso).toBe(0.5);
    expect(unidadDe("metro").minimo).toBe(0.5);
  });

  it("todo lo demás se vende entero: no hay medio botón", () => {
    for (const clave of UNIDADES_VENTA.filter((u) => u !== "metro")) {
      expect(unidadDe(clave).paso, clave).toBe(1);
      expect(unidadDe(clave).minimo, clave).toBe(1);
    }
  });
});

describe("ajustaCantidad", () => {
  it("respeta los medios metros de la tela", () => {
    const m = unidadDe("metro");
    expect(ajustaCantidad(2.5, m)).toBe(2.5);
    expect(ajustaCantidad(2.3, m)).toBe(2.5);
  });

  it("redondea a entero lo que se vende por pieza", () => {
    const p = unidadDe("pieza");
    expect(ajustaCantidad(2.5, p)).toBe(3);
    expect(ajustaCantidad(2.4, p)).toBe(2);
  });

  it("nunca baja del mínimo", () => {
    expect(ajustaCantidad(0, unidadDe("pieza"))).toBe(1);
    expect(ajustaCantidad(-3, unidadDe("metro"))).toBe(0.5);
    expect(ajustaCantidad(0.1, unidadDe("metro"))).toBe(0.5);
  });
});

describe("cantidadCorta", () => {
  it("mantiene el formato de la tela que ya se usaba en el carrito", () => {
    expect(cantidadCorta(3, "metro")).toBe("3 m");
    expect(cantidadCorta(2.5, null)).toBe("2.5 m");
  });

  it("abrevia las piezas y deja legibles las palabras completas", () => {
    expect(cantidadCorta(2, "pieza")).toBe("2 pz");
    expect(cantidadCorta(1, "bolsa")).toBe("1 bolsa");
    expect(cantidadCorta(3, "par")).toBe("3 par");
  });
});

describe("cantidadLarga", () => {
  it("concuerda singular y plural", () => {
    expect(cantidadLarga(1, "metro")).toBe("1 metro");
    expect(cantidadLarga(3, "metro")).toBe("3 metros");
    expect(cantidadLarga(1, "bolsa")).toBe("1 bolsa");
    expect(cantidadLarga(2, "bolsa")).toBe("2 bolsas");
    expect(cantidadLarga(2, "par")).toBe("2 pares");
  });

  it("dice cuántas piezas trae cada empaque, que es lo que se surte", () => {
    // Sin esto "2 bolsas" no le dice a la vendedora si son 12 o 60 piedras.
    expect(cantidadLarga(2, "bolsa", 25)).toBe("2 bolsas (25 pz c/u)");
    expect(cantidadLarga(1, "pieza", 12)).toBe("1 pieza (12 pz c/u)");
  });

  it("no le cuelga el empaque a la tela, que va por metro", () => {
    expect(cantidadLarga(3, "metro", 25)).toBe("3 metros");
  });

  it("omite el empaque cuando no está capturado", () => {
    expect(cantidadLarga(2, "bolsa", null)).toBe("2 bolsas");
    expect(cantidadLarga(2, "bolsa")).toBe("2 bolsas");
  });
});

describe("etiquetaStepper", () => {
  it("va en plural, como el rótulo bajo el número", () => {
    expect(etiquetaStepper("metro")).toBe("metros");
    expect(etiquetaStepper("bolsa")).toBe("bolsas");
    expect(etiquetaStepper(null)).toBe("metros");
  });
});

describe("sufijo de precio", () => {
  it("da el sufijo que va pegado al precio en las cards", () => {
    expect(unidadDe("metro").sufijoPrecio).toBe("/m");
    expect(unidadDe("pieza").sufijoPrecio).toBe("/pieza");
    expect(unidadDe("bolsa").sufijoPrecio).toBe("/bolsa");
    expect(unidadDe("juego").sufijoPrecio).toBe("/juego");
  });
});
