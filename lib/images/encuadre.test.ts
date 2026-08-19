import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  dimensionesMostradas,
  encuadreDeVista,
  esEncuadreCompleto,
  parsearEncuadres,
  pixelesDelEncuadre,
  vistaDeEncuadre,
  vistaLimitada,
  zoomEnPunto,
  girarVista,
  rectDeVista,
  zoomMaximo,
  LADO_MINIMO,
  type Encuadre,
  type Vista,
} from "./encuadre";
import { aplicarEncuadre } from "./aplicar-encuadre";

const APAISADA = { ancho: 100, alto: 50 };

describe("dimensionesMostradas", () => {
  it("intercambia los lados solo en cuartos de vuelta", () => {
    expect(dimensionesMostradas(100, 50, 0)).toEqual({ ancho: 100, alto: 50 });
    expect(dimensionesMostradas(100, 50, 180)).toEqual({ ancho: 100, alto: 50 });
    expect(dimensionesMostradas(100, 50, 90)).toEqual({ ancho: 50, alto: 100 });
    expect(dimensionesMostradas(100, 50, 270)).toEqual({ ancho: 50, alto: 100 });
  });
});

describe("vistaLimitada — la ventana nunca se sale de la foto", () => {
  const { ancho, alto } = APAISADA;

  it("no deja alejar más allá de cubrir", () => {
    expect(vistaLimitada({ zoom: 0.2, cx: 0.5, cy: 0.5, giro: 0 }, ancho, alto).zoom).toBe(1);
  });

  it("no deja acercar por debajo del lado mínimo útil", () => {
    // 4000x3000: el lado corto (3000) dividido entre LADO_MINIMO es el tope.
    expect(zoomMaximo(4000, 3000)).toBeCloseTo(3000 / LADO_MINIMO);
    const v = vistaLimitada({ zoom: 999, cx: 0.5, cy: 0.5, giro: 0 }, 4000, 3000);
    expect(v.zoom).toBeCloseTo(3000 / LADO_MINIMO);
  });

  it("una foto ya pequeña conserva zoom 1 en vez de un tope menor que 1", () => {
    expect(zoomMaximo(300, 200)).toBe(1);
  });

  it("acota el centro contra cada borde", () => {
    // A zoom 1 la ventana mide 50x50 sobre 100x50: solo puede correrse en X,
    // y su centro vive entre 0.25 y 0.75. En Y queda clavado en el medio.
    const izquierda = vistaLimitada({ zoom: 1, cx: -5, cy: 0.5, giro: 0 }, ancho, alto);
    expect(izquierda.cx).toBeCloseTo(0.25);
    const derecha = vistaLimitada({ zoom: 1, cx: 9, cy: 0.5, giro: 0 }, ancho, alto);
    expect(derecha.cx).toBeCloseTo(0.75);
    const arriba = vistaLimitada({ zoom: 1, cx: 0.5, cy: 0, giro: 0 }, ancho, alto);
    expect(arriba.cy).toBeCloseTo(0.5);
  });

  it("conserva el giro", () => {
    expect(vistaLimitada({ zoom: 1, cx: 0.5, cy: 0.5, giro: 270 }, ancho, alto).giro).toBe(270);
  });
});

describe("encuadreDeVista", () => {
  it("centrado a zoom 1 sobre apaisada recorta la franja central", () => {
    const e = encuadreDeVista({ zoom: 1, cx: 0.5, cy: 0.5, giro: 0 }, 100, 50);
    expect(e).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1, giro: 0 });
  });

  it("una foto cuadrada sin tocar da el encuadre identidad", () => {
    const e = encuadreDeVista({ zoom: 1, cx: 0.5, cy: 0.5, giro: 0 }, 800, 800);
    expect(esEncuadreCompleto(e)).toBe(true);
  });

  it("nunca serializa un desborde, aunque la vista venga fuera de rango", () => {
    const e = encuadreDeVista({ zoom: 0.1, cx: 5, cy: -3, giro: 0 }, 100, 50);
    expect(e.x).toBeGreaterThanOrEqual(0);
    expect(e.y).toBeGreaterThanOrEqual(0);
    expect(e.x + e.w).toBeLessThanOrEqual(1);
    expect(e.y + e.h).toBeLessThanOrEqual(1);
  });

  it("ida y vuelta por vistaDeEncuadre conserva la vista", () => {
    const original: Vista = { zoom: 2.5, cx: 0.4, cy: 0.55, giro: 90 };
    const ida = encuadreDeVista(original, 3000, 4000);
    const vuelta = vistaDeEncuadre(ida, 3000, 4000);
    expect(vuelta.zoom).toBeCloseTo(original.zoom, 6);
    expect(vuelta.cx).toBeCloseTo(original.cx, 6);
    expect(vuelta.cy).toBeCloseTo(original.cy, 6);
    expect(vuelta.giro).toBe(90);
  });
});

