/**
 * Recorte automático de producto sobre fondo liso (SOLO servidor / scripts).
 *
 * Las tomas de mercería vienen de estudio: el producto ocupa 5–15% del
 * encuadre, centrado sobre un fondo liso (negro o gris claro). Subirlas tal
 * cual deja un grid de catálogo casi vacío, así que hay que encontrar el
 * sujeto y recortar alrededor.
 *
 * El detector NO usa "qué tan distinto es el pixel del fondo": ese criterio
 * confunde el viñeteo del lente (las esquinas son más oscuras que el centro)
 * con producto, y en las tomas sobre gris claro se traga el encuadre entero.
 * Usa ENERGÍA DE BORDE (gradiente Sobel): el producto tiene bordes duros, el
 * viñeteo es un degradado suave. Como refuerzo suma los pixeles que se apartan
 * MUCHO de la mediana, que rescata sujetos planos y sin textura (una etiqueta
 * blanca sobre negro) cuyo interior no tiene gradiente.
 *
 * El análisis corre sobre una miniatura (~256 px): el bbox se escala al
 * original, así que el costo es constante sin importar el tamaño de entrada.
 */
import sharp, { type Sharp } from "sharp";

/** Lado de la miniatura de análisis. Suficiente para ubicar el sujeto. */
const LADO_ANALISIS = 256;

/**
 * Margen alrededor del sujeto, como fracción del LADO DEL SUJETO
 * (`lado = sujeto * (1 + 2*MARGEN)`, o sea el aire por lado es
 * `MARGEN / (1 + 2*MARGEN)` del cuadrado, no `MARGEN`).
 *
 * NO es solo estética: la card del catálogo pinta este cuadrado en una ventana
 * `aspect-[3/4]` con `object-cover`, que descarta 12.5% del ancho por lado —
 * 13.6% contando el `group-hover:scale-[1.03]` de ProductCard. El aire tiene
 * que superar ese número o el CSS se come producto:
 *
 *     0.12 →  9.7%  ✗ cortaba (era el valor viejo; se veía en gemas y tiras)
 *     0.18 → 13.2%  ✗ corta en hover, por un pelo
 *     0.28 → 17.9%  ✓ deja 4.3% de aire lateral visible
 *
 * Si alguna vez la ventana se vuelve cuadrada, este número puede bajar a ~0.18:
 * el descarte del CSS pasaría a 0 y el margen volvería a ser solo estética.
 */
const MARGEN = 0.28;

/**
 * Desborde máximo POR LADO (fracción del cuadrado) que todavía se rellena con
 * fondo. Por encima se ENCAJA el sujeto completo, escalándolo para que quepa.
 *
 * El criterio es que la banda de relleno quepa DENTRO del anillo de aire
 * (17.9% con el MARGEN de arriba), para que nunca toque el producto. Contra los
 * datos del lote: los .ARW son 7008x4672, y un desborde `d` por lado implica
 * `lado = 4672/(1-2d)`; con d=0.10 el sujeto mide ~3738 px (53% del encuadre),
 * así que una flor grande o un par de copas cae en RELLENAR con banda de 4-6%,
 * mientras que una tira cruzando el encuadre (5000-6500 px) da d=16-23% y cae
 * en ENCAJAR — que es justo el grupo que salía espejeado.
 */
const DESBORDE_MAX = 0.10;

/** Grosor del anillo del marco que se muestrea para el color de fondo, en px
 *  de la miniatura de análisis. */
const ANILLO_FONDO = 6;

/**
 * Fracción del ancho del cuadrado que la card llega a enseñar: la ventana es
 * `aspect-[3/4]` con `object-cover`, así que se ve el 75% central.
 *
 * Solo lo usa el modo ENCAJAR. En RELLENAR no hace falta porque MARGEN ya deja
 * 17.9% de aire por lado, más que el 13.6% que la ventana descarta. Pero en
 * ENCAJAR el sujeto ocupa la foto COMPLETA por definición —por eso se encaja en
 * vez de recortar— y encajarlo en el cuadrado entero significa que la ventana
 * le corta 12.5% por lado: la tira volvía a salir con las puntas cortadas,
 * justo lo que el modo existe para evitar. Encajándola en el área visible se ve
 * entera en la card, que es donde se juzga.
 *
 * Es el único punto del pipeline que sabe de la proporción de la card. Si la
 * ventana cambia a cuadrada, esto pasa a 1.
 */
