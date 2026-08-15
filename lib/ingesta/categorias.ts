/**
 * Categoría de un producto de mercería a partir del código de la tienda.
 * ===========================================================================
 * La tienda codifica el TIPO de producto en las letras del código: "HE020" es
 * una hebilla, "BO12" un botón, "JR1103" un corchete. Ese prefijo es la única
 * pista de categoría que traen la mitad de las fotos, porque el nombre de
 * archivo no dice nada más.
 *
 * Igual que `nombres.ts`, esto son REGLAS DE NEGOCIO, no parseo genérico: cada
 * regla se verificó ABRIENDO LA FOTO del producto, no deduciendo del texto.
 * Equivocarse aquí no rompe nada — simplemente archiva el producto en el cajón
 * equivocado y el cliente no lo encuentra nunca.
 *
 * La taxonomía es POR FORMA DEL PRODUCTO, que es como la tienda las acomoda
 * en el mostrador: una tira, un galón, una aplicación y una piedra suelta se
 * buscan distinto aunque todas sean pedrería.
 *
 * `null` cuando el código no cae en ninguna regla: preferimos "sin clasificar"
 * a inventar. El script de clasificación los lista para que la tienda decida.
 */

/** Categoría del catálogo: nombre visible + slug estable para la URL. */
export type Categoria = { nombre: string; slug: string };

export const CATEGORIAS = {
  TIRA: { nombre: "Tira de pedrería", slug: "tira-de-pedreria" },
  GALON: { nombre: "Galón de encaje", slug: "galon-de-encaje" },
  FLECO: { nombre: "Fleco de pedrería", slug: "fleco-de-pedreria" },
  CINTILLO: { nombre: "Cintillo de pedrería", slug: "cintillo-de-pedreria" },
  APLICACION: { nombre: "Aplicación de pedrería", slug: "aplicacion-de-pedreria" },
  HEBILLA: { nombre: "Hebilla", slug: "hebilla" },
  PIEDRA: { nombre: "Piedra suelta", slug: "piedra-suelta" },
  COPAS: { nombre: "Copas", slug: "copas" },
  CINTA: { nombre: "Cinta", slug: "cinta" },
  BOTONES: { nombre: "Botones", slug: "botones" },
  CORCHETES: { nombre: "Corchetes", slug: "corchetes" },
  FLORES: { nombre: "Flores", slug: "flores" },
  // Tela de verdad (no mercería). Ya venían sembradas en la sección 8 del SQL;
  // se repiten aquí para que el clasificador las pueda asignar sola.
  CHIFON: { nombre: "Chifón", slug: "chifon" },
  TUL: { nombre: "Tul", slug: "tul" },
  TUL_BORDADO: { nombre: "Tul Bordado", slug: "tul-bordado" },
} as const satisfies Record<string, Categoria>;

/**
 * Cómo se vende cada categoría.
 * ---------------------------------------------------------------------------
 * La forma del producto decide la unidad: una tira y un galón se cortan por
 * metro, pero un cintillo, una aplicación o una hebilla se venden de a una, y
 * la piedra suelta va a granel en bolsa.
 *
 * Existe porque la ingesta metió TODO como `metro` —era el default de la
 * columna— y eso llenó el catálogo de precios "$89/m" en piezas sueltas, que
 * es un precio que nadie puede cobrar. Es un DEFAULT por categoría, no una
 * verdad absoluta: lo que la tienda capture a mano desde /admin manda.
 */
export const UNIDAD_POR_CATEGORIA: Record<string, string> = {
  // Se cortan del rollo.
  [CATEGORIAS.TIRA.slug]: "metro",
  [CATEGORIAS.GALON.slug]: "metro",
  [CATEGORIAS.FLECO.slug]: "metro",
  [CATEGORIAS.CINTA.slug]: "metro",
  [CATEGORIAS.CHIFON.slug]: "metro",
  [CATEGORIAS.TUL.slug]: "metro",
  [CATEGORIAS.TUL_BORDADO.slug]: "metro",
  // Se venden de a una.
  [CATEGORIAS.CINTILLO.slug]: "pieza",
  [CATEGORIAS.APLICACION.slug]: "pieza",
  [CATEGORIAS.HEBILLA.slug]: "pieza",
  [CATEGORIAS.BOTONES.slug]: "pieza",
  [CATEGORIAS.CORCHETES.slug]: "pieza",
  [CATEGORIAS.FLORES.slug]: "pieza",
  // A granel.
  [CATEGORIAS.PIEDRA.slug]: "bolsa",
  // Las copas van en PAR: es media prenda, no se vende una sola.
  [CATEGORIAS.COPAS.slug]: "par",
};

/** Unidad de venta que le toca a una categoría, o `null` si no hay regla. */
export function unidadDeCategoria(slug: string | null | undefined): string | null {
  const k = slug?.trim();
  return (k && UNIDAD_POR_CATEGORIA[k]) ?? null;
}

export type ReglaCategoria = {
  re: RegExp;
  categoria: Categoria;
  /** Un código real del lote que esta regla clasifica; lo fija la prueba. */
  ejemplo: string;
};

/**
 * ORDEN SIGNIFICATIVO: se evalúa de arriba abajo y gana la primera que casa.
 * Las reglas específicas van antes que las generales porque varios prefijos
 * comparten primera letra y significan cosas distintas:
 *
 *   B198 es un fleco, pero BNK1041 es una tira, BO12 un botón,
 *   BT279 un cintillo y BCP115 una aplicación.
 *
 * Las que empiezan con letra+letra no chocan con las de letra+dígito (`^B\d`
 * no toca "BNK"), pero se dejan ordenadas igual para que agregar una regla
 * nueva no obligue a re-derivar el razonamiento.
 */