describe("pixelesDelEncuadre — siempre cuadrado y dentro de la foto", () => {
  const casos: { nombre: string; e: Encuadre; ancho: number; alto: number }[] = [
    { nombre: "franja central", e: { x: 0.25, y: 0, w: 0.5, h: 1, giro: 0 }, ancho: 4032, alto: 3024 },
    { nombre: "esquina", e: { x: 0, y: 0, w: 0.3, h: 0.4, giro: 0 }, ancho: 4032, alto: 3024 },
    { nombre: "pegado al borde", e: { x: 0.7, y: 0.6, w: 0.3, h: 0.4, giro: 0 }, ancho: 4032, alto: 3024 },
    { nombre: "fracciones sucias", e: { x: 0.13337, y: 0.271, w: 0.4449, h: 0.5931, giro: 0 }, ancho: 3001, alto: 2251 },
  ];

  for (const { nombre, e, ancho, alto } of casos) {
    it(nombre, () => {
      const r = pixelesDelEncuadre(e, ancho, alto);
      expect(r.width).toBe(r.height);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(ancho);
      expect(r.top + r.height).toBeLessThanOrEqual(alto);
    });
  }

  it("un encuadre imposible se acota en vez de reventar", () => {
    const r = pixelesDelEncuadre({ x: 0.9, y: 0.9, w: 1, h: 1, giro: 0 }, 100, 50);
    expect(r).toEqual({ left: 50, top: 0, width: 50, height: 50 });
  });
});

describe("parsearEncuadres — entrada no confiable", () => {
  it("rellena de null cuando no hay nada que parsear", () => {
    expect(parsearEncuadres(null, 2)).toEqual([null, null]);
    expect(parsearEncuadres("", 2)).toEqual([null, null]);
    expect(parsearEncuadres("no soy json", 2)).toEqual([null, null]);
    expect(parsearEncuadres('{"x":0}', 2)).toEqual([null, null]);
  });

  it("respeta el largo pedido aunque el cliente mande otro", () => {
    const uno: Encuadre = { x: 0.1, y: 0.1, w: 0.5, h: 0.5, giro: 0 };
    expect(parsearEncuadres(JSON.stringify([uno, uno, uno]), 2)).toHaveLength(2);
    expect(parsearEncuadres(JSON.stringify([uno]), 3)).toEqual([uno, null, null]);
  });

  it("descarta encuadres malformados sin tirar los buenos", () => {
    const bueno: Encuadre = { x: 0.1, y: 0.1, w: 0.5, h: 0.5, giro: 90 };
    const lista = [
      bueno,
      { x: 0, y: 0, w: 0.5, h: 0.5, giro: 45 }, // giro fuera del juego
      { x: -0.5, y: 0, w: 0.5, h: 0.5, giro: 0 }, // origen negativo
      { x: 0.9, y: 0, w: 0.5, h: 0.5, giro: 0 }, // se sale por la derecha
      { x: 0, y: 0, w: 0, h: 0.5, giro: 0 }, // lado nulo
      { x: "0", y: 0, w: 0.5, h: 0.5, giro: 0 }, // tipo equivocado
      null,
    ];
    expect(parsearEncuadres(JSON.stringify(lista), 7)).toEqual([
      bueno, null, null, null, null, null, null,
    ]);
  });

  it("el encuadre identidad se normaliza a null: no hay nada que recortar", () => {
    const identidad = [{ x: 0, y: 0, w: 1, h: 1, giro: 0 }];
    expect(parsearEncuadres(JSON.stringify(identidad), 1)).toEqual([null]);
  });
});

/**
 * Integración: que el rectángulo que se ve en el visor sea EXACTAMENTE el que
 * sale del bucket. Se prueba con color porque es lo único que no admite
 * interpretación — si la orientación EXIF o el giro se aplicaran en otro orden,
 * el cuadrado saldría del lado equivocado y el pixel cambiaría de color.
 */
