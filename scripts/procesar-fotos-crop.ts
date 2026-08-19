#!/usr/bin/env tsx
/**
 * Procesamiento y subida de fotos centradas desde 0FotosCrop — Telas La Jalisciense
 * ===========================================================================
 * Toma las fotos recortadas de 0FotosCrop, las centra en un lienzo cuadrado 1:1
 * con muestreo del color de fondo de estudio perimetral (evitando recortes en tiras
 * y piezas alargadas), las sube al bucket 'telas' y genera sus derivados WebP.
 *
 * Uso:
 *   pnpm tsx scripts/procesar-fotos-crop.ts                → SIMULACRO (dry-run)
 *   pnpm tsx scripts/procesar-fotos-crop.ts --aplicar      → PROCESA Y SUBE TODO
 *   pnpm tsx scripts/procesar-fotos-crop.ts --limit=10 --aplicar
 *   pnpm tsx scripts/procesar-fotos-crop.ts --filtro=tira --aplicar
 * ===========================================================================
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";
import { procesarFoto } from "../lib/images/derivados";
import { STORAGE_BUCKET } from "../lib/supabase/storage";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const hit = argv.find((a) => a.startsWith(`${n}=`));
  return hit ? hit.slice(n.length + 1) : undefined;
};
const flags = {
  dir: arg("--dir") ?? "0FotosCrop",
  limit: arg("--limit") ? parseInt(arg("--limit")!, 10) : Infinity,
  filtro: arg("--filtro"),
  aplicar: argv.includes("--aplicar"),
  concurrencia: parseInt(arg("--concurrencia") ?? "4", 10),
};

const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

type RGB = { r: number; g: number; b: number };

/**
 * Tonos del fondo de estudio en las DOS orillas que van a quedar pegadas al
 * relleno: arriba y abajo en una foto apaisada, izquierda y derecha en una
 * vertical.
 *
 * Van por separado porque el fondo NO es plano, tiene viñeteo: medido sobre el
 * lote, la orilla de arriba de 201TiraTulBordado40mm vale 156 y la de abajo
 * 198 —42 niveles—, así que un color único parte la diferencia y deja halo a
 * los dos lados. Con un tono por orilla la unión desaparece SIN inventar
 * textura; el relleno espejo, que sí la inventa, ya se había descartado por la
 * banda que dejaba arriba.
 *
 * Se usa la MODA de la banda, no la media ni la mediana: ver el comentario de
 * `moda` más abajo.
 */
async function muestrearOrillas(
  buffer: Buffer
): Promise<{ a: RGB; b: RGB; medio: RGB }> {
  // `fit: "inside"` y no `"fill"`: aplastar una tira de 2.4:1 a un cuadrado
  // hacía que una banda de N píxeles no representara el mismo grosor real
  // arriba que a los lados.
  const { data, info } = await sharp(buffer)
    .resize(256, 256, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels: c } = info;
  const apaisada = w >= h;
  const grosor = Math.max(2, Math.round(Math.min(w, h) * 0.06));

  // MODA (pico del histograma, suavizado ±2 para que el ruido de sensor no lo
  // parta), no mediana: cuando la pieza ocupa más de medio borde la mediana se
  // va con el producto. Medido en 354TiraTulBordado220mm, cuya greca de encaje
  // llena la orilla inferior: mediana 31 contra un fondo que realmente vale 3;
  // la moda acierta 2. El fondo de estudio siempre es el tono MÁS REPETIDO de
  // la banda aunque no sea mayoría.
  const moda = (arr: number[]) => {
    if (!arr.length) return 0;
    const hist = new Array(256).fill(0);
    for (const v of arr) hist[v]++;
    let mejor = 0, mejorCuenta = -1;
    for (let i = 0; i < 256; i++) {
      let acc = 0;
      for (let d = -2; d <= 2; d++) {
        const j = i + d;
        if (j >= 0 && j < 256) acc += hist[j];
      }
      if (acc > mejorCuenta) { mejorCuenta = acc; mejor = i; }
    }
    return mejor;
  };
  const recoge = (dentro: (x: number, y: number) => boolean): RGB => {
    const r: number[] = [], g: number[] = [], b: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!dentro(x, y)) continue;
        const i = (y * w + x) * c;
        r.push(data[i]);
        g.push(data[i + 1]);
        b.push(data[i + 2]);
      }
    }
    return { r: moda(r), g: moda(g), b: moda(b) };
  };

  const a = apaisada ? recoge((_, y) => y < grosor) : recoge((x) => x < grosor);
  const b = apaisada
    ? recoge((_, y) => y >= h - grosor)
    : recoge((x) => x >= w - grosor);

  return {
    a,
    b,
    medio: {
      r: Math.round((a.r + b.r) / 2),
      g: Math.round((a.g + b.g) / 2),
      b: Math.round((a.b + b.b) / 2),
    },
  };
}

