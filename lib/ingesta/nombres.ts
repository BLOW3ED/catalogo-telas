/**
 * Lectura de los códigos de producto que la tienda escribe en el nombre de
 * archivo de la foto. Vive aparte del script de ingesta porque son REGLAS DE
 * NEGOCIO, no parseo genérico: cómo se descompone "Flor348Humo" es algo que
 * sabe la tienda, no algo que se deduzca del texto, y equivocarse agrupa
 * productos distintos bajo el mismo modelo sin que nada falle.
 *
 * Devuelve datos crudos (el nombre de color tal cual viene escrito); quien
 * llama se encarga de casarlo contra el catálogo de colores.
 */

/**
 * Flores con centro de pedrería.
 *
 * El número pegado a "Flor" son DOS datos concatenados: el primer dígito es el
 * diámetro de la flor y el resto es el código de color de la tienda.
 *
 *   Flor348Humo   → diámetro 3, código de color 48,  color "Humo"
 *   Flor2113Blush → diámetro 2, código de color 113, color "Blush"
 *   Flor23Lila    → diámetro 2, código de color 3,   color "Lila"
 *
 * No hay separador entre ambos números, así que la única regla que los parte
 * es "el diámetro es siempre un dígito".
 */
const RE_FLOR = /^Flor(\d)(?:Piedra)?(\d+)([A-Za-z].*)?$/;

export type Flor = {
  /** Diámetro; agrupa el modelo ("todas las flores del 3"). */
  diametro: string;
  /** Código de color de la tienda; no es un SKU. */
  codigoColor: string;
  /**
   * Nombre del color tal cual viene en el archivo, sin canonicalizar. Vacío
   * cuando el archivo trae el código pero no el nombre ("Flor5Piedra20");
   * `tablaDeColores` lo resuelve contra el resto del lote.
   */
  color: string;
};

/**
 * Diccionario código → nombre de color, deducido del propio lote.
 *
 * Se construye en vez de fijarse a mano porque la tienda inventa códigos de
 * color nuevos con cada compra: una tabla escrita en el código quedaría corta
 * al siguiente lote, mientras que ésta crece sola. Sirve para completar los
 * archivos a los que se les cayó el nombre del color — el código 20 aparece
 * como "Blanco" en los diámetros 2, 3 y 4, así que un archivo suelto con
 * código 20 es blanco también.
 *
 * Si un mismo código apareciera con dos nombres, gana el primero en orden
 * alfabético de archivo, que es estable entre corridas.
 */
export function tablaDeColores(bases: string[]): Map<string, string> {
  const tabla = new Map<string, string>();
  for (const base of [...bases].sort()) {
    const m = RE_FLOR.exec(base);
    if (!m) continue;
    const [, , codigo, color] = m;
    if (color && !tabla.has(codigo)) tabla.set(codigo, color);
  }
  return tabla;
}

/**
 * `null` cuando el nombre no sigue el patrón — p.ej. "FlorO4Oro", que trae
 * letra donde va el diámetro. Esos casos se marcan para revisión en vez de
 * forzarlos: inventar un diámetro los metería en el modelo equivocado.
 *
 * `tabla` (de `tablaDeColores`) completa el color cuando el archivo solo trae
 * el código, como "Flor5Piedra20".
 */
export function interpretaFlor(base: string, tabla?: Map<string, string>): Flor | null {
  const m = RE_FLOR.exec(base);
  if (!m) return null;
  const [, diametro, codigoColor, color] = m;
  return { diametro, codigoColor, color: color ?? tabla?.get(codigoColor) ?? "" };
}

/**
 * El "con Piedra" del modelo no es decorativo: separa este lote del de flores
 * SIN pedrería que entra después. Sin esa marca los dos lotes caerían en la
 * misma tela y el color dejaría de bastar para distinguirlos.
 */
export function modeloFlor(diametro: string): string {
  return `Flor con Piedra ${diametro}`;
}

export type Familia = {
  /** Prefijo + número: aquí el código SÍ identifica el producto. */
  re: RegExp;
  categoria: string;
  nombra: (codigo: string) => string;
};

/**
 * Familias que se reconocen solo por el prefijo del código, sin nada
 * descriptivo en el nombre del archivo.
 */
