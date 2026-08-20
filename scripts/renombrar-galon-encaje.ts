#!/usr/bin/env tsx
/**
 * Nombrar y fusionar "Galón de encaje" — Telas La Jalisciense
 * ===========================================================================
 * De las 8 fichas de "Galón de encaje", 6 llevan el código de proveedor como
 * nombre. Abriendo la foto de cada una: son 5 diseños de guipiur LITÚRGICO
 * (motivos religiosos tejidos — JHS, cáliz, cruz, crismón), no encaje
 * decorativo genérico. Las 2 excepciones que señaló la tienda ("Guipiur" y
 * "Galón de encaje hueso") son encaje decorativo secular y NO se tocan.
 *
 * "Galón de encaje 4212" y "Galón de encaje TGL4212" son el MISMO diseño
 * (medallones JHS en borde festoneado) — se fusionan en una ficha con 2
 * colores. Comparando las fotos incluso corregidas de exposición
 * (`linear(2.2,0)`, igual que `pnpm preparar --exposicion=2`) ambas leen
 * blanco/hueso casi idénticas — la tienda confirmó que SÍ son colores
 * distintos, pero no cuál ficha es cuál. Este script asume
 * 4212=Blanco/TGL4212=Hueso; revisar el simulacro antes de aplicar.
 *
 * Las otras 4 (G4082, TG3996, TGL254, TGL4238) son diseños distintos entre
 * sí — se renombran cada una con el motivo que las distingue. Ya que se abrió
 * la foto de todas, se les asigna también su color (Blanco en las 5 fichas:
 * son hilo blanco/plateado sobre fondo negro subexpuesto, no hay indicio de
 * otro tono en ninguna).
 *
 *   pnpm renombrar:galon              → SIMULACRO
 *   pnpm renombrar:galon --aplicar    → escribe
 *
 * Idempotente.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const FUSION_JHS = {
  conservaSlug: "4212",
  conservaColor: "Blanco", // ⚠ ver nota arriba: no se pudo confirmar cuál de las dos es cuál
  absorbeSlug: "tgl4212",
  absorbeColor: "Hueso", // ⚠ ídem
  nombreNuevo: "Guipiur Litúrgico JHS",
  porque: "medallones JHS en borde festoneado; mismo diseño, 2 colores",
};

const RENOMBRES: { slug: string; nombre: string; color: string; porque: string }[] = [
  { slug: "g4082", nombre: "Guipiur Litúrgico Cáliz", color: "Blanco", porque: "medallones JHS + cáliz con hostia" },
  { slug: "tg3996", nombre: "Guipiur Litúrgico Cruz", color: "Blanco", porque: "cruces repetidas, borde en concha" },
  { slug: "tgl254", nombre: "Guipiur Litúrgico Crismón", color: "Blanco", porque: "crismón (Chi-Rho) con Alfa y Omega, orla de hojas" },
  { slug: "tgl4238", nombre: "Guipiur Litúrgico JHS y Vid", color: "Blanco", porque: "medallones JHS sobre celosía de vid, borde recto" },
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

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · renombrar-galon-encaje\n`);

  const { data: colores, error: eC } = await supabase.from("color").select("id, nombre");
  if (eC) { console.error("✖", eC.message); process.exit(1); }
  const colorPorNombre = new Map((colores ?? []).map((c) => [c.nombre.toLowerCase(), c]));

  // ---------------------------------------------------------------------
  // 1) Fusión 4212 + TGL4212
  // ---------------------------------------------------------------------
  console.log("── Fusión JHS (4212 + TGL4212) ──");
  console.log("   ⚠ blanco/hueso no se distingue con confianza en la foto — revisar antes de --aplicar\n");

  const { data: telasFusion, error: eTF } = await supabase
    .from("tela").select("id, slug, nombre").in("slug", [FUSION_JHS.conservaSlug, FUSION_JHS.absorbeSlug]);
  if (eTF) { console.error("✖", eTF.message); process.exit(1); }
  const destino = telasFusion?.find((t) => t.slug === FUSION_JHS.conservaSlug);
  const fuente = telasFusion?.find((t) => t.slug === FUSION_JHS.absorbeSlug);

  if (!destino) {
    console.log(`   ✖ no encontré la ficha "${FUSION_JHS.conservaSlug}"`);
  } else if (!fuente) {
    console.log(`   ✓ "${FUSION_JHS.absorbeSlug}" ya no existe — fusión ya aplicada`);
    if (destino.nombre !== FUSION_JHS.nombreNuevo && APLICAR) {
      await supabase.from("tela").update({ nombre: FUSION_JHS.nombreNuevo }).eq("id", destino.id);
    }
  } else {
    const colorConserva = colorPorNombre.get(FUSION_JHS.conservaColor.toLowerCase());
    const colorAbsorbe = colorPorNombre.get(FUSION_JHS.absorbeColor.toLowerCase());
    if (!colorConserva || !colorAbsorbe) {
      console.log(`   ✖ color "${FUSION_JHS.conservaColor}" o "${FUSION_JHS.absorbeColor}" no existe en la tabla \`color\``);
    } else {
      const [{ data: vConserva }, { data: vAbsorbe }] = await Promise.all([
        supabase.from("variante").select("id").eq("tela_id", destino.id),
        supabase.from("variante").select("id").eq("tela_id", fuente.id),
      ]);
      console.log(`   "${destino.nombre}" (${vConserva?.length ?? 0} variante) + "${fuente.nombre}" (${vAbsorbe?.length ?? 0} variante)`);
      console.log(`   → "${FUSION_JHS.nombreNuevo}" con colores ${FUSION_JHS.conservaColor} + ${FUSION_JHS.absorbeColor}`);
      console.log(`   porque: ${FUSION_JHS.porque}`);

      if (APLICAR) {
        for (const v of vConserva ?? []) {
          await supabase.from("variante").update({ color_id: colorConserva.id }).eq("id", v.id);
        }
        for (const v of vAbsorbe ?? []) {
          await supabase.from("variante").update({ color_id: colorAbsorbe.id, tela_id: destino.id }).eq("id", v.id);
        }
        const { data: quedan } = await supabase.from("variante").select("id").eq("tela_id", fuente.id);
        if (quedan?.length) {
          console.log(`   ⚠ "${fuente.nombre}" todavía tiene ${quedan.length} variante(s): NO se borra`);
        } else {
          await supabase.from("tela").delete().eq("id", fuente.id);
          console.log(`   ✂ "${fuente.nombre}" borrada`);
        }
        await supabase.from("tela").update({ nombre: FUSION_JHS.nombreNuevo }).eq("id", destino.id);
        console.log(`   ✓ renombrada a "${FUSION_JHS.nombreNuevo}"`);
      }
    }
  }

  // ---------------------------------------------------------------------
  // 2) Renombres + color, uno por diseño
  // ---------------------------------------------------------------------
  console.log("\n── Renombres por diseño ──");
  const { data: telas, error: eT } = await supabase
    .from("tela").select("id, slug, nombre").in("slug", RENOMBRES.map((r) => r.slug));
  if (eT) { console.error("✖", eT.message); process.exit(1); }
  const porSlug = new Map((telas ?? []).map((t) => [t.slug, t]));

  for (const r of RENOMBRES) {
    const tela = porSlug.get(r.slug);
    if (!tela) { console.log(`   ✓ ${r.slug}: no existe (¿ya renombrada con otro slug?)`); continue; }
    const color = colorPorNombre.get(r.color.toLowerCase());
    if (!color) { console.log(`   ✖ color "${r.color}" no existe en la tabla \`color\``); continue; }
    console.log(`   ${tela.nombre}`);
    console.log(`     → "${r.nombre}"  ·  color ${r.color}  (${r.porque})`);
    if (!APLICAR) continue;
    await supabase.from("tela").update({ nombre: r.nombre }).eq("id", tela.id);
    const { data: variantes } = await supabase.from("variante").select("id").eq("tela_id", tela.id);
    for (const v of variantes ?? []) {
      await supabase.from("variante").update({ color_id: color.id }).eq("id", v.id);
    }
  }

  console.log(`\n${APLICAR ? "Listo." : "Nada de esto se escribió."}\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