/** Techo del lado del lienzo: el mismo que el derivado `lg`, no sube de ahí. */
const LADO_MAX = 2400;
/** El producto ocupa 1/1.06 del lienzo → 3% de aire por lado, 6% en total. */
const MARGEN = 1.06;

/**
 * Prepara la foto en un lienzo cuadrado 1:1 bien centrado con su fondo
 * perimetral y margen de respiro, para que el catálogo la muestre íntegra:
 * el grid la mete en un marco `aspect-square` con `object-cover`, así que
 * cualquier foto que no llegue cuadrada se recorta por los costados.
 */
async function prepararFotoCuadrada(bufferOriginal: Buffer): Promise<Buffer> {
  const { a, b, medio } = await muestrearOrillas(bufferOriginal);
  const meta = await sharp(bufferOriginal).metadata();
  const maxDim = Math.max(meta.width ?? LADO_MAX, meta.height ?? LADO_MAX);

  const lienzo = Math.min(Math.round(maxDim * MARGEN), LADO_MAX);
  const interior = Math.round(lienzo / MARGEN);

  // Buffer intermedio A PROPÓSITO: sharp admite UN solo `resize` por pipeline
  // y el segundo PISA al primero, no se componen. Encadenarlos dejaba la foto
  // con su proporción original —el lienzo cuadrado nunca llegaba a crearse— y
  // el catálogo la recortaba: medido en el navegador, una tira de 2.4:1 perdía
  // el 59% de su ancho.
  const producto = await sharp(bufferOriginal)
    .resize(interior, interior, { fit: "inside", withoutEnlargement: true })
    .toBuffer();
  const mp = await sharp(producto).metadata();
  const pw = mp.width ?? interior;
  const ph = mp.height ?? interior;

  const apaisada = pw >= ph;
  const vert = lienzo - ph;
  const horiz = lienzo - pw;
  const arriba = Math.floor(vert / 2);
  const izquierda = Math.floor(horiz / 2);

  // Tres `extend` con buffer intermedio, por lo mismo que el resize: una
  // segunda llamada pisaría a la anterior. El eje MENOR lleva el tono medio
  // —es una tira del 3% pegada al costado del producto— y el eje MAYOR, donde
  // el halo se veía, lleva el tono propio de cada orilla.
  const menor = apaisada
    ? { left: izquierda, right: horiz - izquierda }
    : { top: arriba, bottom: vert - arriba };
  const conCostados = await sharp(producto)
    .extend({ ...menor, background: medio })
    .toBuffer();

  const conA = await sharp(conCostados)
    .extend({ ...(apaisada ? { top: arriba } : { left: izquierda }), background: a })
    .toBuffer();

  return await sharp(conA)
    .extend({
      ...(apaisada ? { bottom: vert - arriba } : { right: horiz - izquierda }),
      background: b,
    })
    .withIccProfile("srgb")
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
}