export const FAMILIAS: Familia[] = [
  // BO12, BO635, BO13RG39 — botones de pedrería. Se exige un dígito después de
  // "BO" para no tragarse "BolsitaPiedras", que empieza con las mismas letras.
  { re: /^(BO\d[A-Z0-9]*)$/, categoria: "Botones", nombra: (c) => `Botón ${c}` },
  // JR1103, JR1130 — corchetes enganchables.
  { re: /^(JR\d+)$/, categoria: "Corchetes", nombra: (c) => `Corchete enganchable ${c}` },
];

export type Reconocida = { codigo: string; categoria: string; modelo: string };

export function interpretaFamilia(base: string): Reconocida | null {
  for (const fam of FAMILIAS) {
    const m = fam.re.exec(base);
    if (m) {
      return { codigo: m[1], categoria: fam.categoria, modelo: fam.nombra(m[1]) };
    }
  }
  return null;
}

/**
 * Bolsitas de piedra: nombre de vitrina a partir del provisional.
 * ---------------------------------------------------------------------------
 * `nombres-provisionales` armó nombres como
 *
 *     "Bolsa de Piedras · 1404 · 25 pz · 00021"
 *
 * donde "00021" es el número que la cámara le puso a la foto. Ese número no
 * significa nada para quien compra, pero NO se puede borrar sin más: revisando
 * las fotos, ocho bolsitas distintas comparten rótulo "1404 · 25 pz" y su
 * contenido es diferente (cristal, ámbar, tornasol…). El rótulo identifica un
 * PRECIO, no un producto, y el color —que sería lo que las distingue— nadie lo
 * capturó todavía.
 *
 * Así que el número se cambia por una letra: "· A", "· B"… Sigue siendo un
 * desempate arbitrario, pero se lee como una variante de mostrador y no como
 * un número de archivo. En cuanto la tienda capture el color de cada bolsita,
 * esto se puede reemplazar por el color de verdad.
 */
export type Bolsita = { codigo: string; piezas: string; toma: string };

/**
 * Los tres tramos después de "Bolsa de Piedras" son OPCIONALES e
 * indistinguibles a simple vista: los tres pueden ser números. Los dos
 * lookaheads le impiden al primer tramo (el código) tragarse lo que en
 * realidad es la cantidad ("25 pz") o el número de cámara ("00025"), que es
 * lo que pasa en "Bolsa de Piedras · 25 pz · 00025" — una bolsita sin código.
 *
 * Los `\s*` van DENTRO de los lookaheads a propósito: si se dejan fuera, el
 * motor retrocede el espacio que ya consumió, el lookahead se evalúa sobre
 * " 00025" —que no empieza con dígito— y deja pasar justo lo que bloqueaba.
 */
const RE_BOLSITA =
  /^Bolsa de Piedras(?:\s*·(?!\s*\d{5}\s*$)(?!\s*\d+\s*pz\b)\s*([^·]+?))?(?:\s*·\s*(\d+)\s*pz)?\s*·\s*(\d{5})\s*$/i;

/**
 * Solo reconoce el nombre PROVISIONAL, que siempre termina en el número de
 * cámara. Sin esa exigencia la función no sería idempotente: aplicada a su
 * propia salida leería "Bolsa de piedras · A" como código "A" y la renombraría
 * a "Piedra A" en cada corrida. La única excepción es la bolsita que llegó sin
 * etiqueta y sin número.
 */
export function interpretaBolsita(nombre: string): Bolsita | null {
  const limpio = nombre.trim();
  if (/^Bolsa de Piedras$/i.test(limpio)) return { codigo: "", piezas: "", toma: "" };

  const m = RE_BOLSITA.exec(limpio);
  if (!m) return null;
  return {
    codigo: (m[1] ?? "").trim(),
    piezas: m[2] ?? "",
    toma: m[3] ?? "",
  };
}

/**
 * Nombre sin el número de cámara. `sufijo` desempata las bolsitas que quedan
 * con el mismo rótulo; quien llama lo asigna en orden estable (por número de
 * toma) para que dos corridas den el mismo resultado.
 */
export function nombreDeBolsita(b: Bolsita, sufijo = ""): string {
  const partes = [
    b.codigo ? `Piedra ${b.codigo}` : "Bolsa de piedras",
    b.piezas ? `${b.piezas} pz` : "",
    sufijo,
  ].filter(Boolean);
  return partes.join(" · ");
}
