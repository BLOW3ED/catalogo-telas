import { describe, it, expect } from "vitest";
import { fusionaFila, fusionaNotas, registroAuto, MARCA_AUTO } from "./fusion";
const A = MARCA_AUTO;

/** Fila recién deducida del nombre de archivo: casi todo vacío. */
const nueva = () => ({
  archivo: "BNK2315.jpg", grupo: "BNK2315", orden: "0",
  sku: "BNK2315", modelo: "", color: "", precio: "", unidad_venta: "",
  piezas_por_unidad: "", gramaje: "", stock: "", es_bordado: "",
  es_brillante: "", es_traslucida: "", es_tornasol: "", categoria: "",
  casos_uso: "", notas: "",
});

describe("fusionaFila", () => {
  it("en la primera corrida deja la fila deducida tal cual", () => {
    const { fila, conservo } = fusionaFila(nueva(), undefined, ["sin nombre"]);
    expect(conservo).toBe(false);
    expect(fila.modelo).toBe("");
    expect(fila.notas).toBe(`${A} sin nombre`);
  });

  it("conserva lo capturado a mano por encima de lo deducido", () => {
    const previa = { ...nueva(), modelo: "Mariposa de pedrería", precio: "35", categoria: "Aplicaciones" };
    const { fila, conservo } = fusionaFila(nueva(), previa, []);
    expect(conservo).toBe(true);
    expect(fila.modelo).toBe("Mariposa de pedrería");
    expect(fila.precio).toBe("35");
    expect(fila.categoria).toBe("Aplicaciones");
  });

  it("deja que el parser rellene las celdas que quedaron vacías", () => {
    // Escenario real: se agrega la regla de flores y ahora sí hay modelo, pero
    // la tienda nunca escribió uno. Lo deducido debe entrar.
    const conModelo = { ...nueva(), modelo: "Flor con Piedra 3", categoria: "Flores" };
    const { fila } = fusionaFila(conModelo, nueva(), []);
    expect(fila.modelo).toBe("Flor con Piedra 3");
    expect(fila.categoria).toBe("Flores");
  });

  it("una celda en blanco o con espacios no cuenta como capturada", () => {
    const conModelo = { ...nueva(), modelo: "Flor con Piedra 3" };
    const previa = { ...nueva(), modelo: "   " };
    const { fila } = fusionaFila(conModelo, previa, []);
    expect(fila.modelo).toBe("Flor con Piedra 3");
  });

  it("el precio capturado gana aunque el parser proponga otro", () => {
    const propuesto = { ...nueva(), precio: "18" };
    const previa = { ...nueva(), precio: "42" };
    const { fila } = fusionaFila(propuesto, previa, []);
    expect(fila.precio).toBe("42");
  });

  it("no toca las columnas que manda el parser", () => {
    // Un archivo reprocesado puede cambiar de orden dentro del grupo; el CSV
    // viejo no debe congelarlo, o la foto principal quedaría equivocada.
    const recalculada = { ...nueva(), orden: "2", grupo: "BNK2315" };
    const previa = { ...nueva(), orden: "0", grupo: "OTRO" };
    const { fila } = fusionaFila(recalculada, previa, []);
    expect(fila.orden).toBe("2");
    expect(fila.grupo).toBe("BNK2315");
  });
});