/** Procesamiento en paralelo con control de concurrencia */
async function enParalelo<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  const obreros = Array.from({ length: Math.min(limite, items.length) }, async () => {
    for (;;) {
      const i = siguiente++;
      if (i >= items.length) return;
      salida[i] = await tarea(items[i], i);
    }
  });
  await Promise.all(obreros);
  return salida;
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const archivos = (await fs.readdir(flags.dir)).filter((f) =>
    EXT.has(path.extname(f).toLowerCase())
  );
  const porSlug = new Map<string, string>();
  for (const f of archivos) {
    const ext = path.extname(f);
    porSlug.set(slugify(path.basename(f, ext)), f);
  }

  const { data: fotos, error } = await supabase
    .from("foto")
    .select("id, ruta")
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`✖ No pude listar las fotos: ${error.message}`);
    process.exit(1);
  }

  let pares: { id: string; ruta: string; archivo: string }[] = [];
  const sinArchivo: string[] = [];
  for (const foto of fotos ?? []) {
    const baseSlug = slugify(path.basename(foto.ruta, path.extname(foto.ruta)));
    const archivo = porSlug.get(baseSlug);
    if (archivo) pares.push({ id: foto.id, ruta: foto.ruta, archivo });
    else sinArchivo.push(foto.ruta);
  }

  if (flags.filtro) {
    const patrones = flags.filtro.split(",").map((s) => s.trim().toLowerCase());
    pares = pares.filter((p) =>
      patrones.some((pat) => p.ruta.toLowerCase().includes(pat) || p.archivo.toLowerCase().includes(pat))
    );
  }

  console.log(`\n🖼  ${fotos?.length ?? 0} fotos en la BD · ${archivos.length} archivos en ${flags.dir}`);
  console.log(`   con archivo local : ${pares.length}`);
  console.log(`   sin archivo local : ${sinArchivo.length}${sinArchivo.length ? "  (subidas manuales: se conservan intactas)" : ""}`);

  const lote = pares.slice(0, flags.limit);
  if (!flags.aplicar) {
    console.log(`\n🔎 Simulacro: se centrarían y subirían ${lote.length} fotos + sus 3 derivados.`);
    console.log("   Para escribir en Supabase: agrega --aplicar\n");
    return;
  }

  console.log(`\n⬆️  Centrando, subiendo y generando derivados para ${lote.length} fotos… (concurrencia: ${flags.concurrencia})\n`);
  
  let ok = 0;
  const fallas: string[] = [];
  
  // Cache de buffers procesados por archivo local para no repetir trabajo si varias fotos usan el mismo archivo
  const bufferCache = new Map<string, Promise<Buffer>>();

  await enParalelo(lote, flags.concurrencia, async (p, i) => {
    const etiqueta = `[${i + 1}/${lote.length}] ${p.ruta} (desde ${p.archivo})`;
    let reintentos = 3;
    let exito = false;
    let ultimoError = "";

    while (reintentos > 0 && !exito) {
      try {
        const inicio = Date.now();
        
        let promiseBuffer = bufferCache.get(p.archivo);
        if (!promiseBuffer) {
          promiseBuffer = (async () => {
            const raw = await fs.readFile(path.join(flags.dir, p.archivo));
            return await prepararFotoCuadrada(raw);
          })();
          bufferCache.set(p.archivo, promiseBuffer);
        }
        const buffer = await promiseBuffer;

        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(p.ruta, buffer, {
            contentType: "image/webp",
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message);

        // Regenera los 3 WebP y actualiza foto.derivados
        await procesarFoto(supabase, { fotoId: p.id, ruta: p.ruta, original: buffer });
        ok++;
        exito = true;
        console.log(`   ✓ ${etiqueta} (${((Date.now() - inicio) / 1000).toFixed(1)}s)`);
      } catch (e) {
        ultimoError = (e as Error).message;
        reintentos--;
        if (reintentos > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (!exito) {
      fallas.push(`${p.ruta}: ${ultimoError}`);
      console.error(`   ✖ ${etiqueta} - ${ultimoError}`);
    }
  });

  console.log(`\n✅ Proceso terminado: ${ok} exitosas, ${fallas.length} fallas.`);
  if (fallas.length) {
    console.log("   Fotos con fallo:");
    fallas.forEach((f) => console.log(`   · ${f}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
