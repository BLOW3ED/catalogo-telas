import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  publicImageUrl,
  rutaDerivado,
  rutasDerivados,
  srcsetDerivados,
  urlDerivado,
} from "./supabase/storage";
import type { DerivadosFoto } from "./types";

const BASE = "https://demo.supabase.co";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
});

const derivados: DerivadosFoto = {
  sm: { ruta: "derivados/sm/chifon/azul-1.webp", ancho: 533, alto: 800 },
  md: { ruta: "derivados/md/chifon/azul-1.webp", ancho: 1067, alto: 1600 },
  lg: { ruta: "derivados/lg/chifon/azul-1.webp", ancho: 1600, alto: 2400 },
};

describe("rutaDerivado", () => {
  it("espeja la ruta del original bajo derivados/{tamano} con extensión .webp", () => {
    expect(rutaDerivado("chifon/azul-1.jpg", "md")).toBe(
      "derivados/md/chifon/azul-1.webp"
    );
  });

  it("tolera slash inicial y extensiones variadas", () => {
    expect(rutaDerivado("/tul/negro.PNG", "sm")).toBe("derivados/sm/tul/negro.webp");
  });

  it("genera las tres rutas para el borrado en bloque", () => {
    expect(rutasDerivados("chifon/azul-1.jpg")).toEqual([
      "derivados/sm/chifon/azul-1.webp",
      "derivados/md/chifon/azul-1.webp",
      "derivados/lg/chifon/azul-1.webp",
    ]);
  });
});

describe("srcsetDerivados", () => {
  it("arma el srcset con el ancho real de cada derivado, de menor a mayor", () => {
    expect(srcsetDerivados(derivados)).toBe(
      [
        `${BASE}/storage/v1/object/public/telas/derivados/sm/chifon/azul-1.webp 533w`,
        `${BASE}/storage/v1/object/public/telas/derivados/md/chifon/azul-1.webp 1067w`,
        `${BASE}/storage/v1/object/public/telas/derivados/lg/chifon/azul-1.webp 1600w`,
      ].join(", ")
    );
  });

  it("omite tamaños faltantes (fotos procesadas con estrategias previas)", () => {
    expect(srcsetDerivados({ md: derivados.md })).toBe(
      `${BASE}/storage/v1/object/public/telas/derivados/md/chifon/azul-1.webp 1067w`
    );
  });

  it("devuelve null sin derivados → el componente cae a next/image", () => {
    expect(srcsetDerivados(null)).toBeNull();
    expect(srcsetDerivados(undefined)).toBeNull();
    expect(srcsetDerivados({})).toBeNull();
  });
});

describe("urlDerivado", () => {
  it("devuelve el tamaño preferido si existe", () => {
    expect(urlDerivado(derivados, "md")).toContain("derivados/md/");
  });

  it("cae en cascada a otro tamaño si el preferido falta", () => {
    expect(urlDerivado({ lg: derivados.lg }, "md")).toContain("derivados/lg/");
  });

  it("null si no hay ninguno", () => {
    expect(urlDerivado({}, "md")).toBeNull();
  });
});

describe("publicImageUrl", () => {
  it("construye la URL pública del bucket a partir de la ruta relativa", () => {
    expect(publicImageUrl("chifon/azul-1.jpg")).toBe(
      `${BASE}/storage/v1/object/public/telas/chifon/azul-1.jpg`
    );
  });
});