const VENTANA_SEGURA = 0.75;

/**
 * Un recorte que cubre casi todo el encuadre significa que el detector no
 * encontró nada (fondo sucio, foto fuera de foco): mejor no recortar.
 */
const COBERTURA_MAX = 0.9;

/**
 * Una componente se conserva si tiene al menos esta fracción de la mayor.
 * Cubre productos de partes separables (un par de copas, flor + pétalo suelto)
 * sin readmitir motas de polvo, que son órdenes de magnitud más chicas.
 */
const FRACCION_COMPONENTE = 0.2;

/**
 * Escalada de severidad del umbral. Sobre fondo negro el sujeto salta con el
 * corte más laxo; sobre gris claro con viñeteo y trama de tela visible, ese
 * corte marca el encuadre entero. En vez de calibrar un umbral único que sirva
 * para ambos (no existe), se prueban de laxo a estricto y se toma el PRIMERO
 * que produce un recorte plausible — el laxo gana cuando de verdad funciona,
 * así que las tomas fáciles no pagan el precio de un corte pensado para las
 * difíciles.
 */
const SEVERIDADES = [0.15, 0.3, 0.45, 0.6, 0.75];

export type Recorte = { left: number; top: number; width: number; height: number };

export type RGB = { r: number; g: number; b: number };

export type ResultadoRecorte = {
  /** null = no se detectó sujeto confiable; el caller debe dejar la foto intacta. */
  recorte: Recorte | null;
  /** Fracción del encuadre original que ocupaba el sujeto detectado (diagnóstico). */
  cobertura: number;
  /** Color del fondo de estudio, muestreado del marco de la propia foto. */
  fondo: RGB;
  /**
   * true → el cuadrado se sale tanto de la foto que rellenarlo inventaría más
   * fondo del que cabe en el aire. El caller debe ENCAJAR en vez de RELLENAR.
   */
  encajar: boolean;
};

/**
 * Decide el modo de encuadre a partir de pura geometría.
 *
 * Aparte para poder fijarlo con una tabla de números en los tests, sin
 * decodificar imágenes: el umbral es una decisión de producto y cambiarlo
 * tiene que ser deliberado.
 */
export function modoEncuadre(
  recorte: Recorte,
  anchoOrig: number,
  altoOrig: number
): "rellenar" | "encajar" {
  const desborde = Math.max(
    -Math.min(0, recorte.left),
    -Math.min(0, recorte.top),
    Math.max(0, recorte.left + recorte.width - anchoOrig),
    Math.max(0, recorte.top + recorte.height - altoOrig)
  ) / recorte.width;
  return desborde > DESBORDE_MAX ? "encajar" : "rellenar";
}

/**
 * Color del fondo de estudio, muestreado del ANILLO EXTERIOR de la miniatura.
 *
 * MEDIANA, no media ni `sharp().stats().dominant`. `dominant` mira la imagen
 * ENTERA —producto incluido— y viene cuantizado en pasos de 8: medido sobre
 * KP16200007 devuelve (152,152,152) cuando el borde real es (134,133,138), o
 * sea 18 niveles de más porque la pedrería clara pesa en el histograma. La
 * mediana del anillo es inmune al producto (que en estas tomas nunca toca el
 * marco) y a un reflejo suelto en la orilla.
 *
 * Se muestrea sobre la miniatura de análisis a propósito: el resize ya promedió
 * ~27x27 px del original por muestra, así que el grano del sensor desaparece
 * sin pagar un blur aparte.
 */
function fondoDelMarco(px: Buffer | Uint8Array, w: number, h: number, canales: number): RGB {
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let y = 0; y < h; y++) {
    const borde = y < ANILLO_FONDO || y >= h - ANILLO_FONDO;
    for (let x = 0; x < w; x++) {
      if (!borde && x >= ANILLO_FONDO && x < w - ANILLO_FONDO) continue;
      const i = (y * w + x) * canales;
      r.push(px[i]); g.push(px[i + 1]); b.push(px[i + 2]);
    }
  }
  const mediana = (a: number[]) => {
    if (!a.length) return 0;
    a.sort((p, q) => p - q);
    return a[a.length >> 1];
  };
  return { r: mediana(r), g: mediana(g), b: mediana(b) };
}

