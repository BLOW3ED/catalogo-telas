/**
 * Vocabulario del encuadre manual (PURO — sin sharp; corre en cliente y servidor).
 *
 * El curador de fotos de /admin NO recorta píxeles en el navegador: un
 * `<canvas>` re-comprime, tira el perfil ICC y en iOS submuestrea las fotos
 * grandes, que es justo lo que este catálogo no puede permitirse (los colores
 * del producto son el producto). El cliente solo decide UN RECTÁNGULO y lo
 * manda como fracciones; el corte real lo hace `aplicar-encuadre.ts` con sharp
 * sobre el archivo original a resolución completa.
 *
 * El sistema de coordenadas es el de la imagen MOSTRADA: con la orientación
 * EXIF ya aplicada (el navegador lo hace solo desde `image-orientation:
 * from-image`, y sharp con `{ autoOrient: true }`) y con el giro manual encima.
 * Así el rectángulo que el usuario ve es literalmente el que se extrae.
 */

export const GIROS = [0, 90, 180, 270] as const;
export type Giro = (typeof GIROS)[number];

/**
 * Encuadre serializado, en FRACCIONES del ancho/alto de la imagen mostrada.
 *
 * Fracciones y no píxeles a propósito: si el navegador y sharp discreparan en
 * las dimensiones (Safari submuestrea decodificaciones grandes, un EXIF raro se
 * lee distinto), un recorte en píxeles saldría corrido; una fracción es
 * invariante a la resolución mientras la PROPORCIÓN se conserve, y se conserva
 * siempre.
 *
 * `w` es fracción del ancho y `h` del alto, así que en una foto no cuadrada
 * w ≠ h aunque el recorte SÍ sea cuadrado en píxeles. El servidor lo vuelve
 * cuadrado exacto al convertir (`pixelesDelEncuadre`).
 */
export type Encuadre = { x: number; y: number; w: number; h: number; giro: Giro };

/** Estado del visor: cuánto acerca y dónde está centrada la ventana. */
export type Vista = {
  /** 1 = la ventana cubre el lado corto de la foto. Nunca menor a 1. */
  zoom: number;
  /** Centro de la ventana, en fracciones de la imagen mostrada. */
  cx: number;
  cy: number;
  giro: Giro;
};

export const VISTA_INICIAL: Vista = { zoom: 1, cx: 0.5, cy: 0.5, giro: 0 };

/**
 * Lado mínimo del maestro recortado, en píxeles del original.
 *
 * Es el tope del acercamiento: por debajo de esto el maestro ya no alimenta ni
 * el derivado `sm` (800 px) sin que `withoutEnlargement` lo deje borroso en el
 * grid. No es una preferencia estética, es el piso del pipeline.
 */
export const LADO_MINIMO = 600;

/**
 * Debajo de este lado el maestro no alcanza para el derivado `md` (1600 px),
 * que es el que pinta la ficha de producto. La foto se sube igual — es decisión
 * de la tienda — pero el curador lo avisa.
 */
export const LADO_COMODO = 1600;

const EPSILON = 0.001;

function acotar(valor: number, min: number, max: number): number {
  return valor < min ? min : valor > max ? max : valor;
}

export function esGiro(valor: unknown): valor is Giro {
  return GIROS.includes(valor as Giro);
}

/**
 * Dimensiones de la imagen MOSTRADA: las naturales (ya con EXIF aplicado por
 * el navegador) con los lados intercambiados si el giro manual es de un cuarto
 * de vuelta.
 */
export function dimensionesMostradas(
  anchoNatural: number,
  altoNatural: number,
  giro: Giro
): { ancho: number; alto: number } {
  return giro % 180 === 0
    ? { ancho: anchoNatural, alto: altoNatural }
    : { ancho: altoNatural, alto: anchoNatural };
}

/** Lado de la ventana cuando `zoom = 1`: la foto justo la cubre. */
export function ladoCubriente(ancho: number, alto: number): number {
  return Math.min(ancho, alto);
}

/**
 * Tope de acercamiento: el que deja el recorte justo en LADO_MINIMO. En una
 * foto ya pequeña el tope es 1 (no se puede acercar) en vez de un número < 1,
 * que dejaría al usuario sin ningún margen de maniobra.
 */
export function zoomMaximo(ancho: number, alto: number): number {
  return Math.max(1, ladoCubriente(ancho, alto) / LADO_MINIMO);
}