describe("fusionaNotas", () => {
  it("conserva lo que escribió la tienda y antepone lo deducido", () => {
    const r = fusionaNotas(["sin nombre de producto"], "ojo: viene descontinuado");
    expect(r).toBe(`${A} sin nombre de producto; ojo: viene descontinuado`);
  });

  it("no duplica una nota deducida en cada corrida", () => {
    const uno = fusionaNotas(["sin SKU en archivo"], "confirmar precio");
    const dos = fusionaNotas(["sin SKU en archivo"], uno);
    expect(dos).toBe(uno);
    expect(dos.match(/sin SKU en archivo/g)).toHaveLength(1);
  });

  it("suelta los avisos deducidos que ya no aplican", () => {
    // Al afinarse la heurística el "corte dudoso" deja de aplicar; por su
    // marca se puede tirar, en vez de quedarse pegado pidiendo confirmación
    // sobre una fila que ya está bien.
    const antes = fusionaNotas(['corte SKU/toma dudoso: "B198" — confirmar'], "");
    expect(fusionaNotas([], antes)).toBe("");
  });

  it("respeta una nota manual que ya no corresponde a ninguna deducida", () => {
    const r = fusionaNotas([], "sin SKU en archivo");
    expect(r).toBe("sin SKU en archivo");
  });

  it("no duplica notas automáticas escritas antes de que existiera la marca", () => {
    // CSV viejo: la nota automática está sin marcar. Al fusionar no debe
    // quedar dos veces, una marcada y otra suelta.
    const r = fusionaNotas(["sin SKU en archivo"], "sin SKU en archivo; ojo: pedir más");
    expect(r).toBe(`${A} sin SKU en archivo; ojo: pedir más`);
  });

  it("sobrevive a notas vacías por ambos lados", () => {
    expect(fusionaNotas([], "")).toBe("");
    expect(fusionaNotas([], "   ; ;  ")).toBe("");
  });
});

describe("fusionaFila — procedencia", () => {
  const base = () => ({
    archivo: "Flor5Piedra2000010.jpg", grupo: "Flor5Piedra20", orden: "0",
    sku: "", modelo: "", color: "", precio: "", unidad_venta: "", piezas_por_unidad: "",
    gramaje: "", stock: "", es_bordado: "", es_brillante: "", es_traslucida: "",
    es_tornasol: "", categoria: "", casos_uso: "", notas: "",
  });

  it("deja que el parser corrija lo que él mismo había puesto", () => {
    // El caso real: al añadirse la regla de flores, el modelo pasa de lo que
    // sacaba el parser genérico a lo correcto. La celda no la tocó nadie.
    const previa = { ...base(), modelo: "Flor5 Piedra20", color: "Piedra20" };
    const ahora = { ...base(), modelo: "Flor con Piedra 5", color: "Blanco" };
    const { fila } = fusionaFila(ahora, previa, [], { modelo: "Flor5 Piedra20", color: "Piedra20" });
    expect(fila.modelo).toBe("Flor con Piedra 5");
    expect(fila.color).toBe("Blanco");
  });

  it("no pisa la celda que la tienda corrigió a mano", () => {
    const previa = { ...base(), modelo: "Flor grande blanca" };
    const ahora = { ...base(), modelo: "Flor con Piedra 5" };
    // El parser había puesto otra cosa: el valor actual es de la tienda.
    const { fila, conservo } = fusionaFila(ahora, previa, [], { modelo: "Flor5 Piedra20" });
    expect(fila.modelo).toBe("Flor grande blanca");
    expect(conservo).toBe(true);
  });

  it("sin registro de procedencia conserva todo lo no vacío", () => {
    // CSV viejo, de antes del sidecar: más vale conservar de más que borrar
    // captura de la tienda.
    const previa = { ...base(), modelo: "Flor5 Piedra20" };
    const ahora = { ...base(), modelo: "Flor con Piedra 5" };
    const { fila } = fusionaFila(ahora, previa, []);
    expect(fila.modelo).toBe("Flor5 Piedra20");
  });
});

describe("registroAuto", () => {
  it("guarda solo las columnas editables con valor", () => {
    const reg = registroAuto({
      archivo: "x.jpg", grupo: "G", orden: "0", modelo: "Botón BO7",
      categoria: "Botones", sku: "", color: "", precio: "", notas: "algo",
    } as Record<string, string>);
    expect(reg).toEqual({ modelo: "Botón BO7", categoria: "Botones" });
    expect(reg.notas).toBeUndefined();
    expect(reg.grupo).toBeUndefined();
  });
});
