import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { calcularRecorte, recortarProducto, modoEncuadre } from "./recorte";

/**
 * Escenas sintéticas en vez de fotos reales: el detector se prueba contra
 * geometría conocida, así que las aserciones pueden ser sobre coordenadas
 * exactas en vez de "se ve bien".
 */
function escena(
  fondo: { r: number; g: number; b: number },
  piezas: { left: number; top: number; w: number; h: number; gris: number }[],
  { ancho = 800, alto = 600 } = {}
): Promise<Buffer> {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: fondo } })
    .composite(
      piezas.map((p) => ({
        input: {
          create: {
            width: p.w, height: p.h, channels: 3,
            background: { r: p.gris, g: p.gris, b: p.gris },
          },
        },
        left: p.left, top: p.top,
      }))
    )
    .png()
    .toBuffer();
}

const NEGRO = { r: 8, g: 8, b: 8 };
const GRIS = { r: 150, g: 150, b: 150 };

/** El recorte es cuadrado con margen, así que se compara con tolerancia. */
function contiene(r: { left: number; top: number; width: number; height: number },
                 caja: { left: number; top: number; w: number; h: number }) {
  return r.left <= caja.left && r.top <= caja.top
    && r.left + r.width >= caja.left + caja.w
    && r.top + r.height >= caja.top + caja.h;
}

/**
 * Luminancia de una región del resultado. Media, máximo y desviación estándar:
 * el MÁXIMO delata contenido brillante que no debería estar ahí (un reflejo del
 * producto) y la DESVIACIÓN delata estructura — un fondo liso desenfocado es
 * plano, un eco del producto no.
 */
async function luminancia(
  buf: Buffer,
  region: { left: number; top: number; width: number; height: number }
) {
  const { data, info } = await sharp(buf)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const vals: number[] = [];
  for (let i = 0; i < data.length; i += info.channels) {
    vals.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / vals.length);
  return { media, max: Math.max(...vals), sd };
}

describe("calcularRecorte", () => {
  it("encuentra un sujeto claro sobre fondo negro y lo deja completo dentro", async () => {
    const caja = { left: 340, top: 250, w: 120, h: 100 };
    const { recorte } = await calcularRecorte(
      await escena(NEGRO, [{ ...caja, gris: 230 }])
    );

    expect(recorte).not.toBeNull();
    expect(contiene(recorte!, caja)).toBe(true);
    // Cuadrado, y con margen: más grande que el sujeto pero lejos del encuadre.
    expect(recorte!.width).toBe(recorte!.height);
    expect(recorte!.width).toBeGreaterThan(caja.w);
    expect(recorte!.width).toBeLessThan(400);
  });

  it("también lo encuentra sobre fondo gris claro (piezas oscuras)", async () => {
    const caja = { left: 200, top: 180, w: 160, h: 160 };
    const { recorte } = await calcularRecorte(
      await escena(GRIS, [{ ...caja, gris: 20 }])
    );

    expect(recorte).not.toBeNull();
    expect(contiene(recorte!, caja)).toBe(true);
  });

  it("ignora una mota de polvo lejos del producto", async () => {
    // La mota está en la esquina opuesta: con bbox por proyección de filas y
    // columnas estiraría el recorte hasta cubrir casi todo el encuadre.
    const producto = { left: 120, top: 120, w: 140, h: 140 };
    const { recorte } = await calcularRecorte(
      await escena(NEGRO, [
        { ...producto, gris: 220 },
        { left: 700, top: 520, w: 4, h: 4, gris: 200 },
      ])
    );

    expect(recorte).not.toBeNull();
    expect(contiene(recorte!, producto)).toBe(true);
    expect(recorte!.left + recorte!.width).toBeLessThan(600);
  });

  it("conserva las dos partes de un producto separable", async () => {
    // Dos piezas de tamaño comparable (un par de copas): ninguna es ruido.
    const a = { left: 220, top: 240, w: 130, h: 130 };
    const b = { left: 400, top: 240, w: 130, h: 130 };
    const { recorte } = await calcularRecorte(
      await escena(NEGRO, [{ ...a, gris: 210 }, { ...b, gris: 210 }])
    );

    expect(recorte).not.toBeNull();
    expect(contiene(recorte!, a)).toBe(true);
    expect(contiene(recorte!, b)).toBe(true);
  });

  it("no recorta cuando no hay sujeto que encontrar", async () => {
    const { recorte } = await calcularRecorte(await escena(NEGRO, []));
    expect(recorte).toBeNull();
  });

  it("cubre al sujeto aunque toque el borde, saliéndose del encuadre si hace falta", async () => {
    const caja = { left: 0, top: 0, w: 200, h: 180 };
    const { recorte } = await calcularRecorte(await escena(NEGRO, [{ ...caja, gris: 240 }]));

    expect(recorte).not.toBeNull();
    // Puede quedar en negativo: lo que falte se rellena con fondo al recortar.
    expect(contiene(recorte!, caja)).toBe(true);
  });

  it("cubre un sujeto más ancho que el alto de la foto", async () => {
    // El caso que cortaba producto: limitar el cuadrado al lado corto hacía
    // imposible contener un sujeto más ancho que eso.
    const caja = { left: 40, top: 240, w: 720, h: 120 };
    const { recorte } = await calcularRecorte(await escena(NEGRO, [{ ...caja, gris: 225 }]));

    expect(recorte).not.toBeNull();
    expect(recorte!.width).toBeGreaterThan(600);
    expect(contiene(recorte!, caja)).toBe(true);
  });
});

