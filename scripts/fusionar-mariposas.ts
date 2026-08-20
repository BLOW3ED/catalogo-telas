#!/usr/bin/env tsx
/**
 * Fusionar "Mariposa de organza" dentro de "Mariposa bordada" — Telas La Jalisciense
 * ===========================================================================
 * La tienda las quiere como UN producto. Comparando las fotos, son dos
 * CONSTRUCCIONES distintas (organza: ala traslúcida con pespunte de venas;
 * bordada: ala opaca de bordado denso) — no es la misma pieza mal repartida.
 *
 * 10 colores de "bordada" y 1 de "organza" (Champagne) no se repiten: se
 * mueven directo. 3 colores existen en AMBAS (Lila, Negro, Azul Marino), y
 * `ColorSelector.tsx` selecciona con `variantes.find(v => v.color_slug ===
 * slug)` — con dos variantes del mismo color en una ficha, la SEGUNDA queda
 * inalcanzable desde el swatch. Para esos 3 la tienda decidió el criterio:
 * gana la foto de FONDO CLARO (la sesión de estudio más reciente); la otra
 * variante de ese color se borra, no se conservan las dos.
 *
 * Verificado foto por foto:
 *   - Lila:        bordada = fondo negro (butterfly00208) · organza = fondo
 *                   claro (map400005) → gana ORGANZA, se borra bordada
 *   - Negro:        bordada = fondo negro (butterfly00230) · organza = fondo
 *                   claro (map400014) → gana ORGANZA, se borra bordada
 *   - Azul Marino:  bordada = fondo claro (butterfly00232) · organza = fondo
 *                   claro (map400009/10), construcción casi idéntica en las
 *                   dos → empate de fondo, gana BORDADA (ya está en la ficha
 *                   destino, no se mueve nada) y se borra organza
 *
 *   pnpm fusionar:mariposas              → SIMULACRO
 *   pnpm fusionar:mariposas --aplicar    → escribe
 *
 * Idempotente.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const CONSERVA_SLUG = "mariposa-bordada";
const ABSORBE_SLUG = "mariposa-de-organza";

/** Colores que NO se repiten entre las dos fichas: se mueven sin condición. */
const MOVER_SIN_CONFLICTO = ["Champagne"];

/**
 * Colores en ambas fichas. `gana` = de dónde queda la variante/fotos;
 * la otra se borra completa (variante + fotos).
 */
