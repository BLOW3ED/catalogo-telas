import { describe, it, expect } from "vitest";
import {
  interpretaFlor, interpretaFamilia, modeloFlor, tablaDeColores,
  interpretaBolsita, nombreDeBolsita,
} from "./nombres";

describe("interpretaFlor", () => {
  it("parte el número en diámetro (un dígito) y código de color (el resto)", () => {
    expect(interpretaFlor("Flor348Humo")).toEqual({
      diametro: "3", codigoColor: "48", color: "Humo",
    });
    expect(interpretaFlor("Flor2113Blush")).toEqual({
      diametro: "2", codigoColor: "113", color: "Blush",
    });
    // Código de color de un solo dígito: el diámetro sigue siendo el primero.
    expect(interpretaFlor("Flor23Lila")).toEqual({
      diametro: "2", codigoColor: "3", color: "Lila",
    });
  });

  it("lee nombres de color de varias palabras pegadas", () => {
    expect(interpretaFlor("Flor324VerdeBotella")?.color).toBe("VerdeBotella");
    expect(interpretaFlor("Flor225PalodeRosa")).toEqual({
      diametro: "2", codigoColor: "25", color: "PalodeRosa",
    });
  });

  it("agrupa por diámetro: mismo color en distinto tamaño son modelos distintos", () => {
    const a = interpretaFlor("Flor220Blanco")!;
    const b = interpretaFlor("Flor320Blanco")!;
    const c = interpretaFlor("Flor420Blanco")!;
    // Mismo código de color, tres diámetros → tres modelos, un solo color.
    expect([a, b, c].map((f) => f.codigoColor)).toEqual(["20", "20", "20"]);
    expect(new Set([a, b, c].map((f) => modeloFlor(f.diametro))).size).toBe(3);
  });

  it("devuelve null en los nombres que no siguen el patrón", () => {
    // Empieza con letra donde iría el diámetro: no se le inventa uno.
    expect(interpretaFlor("FlorO4")).toBeNull();
    expect(interpretaFlor("FlorO4Oro")).toBeNull();
    // Sin número.
    expect(interpretaFlor("FlorBlanco")).toBeNull();
  });

  it("tolera 'Piedra' escrito entre el diámetro y el código de color", () => {
    // "Flor5Piedra20": la tienda escribió de más lo que ya se da por hecho en
    // este lote (todas llevan piedra). El diámetro y el código siguen ahí.
    expect(interpretaFlor("Flor5Piedra20")).toEqual({
      diametro: "5", codigoColor: "20", color: "",
    });
  });

  it("completa el color desde la tabla cuando el archivo solo trae el código", () => {
    const tabla = tablaDeColores(["Flor220Blanco", "Flor320Blanco", "Flor5Piedra20"]);
    expect(interpretaFlor("Flor5Piedra20", tabla)?.color).toBe("Blanco");
  });
});

describe("tablaDeColores", () => {
  it("aprende los códigos de los archivos que sí traen el nombre", () => {
    const t = tablaDeColores(["Flor348Humo", "Flor2113Blush", "Flor420Blanco"]);
    expect(t.get("48")).toBe("Humo");
    expect(t.get("113")).toBe("Blush");
    expect(t.get("20")).toBe("Blanco");
  });

  it("ignora los que no traen nombre de color", () => {
    expect(tablaDeColores(["Flor5Piedra20"]).size).toBe(0);
  });

  it("ante un código con dos nombres se queda con uno solo, estable", () => {
    const orden1 = tablaDeColores(["Flor220Blanco", "Flor320Perla"]);
    const orden2 = tablaDeColores(["Flor320Perla", "Flor220Blanco"]);
    expect(orden1.get("20")).toBe(orden2.get("20"));
  });
});

describe("modeloFlor", () => {
  it("marca el lote con pedrería para no mezclarlo con el que viene sin ella", () => {
    expect(modeloFlor("3")).toBe("Flor con Piedra 3");
  });
});