const FONDO_NEUTRO: RGB = { r: 0, g: 0, b: 0 };

/** Magnitud de gradiente Sobel sobre un buffer greyscale de ancho×alto. */
function gradiente(px: Buffer, ancho: number, alto: number): Float32Array {
  const g = new Float32Array(ancho * alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const a = px[i - ancho - 1], b = px[i - ancho], c = px[i - ancho + 1];
      const d = px[i - 1],                            f = px[i + 1];
      const h = px[i + ancho - 1], j = px[i + ancho], k = px[i + ancho + 1];
      const gx = a + 2 * d + h - c - 2 * f - k;
      const gy = a + 2 * b + c - h - 2 * j - k;
      g[i] = Math.hypot(gx, gy);
    }
  }
  return g;
}

function percentil(valores: ArrayLike<number>, p: number): number {
  const orden = Array.from(valores).sort((x, y) => x - y);
  return orden[Math.min(orden.length - 1, Math.floor(orden.length * p))] ?? 0;
}

type Caja = { x0: number; y0: number; x1: number; y1: number };

/**
 * Etiqueta componentes conexas (8-vecinos) de la máscara por flood fill
 * iterativo y devuelve el bbox de la mayor unida a las que le llegan a
 * FRACCION_COMPONENTE. Iterativo y no recursivo a propósito: una máscara que
 * cubra medio encuadre desborda la pila con recursión.
 */
function cajaDelSujeto(mascara: Uint8Array, w: number, h: number): Caja | null {
  const visto = new Uint8Array(w * h);
  const pila: number[] = [];
  const comps: { n: number; caja: Caja }[] = [];

  for (let s = 0; s < mascara.length; s++) {
    if (!mascara[s] || visto[s]) continue;
    visto[s] = 1;
    pila.push(s);
    let n = 0;
    const caja: Caja = { x0: w, y0: h, x1: -1, y1: -1 };

    while (pila.length) {
      const i = pila.pop()!;
      const x = i % w, y = (i / w) | 0;
      n++;
      if (x < caja.x0) caja.x0 = x;
      if (x > caja.x1) caja.x1 = x;
      if (y < caja.y0) caja.y0 = y;
      if (y > caja.y1) caja.y1 = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mascara[j] && !visto[j]) { visto[j] = 1; pila.push(j); }
        }
      }
    }
    comps.push({ n, caja });
  }

  if (!comps.length) return null;
  const mayor = comps.reduce((a, b) => (b.n > a.n ? b : a));
  const minimo = mayor.n * FRACCION_COMPONENTE;

  const union: Caja = { ...mayor.caja };
  for (const c of comps) {
    if (c.n < minimo) continue;
    union.x0 = Math.min(union.x0, c.caja.x0);
    union.y0 = Math.min(union.y0, c.caja.y0);
    union.x1 = Math.max(union.x1, c.caja.x1);
    union.y1 = Math.max(union.y1, c.caja.y1);
  }
  return union;
}

/**
 * Localiza el sujeto y devuelve un recorte CUADRADO con margen, en
 * coordenadas del original, junto con el color del fondo de estudio y el modo
 * de encuadre que le corresponde.
 *
 * Cuadrado NO porque la card sea cuadrada —hoy es 3:4— sino para que el asset
 * horneado no dependa del layout: si mañana cambia la proporción de la card no
 * hay que re-hornear el catálogo entero. Lo que sí depende del layout es
 * MARGEN, que tiene que dejar más aire del que la ventana descarta.
 */