/** La ventana en píxeles de la imagen mostrada. */
export function rectDeVista(
  vista: Vista,
  ancho: number,
  alto: number
): { left: number; top: number; lado: number } {
  const lado = ladoCubriente(ancho, alto) / vista.zoom;
  return { left: vista.cx * ancho - lado / 2, top: vista.cy * alto - lado / 2, lado };
}

/**
 * POLÍTICA DE ENCUADRE — la ventana nunca se sale de la foto ("cubrir").
 *
 * Es la única regla que decide qué puede y qué no puede hacer el usuario con
 * el zoom y el arrastre, y por eso vive sola en su función.
 *
 * Se eligió CUBRIR (acotar el centro para que la ventana quede dentro de la
 * foto, y el zoom nunca baje de 1) sobre la alternativa de dejarla desbordar y
 * rellenar con el color del fondo, como sí hace `recorte.ts` en el pipeline
 * automático. El razonamiento: ahí el desborde es el mal menor porque nadie
 * está mirando —es un script sobre 115 bolsitas— y mutilar el producto sería
 * peor. Aquí hay una persona decidiendo, la previsualización promete "así se va
 * a ver", y una banda de fondo inventado rompería esa promesa. Si el producto
 * no cabe en cuadrado, la respuesta correcta es volver a tomar la foto o pasarla
 * por `pnpm preparar`, que sí sabe encajar.
 */
export function vistaLimitada(vista: Vista, ancho: number, alto: number): Vista {
  const zoom = acotar(vista.zoom, 1, zoomMaximo(ancho, alto));
  const lado = ladoCubriente(ancho, alto) / zoom;

  // Mitad de la ventana, en fracciones de cada eje: el centro no puede acercarse
  // al borde más que eso o la ventana se saldría.
  const margenX = lado / 2 / ancho;
  const margenY = lado / 2 / alto;

  return {
    zoom,
    cx: acotar(vista.cx, margenX, 1 - margenX),
    cy: acotar(vista.cy, margenY, 1 - margenY),
    giro: vista.giro,
  };
}

/** Vista → encuadre serializable. Acota antes: nunca serializa un desborde. */
export function encuadreDeVista(vista: Vista, ancho: number, alto: number): Encuadre {
  const limitada = vistaLimitada(vista, ancho, alto);
  const { left, top, lado } = rectDeVista(limitada, ancho, alto);
  return {
    x: left / ancho,
    y: top / alto,
    w: lado / ancho,
    h: lado / alto,
    giro: limitada.giro,
  };
}

/** Encuadre → vista, para reabrir una foto ya curada sin perder su ajuste. */
export function vistaDeEncuadre(encuadre: Encuadre, ancho: number, alto: number): Vista {
  const lado = encuadre.w * ancho;
  return vistaLimitada(
    {
      zoom: ladoCubriente(ancho, alto) / lado,
      cx: encuadre.x + encuadre.w / 2,
      cy: encuadre.y + encuadre.h / 2,
      giro: encuadre.giro,
    },
    ancho,
    alto
  );
}

/**
 * true = el encuadre no cambia nada (foto ya cuadrada, sin girar, sin acercar).
 * El servidor lo usa para subir los BYTES ORIGINALES sin re-comprimir: recortar
 * un JPEG obliga a re-codificarlo, y si no hay nada que recortar ese paso solo
 * puede restar calidad.
 */
export function esEncuadreCompleto(encuadre: Encuadre): boolean {
  return (
    encuadre.giro === 0 &&
    Math.abs(encuadre.x) < EPSILON &&
    Math.abs(encuadre.y) < EPSILON &&
    Math.abs(encuadre.w - 1) < EPSILON &&
    Math.abs(encuadre.h - 1) < EPSILON
  );
}

/**
 * Encuadre → rectángulo entero en píxeles, garantizado CUADRADO y DENTRO de la
 * imagen. sharp revienta si `extract` se sale aunque sea un píxel, así que este
 * acotado no es cortesía: es lo que evita un 500 con una foto rara.
 */
export function pixelesDelEncuadre(
  encuadre: Encuadre,
  ancho: number,
  alto: number
): { left: number; top: number; width: number; height: number } {
  // El cuadrado se reconstruye del lado MENOR de los dos ejes: el redondeo de
  // fracciones puede dejar w*ancho y h*alto separados por un píxel.
  const lado = acotar(
    Math.round(Math.min(encuadre.w * ancho, encuadre.h * alto)),
    1,
    Math.min(ancho, alto)
  );
  return {
    left: acotar(Math.round(encuadre.x * ancho), 0, ancho - lado),
    top: acotar(Math.round(encuadre.y * alto), 0, alto - lado),
    width: lado,
    height: lado,
  };
}

