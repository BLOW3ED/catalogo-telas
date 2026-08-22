#!/usr/bin/env tsx
/**
 * Inspección de solo lectura: dado uno o más slugs de tela, imprime sus
 * variantes, colores y rutas de foto (con URL pública), para revisar antes
 * de escribir cualquier script de curaduría. No escribe nada.
 *
 * Uso: npx tsx inspeccionar.ts <slug1,slug2,...>
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  const slugs = (process.argv[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!slugs.length) {
    console.error("Uso: npx tsx inspeccionar.ts <slug1,slug2,...>");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: telas, error: e1 } = await supabase
    .from("tela")
    .select("id, slug, nombre, categoria_id, categoria:categoria_id(nombre)")
    .in("slug", slugs);
  if (e1) { console.error(e1.message); process.exit(1); }

  for (const t of telas ?? []) {
    console.log(`\n=== ${t.nombre}  (slug=${t.slug}, categoria=${(t as any).categoria?.nombre})  id=${t.id} ===`);
    const { data: variantes } = await supabase
      .from("variante")
      .select("id, sku, color_id, color:color_id(nombre, hex), unidad_venta, orden")
      .eq("tela_id", t.id)
      .order("orden");
    for (const v of variantes ?? []) {
      const { data: fotos } = await supabase
        .from("foto")
        .select("ruta, orden")
        .eq("variante_id", v.id)
        .order("orden");
      const colorNombre = (v as any).color?.nombre ?? "SIN COLOR";
      console.log(`  variante ${v.id}  sku=${v.sku ?? "-"}  color=${colorNombre}`);
      for (const f of fotos ?? []) {
        console.log(`      ${url}/storage/v1/object/public/telas/${f.ruta}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