export async function calcularRecorte(
  entrada: Buffer | Uint8Array,
  { exposicion = 1 }: { exposicion?: number } = {}
): Promise<ResultadoRecorte> {
  const img = sharp(entrada, { failOn: "error" }).rotate();
  const meta = await img.metadata();
  const anchoOrig = meta.width ?? 0;
  const altoOrig = meta.height ?? 0;
  if (!anchoOrig || !altoOrig) {
    return { recorte: null, cobertura: 0, fondo: FONDO_NEUTRO, encajar: false };
  }

  // Miniatura greyscale. El blur suave quita grano del sensor, que en ISO alto
  // dispara el gradiente en todo el fondo y ensancha el bbox hasta el marco.
  // La exposición se aplica aquí, sobre la miniatura y no sobre el original:
  // el bbox sale en las mismas coordenadas y evita materializar en memoria una
  // copia expuesta de 33 megapíxeles solo para medir.
  const analisis = exposicion === 1 ? img.clone() : exponer(img.clone(), exposicion);
  const { data, info } = await analisis
    .greyscale()
    .resize(LADO_ANALISIS, LADO_ANALISIS, { fit: "inside" })
    .blur(1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Lectura RGB aparte, para muestrear el color del fondo. Deliberadamente NO
  // se reusa el pipeline de arriba: `greyscale()` va antes del resize y meterle
  // una rama en medio movería los números del detector, que están fijados por
  // los tests. Cuesta un decode extra por foto y no vale el riesgo de ahorrarlo.
  // Va sobre la imagen EXPUESTA porque el relleno se pinta sobre esa.
  const colorPipe = exposicion === 1 ? img.clone() : exponer(img.clone(), exposicion);
  const { data: rgb, info: infoRgb } = await colorPipe
    .removeAlpha()
    .resize(LADO_ANALISIS, LADO_ANALISIS, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const fondo = fondoDelMarco(rgb, infoRgb.width, infoRgb.height, infoRgb.channels);

  const { width: w, height: h } = info;
  const grad = gradiente(data, w, h);

  // Referencias de la imagen: la mediana del gradiente ES el piso de ruido (la
  // mayor parte del encuadre es fondo) y el p99.9 marca el borde más duro; el
  // umbral se interpola entre ambos según la severidad.
  const gMed = percentil(grad, 0.5);
  const gMax = percentil(grad, 0.999);

  let caja: Caja | null = null;
  let cobertura = 0;

  for (const severidad of SEVERIDADES) {
    const umbralBorde = gMed + severidad * (gMax - gMed);

    // Solo gradiente, sin término de luminancia: como el bbox sale de una
    // componente conexa, el CONTORNO del sujeto ya fija la caja y marcar su
    // interior no aporta nada. Un término de luminancia sí traería de vuelta
    // el viñeteo, que sobre fondo gris claro se aparta de la mediana tanto
    // como el producto y forma una mancha enorme pegada al marco.
    const mascara = new Uint8Array(w * h);
    for (let i = 0; i < mascara.length; i++) {
      if (grad[i] > umbralBorde) mascara[i] = 1;
    }

    const c = cajaDelSujeto(mascara, w, h);
    if (!c) break;   // más severidad solo puede borrar más: no sigas

    cobertura = ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)) / (w * h);
    if (cobertura <= COBERTURA_MAX) { caja = c; break; }
  }

  if (!caja) return { recorte: null, cobertura, fondo, encajar: false };
  const { x0, y0, x1, y1 } = caja;

  // Escalar el bbox a coordenadas del original y volverlo cuadrado con margen.
  const escalaX = anchoOrig / w;
  const escalaY = altoOrig / h;
  const cx = ((x0 + x1 + 1) / 2) * escalaX;
  const cy = ((y0 + y1 + 1) / 2) * escalaY;
  const anchoSujeto = (x1 - x0 + 1) * escalaX;
  const altoSujeto = (y1 - y0 + 1) * escalaY;

  const lado = Math.round(Math.max(anchoSujeto, altoSujeto) * (1 + 2 * MARGEN));

  // El cuadrado se centra en el sujeto y PUEDE salirse del encuadre. Antes se
  // limitaba al lado corto del original, y eso cortaba producto: un par de
  // copas más ancho que el alto de la foto no cabe en NINGÚN cuadrado interior,
  // así que limitarlo garantizaba perder los extremos. Quien recorta rellena
  // lo que falta con el color del fondo de estudio, que es liso y uniforme —
  // se prefiere un borde de fondo pintado a un producto mutilado.
  const left = Math.round(cx - lado / 2);
  const top = Math.round(cy - lado / 2);
  const recorte = { left, top, width: lado, height: lado };

  return {
    recorte,
    cobertura,
    fondo,
    encajar: modoEncuadre(recorte, anchoOrig, altoOrig) === "encajar",
  };
}

