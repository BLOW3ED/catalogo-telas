import { afterEach, describe, expect, it, vi } from "vitest";
import { aplicarPreciosDemo, demoPricesEnabled, resolveDemoPrice } from "./demo-prices";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demoPricesEnabled", () => {
  it("es false por default (flag no configurada)", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "");
    expect(demoPricesEnabled()).toBe(false);
  });

  it("solo se activa con el string exacto 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    expect(demoPricesEnabled()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "1");
    expect(demoPricesEnabled()).toBe(false);
  });
});

describe("resolveDemoPrice", () => {
  it("con el flag apagado, respeta el precio real (incluido null)", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "false");
    expect(
      resolveDemoPrice({ variante_id: "v1", categoria_slug: "chifon", precio_metro: null })
    ).toBeNull();
    expect(
      resolveDemoPrice({ variante_id: "v1", categoria_slug: "chifon", precio_metro: 120 })
    ).toBe(120);
  });

  it("con el flag activo, nunca sobreescribe un precio real", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    expect(
      resolveDemoPrice({ variante_id: "v1", categoria_slug: "chifon", precio_metro: 120 })
    ).toBe(120);
  });

  it("con el flag activo y precio null, usa el precio base de la categoría + offset", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    const precio = resolveDemoPrice({
      variante_id: "v1",
      categoria_slug: "tul",
      precio_metro: null,
    });
    // base tul = 45, offset determinista es un múltiplo de 5 entre 0 y 20
    expect(precio).not.toBeNull();
    expect(precio!).toBeGreaterThanOrEqual(45);
    expect(precio!).toBeLessThanOrEqual(65);
    expect((precio! - 45) % 5).toBe(0);
  });

  it("el offset es determinista: mismo id ⇒ mismo precio siempre", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    const row = { variante_id: "variante-abc", categoria_slug: "saten", precio_metro: null };
    expect(resolveDemoPrice(row)).toBe(resolveDemoPrice(row));
  });

  it("categoría desconocida cae al precio default", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    const precio = resolveDemoPrice({
      variante_id: "v1",
      categoria_slug: "categoria-que-no-existe",
      precio_metro: null,
    });
    expect(precio!).toBeGreaterThanOrEqual(79);
    expect(precio!).toBeLessThanOrEqual(99);
  });
});

describe("aplicarPreciosDemo", () => {
  it("con el flag apagado, regresa las filas sin tocar", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "false");
    const filas = [{ variante_id: "v1", categoria_slug: "tul", precio_metro: null }];
    expect(aplicarPreciosDemo(filas)).toEqual(filas);
  });

  it("marca precio_es_referencia solo en las filas que rellenó", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    const filas = [
      { variante_id: "v1", categoria_slug: "tul", precio_metro: null },
      { variante_id: "v2", categoria_slug: "tul", precio_metro: 200 },
    ];
    const resultado = aplicarPreciosDemo(filas);

    expect(resultado[0].precio_metro).not.toBeNull();
    expect(resultado[0]).toHaveProperty("precio_es_referencia", true);

    expect(resultado[1].precio_metro).toBe(200);
    expect(resultado[1]).not.toHaveProperty("precio_es_referencia");
  });

  it("no muta el arreglo ni las filas originales", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_PRICES", "true");
    const fila = { variante_id: "v1", categoria_slug: "tul", precio_metro: null };
    const filas = [fila];
    aplicarPreciosDemo(filas);
    expect(fila.precio_metro).toBeNull();
    expect(fila).not.toHaveProperty("precio_es_referencia");
  });
});