describe("aplicarEncuadre", () => {
  /**
   * 100x50 crudos con EXIF de un cuarto de vuelta → MOSTRADA 50x100, con la
   * mitad de ARRIBA roja y la de ABAJO azul. Es una foto vertical de celular
   * en miniatura: el caso que rompe si alguien encadena dos `.rotate()`.
   */
  async function fotoVertical(): Promise<Buffer> {
    const parche = (r: number, g: number, b: number) =>
      sharp({ create: { width: 50, height: 50, channels: 3, background: { r, g, b } } })
        .png()
        .toBuffer();
    return sharp({ create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .composite([
        { input: await parche(255, 0, 0), left: 0, top: 0 },
        { input: await parche(0, 0, 255), left: 50, top: 0 },
      ])
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 100 })
      .toBuffer();
  }

  /** Color del centro del resultado, redondeado: el JPEG mueve un par de niveles. */
  async function centro(buffer: Buffer): Promise<"rojo" | "azul" | "otro"> {
    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const i = ((info.height >> 1) * info.width + (info.width >> 1)) * info.channels;
    const [r, , b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 200 && b < 60) return "rojo";
    if (b > 200 && r < 60) return "azul";
    return "otro";
  }

  it("recorta en las coordenadas que ve el navegador (EXIF ya aplicado)", async () => {
    const foto = await fotoVertical();
    const arriba = await aplicarEncuadre(foto, { x: 0, y: 0, w: 1, h: 0.5, giro: 0 }, "image/jpeg");
    const abajo = await aplicarEncuadre(foto, { x: 0, y: 0.5, w: 1, h: 0.5, giro: 0 }, "image/jpeg");
    expect(await centro(arriba)).toBe("rojo");
    expect(await centro(abajo)).toBe("azul");
    expect(await sharp(arriba).metadata()).toMatchObject({ width: 50, height: 50 });
  });

  it("el giro manual se compone con el EXIF en vez de pisarlo", async () => {
    const foto = await fotoVertical();
    // Girada 90° en sentido horario, la mitad de arriba (roja) queda a la DERECHA.
    const derecha = await aplicarEncuadre(foto, { x: 0.5, y: 0, w: 0.5, h: 1, giro: 90 }, "image/jpeg");
    const izquierda = await aplicarEncuadre(foto, { x: 0, y: 0, w: 0.5, h: 1, giro: 90 }, "image/jpeg");
    expect(await centro(derecha)).toBe("rojo");
    expect(await centro(izquierda)).toBe("azul");
  });

  it("conserva el canal alfa: un PNG sin fondo no sale con fondo negro", async () => {
    const transparente = await sharp({
      create: { width: 60, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const salida = await aplicarEncuadre(
      transparente,
      { x: 0, y: 0, w: 40 / 60, h: 1, giro: 0 },
      "image/png"
    );
    const meta = await sharp(salida).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect(meta).toMatchObject({ width: 40, height: 40 });
  });
});

describe("zoomEnPunto — el punto señalado no se mueve", () => {
  it("acercar sobre una esquina deja esa esquina en su lugar", () => {
    // Dimensiones de foto real: por debajo de LADO_MINIMO*zoom el tope de
    // acercamiento se activa y taparía lo que este caso quiere medir.
    const ancho = 6000, alto = 6000;
    const inicial: Vista = { zoom: 1, cx: 0.5, cy: 0.5, giro: 0 };
    // Ancla en la esquina superior izquierda de la ventana = pixel (0,0).
    const acercada = zoomEnPunto(inicial, ancho, alto, 0, 0, 2);
    const r = rectDeVista(acercada, ancho, alto);
    expect(acercada.zoom).toBeCloseTo(2);
    expect(r.left).toBeCloseTo(0);
    expect(r.top).toBeCloseTo(0);
  });

  it("acercar en el centro conserva el centro", () => {
    const v = zoomEnPunto({ zoom: 1, cx: 0.5, cy: 0.5, giro: 0 }, 4000, 3000, 0.5, 0.5, 3);
    expect(v.cx).toBeCloseTo(0.5);
    expect(v.cy).toBeCloseTo(0.5);
  });

  it("respeta los topes de la política de encuadre", () => {
    expect(zoomEnPunto({ zoom: 1, cx: 0.5, cy: 0.5, giro: 0 }, 3000, 2000, 0.5, 0.5, 0.1).zoom).toBe(1);
    const tope = zoomMaximo(3000, 2000);
    expect(tope).toBeCloseTo(2000 / LADO_MINIMO);
    expect(zoomEnPunto({ zoom: 1, cx: 0.5, cy: 0.5, giro: 0 }, 3000, 2000, 0.5, 0.5, 99).zoom)
      .toBeCloseTo(tope);
  });
});

describe("girarVista — el encuadre viaja con la foto", () => {
  it("acumula cuartos de vuelta y vuelve al origen", () => {
    let v: Vista = { zoom: 1, cx: 0.5, cy: 0.5, giro: 0 };
    const giros: number[] = [];
    for (let i = 0; i < 4; i++) {
      v = girarVista(v, 100, 50);
      giros.push(v.giro);
    }
    expect(giros).toEqual([90, 180, 270, 0]);
  });

  it("el punto encuadrado se conserva: arriba pasa a la derecha", () => {
    // Ventana chica pegada arriba a la izquierda de una foto cuadrada.
    const v: Vista = { zoom: 4, cx: 0.125, cy: 0.125, giro: 0 };
    const girada = girarVista(v, 4800, 4800);
    // (0.125, 0.125) → (1 − 0.125, 0.125) = (0.875, 0.125): misma esquina, ahora arriba a la derecha.
    expect(girada.cx).toBeCloseTo(0.875);
    expect(girada.cy).toBeCloseTo(0.125);
    expect(girada.zoom).toBeCloseTo(4);
  });
});
