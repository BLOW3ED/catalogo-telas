import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { calcularRecorte, recortarProducto } from "./recorte";

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

describe("recortarProducto — encuadre", () => {
  it("entrega un cuadrado completo aunque el recorte se salga de la foto", async () => {
    const { buffer, recortada } = await recortarProducto(
      await escena(NEGRO, [{ left: 40, top: 240, w: 720, h: 120, gris: 225 }]),
      { lado: 600 }
    );
    expect(recortada).toBe(true);
    const { width, height } = await sharp(buffer).metadata();
    expect(width).toBe(height);
  });

  it("rellena continuando el fondo, no con negro por defecto", async () => {
    // Fondo gris claro: si el relleno fuera negro fijo, se vería una banda.
    const { buffer } = await recortarProducto(
      await escena(GRIS, [{ left: 30, top: 250, w: 740, h: 100, gris: 20 }]),
      { lado: 600 }
    );
    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    // Esquina superior izquierda: cae en la zona rellenada.
    expect(data[0]).toBeGreaterThan(100);
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
