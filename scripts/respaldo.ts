#!/usr/bin/env tsx
/**
 * Respaldo de las tablas del catálogo — Telas La Jalisciense
 * ===========================================================================
 * Los scripts de curaduría borran variantes y fusionan fichas. Nada de eso es
 * reversible desde la app, así que la regla de trabajo es respaldar ANTES de
 * cada `--aplicar`. Vuelca a JSON las seis tablas que tocan esos scripts.
 *
 *   pnpm respaldo respaldo-bd-antes-de-<fase>.json
 *
 * Pagina de mil en mil: Supabase corta las respuestas y sin paginar el
 * respaldo saldría incompleto justo cuando más se necesita.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";
loadEnv({ path: ".env.local" });
async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const out: Record<string, unknown> = {};
  for (const tabla of ["tela", "variante", "foto", "color", "categoria", "acabado"]) {
    const filas: unknown[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await sb.from(tabla).select("*").range(desde, desde + 999);
      if (error) { console.error(`✖ ${tabla}: ${error.message}`); process.exit(1); }
      filas.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    out[tabla] = filas;
    console.log(`   ${tabla}: ${filas.length}`);
  }
  const destino = process.argv[2];
  if (!destino) { console.error("Uso: pnpm respaldo <archivo.json>"); process.exit(1); }
  writeFileSync(destino, JSON.stringify(out, null, 2));
  console.log(`✓ ${destino}`);
}
main();