/**
 * Desenfoque de la costura entre la foto y el relleno de fondo.
 *
 * Historia, porque el valor de aquí antes servía a otra estrategia: el relleno
 * se hacía por ESPEJO (`extendWith: "mirror"`), argumentando que reflejar
 * garantiza continuidad de color en la unión. Lo que garantizaba de verdad era
 * DUPLICAR EL PRODUCTO: en una tira de pedrería —larga y diagonal— el cuadrado
 * se sale por 25-40%, y esa franja salía siendo un eco borroso de la tira, con
 * una X en las esquinas donde el reflejo se cruza consigo mismo. Se veía en el
 * grid de "Tira de pedrería" a simple vista.
 *
 * Ahora el relleno es el color de fondo muestreado del marco de la propia foto
 * (`fondoDelMarco`), que en estas tomas de estudio es plano — medido: (6,5,8)
 * y (8,7,11) en las tiras sobre negro, (124,123,124) sobre gris. El blur ya no
 * está para "leerse como superficie" sino solo para suavizar la costura, donde
 * la mediana del anillo no empata exactamente con la orilla real de la foto,
 * que es la parte más viñeteada. Convierte ese escalón en degradado.
 *
 * Si el halo del producto se extiende demasiado sobre el relleno, bajarlo a
 * 20-24. Un cambio a la vez.
 */
const DESENFOQUE_RELLENO = 40;

/**
 * Sube la exposición escalando los tres canales RGB por igual.
 *
 * Es la única operación que sube el brillo SIN mover el tono: el matiz y la
 * saturación HSV dependen de RAZONES entre canales ((max−min)/max, y los
 * cocientes que definen el ángulo de matiz), y multiplicar los tres por el
 * mismo factor no altera ninguna razón.
 *
 * La alternativa obvia, `modulate({ brightness })`, escala la L de LCh dejando
 * la CROMA ABSOLUTA. Al subir L con C fija, la saturación relativa cae: medido
 * sobre este lote, entre 19% y 36% menos — el rosa se va a un malva grisáceo y
 * el amarillo pierde cuerpo. Eso es exactamente "cambiar la tonalidad".
 *
 * No hace falta anclar el punto negro (`linear(f, -(f-1)*negro)`): el fondo de
 * estudio de estas tomas ya mide 0 en el percentil 1, así que el offset sería
 * cero. Sube de 2 a 2,5 sobre 255, imperceptible.
 */
function exponer(pipe: Sharp, factor: number): Sharp {
  return factor === 1 ? pipe : pipe.linear(factor, 0);
}

/**
 * Aplica exposición y recorte, y devuelve un JPEG listo para la ingesta. Si no
 * se detectó sujeto, devuelve la imagen sin recortar (solo redimensionada),
 * nunca falla: una foto sin recortar es un problema estético, perder la foto no.
 *
 * NO enfoca: el sharpening vive en el pipeline de derivados, que lo aplica
 * después de cada resize. Enfocar aquí también dejaría halos acumulados.
 *
 * El orden importa. La exposición va ANTES del reescalado, sobre la imagen a
 * resolución completa: el promediado del downscale reparte la cuantización que
 * introduce el multiplicar enteros de 8 bits, en vez de arrastrarla a la
 * imagen final. Y la detección corre sobre la imagen ya expuesta, que tiene
 * más contraste de borde donde el producto es oscuro.
 */