export const REGLAS_CATEGORIA: ReglaCategoria[] = [
  // — Tela, que se nombra en palabras y no en código. Va primero porque es el
  // caso fácil y no compite con ningún prefijo: ninguna regla de mercería
  // arranca con letra+letra minúscula. "Tul Bordado" antes que "Tul", si no
  // el bordado se archiva como tul liso.
  { re: /^tul\s+bordado/i, categoria: CATEGORIAS.TUL_BORDADO, ejemplo: "Tul Bordado Margarita" },
  { re: /^tul\b/i, categoria: CATEGORIAS.TUL, ejemplo: "Tul Punto Lunares" },
  // La tienda escribe "Chifon" tanto como "Chifón": el acento es opcional.
  { re: /^chif[oó]n/i, categoria: CATEGORIAS.CHIFON, ejemplo: "Chifon Lunares" },

  // — Tiras: cadena de strass larga y continua, se vende por metro/tramo.
  { re: /^BNK\d/i, categoria: CATEGORIAS.TIRA, ejemplo: "BNK1041" },
  // "KPA" existe como código a secas (sin número), de ahí el `|$`.
  { re: /^KPA?(\d|$)/i, categoria: CATEGORIAS.TIRA, ejemplo: "KP151" },
  { re: /^TDC\d/i, categoria: CATEGORIAS.TIRA, ejemplo: "TDC68" },
  // T4L es tira pese a empezar con T+dígito: va ANTES de la regla `^T\d`,
  // que es de cintillos. Sin esta línea acabaría mal clasificada.
  { re: /^T4L$/i, categoria: CATEGORIAS.TIRA, ejemplo: "T4L" },

  // — Galón de encaje: cinta de encaje BLANCO (motivo IHS, orilla ondulada).
  // No es pedrería; meterlo con lo demás fue el primer error que corrigió la
  // revisión de fotos. "4212" es el mismo producto que "TGL4212" con el
  // prefijo comido, por eso el número suelto también cae aquí.
  { re: /^TGL?\d/i, categoria: CATEGORIAS.GALON, ejemplo: "TGL254" },
  { re: /^G\d/i, categoria: CATEGORIAS.GALON, ejemplo: "G4082" },
  { re: /^\d+$/, categoria: CATEGORIAS.GALON, ejemplo: "4212" },

  // — Cintillos y diademas: tira delgada rematada con listón o ganchos.
  { re: /^BT\d/i, categoria: CATEGORIAS.CINTILLO, ejemplo: "BT279" },
  { re: /^CT\d/i, categoria: CATEGORIAS.CINTILLO, ejemplo: "CT279" },
  { re: /^TC\d/i, categoria: CATEGORIAS.CINTILLO, ejemplo: "TC199" },
  { re: /^T\d/i, categoria: CATEGORIAS.CINTILLO, ejemplo: "T339" },

  // — Aplicaciones: pieza suelta que se cose encima (broche, mariposa, flor
  // de metal, óvalo). Distintas formas, mismo uso.
  { re: /^BCP\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "BCP115" },
  { re: /^DB\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "DB16" },
  { re: /^D\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "D440" },
  { re: /^FP\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "FP1523" },
  { re: /^JF\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "JF001" },
  { re: /^MC\d/i, categoria: CATEGORIAS.APLICACION, ejemplo: "MC45" },

  { re: /^HE\d/i, categoria: CATEGORIAS.HEBILLA, ejemplo: "HE020" },

  // — Piedra suelta: se vende a granel, en frasco o bolsita.
  { re: /^PCC\d/i, categoria: CATEGORIAS.PIEDRA, ejemplo: "PCC120" },
  { re: /^I\d/i, categoria: CATEGORIAS.PIEDRA, ejemplo: "I1403" },
  { re: /^GEMA/i, categoria: CATEGORIAS.PIEDRA, ejemplo: "Gema" },
  { re: /^BOLSITA/i, categoria: CATEGORIAS.PIEDRA, ejemplo: "BolsitaPiedras" },
  { re: /^BOLSA DE PIEDRAS/i, categoria: CATEGORIAS.PIEDRA, ejemplo: "Bolsa de Piedras" },
  { re: /^PIEDRA /i, categoria: CATEGORIAS.PIEDRA, ejemplo: "Piedra 1404" },

  // — Fleco: strass que cuelga en hilos. `^B\d` va al final de la familia B.
  { re: /^B\d/i, categoria: CATEGORIAS.FLECO, ejemplo: "B198" },

  // — Familias ya descriptivas en el nombre de archivo.
  { re: /^COP/i, categoria: CATEGORIAS.COPAS, ejemplo: "CopTirante" },
  { re: /^YULI/i, categoria: CATEGORIAS.CINTA, ejemplo: "YuliCintaBies16mm" },
  { re: /^BO\d/i, categoria: CATEGORIAS.BOTONES, ejemplo: "BO12" },
  { re: /^JR\d/i, categoria: CATEGORIAS.CORCHETES, ejemplo: "JR1103" },
  { re: /^FLOR/i, categoria: CATEGORIAS.FLORES, ejemplo: "Flor348Humo" },
];

/**
 * Categoría de un código de tienda, o `null` si ninguna regla lo reconoce.
 *
 * Acepta tanto el nombre base del archivo ("BNK104100005" ya sin contador)
 * como el SKU o el nombre provisional del modelo, porque en este lote los tres
 * son la misma cadena: el código.
 */
export function categoriaDeCodigo(codigo: string | null | undefined): Categoria | null {
  const limpio = codigo?.trim();
  if (!limpio) return null;
  return REGLAS_CATEGORIA.find((r) => r.re.test(limpio))?.categoria ?? null;
}