describe("modoEncuadre", () => {
  // Tabla pura, sin decodificar imágenes: el umbral es una decisión de producto
  // y esto lo vuelve deliberado. DESBORDE_MAX = 0.10.
  const casos: [string, number, "rellenar" | "encajar"][] = [
    ["el cuadrado cabe entero", 0, "rellenar"],
    ["se sale por menos del umbral", 0.099, "rellenar"],
    ["se sale justo por encima", 0.101, "encajar"],
    ["tira cruzando el encuadre", 0.22, "encajar"],
  ];

  it.each(casos)("%s (desborde %s) → %s", (_n, desborde, esperado) => {
    // Cuadrado de 1000 que se sale `desborde*1000` px por la izquierda.
    const lado = 1000;
    const fuera = Math.round(desborde * lado);
    const recorte = { left: -fuera, top: 0, width: lado, height: lado };
    expect(modoEncuadre(recorte, 4000, lado)).toBe(esperado);
  });
});

describe("recortarProducto — encuadre", () => {
  it("encaja un sujeto tipo tira COMPLETO en vez de recortarlo", async () => {
    // Una tira ocupa casi todo el ancho: el cuadrado con margen se sale un 23%,
    // muy por encima del umbral, así que se escala para caber.
    const { buffer, recortada } = await recortarProducto(
      await escena(NEGRO, [{ left: 40, top: 240, w: 720, h: 120, gris: 225 }]),
      { lado: 600 }
    );
    expect(recortada).toBe(true);
    const { width, height } = await sharp(buffer).metadata();
    expect(width).toBe(height);

    // La tira entera cabe: hay producto en el centro y fondo en ambos extremos
    // horizontales, o sea no se perdió ninguna punta.
    const centro = await luminancia(buffer, { left: 280, top: 280, width: 40, height: 40 });
    expect(centro.media).toBeGreaterThan(150);
    for (const left of [0, 595]) {
      const punta = await luminancia(buffer, { left, top: 280, width: 5, height: 40 });
      expect(punta.media).toBeLessThan(60);
    }
  });

  it("NO espejea el producto en la banda de relleno", async () => {
    // Este es el test que faltaba. Con `extendWith:"mirror"` la marca brillante
    // pegada al borde superior reaparecía reflejada dentro de la banda, y en las
    // esquinas el reflejo se cruzaba consigo mismo formando una X. Se veía a
    // simple vista en el grid de "Tira de pedrería".
    const { buffer } = await recortarProducto(
      await escena(NEGRO, [
        { left: 50, top: 255, w: 700, h: 90, gris: 230 },
        { left: 620, top: 0, w: 70, h: 40, gris: 255 },  // marca asimétrica
      ]),
      { lado: 600 }
    );

    // Mitad exterior de la banda superior, lejos de la costura: ahí el blur ya
    // no sangra producto, así que lo que haya es relleno puro.
    const banda = await luminancia(buffer, { left: 0, top: 0, width: 600, height: 20 });
    expect(banda.max).toBeLessThan(60);   // medido con fondo muestreado: 15
    expect(banda.sd).toBeLessThan(4);     // medido: 1.06 — plano. Con espejo se dispara
  });

  it("rellena con el color de fondo real, no con negro ni con un valor fijo", async () => {
    // Fondo gris claro: si el relleno fuera negro fijo, se vería una banda.
    const { buffer } = await recortarProducto(
      await escena(GRIS, [{ left: 30, top: 250, w: 740, h: 100, gris: 20 }]),
      { lado: 600 }
    );
    // La banda superior debe estar cerca del gris del fondo (150), no solo
    // "no ser negra": la aserción vieja (`> 100`) pasaba igual con espejo.
    const banda = await luminancia(buffer, { left: 0, top: 0, width: 600, height: 20 });
    expect(banda.media).toBeGreaterThan(138);
    expect(banda.media).toBeLessThan(162);
    expect(banda.sd).toBeLessThan(4);
  });

  it("en modo rellenar conserva la escala del sujeto y pinta solo el borde que falta", async () => {
    // Desborde del 7%: por debajo del umbral, así que el cuadrado manda y solo
    // se pinta la franja izquierda que pide fuera de la foto.
    const { buffer } = await recortarProducto(
      await escena(NEGRO, [{ left: 60, top: 150, w: 300, h: 300, gris: 220 }]),
      { lado: 600 }
    );
    const { width, height } = await sharp(buffer).metadata();
    expect(width).toBe(height);

    const franja = await luminancia(buffer, { left: 0, top: 200, width: 10, height: 80 });
    expect(franja.media).toBeLessThan(40);   // fondo negro, no producto estirado
    expect(franja.sd).toBeLessThan(6);
  });

  it("en modo encajar el sujeto sobrevive la ventana 3:4 de la card", async () => {
    // El punto del modo: la card enseña el 75% central del cuadrado, así que
    // encajar en el cuadrado ENTERO devolvía la tira con las puntas cortadas —
    // exactamente lo que el modo existe para evitar. Aquí se recorta la salida
    // como lo hace `object-cover` y se comprueba que las puntas siguen ahí.
    const { buffer } = await recortarProducto(
      await escena(NEGRO, [{ left: 40, top: 240, w: 720, h: 120, gris: 225 }]),
      { lado: 600 }
    );
    const ventana = await sharp(buffer)
      .extract({ left: 75, top: 0, width: 450, height: 600 })
      .toBuffer();

    // Hay producto en el centro de la ventana…
    const centro = await luminancia(ventana, { left: 205, top: 280, width: 40, height: 40 });
    expect(centro.media).toBeGreaterThan(150);

    // …y NINGÚN pixel de producto tocando los bordes verticales. Se mide con
    // `max` y no con la media: la tira ocupa 90 de 600 filas, así que promediar
    // la columna entera la diluye a ~40 y la aserción pasaría igual con las
    // puntas cortadas — que fue justo el primer intento de este test.
    for (const left of [0, 445]) {
      const punta = await luminancia(ventana, { left, top: 0, width: 5, height: 600 });
      expect(punta.max).toBeLessThan(60);
    }
  });

  it("entrega un cuadrado aunque no detecte sujeto", async () => {
    // Cierra el invariante del que depende el encuadre de la card. Antes estas
    // fotos salían con el aspect nativo de cámara (3:2) y la ventana les comía
    // los costados.
    const { buffer, recortada } = await recortarProducto(await escena(NEGRO, []), { lado: 600 });
    expect(recortada).toBe(false);
    const { width, height } = await sharp(buffer).metadata();
    expect(width).toBe(height);
  });
});

