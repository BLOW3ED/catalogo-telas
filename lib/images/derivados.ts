/**
 * Pipeline de derivados de imagen (SOLO servidor / scripts — importa sharp).
 *
 * Por cada foto original genera 3 WebP optimizados para web preservando la
 * fidelidad de color y la textura del tejido:
 *
 *   sm 800px  → grid del catálogo
 *   md 1600px → página de producto
 *   lg 2400px → zoom futuro + agente de WhatsApp
 *
 * El original NUNCA se toca: los derivados viven bajo `derivados/{tamano}/`
 * (misma ruta relativa, extensión .webp) y se pueden regenerar o borrar en
 * bloque si cambia la estrategia. El resultado se guarda en `foto.derivados`
 * (jsonb, sección 12 del SQL).
 */
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DerivadosFoto } from "@/lib/types";
import {
  STORAGE_BUCKET,
  rutaDerivado,
  type TamanoDerivado,
} from "@/lib/supabase/storage";

/**
 * Calibración del pipeline. `lado` = lado LARGO máximo (nunca se agranda).
 * `calidad` WebP: 80–82 conserva la trama del tejido sin archivos pesados.
 */
const TAMANOS: { tamano: TamanoDerivado; lado: number; calidad: number }[] = [
  { tamano: "sm", lado: 800, calidad: 80 },
  { tamano: "md", lado: 1600, calidad: 82 },
  { tamano: "lg", lado: 2400, calidad: 82 },
];

/**
 * Sharpening ligero POST-resize (sharp lo aplica después del resize en su
 * pipeline interno). σ bajo: recupera el micro-contraste de la trama que el
 * resize suaviza, sin halos en los bordes de bordados.
 */
const SHARPEN_SIGMA = 0.6;

export type DerivadoGenerado = {
  tamano: TamanoDerivado;
  buffer: Buffer;
  ancho: number;
  alto: number;
};

/**
 * Genera los 3 WebP en memoria a partir del buffer original.
 * Por cada tamaño: orientación EXIF → conversión forzada a sRGB (usando el
 * perfil ICC embebido como origen) → resize por lado largo → sharpen → WebP.
 */
export async function generarDerivados(
  original: Buffer | Uint8Array
): Promise<DerivadoGenerado[]> {
  const base = sharp(original, { failOn: "error" }).rotate();

  const resultados: DerivadoGenerado[] = [];
  for (const { tamano, lado, calidad } of TAMANOS) {
    const { data, info } = await base
      .clone()
      .resize(lado, lado, { fit: "inside", withoutEnlargement: true })
      .sharpen({ sigma: SHARPEN_SIGMA })
      .withIccProfile("srgb")
      .webp({ quality: calidad, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    resultados.push({ tamano, buffer: data, ancho: info.width, alto: info.height });
  }
  return resultados;
}

/**
 * Procesa una foto de punta a punta: descarga el original del bucket (o usa
 * el buffer provisto, p.ej. en la ingesta local), sube los 3 derivados y
 * actualiza `foto.derivados`. Lanza en cualquier fallo; el caller decide si
 * es fatal (backfill) o solo se loguea (after() en la server action) — la
 * foto queda con `derivados = null` y el backfill la recoge después.
 */
export async function procesarFoto(
  supabase: SupabaseClient,
  { fotoId, ruta, original }: { fotoId: string; ruta: string; original?: Buffer | Uint8Array }
): Promise<DerivadosFoto> {
  let bytes = original;
  if (!bytes) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(ruta);
    if (error || !data) {
      throw new Error(`No se pudo descargar "${ruta}": ${error?.message ?? "sin datos"}`);
    }
    bytes = new Uint8Array(await data.arrayBuffer());
  }

  const generados = await generarDerivados(bytes);

  const derivados: DerivadosFoto = { generado_en: new Date().toISOString() };
  for (const g of generados) {
    const rutaDeriv = rutaDerivado(ruta, g.tamano);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(rutaDeriv, g.buffer, { contentType: "image/webp", upsert: true });
    if (error) {
      throw new Error(`No se pudo subir "${rutaDeriv}": ${error.message}`);
    }
    derivados[g.tamano] = { ruta: rutaDeriv, ancho: g.ancho, alto: g.alto };
  }

  const { error: errorUpdate } = await supabase
    .from("foto")
    .update({ derivados })
    .eq("id", fotoId);
  if (errorUpdate) {
    // 42703 = la columna no existe: falta correr la sección 12 del SQL.
    const hint =
      errorUpdate.code === "42703"
        ? " (¿ya corriste la sección 12 de catalogo_telas_supabase.sql en Supabase Studio?)"
        : "";
    throw new Error(`Derivados subidos pero no registrados en la BD: ${errorUpdate.message}${hint}`);
  }

  return derivados;
}
