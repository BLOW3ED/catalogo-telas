#!/usr/bin/env tsx
/**
 * Re-subida de fotos ya catalogadas — Telas La Jalisciense
 * ===========================================================================
 * Vuelve a subir al bucket los JPEG de una carpeta local para las fotos que YA
 * existen en la BD, y regenera sus derivados WebP. Sirve cuando se re-hornea un
 * lote (`pnpm preparar`) y hay que reemplazar los bytes sin volver a catalogar.
 *
 *   pnpm resubir --dir=Fotos_Entrada_listas             → SIMULACRO, no escribe
 *   pnpm resubir --dir=Fotos_Entrada_listas --limit=5 --aplicar
 *   pnpm resubir --dir=Fotos_Entrada_listas --aplicar
 *
 * NO usar `pnpm ingest --upload` para esto. Ese comando reprocesa las filas
 * contra `tela` y `variante`, y en este catálogo eso destruye trabajo:
 *   · `varPayload` reescribe precio, stock, unidad_venta y los flags ópticos
 *     con lo que diga el CSV → pisa lo capturado en /admin.
 *   · `tela.upsert({slug, nombre, categoria_id})` manda `categoria_id = null`
 *     cuando la columna `categoria` del CSV está vacía, que es el caso en casi
 *     todo el lote de mercería → deshace `pnpm clasificar` entero.
 *   · Si una tela fue renombrada en /admin, el `onConflict:"slug"` crea una
 *     tela duplicada con el slug viejo.
 * Este script solo toca Storage y `foto.derivados`. Nunca `tela` ni `variante`.
 *
 * Idempotente: se puede re-correr sobre las que fallaron.
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
  dir: arg("--dir") ?? "Fotos_Entrada_listas",
  limit: arg("--limit") ? parseInt(arg("--limit")!, 10) : Infinity,
  filtro: arg("--filtro"),
  aplicar: argv.includes("--aplicar"),
};

const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Índice de archivos locales por el MISMO slug base con que la ingesta armó
  // `foto.ruta` (slugify del basename), para poder casar sin importar si el
  // original en BD era .jpg y el nuevo es .webp sin fondo.
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
  console.log(`   sin archivo local : ${sinArchivo.length}${sinArchivo.length ? "  (subidas desde /admin o no en lote: NO se tocan)" : ""}`);
  sinArchivo.slice(0, 10).forEach((r) => console.log(`     · ${r}`));

  const lote = pares.slice(0, flags.limit);
  if (!flags.aplicar) {
    console.log(`\n🔎 Simulacro: se re-subirían ${lote.length} fotos + sus 3 derivados.`);
    console.log("   Para escribir de verdad: agrega --aplicar\n");
    return;
  }

  console.log(`\n⬆️  Re-subiendo ${lote.length}…\n`);
  let ok = 0;
  const fallas: string[] = [];
  for (const [i, p] of lote.entries()) {
    const etiqueta = `[${i + 1}/${lote.length}] ${p.ruta} (desde ${p.archivo})`;
    let reintentos = 3;
    let exito = false;
    let ultimoError = "";

    while (reintentos > 0 && !exito) {
      try {
        const inicio = Date.now();
        let buffer = await fs.readFile(path.join(flags.dir, p.archivo));
        const fileExt = path.extname(p.archivo).toLowerCase();
        let contentType =
          fileExt === ".webp"
            ? "image/webp"
            : fileExt === ".png"
            ? "image/png"
            : "image/jpeg";

        // Si el archivo supera 4.5MB (límite de Supabase Storage), se redimensiona
        // a un máximo de 3200px en WebP manteniendo altísima fidelidad.
        if (buffer.length > 4.5 * 1024 * 1024) {
          buffer = await sharp(buffer)
            .resize(3200, 3200, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85, effort: 4 })
            .toBuffer();
          contentType = "image/webp";
        }

        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(p.ruta, buffer, {
            contentType,
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message);

        // Regenera los 3 WebP sobre las mismas rutas y reescribe foto.derivados.
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
      console.log(`   ✖ ${etiqueta} - ${ultimoError}`);
    }
  }

  console.log(`\n✅ Re-subida terminada: ${ok} ok, ${fallas.length} fallas.`);
  if (fallas.length) {
    // Importante: una foto que YA tenía derivados y falla aquí conserva los
    // VIEJOS (no queda en NULL), así que `pnpm backfill:derivados` —que filtra
    // por `derivados IS NULL`— no la va a recoger. Hay que re-correr este
    // script sobre ellas.
    console.log("   Re-corre el script para estas (backfill:derivados NO las recoge):");
    fallas.forEach((f) => console.log(`   · ${f}`));
    process.exitCode = 1;
  }
  console.log("");
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
