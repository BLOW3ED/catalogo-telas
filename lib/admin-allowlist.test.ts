import { describe, expect, it } from "vitest";
import { isAllowedAdminEmail } from "./admin-allowlist";

describe("isAllowedAdminEmail", () => {
  it("autoriza un correo presente en el allowlist", () => {
    expect(isAllowedAdminEmail("dueño@jalisciense.mx", "dueño@jalisciense.mx")).toBe(true);
  });

  it("ignora mayúsculas y espacios en ambos lados", () => {
    expect(
      isAllowedAdminEmail(
        "Dueño@Jalisciense.mx",
        " dueño@jalisciense.mx , vendedor@jalisciense.mx "
      )
    ).toBe(true);
  });

  it("rechaza un correo que no está en el allowlist", () => {
    expect(isAllowedAdminEmail("intruso@example.com", "dueño@jalisciense.mx")).toBe(false);
  });

  it("sin allowlist configurada, nadie está autorizado", () => {
    expect(isAllowedAdminEmail("dueño@jalisciense.mx", undefined)).toBe(false);
    expect(isAllowedAdminEmail("dueño@jalisciense.mx", "")).toBe(false);
  });

  it("sin correo (sesión anónima o sin sesión), nunca autoriza", () => {
    expect(isAllowedAdminEmail(null, "dueño@jalisciense.mx")).toBe(false);
    expect(isAllowedAdminEmail(undefined, "dueño@jalisciense.mx")).toBe(false);
  });

  it("ignora entradas vacías por comas repetidas en el allowlist", () => {
    expect(isAllowedAdminEmail("a@b.com", "a@b.com,,  ,")).toBe(true);
  });
});
