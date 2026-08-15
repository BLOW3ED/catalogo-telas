import { describe, it, expect } from "vitest";
import {
  categoriaDeCodigo,
  unidadDeCategoria,
  CATEGORIAS,
  REGLAS_CATEGORIA,
  UNIDAD_POR_CATEGORIA,
} from "./categorias";
import { UNIDADES_VENTA } from "../unidades";
import { interpretaFamilia } from "./nombres";

/**
 * Códigos REALES del lote de agosto 2026, con la categoría que se confirmó
 * abriendo la foto. Es la red de seguridad de este módulo: si alguien agrega
 * una regla que se traga un prefijo ajeno, aquí truena en vez de archivar el
 * producto en silencio en el cajón equivocado.
 */
const CLASIFICADOS: [string, string][] = [
  // Tiras: cadena de strass continua.
  ["BNK1041", CATEGORIAS.TIRA.slug],
  ["BNK203823", CATEGORIAS.TIRA.slug],
  ["BNK709M", CATEGORIAS.TIRA.slug],
  ["KP151", CATEGORIAS.TIRA.slug],
  ["KPA", CATEGORIAS.TIRA.slug],
  ["TDC68", CATEGORIAS.TIRA.slug],
  ["TDC11923", CATEGORIAS.TIRA.slug],
  ["T4L", CATEGORIAS.TIRA.slug],

  // Galón de encaje blanco — NO es pedrería.
  ["TGL254", CATEGORIAS.GALON.slug],
  ["TGL4238", CATEGORIAS.GALON.slug],
  ["TG3996", CATEGORIAS.GALON.slug],
  ["G4082", CATEGORIAS.GALON.slug],
  ["4212", CATEGORIAS.GALON.slug],

  // Cintillos y diademas.
  ["BT279", CATEGORIAS.CINTILLO.slug],
  ["BT1171", CATEGORIAS.CINTILLO.slug],
  ["CT279", CATEGORIAS.CINTILLO.slug],
  ["TC199", CATEGORIAS.CINTILLO.slug],
  ["T339", CATEGORIAS.CINTILLO.slug],
  ["T22970", CATEGORIAS.CINTILLO.slug],
  ["T26923", CATEGORIAS.CINTILLO.slug],

  // Aplicaciones.
  ["BCP115", CATEGORIAS.APLICACION.slug],
  ["DB16", CATEGORIAS.APLICACION.slug],
  ["D440", CATEGORIAS.APLICACION.slug],
  ["FP1523", CATEGORIAS.APLICACION.slug],
  ["JF001", CATEGORIAS.APLICACION.slug],
  ["MC45", CATEGORIAS.APLICACION.slug],

  ["HE020", CATEGORIAS.HEBILLA.slug],

  // Piedra suelta, a granel.
  ["PCC120", CATEGORIAS.PIEDRA.slug],
  ["I1403", CATEGORIAS.PIEDRA.slug],
  ["I9301", CATEGORIAS.PIEDRA.slug],
  ["Gema", CATEGORIAS.PIEDRA.slug],
  ["BolsitaPiedras", CATEGORIAS.PIEDRA.slug],
  ["Bolsa de Piedras · 1404", CATEGORIAS.PIEDRA.slug],
  ["Piedra 1404", CATEGORIAS.PIEDRA.slug],

  // Fleco.
  ["B198", CATEGORIAS.FLECO.slug],
  ["B269", CATEGORIAS.FLECO.slug],

  // Familias descriptivas.
  ["CopTirante", CATEGORIAS.COPAS.slug],
  ["CopaOvaladaMediana", CATEGORIAS.COPAS.slug],
  ["CopNUXL", CATEGORIAS.COPAS.slug],
  ["YuliCintaBies16mm", CATEGORIAS.CINTA.slug],
  ["BO12", CATEGORIAS.BOTONES.slug],
  ["BO13RG39", CATEGORIAS.BOTONES.slug],
  ["JR1103", CATEGORIAS.CORCHETES.slug],
  ["Flor348Humo", CATEGORIAS.FLORES.slug],

  // Tela de verdad: se nombra en palabras, no en código.
  ["Chifon Lunares", CATEGORIAS.CHIFON.slug],
  ["Chifón Lunares", CATEGORIAS.CHIFON.slug],
  ["Tul Punto Lunares", CATEGORIAS.TUL.slug],
  ["Tul Bordado", CATEGORIAS.TUL_BORDADO.slug],
  ["Tul Bordado Margarita", CATEGORIAS.TUL_BORDADO.slug],
];

