/**
 * Unidad de venta: cómo se cobra y cómo se cuenta cada producto.
 * ===========================================================================
 * El catálogo dejó de ser solo tela. `variante.precio` es por METRO en una
 * tela, pero por PIEZA en un botón y por BOLSA en la pedrería a granel
 * (`unidad_venta`, sección 13 del SQL).
 *
 * Esto no es solo una etiqueta. La unidad decide también CÓMO SE CUENTA:
 * la tela se corta a medios metros, así que el stepper va de 0.5 en 0.5; un
 * botón no se parte a la mitad. Antes todo el catálogo se contaba como tela y
 * se podía agregar "0.5 botones" a la cotización, que es un pedido imposible
 * de surtir.
 *
 * `metro` es el default en todos lados a propósito: es lo que había antes de
 * que existiera esta columna, así que un dato faltante —o un carrito guardado
 * en localStorage desde antes— se comporta exactamente como se comportaba.
 */

export const UNIDADES_VENTA = ["metro", "pieza", "par", "bolsa", "rollo", "juego"] as const;

export type UnidadVenta = (typeof UNIDADES_VENTA)[number];

export type Unidad = {
  clave: UnidadVenta;
  /** Sufijo del precio: "$79.00/m", "$18.00/bolsa". */
  sufijoPrecio: string;
  /** Forma compacta para el carrito, donde el espacio es poco: "3 m", "2 pz". */
  abreviatura: string;
  singular: string;
  plural: string;
  /** Cuánto sube o baja el stepper con cada toque. */
  paso: number;
  /** Lo mínimo que se puede pedir. */
  minimo: number;
};

const METRO: Unidad = {
  clave: "metro",
  sufijoPrecio: "/m",
  abreviatura: "m",
  singular: "metro",
  plural: "metros",
  // La tienda corta a medio metro; es el incremento con el que se despacha.
  paso: 0.5,
  minimo: 0.5,
};

/** Todo lo que no es tela se vende entero: paso y mínimo de 1. */
function porPieza(
  clave: UnidadVenta,
  singular: string,
  plural: string,
  abreviatura = singular
): Unidad {
  return {
    clave,
    sufijoPrecio: `/${singular}`,
    abreviatura,
    singular,
    plural,
    paso: 1,
    minimo: 1,
  };
}

const UNIDADES: Record<UnidadVenta, Unidad> = {
  metro: METRO,
  pieza: porPieza("pieza", "pieza", "piezas", "pz"),
  par: porPieza("par", "par", "pares"),
  bolsa: porPieza("bolsa", "bolsa", "bolsas"),
  rollo: porPieza("rollo", "rollo", "rollos"),
  juego: porPieza("juego", "juego", "juegos"),
};

/**
 * Unidad a partir del valor de la BD. Tolerante a propósito: un valor
 * desconocido (una unidad nueva que alguien agregó en Studio antes de que el
 * front la conozca) cae a metro en vez de tumbar la página.
 */
export function unidadDe(clave: string | null | undefined): Unidad {
  const k = clave?.trim().toLowerCase();
  return (k && UNIDADES[k as UnidadVenta]) || METRO;
}

/** Redondea al paso de la unidad: evita "2.5 piezas" si algo llega sucio. */
export function ajustaCantidad(cantidad: number, unidad: Unidad): number {
  const pasos = Math.round(cantidad / unidad.paso);
  return Math.max(unidad.minimo, pasos * unidad.paso);
}

/** Compacto, para el carrito: "3 m", "2 pz", "1 bolsa". */
export function cantidadCorta(cantidad: number, clave: string | null | undefined): string {
  const u = unidadDe(clave);
  // "3 m" sin espacio se leía como "3m" en el diseño original de la tela;
  // con abreviaturas de palabra ("bolsa") el espacio es indispensable.
  return u.clave === "metro" ? `${cantidad} m` : `${cantidad} ${u.abreviatura}`;
}

/**
 * Con todas las letras, para el mensaje de WhatsApp, donde lo lee una persona
 * que va a surtir el pedido: "3 metros", "2 bolsas (25 pz c/u)".
 *
 * `piezasPorUnidad` solo aparece si la unidad viene empaquetada; sin él, la
 * vendedora no sabe si "2 bolsas" son 12 o 60 piedras.
 */
export function cantidadLarga(
  cantidad: number,
  clave: string | null | undefined,
  piezasPorUnidad?: number | null
): string {
  const u = unidadDe(clave);
  const nombre = cantidad === 1 ? u.singular : u.plural;
  const base = `${cantidad} ${nombre}`;
  return u.clave !== "metro" && piezasPorUnidad
    ? `${base} (${piezasPorUnidad} pz c/u)`
    : base;
}

/** Etiqueta del stepper, siempre en plural: "metros", "piezas". */
export function etiquetaStepper(clave: string | null | undefined): string {
  return unidadDe(clave).plural;
}