describe("calcularRecorte — aire y fondo", () => {
  it("deja más aire del que la ventana 3:4 de la card descarta", async () => {
    // `object-cover` en aspect-[3/4] tira 12.5% del ancho por lado, 13.6% con el
    // hover. Con MARGEN=0.28 el lado del cuadrado es 1.56x el sujeto → 17.9% de
    // aire. El bbox detectado sale unos px más ancho que el bloque dibujado
    // (el gradiente Sobel marca el contorno), de ahí el rango en vez del valor.
    const caja = { left: 250, top: 150, w: 300, h: 300 };
    const { recorte } = await calcularRecorte(await escena(NEGRO, [{ ...caja, gris: 220 }]));

    expect(recorte).not.toBeNull();
    const razon = recorte!.width / caja.w;
    expect(razon).toBeGreaterThan(1.5);
    expect(razon).toBeLessThan(1.75);
  });

  it("muestrea el fondo del MARCO, no el color dominante de la foto", async () => {
    // El sujeto claro ocupa el 73% del encuadre, así que domina el histograma:
    // `sharp().stats().dominant` devuelve (248,248,248) —el producto— mientras
    // que la mediana del anillo devuelve el fondo real. Si alguien cambia
    // `fondoDelMarco` por `dominant` o por la media global, este test truena.
    const { fondo } = await calcularRecorte(
      await escena(GRIS, [{ left: 50, top: 40, w: 700, h: 500, gris: 250 }])
    );
    for (const canal of [fondo.r, fondo.g, fondo.b]) {
      expect(canal).toBeGreaterThan(142);
      expect(canal).toBeLessThan(158);
    }
  });
});

