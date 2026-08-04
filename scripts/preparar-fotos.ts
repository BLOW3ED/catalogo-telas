#!/usr/bin/env tsx
/**
 * Preparación de fotos de estudio — Telas La Jalisciense
 * ===========================================================================
 * Deja una carpeta de RAW de cámara lista para `pnpm ingest`:
 *
 *   .ARW (RAW Sony) ──sips──> JPEG ──recorte automático──> JPEG cuadrado
 *
 * Por qué dos pasos y no solo sharp: el binario de sharp que instala npm no
 * trae libraw, así que no puede abrir un .ARW. macOS sí sabe (Image I/O), y
 * `sips` lo expone sin instalar nada — de ahí que este script sea macOS-only.
 * Los .jpg/.png de entrada se recortan directo, sin pasar por sips.
 *
 * El original NUNCA se toca: la carpeta de entrada queda intacta y todo lo
 * generado va a la carpeta de salida, que se puede borrar y regenerar.
 *
 * Uso:
 *   pnpm preparar --in=Fotos_Entrada --out=Fotos_Entrada_listas
 *
 * Flags:
 *   --in=<ruta>       carpeta con los RAW/JPEG de cámara (default: Fotos_Entrada)
 *   --out=<ruta>      carpeta de salida                  (default: Fotos_Entrada_listas)
 *   --lado=<px>       lado máximo del JPEG final         (default: 2400 = el derivado lg)
 *   --exposicion=<f>  factor de exposición: 1.8 = 180%   (default: 1, sin cambio)
 *   --calidad=<n>     calidad JPEG de salida             (default: 95)
 *   --sin-recorte     convierte pero no recorta (para comparar encuadres)
 *   --limit=<n>       procesa solo las primeras n (pruebas)
 * ===========================================================================
 */
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { recortarProducto } from "../lib/images/recorte";

const ejecutar = promisify(execFile);

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const hit = argv.find((a) => a.startsWith(`${n}=`));
  return hit ? hit.slice(n.length + 1) : undefined;
};

const flags = {
  entrada: arg("--in") ?? "Fotos_Entrada",
  salida: arg("--out") ?? "Fotos_Entrada_listas",
  lado: parseInt(arg("--lado") ?? "2400", 10),
  // 1 = como salió de cámara. El default es neutro a propósito: una exposición
  // escondida arruinaría un lote que ya venía bien expuesto.
  exposicion: parseFloat(arg("--exposicion") ?? "1"),
  calidad: parseInt(arg("--calidad") ?? "95", 10),
  sinRecorte: argv.includes("--sin-recorte"),
  limit: arg("--limit") ? parseInt(arg("--limit")!, 10) : Infinity,
};

const EXT_RAW = new Set([".arw", ".cr2", ".cr3", ".nef", ".dng", ".raf", ".orf"]);
const EXT_JPEG = new Set([".jpg", ".jpeg", ".png"]);

/**
 * Concurrencia. sips e I/O de disco dominan (el proceso pasa la mayor parte
 * del tiempo esperando, no calculando), así que sobresuscribir los núcleos
 * ayuda; el tope evita que 248 sips simultáneos saturen la memoria.
 */
const CONCURRENCIA = Math.min(8, Math.max(2, os.cpus().length - 2));

/**
 * RAW → JPEG a máxima resolución vía sips, a un temporal que luego se borra.
 *
 * Calidad 100 porque este JPEG es un intermedio que sharp vuelve a comprimir:
 * la pérdida de las dos generaciones se acumula, y en la primera es gratis
 * evitarla (el archivo es temporal, el tamaño da igual).
 *
 * Se queda en JPEG y no en TIFF/PNG a pesar de que sips los exporta en 16 bits:
 * esos salen en luz LINEAL y con un perfil que ni sharp ni libvips convierten
 * bien a sRGB — los intentos aplastan las altas luces a ~206 en vez de 255, o
 * sea matan el brillo especular de la pedrería, que es justo lo que se quiere
 * lucir. El JPEG viene ya renderizado a sRGB por Image I/O y llega a 255.
 */
