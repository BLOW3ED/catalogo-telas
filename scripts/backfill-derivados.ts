#!/usr/bin/env tsx
/**
 * Backfill de derivados de imagen — Telas La Jalisciense
 * ===========================================================================
 * Genera los WebP (sm/md/lg) para las fotos que aún no los tienen
 * (`foto.derivados IS NULL`): las subidas antes del pipeline, o aquellas
 * cuyo procesamiento automático falló. Idempotente: se puede re-correr.
 *
 *   pnpm backfill:derivados            → procesa todas las pendientes
 *   pnpm backfill:derivados --limit=5  → solo las primeras N (para probar)
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * y haber corrido la sección 12 de catalogo_telas_supabase.sql en Studio.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { procesarFoto } from "../lib/images/derivados";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const limitFlag = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitFlag ? parseInt(limitFlag.slice("--limit=".length), 10) : Infinity;

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: pendientes, error } = await supabase
    .from("foto")
    .select("id, ruta")
    .is("derivados", null)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42703") {
      console.error(
        "✖ La columna foto.derivados no existe. Corre la sección 12 de\n" +
          "  catalogo_telas_supabase.sql en Supabase Studio y vuelve a intentar."
      );
    } else {
      console.error(`✖ No pude listar fotos pendientes: ${error.message}`);
    }
    process.exit(1);
  }

  const lote = (pendientes ?? []).slice(0, limit);
  if (lote.length === 0) {
    console.log("✅ Nada que hacer: todas las fotos tienen derivados.");
    return;
  }
  console.log(`\n🖼  ${pendientes!.length} fotos sin derivados; procesando ${lote.length}…\n`);

  let ok = 0;
  const fallas: string[] = [];
  for (const [i, foto] of lote.entries()) {
    const etiqueta = `[${i + 1}/${lote.length}] ${foto.ruta}`;
    try {
      const inicio = Date.now();
      await procesarFoto(supabase, { fotoId: foto.id, ruta: foto.ruta });
      ok++;
      console.log(`   ✓ ${etiqueta} (${((Date.now() - inicio) / 1000).toFixed(1)}s)`);
    } catch (e) {
      fallas.push(`${foto.ruta}: ${(e as Error).message}`);
      console.log(`   ✖ ${etiqueta}`);
    }
  }

  console.log(`\n✅ Backfill terminado: ${ok} procesadas, ${fallas.length} fallas.`);
  if (fallas.length) {
    fallas.forEach((f) => console.log(`   · ${f}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