/** Matiz (grados) y saturación HSV del pixel central del resultado. */
async function tonoCentral(buf: Buffer) {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const { data } = await sharp(buf)
    .extract({ left: (width >> 1) - 4, top: (height >> 1) - 4, width: 8, height: 8 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  const n = data.length / 3;
  r /= n * 255; g /= n * 255; b /= n * 255;

  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return { h, sat: mx === 0 ? 0 : d / mx, val: mx };
}

describe("recortarProducto — exposición", () => {
  /** Rosa apagado sobre negro: el caso donde `modulate` viraba a malva gris. */
  const rosa = { r: 120, g: 58, b: 72 };

  const escenaColor = () =>
    sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 6, g: 6, b: 8 } } })
      .composite([{
        input: { create: { width: 260, height: 260, channels: 3, background: rosa } },
        left: 270, top: 170,
      }])
      .png()
      .toBuffer();

  it("aclara sin mover el matiz ni la saturación", async () => {
    const escena = await escenaColor();
    const base = await recortarProducto(escena, { lado: 400, exposicion: 1 });
    const alta = await recortarProducto(escena, { lado: 400, exposicion: 1.95 });

    const a = await tonoCentral(base.buffer);
    const b = await tonoCentral(alta.buffer);

    // Más claro, que es el objetivo.
    expect(b.val).toBeGreaterThan(a.val * 1.5);
    // Y el color sigue siendo el mismo: esto es lo que `modulate` rompía.
    expect(Math.abs(b.h - a.h)).toBeLessThan(3);
    expect(Math.abs(b.sat - a.sat)).toBeLessThan(0.03);
  });

  it("con exposición 1 no toca la imagen", async () => {
    const escena = await escenaColor();
    const { buffer } = await recortarProducto(escena, { lado: 400, exposicion: 1 });
    const t = await tonoCentral(buffer);
    // El parche se mantiene reconocible como el mismo rosa de entrada.
    const esperado = (() => {
      const mx = 120 / 255, mn = 58 / 255;
      return { sat: (mx - mn) / mx };
    })();
    expect(Math.abs(t.sat - esperado.sat)).toBeLessThan(0.05);
  });
});