async function rawAJpeg(origen: string, destino: string): Promise<void> {
  await ejecutar("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", "100",
    origen,
    "--out", destino,
  ]);
}

type Resultado = { archivo: string; ok: boolean; recortada: boolean; nota?: string };

async function procesar(dirEntrada: string, dirSalida: string, archivo: string): Promise<Resultado> {
  const ext = path.extname(archivo).toLowerCase();
  const base = path.basename(archivo, path.extname(archivo));
  const origen = path.join(dirEntrada, archivo);
  const destino = path.join(dirSalida, `${base}.jpg`);

  let fuente: Buffer;
  let temporal: string | null = null;

  if (EXT_RAW.has(ext)) {
    temporal = path.join(dirSalida, `.tmp-${base}.jpg`);
    await rawAJpeg(origen, temporal);
    fuente = await fs.readFile(temporal);
  } else {
    fuente = await fs.readFile(origen);
  }

  try {
    if (flags.sinRecorte) {
      await fs.writeFile(destino, fuente);
      return { archivo, ok: true, recortada: false };
    }
    const { buffer, recortada, cobertura } = await recortarProducto(fuente, {
      lado: flags.lado,
      calidad: flags.calidad,
      exposicion: flags.exposicion,
    });
    await fs.writeFile(destino, buffer);
    return {
      archivo,
      ok: true,
      recortada,
      nota: recortada ? undefined : `sin sujeto detectado (cobertura ${(cobertura * 100).toFixed(0)}%)`,
    };
  } finally {
    if (temporal) await fs.rm(temporal, { force: true });
  }
}

/** Corre `tarea` sobre `items` con como mucho `limite` en vuelo a la vez. */
async function enParalelo<T, R>(
  items: T[], limite: number, tarea: (item: T, i: number) => Promise<R>
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
  const entradas = (await fs.readdir(flags.entrada))
    .filter((f) => {
      const e = path.extname(f).toLowerCase();
      return EXT_RAW.has(e) || EXT_JPEG.has(e);
    })
    .sort()
    .slice(0, flags.limit);

  if (!entradas.length) {
    console.error(`✖ No encontré fotos en "${flags.entrada}".`);
    process.exit(1);
  }

  await fs.mkdir(flags.salida, { recursive: true });
  console.log(`\n🖼  ${entradas.length} fotos · ${CONCURRENCIA} en paralelo · lado ${flags.lado}px` +
    ` · calidad ${flags.calidad}` +
    (flags.exposicion !== 1 ? ` · exposición ${Math.round(flags.exposicion * 100)}%` : ""));
  console.log(`   ${flags.entrada} → ${flags.salida}\n`);

  let hechas = 0;
  const resultados = await enParalelo(entradas, CONCURRENCIA, async (archivo) => {
    try {
      const r = await procesar(flags.entrada, flags.salida, archivo);
      process.stdout.write(`\r   ${++hechas}/${entradas.length}   `);
      return r;
    } catch (e) {
      process.stdout.write(`\r   ${++hechas}/${entradas.length}   `);
      return { archivo, ok: false, recortada: false, nota: (e as Error).message };
    }
  });

  const fallidas = resultados.filter((r) => !r.ok);
  const sinRecorte = resultados.filter((r) => r.ok && !r.recortada);

  console.log(`\n\n✅ Listas: ${resultados.length - fallidas.length}/${resultados.length}`);
  if (sinRecorte.length) {
    console.log(`\n⚠ ${sinRecorte.length} sin recortar (se subieron con el encuadre completo):`);
    sinRecorte.forEach((r) => console.log(`   · ${r.archivo} — ${r.nota}`));
  }
  if (fallidas.length) {
    console.log(`\n✖ ${fallidas.length} con error:`);
    fallidas.forEach((r) => console.log(`   · ${r.archivo} — ${r.nota}`));
  }
  console.log(`\n👉 Siguiente: pnpm ingest --dir=${flags.salida}\n`);
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
