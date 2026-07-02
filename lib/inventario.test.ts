import { describe, it, expect } from "vitest";
import { aplicarMovimiento, esTipoMovimiento } from "./inventario";

describe("aplicarMovimiento", () => {
  it("entrada suma al stock actual", () => {
    expect(aplicarMovimiento(10, "entrada", 5)).toBe(15);
  });

  it("entrada sobre stock desconocido (null) parte de 0", () => {
    expect(aplicarMovimiento(null, "entrada", 20)).toBe(20);
  });

  it("salida resta del stock", () => {
    expect(aplicarMovimiento(10, "salida", 3.5)).toBe(6.5);
  });

  it("salida mayor al stock lanza error (corregir con ajuste primero)", () => {
    expect(() => aplicarMovimiento(2, "salida", 5)).toThrow(/ajuste/);
  });

  it("salida con stock desconocido (null) se trata como 0 y falla", () => {
    expect(() => aplicarMovimiento(null, "salida", 1)).toThrow();
  });

  it("merma se comporta como salida", () => {
    expect(aplicarMovimiento(10, "merma", 10)).toBe(0);
    expect(() => aplicarMovimiento(10, "merma", 10.01)).toThrow();
  });

  it("ajuste fija el stock al valor absoluto, ignorando el anterior", () => {
    expect(aplicarMovimiento(99, "ajuste", 12.25)).toBe(12.25);
    expect(aplicarMovimiento(null, "ajuste", 0)).toBe(0);
  });

  it("redondea a 2 decimales como numeric(10,2)", () => {
    expect(aplicarMovimiento(0.1, "entrada", 0.2)).toBe(0.3);
    expect(aplicarMovimiento(10, "salida", 3.333)).toBe(6.67);
  });

  it("rechaza cantidades negativas o no numéricas", () => {
    expect(() => aplicarMovimiento(10, "entrada", -1)).toThrow();
    expect(() => aplicarMovimiento(10, "ajuste", Number.NaN)).toThrow();
  });
});

describe("esTipoMovimiento", () => {
  it("acepta los cuatro tipos y rechaza el resto", () => {
    for (const t of ["entrada", "salida", "merma", "ajuste"]) {
      expect(esTipoMovimiento(t)).toBe(true);
    }
    expect(esTipoMovimiento("venta")).toBe(false);
    expect(esTipoMovimiento("")).toBe(false);
  });
});