describe("interpretaFamilia", () => {
  it("reconoce botones por el prefijo BO seguido de dígito", () => {
    expect(interpretaFamilia("BO635")).toEqual({
      codigo: "BO635", categoria: "Botones", modelo: "Botón BO635",
    });
    // Códigos con letras intercaladas.
    expect(interpretaFamilia("BO13RG39")?.categoria).toBe("Botones");
    expect(interpretaFamilia("BO7")?.modelo).toBe("Botón BO7");
  });

  it("NO confunde BolsitaPiedras con un botón", () => {
    // Empieza con "Bo" pero sigue con letra: es otra familia entera.
    expect(interpretaFamilia("BolsitaPiedras")).toBeNull();
  });

  it("reconoce corchetes enganchables por el prefijo JR", () => {
    expect(interpretaFamilia("JR1103")).toEqual({
      codigo: "JR1103", categoria: "Corchetes", modelo: "Corchete enganchable JR1103",
    });
  });

  it("deja pasar los códigos de familias que todavía no se conocen", () => {
    expect(interpretaFamilia("BNK2315")).toBeNull();
    expect(interpretaFamilia("KPA")).toBeNull();
    expect(interpretaFamilia("TGL254")).toBeNull();
  });
});

describe("interpretaBolsita / nombreDeBolsita", () => {
  it("separa código, cantidad y número de cámara del nombre provisional", () => {
    expect(interpretaBolsita("Bolsa de Piedras · 1404 · 25 pz · 00021")).toEqual({
      codigo: "1404", piezas: "25", toma: "00021",
    });
    expect(interpretaBolsita("Bolsa de Piedras · B1403 · 12 pz · 00030")).toEqual({
      codigo: "B1403", piezas: "12", toma: "00030",
    });
  });

  it("no confunde la cantidad con el código cuando la bolsita no trae código", () => {
    // "25 pz" va donde iría el código; el lookahead evita que se lo trague.
    expect(interpretaBolsita("Bolsa de Piedras · 25 pz · 00025")).toEqual({
      codigo: "", piezas: "25", toma: "00025",
    });
  });

  it("no confunde el número de cámara con el código", () => {
    expect(interpretaBolsita("Bolsa de Piedras · 00031")).toEqual({
      codigo: "", piezas: "", toma: "00031",
    });
  });

  it("tolera bolsitas con código pero sin cantidad, y sin nada", () => {
    expect(interpretaBolsita("Bolsa de Piedras · 1404 · 00033")).toEqual({
      codigo: "1404", piezas: "", toma: "00033",
    });
    expect(interpretaBolsita("Bolsa de Piedras")).toEqual({
      codigo: "", piezas: "", toma: "",
    });
  });

  it("saca el número de cámara del nombre de vitrina", () => {
    const b = interpretaBolsita("Bolsa de Piedras · 1404 · 25 pz · 00021")!;
    expect(nombreDeBolsita(b)).toBe("Piedra 1404 · 25 pz");
    expect(nombreDeBolsita(b, "B")).toBe("Piedra 1404 · 25 pz · B");
  });

  it("nombra las bolsitas sin código sin dejar el 'Piedra' colgando", () => {
    expect(nombreDeBolsita(interpretaBolsita("Bolsa de Piedras · 00031")!)).toBe("Bolsa de piedras");
    expect(nombreDeBolsita(interpretaBolsita("Bolsa de Piedras · 25 pz · 00025")!))
      .toBe("Bolsa de piedras · 25 pz");
  });

  it("devuelve null para nombres que no son bolsita", () => {
    expect(interpretaBolsita("BNK1041")).toBeNull();
    expect(interpretaBolsita("Chifon Lunares")).toBeNull();
  });

  it("es idempotente: no vuelve a interpretar su propia salida", () => {
    // Sin esto, "Bolsa de piedras · A" se leería con código "A" y cada corrida
    // del clasificador renombraría las mismas bolsitas una y otra vez.
    for (const yaLimpio of [
      "Bolsa de piedras · A",
      "Bolsa de piedras · 25 pz",
      "Piedra 1404 · 25 pz · A",
      "Piedra B9301 · 12 pz",
    ]) {
      expect(interpretaBolsita(yaLimpio), yaLimpio).toBeNull();
    }
  });
});