export async function recortarProducto(
  entrada: Buffer | Uint8Array,
  { lado = 2400, calidad = 95, exposicion = 1, ventanaSegura = VENTANA_SEGURA }:
    { lado?: number; calidad?: number; exposicion?: number; ventanaSegura?: number } = {}
): Promise<{ buffer: Buffer; recortada: boolean; cobertura: number }> {
  const { recorte, cobertura, fondo, encajar } = await calcularRecorte(entrada, { exposicion });

  // Un solo pipeline, sin intermedios: exponer → recortar → reescalar → JPEG.
  let pipe = exponer(sharp(entrada, { failOn: "error" }).rotate(), exposicion);

  if (recorte) {
    const meta = await sharp(entrada, { failOn: "error" }).rotate().metadata();
    const ancho = meta.width ?? 0, alto = meta.height ?? 0;

    // Intersección con la foto: lo que de verdad se puede extraer.
    const izq = Math.max(0, recorte.left);
    const arr = Math.max(0, recorte.top);
    const der = Math.min(ancho, recorte.left + recorte.width);
    const aba = Math.min(alto, recorte.top + recorte.height);
    const anchoDisp = der - izq, altoDisp = aba - arr;

    // Lado final del cuadrado. `withoutEnlargement`: un producto chico no se
    // amplía, se queda en su resolución nativa.
    const salida = Math.min(recorte.width, lado);

    // Los dos modos difieren SOLO en la escala y el offset; la composición de
    // abajo es común.
    //
    // RELLENAR — el cuadrado manda y lo que pide fuera de la foto se pinta con
    //   el fondo de estudio. Conserva el encuadre y la escala del sujeto. Es el
    //   caso normal: gemas, flores, botones, copas.
    // ENCAJAR  — el sujeto es tan alargado que el cuadrado se sale por mucho
    //   (una tira cruzando el encuadre pide 32-45% de relleno). Se toma lo que
    //   SÍ hay de foto y se escala para CABER, centrado: la tira se ve COMPLETA
    //   y con aire, a cambio de salir más chica. Es el trueque correcto para un
    //   catálogo, donde lo que se juzga es el producto entero, no su textura.
    const escala = encajar
      ? (salida * ventanaSegura) / Math.max(anchoDisp, altoDisp)
      : salida / recorte.width;

    // sharp aplica `extend` DESPUÉS del resize, siempre — el orden del
    // encadenado no manda. Así que el relleno se calcula ya en píxeles de
    // salida; en escala del original agrandaría el resultado.
    const anchoUtil = Math.round(anchoDisp * escala);
    const altoUtil = Math.round(altoDisp * escala);
    const padIzq = encajar
      ? Math.round((salida - anchoUtil) / 2)
      : Math.round((izq - recorte.left) * escala);
    const padArr = encajar
      ? Math.round((salida - altoUtil) / 2)
      : Math.round((arr - recorte.top) * escala);

    const util = await pipe
      .extract({ left: izq, top: arr, width: anchoDisp, height: altoDisp })
      // `fill` y no `inside`: ambos lados llevan el MISMO factor, así que no
      // hay deformación, y da el tamaño exacto que necesita la cuenta de abajo.
      .resize(anchoUtil, altoUtil, { fit: "fill" })
      .toBuffer();

    if (anchoUtil === salida && altoUtil === salida) {
      pipe = sharp(util);   // el cuadrado cupo entero: no hay nada que rellenar
    } else {
      // Fondo en dos tiempos: se completa el cuadrado con el color muestreado
      // del marco de la propia foto, se desenfoca para que la costura contra la
      // orilla (que es la zona más viñeteada) degrade en vez de escalonar, y
      // encima se vuelve a pegar la región nítida, que es la que lleva el
      // producto. `extend` sin `extendWith` usa "background" por default.
      const lienzo = await sharp(util)
        .extend({
          left: padIzq, top: padArr,
          right: Math.max(0, salida - anchoUtil - padIzq),
          bottom: Math.max(0, salida - altoUtil - padArr),
          background: fondo,
        })
        .blur(DESENFOQUE_RELLENO)
        .toBuffer();
      pipe = sharp(lienzo).composite([{ input: util, left: padIzq, top: padArr }]);
    }
  } else {
    // Sin sujeto detectado también se entrega CUADRADO, rellenando con el fondo
    // muestreado. Cierra el invariante "el pipeline siempre entrega un
    // cuadrado", del que depende el encuadre de la card: antes estas fotos
    // salían 3:2 y la ventana les comía los costados.
    pipe = pipe.resize(lado, lado, {
      fit: "contain",
      background: fondo,
      withoutEnlargement: true,
    });
  }

  const buffer = await pipe
    .withIccProfile("srgb")
    .jpeg({ quality: calidad, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return { buffer, recortada: recorte !== null, cobertura };
}