/**
 * Valida el JSON que manda el curador. Es entrada NO CONFIABLE: la server
 * action es un endpoint público y cualquiera puede postear lo que quiera, así
 * que un encuadre malformado se descarta (la foto sube entera) en vez de
 * tumbar la subida completa.
 *
 * Devuelve un arreglo alineado por índice con los archivos; `null` = esa foto
 * se sube tal cual.
 */
export function parsearEncuadres(bruto: unknown, cantidad: number): (Encuadre | null)[] {
  const vacio = Array<Encuadre | null>(cantidad).fill(null);
  if (typeof bruto !== "string" || !bruto.trim()) return vacio;

  let crudo: unknown;
  try {
    crudo = JSON.parse(bruto);
  } catch {
    return vacio;
  }
  if (!Array.isArray(crudo)) return vacio;

  return vacio.map((_, i) => encuadreValido(crudo[i]));
}

function encuadreValido(valor: unknown): Encuadre | null {
  if (!valor || typeof valor !== "object") return null;
  const { x, y, w, h, giro } = valor as Record<string, unknown>;
  const numeros = [x, y, w, h];
  if (!numeros.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (!esGiro(giro)) return null;

  const e = { x, y, w, h, giro } as Encuadre;
  // Un lado no positivo o un origen fuera de la foto significan que el cliente
  // mandó basura, no un encuadre agresivo: descartarlo es más seguro que acotarlo.
  if (e.w <= 0 || e.h <= 0 || e.w > 1 + EPSILON || e.h > 1 + EPSILON) return null;
  if (e.x < -EPSILON || e.y < -EPSILON) return null;
  if (e.x + e.w > 1 + EPSILON || e.y + e.h > 1 + EPSILON) return null;

  return esEncuadreCompleto(e) ? null : e;
}

/**
 * Acerca o aleja MANTENIENDO FIJO el punto bajo el cursor (o bajo el centro del
 * pellizco), en vez de acercar hacia el centro de la ventana.
 *
 * Es la diferencia entre "hacer zoom" y "hacer zoom en ESTO": quien está
 * revisando el brillo de una piedra apunta a la piedra y espera que la piedra
 * se quede donde está. Acercar al centro obliga a arrastrar después de cada
 * rueda del ratón.
 *
 * `fx`/`fy` son la posición del ancla DENTRO de la ventana, en fracciones
 * (0 = borde izquierdo/superior, 1 = derecho/inferior), así que el llamador no
 * necesita saber a qué tamaño se está pintando.
 */
export function zoomEnPunto(
  vista: Vista,
  ancho: number,
  alto: number,
  fx: number,
  fy: number,
  factor: number
): Vista {
  const antes = rectDeVista(vista, ancho, alto);
  // Punto de la imagen que hay que dejar clavado.
  const ix = antes.left + fx * antes.lado;
  const iy = antes.top + fy * antes.lado;

  const zoom = acotar(vista.zoom * factor, 1, zoomMaximo(ancho, alto));
  const lado = ladoCubriente(ancho, alto) / zoom;

  return vistaLimitada(
    {
      zoom,
      cx: (ix - fx * lado + lado / 2) / ancho,
      cy: (iy - fy * lado + lado / 2) / alto,
      giro: vista.giro,
    },
    ancho,
    alto
  );
}

/**
 * Gira un cuarto de vuelta en sentido horario, arrastrando el encuadre con la
 * foto.
 *
 * Sin rotar el centro, girar una foto ya encuadrada la manda de vuelta al medio
 * y hay que reencuadrar desde cero — que es justo lo que pasa cuando descubres
 * que la toma estaba acostada DESPUÉS de haber ajustado el detalle.
 *
 * Al girar horario, el punto (u,v) aterriza en (1−v, u): el borde superior pasa
 * a ser el derecho. Los lados de la imagen se intercambian, así que el llamador
 * debe pasar las dimensiones que había ANTES del giro.
 */
export function girarVista(vista: Vista, ancho: number, alto: number): Vista {
  return vistaLimitada(
    {
      zoom: vista.zoom,
      cx: 1 - vista.cy,
      cy: vista.cx,
      giro: ((vista.giro + 90) % 360) as Giro,
    },
    // Tras el giro los lados quedan intercambiados.
    alto,
    ancho
  );
}