describe("categoriaDeCodigo", () => {
  it.each(CLASIFICADOS)("clasifica %s como %s", (codigo, slug) => {
    expect(categoriaDeCodigo(codigo)?.slug).toBe(slug);
  });

  it("distingue los prefijos que empiezan con B, que significan cosas distintas", () => {
    // El caso que motivó el orden de las reglas: cinco familias, una letra.
    expect(categoriaDeCodigo("B198")?.slug).toBe(CATEGORIAS.FLECO.slug);
    expect(categoriaDeCodigo("BNK1041")?.slug).toBe(CATEGORIAS.TIRA.slug);
    expect(categoriaDeCodigo("BO12")?.slug).toBe(CATEGORIAS.BOTONES.slug);
    expect(categoriaDeCodigo("BT279")?.slug).toBe(CATEGORIAS.CINTILLO.slug);
    expect(categoriaDeCodigo("BCP115")?.slug).toBe(CATEGORIAS.APLICACION.slug);
  });

  it("no deja que la regla de cintillos (^T+dígito) se trague T4L ni los galones", () => {
    expect(categoriaDeCodigo("T4L")?.slug).toBe(CATEGORIAS.TIRA.slug);
    expect(categoriaDeCodigo("TGL254")?.slug).toBe(CATEGORIAS.GALON.slug);
    expect(categoriaDeCodigo("TDC68")?.slug).toBe(CATEGORIAS.TIRA.slug);
  });

  it("no confunde tul bordado con tul liso", () => {
    expect(categoriaDeCodigo("Tul Bordado Margarita")?.slug).toBe(CATEGORIAS.TUL_BORDADO.slug);
    expect(categoriaDeCodigo("Tul Punto Lunares")?.slug).toBe(CATEGORIAS.TUL.slug);
  });

  it("ignora mayúsculas: la tienda escribe 'tgl254' y 'TGL254' indistintamente", () => {
    expect(categoriaDeCodigo("tgl254")?.slug).toBe(categoriaDeCodigo("TGL254")?.slug);
    expect(categoriaDeCodigo("tg3996")?.slug).toBe(CATEGORIAS.GALON.slug);
  });

  it("devuelve null en vez de inventar cuando el código no se reconoce", () => {
    expect(categoriaDeCodigo("ZZ999")).toBeNull();
    expect(categoriaDeCodigo("")).toBeNull();
    expect(categoriaDeCodigo(null)).toBeNull();
    expect(categoriaDeCodigo(undefined)).toBeNull();
  });

  it("cada regla clasifica su propio ejemplo (nadie queda tapada por otra)", () => {
    for (const regla of REGLAS_CATEGORIA) {
      expect(
        categoriaDeCodigo(regla.ejemplo)?.slug,
        `la regla de "${regla.categoria.nombre}" quedó tapada: su ejemplo ${regla.ejemplo} cae en otra`
      ).toBe(regla.categoria.slug);
    }
  });

  it("coincide con las categorías que ya asigna interpretaFamilia", () => {
    // Dos módulos opinan sobre BO y JR. Esta prueba impide que se separen.
    for (const codigo of ["BO12", "BO635", "JR1103", "JR1130"]) {
      expect(categoriaDeCodigo(codigo)?.nombre).toBe(interpretaFamilia(codigo)?.categoria);
    }
  });
});

describe("unidadDeCategoria", () => {
  it("corta por metro solo lo que sale de un rollo", () => {
    for (const c of [CATEGORIAS.TIRA, CATEGORIAS.GALON, CATEGORIAS.FLECO, CATEGORIAS.CINTA]) {
      expect(unidadDeCategoria(c.slug), c.nombre).toBe("metro");
    }
    for (const c of [CATEGORIAS.CHIFON, CATEGORIAS.TUL, CATEGORIAS.TUL_BORDADO]) {
      expect(unidadDeCategoria(c.slug), c.nombre).toBe("metro");
    }
  });

  it("vende de a una lo que es una pieza suelta", () => {
    // El bug que motivó esto: un cintillo a "$89/m" es un precio que nadie
    // puede cobrar, porque la diadema no se corta.
    for (const c of [
      CATEGORIAS.CINTILLO, CATEGORIAS.APLICACION, CATEGORIAS.HEBILLA,
      CATEGORIAS.BOTONES, CATEGORIAS.CORCHETES, CATEGORIAS.FLORES,
    ]) {
      expect(unidadDeCategoria(c.slug), c.nombre).toBe("pieza");
    }
  });

  it("la piedra suelta va a granel y las copas en par", () => {
    expect(unidadDeCategoria(CATEGORIAS.PIEDRA.slug)).toBe("bolsa");
    expect(unidadDeCategoria(CATEGORIAS.COPAS.slug)).toBe("par");
  });

  it("toda categoría conocida tiene unidad: ninguna se queda en el default silencioso", () => {
    for (const c of Object.values(CATEGORIAS)) {
      expect(unidadDeCategoria(c.slug), `falta la unidad de "${c.nombre}"`).not.toBeNull();
    }
  });

  it("solo usa unidades que lib/unidades.ts sabe formatear", () => {
    // Si alguien pone "kilo" aquí, unidadDe() lo mandaría callado a metro.
    for (const u of Object.values(UNIDAD_POR_CATEGORIA)) {
      expect(UNIDADES_VENTA as readonly string[]).toContain(u);
    }
  });

  it("devuelve null para lo que no conoce, en vez de adivinar", () => {
    expect(unidadDeCategoria("categoria-inventada")).toBeNull();
    expect(unidadDeCategoria(null)).toBeNull();
  });
});
