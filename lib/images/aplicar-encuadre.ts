/**
 * Corte del maestro según el encuadre que eligió la tienda (SOLO servidor —
 * importa sharp).
 *
 * El curador de /admin manda el archivo ORIGINAL sin tocar más un rectángulo en
 * fracciones (`lib/images/encuadre.ts`). Aquí se aplica ese rectángulo sobre la
 * foto a resolución completa, y el resultado es el nuevo "original" que vive en
 * el bucket: de él salen después los tres derivados WebP igual que siempre.
 *
 * Es destructivo a propósito, como `pnpm preparar`: el maestro del catálogo ya
 * es un asset horneado (cuadrado, con su aire calculado), no el negativo de
 * cámara. Guardar el encuadre en la BD para re-recortar después habría pedido
 * una columna nueva y, peor, habría dejado el maestro del bucket con un
 * encuadre distinto al que se ve en la tienda — que es exactamente la
 * incertidumbre que este flujo existe para matar.
 */
import sharp, { type Sharp } from "sharp";
import { pixelesDelEncuadre, type Encuadre } from "@/lib/images/encuadre";

/**
 * Calidad del maestro recortado. Los mismos números que `recortarProducto`:
 * q95 con mozjpeg y SIN submuestreo de croma (4:4:4), porque el 4:2:0 default
 * promedia el color en bloques de 2x2 y eso se ve en la pedrería y en los
 * hilos de un bordado, que son detalle de color de un píxel de ancho.
 */
const CALIDAD_JPEG = 95;
const CALIDAD_WEBP = 95;

/**
 * Codificador por tipo de archivo: el formato de entrada se CONSERVA.
 *
 * Convertir todo a JPEG habría sido más simple y está mal: parte del catálogo
 * son fotos recortadas sin fondo, y el JPEG no tiene canal alfa — la
 * transparencia saldría pintada de negro. El PNG se mantiene sin pérdida; el
 * WebP conserva su alfa a calidad máxima aunque el color vaya con pérdida.
 */
const CODIFICADORES: Record<string, (pipe: Sharp) => Sharp> = {
  "image/jpeg": (p) =>
    p.jpeg({ quality: CALIDAD_JPEG, mozjpeg: true, chromaSubsampling: "4:4:4" }),
  "image/png": (p) => p.png({ compressionLevel: 9 }),
  "image/webp": (p) =>
    p.webp({ quality: CALIDAD_WEBP, alphaQuality: 100, effort: 5, smartSubsample: true }),
};

export function formatoSoportado(mime: string): boolean {
  return mime in CODIFICADORES;
}

/**
 * Aplica el encuadre y devuelve el maestro listo para subir.
 *
 * El orden —orientar, girar, extraer— es el mismo que ve el usuario en el
 * visor, y por eso las coordenadas empatan sin conversiones.
 *
 * La orientación EXIF va en el CONSTRUCTOR (`autoOrient: true`), no en
 * `.rotate()`: sharp RESETEA la rotación si se le llama dos veces, así que
 * `.rotate().rotate(90)` pierde el EXIF en silencio y las fotos verticales de
 * celular salen acostadas. Como bandera del constructor convive con el giro
 * manual sin pisarse (verificado contra sharp 0.35).
 */
export async function aplicarEncuadre(
  entrada: Buffer | Uint8Array,
  encuadre: Encuadre,
  mime: string
): Promise<Buffer> {
  const codificar = CODIFICADORES[mime];
  if (!codificar) throw new Error(`Formato sin codificador para el recorte: ${mime}`);

  const { ancho, alto } = await dimensionesMostradas(entrada, encuadre.giro);
  const recorte = pixelesDelEncuadre(encuadre, ancho, alto);

  let pipe = sharp(entrada, { failOn: "error", autoOrient: true });
  if (encuadre.giro !== 0) pipe = pipe.rotate(encuadre.giro);

  return codificar(pipe.extract(recorte).withIccProfile("srgb")).toBuffer();
}

/**
 * Dimensiones de la imagen tal como la vio quien encuadró: con EXIF aplicado y
 * con el giro manual encima.
 *
 * `metadata()` reporta el tamaño CRUDO aunque la instancia lleve `autoOrient`
 * (una foto vertical de celular sale 4032x3024 con `orientation: 6`), así que
 * las dimensiones útiles se leen de `metadata().autoOrient`, que sharp calcula
 * justo para esto. El fallback cubre imágenes sin EXIF.
 */
async function dimensionesMostradas(
  entrada: Buffer | Uint8Array,
  giro: number
): Promise<{ ancho: number; alto: number }> {
  const meta = await sharp(entrada, { failOn: "error" }).metadata();
  const ancho = meta.autoOrient?.width ?? meta.width ?? 0;
  const alto = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!ancho || !alto) throw new Error("No se pudieron leer las dimensiones de la imagen.");
  return giro % 180 === 0 ? { ancho, alto } : { ancho: alto, alto: ancho };
}