const RESOLUCION: { color: string; gana: "organza" | "bordada"; porque: string }[] = [
  { color: "Lila", gana: "organza", porque: "bordada en fondo negro, organza en fondo claro" },
  { color: "Negro", gana: "organza", porque: "bordada en fondo negro, organza en fondo claro" },
  { color: "Azul Marino", gana: "bordada", porque: "las dos en fondo claro (empate); bordada ya está en la ficha destino" },
];

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · fusionar-mariposas\n`);

  const { data: telas, error: eT } = await supabase.from("tela").select("id, slug, nombre").in("slug", [CONSERVA_SLUG, ABSORBE_SLUG]);
  if (eT) { console.error("✖", eT.message); process.exit(1); }
  const destino = telas?.find((t) => t.slug === CONSERVA_SLUG);
  const fuente = telas?.find((t) => t.slug === ABSORBE_SLUG);

  if (!destino) { console.log(`   ✖ no encontré "${CONSERVA_SLUG}"`); process.exit(1); }
  if (!fuente) { console.log(`   ✓ "${ABSORBE_SLUG}" ya no existe — fusión ya aplicada`); return; }

  const [{ data: vDestino, error: eVD }, { data: vFuente, error: eVF }] = await Promise.all([
    supabase.from("variante").select("id, color:color_id(nombre)").eq("tela_id", destino.id),
    supabase.from("variante").select("id, color:color_id(nombre)").eq("tela_id", fuente.id),
  ]);
  if (eVD) { console.error("✖", eVD.message); process.exit(1); }
  if (eVF) { console.error("✖", eVF.message); process.exit(1); }

  type V = { id: string; color: { nombre: string } | null };
  const porColorDestino = new Map<string, V>();
  for (const v of (vDestino as unknown as V[]) ?? []) if (v.color?.nombre) porColorDestino.set(v.color.nombre, v);
  const porColorFuente = new Map<string, V>();
  for (const v of (vFuente as unknown as V[]) ?? []) if (v.color?.nombre) porColorFuente.set(v.color.nombre, v);

  const sinConflicto = MOVER_SIN_CONFLICTO.map((c) => porColorFuente.get(c)).filter(Boolean) as V[];
  const contempladosFuente = new Set([...RESOLUCION.map((r) => r.color), ...MOVER_SIN_CONFLICTO]);
  const inesperados = [...porColorFuente.keys()].filter((c) => !contempladosFuente.has(c));

  console.log(`── mover sin conflicto (${sinConflicto.length}) ──`);
  for (const v of sinConflicto) console.log(`   · ${v.color?.nombre} → "${destino.nombre}"`);

  console.log(`\n── colores repetidos: gana fondo claro (${RESOLUCION.length}) ──`);
  const borrar: { variante: V; nombreTela: string; color: string }[] = [];
  const mover: V[] = [];
  for (const r of RESOLUCION) {
    const vB = porColorDestino.get(r.color); // bordada
    const vO = porColorFuente.get(r.color); // organza
    if (!vB || !vO) { console.log(`   ⚠ ${r.color}: no encontré las dos variantes (¿ya resuelto?) — se omite`); continue; }
    const [gana, pierde, nombrePierde] = r.gana === "organza" ? [vO, vB, destino.nombre] : [vB, vO, fuente.nombre];
    console.log(`   · ${r.color}: gana ${r.gana} (${r.porque})`);
    borrar.push({ variante: pierde, nombreTela: nombrePierde, color: r.color });
    if (r.gana === "organza") mover.push(gana);
  }

  if (inesperados.length) {
    console.log(`\n   ⚠ color(es) inesperado(s) en "${fuente.nombre}" no contemplados: ${inesperados.join(", ")} — revisar antes de aplicar`);
  }

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }
  if (inesperados.length) { console.log("\n   ✖ ABORTADO: hay colores no contemplados.\n"); process.exit(1); }

  for (const v of sinConflicto) {
    const { error } = await supabase.from("variante").update({ tela_id: destino.id }).eq("id", v.id);
    if (error) { console.error(`   ✖ moviendo variante ${v.id}: ${error.message}`); process.exit(1); }
  }
  for (const v of mover) {
    const { error } = await supabase.from("variante").update({ tela_id: destino.id }).eq("id", v.id);
    if (error) { console.error(`   ✖ moviendo variante ${v.id}: ${error.message}`); process.exit(1); }
  }
  for (const b of borrar) {
    const { data: fotos } = await supabase.from("foto").select("id").eq("variante_id", b.variante.id);
    if (fotos?.length) await supabase.from("foto").delete().eq("variante_id", b.variante.id);
    const { error } = await supabase.from("variante").delete().eq("id", b.variante.id);
    if (error) { console.error(`   ✖ borrando variante ${b.color} de "${b.nombreTela}": ${error.message}`); process.exit(1); }
    console.log(`   ✂ ${b.color} de "${b.nombreTela}" borrada (${fotos?.length ?? 0} foto(s))`);
  }

  const { data: quedan, error: eQuedan } = await supabase.from("variante").select("id").eq("tela_id", fuente.id);
  if (eQuedan) { console.error("✖", eQuedan.message); process.exit(1); }
  if (quedan?.length) {
    console.log(`   ⚠ "${fuente.nombre}" todavía tiene ${quedan.length} variante(s): NO se borra la ficha`);
  } else {
    await supabase.from("tela").delete().eq("id", fuente.id);
    console.log(`   ✂ "${fuente.nombre}" borrada`);
  }

  console.log("\nListo.\n");
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
