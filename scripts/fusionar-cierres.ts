#!/usr/bin/env tsx
/**
 * Fusionar "Cierre" dentro de "Cierre oculto" — Telas La Jalisciense
 * ===========================================================================
 * "Cierre" (3 variantes: Hueso, Champagne, Negro) y "Cierre oculto"
 * (22 variantes) son el MISMO producto capturado dos veces: los 3 colores de
 * "Cierre" ya existen en "Cierre oculto", y comparando las fotos (mismo
 * cierre, misma pose en "ocho", mismo fondo de estudio) son duplicados, no
 * variantes distintas. La tienda confirmó que todos sus cierres son
 * ocultos y de marca YKK.
 *
 * A diferencia de `fusionar-modelos.ts` (que mueve una variante ENTERA a otra
 * ficha porque el color destino no existía todavía), aquí el color YA existe
 * en ambos lados: se fusiona a nivel FOTO, no a nivel variante — las fotos de
 * "Cierre" se agregan a la variante del mismo color en "Cierre oculto" y la
 * variante origen (que se queda sin fotos) se borra. Ninguna foto se pierde.
 *
 * No hay columna `marca` en el esquema (verificado); YKK va en el nombre del
 * producto fusionado, que es donde el cliente y el agente de WhatsApp lo ven.
 *
 *   pnpm fusionar:cierres              → SIMULACRO
 *   pnpm fusionar:cierres --aplicar    → escribe
 *
 * Idempotente: si "Cierre" ya no existe, no hace nada.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const CONSERVA_NOMBRE = "Cierre oculto";
const CONSERVA_NOMBRE_NUEVO = "Cierre oculto YKK";
const ABSORBE_NOMBRE = "Cierre";

/** color de la variante origen → foto(s) que se mueven a la variante del mismo color en destino. */
const FOTOS_POR_COLOR: Record<string, string[]> = {
  "Hueso": ["cierre/cierre00026.webp"],
  "Champagne": ["cierre/cierre00028.webp"],
  "Negro": ["crin/crin00119.webp", "crin/crin00122.webp"],
};

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · fusionar-cierres\n`);

  const { data: telas, error: eT } = await supabase
    .from("tela")
    .select("id, nombre")
    .in("nombre", [CONSERVA_NOMBRE, CONSERVA_NOMBRE_NUEVO, ABSORBE_NOMBRE]);
  if (eT) { console.error("✖", eT.message); process.exit(1); }

  const destino = telas?.find((t) => t.nombre === CONSERVA_NOMBRE || t.nombre === CONSERVA_NOMBRE_NUEVO);
  const fuente = telas?.find((t) => t.nombre === ABSORBE_NOMBRE);

  if (!destino) { console.log(`   ✖ no encontré "${CONSERVA_NOMBRE}" ni "${CONSERVA_NOMBRE_NUEVO}"`); process.exit(1); }
  if (!fuente) {
    console.log(`   ✓ "${ABSORBE_NOMBRE}" ya no existe — fusión ya aplicada`);
    if (destino.nombre !== CONSERVA_NOMBRE_NUEVO) {
      console.log(`   · falta renombrar "${destino.nombre}" → "${CONSERVA_NOMBRE_NUEVO}"`);
      if (APLICAR) {
        const { error } = await supabase.from("tela").update({ nombre: CONSERVA_NOMBRE_NUEVO }).eq("id", destino.id);
        if (error) console.error("   ✖", error.message);
        else console.log("   ✓ renombrado");
      }
    }
    return;
  }

  const [{ data: variantesDestino, error: eVD }, { data: variantesFuente, error: eVF }] = await Promise.all([
    supabase.from("variante").select("id, color_id, color:color_id(nombre)").eq("tela_id", destino.id),
    supabase.from("variante").select("id, color_id, color:color_id(nombre)").eq("tela_id", fuente.id),
  ]);
  if (eVD) { console.error("✖", eVD.message); process.exit(1); }
  if (eVF) { console.error("✖", eVF.message); process.exit(1); }

  type V = { id: string; color_id: string | null; color: { nombre: string } | null };
  const porColorDestino = new Map<string, V>();
  for (const v of (variantesDestino ?? []) as unknown as V[]) {
    if (v.color?.nombre) porColorDestino.set(v.color.nombre, v);
  }

  let falla = false;
  const plan: { fuenteVariante: V; destinoVariante: V; fotos: string[] }[] = [];
  for (const v of (variantesFuente ?? []) as unknown as V[]) {
    const colorNombre = v.color?.nombre;
    if (!colorNombre) { console.log(`   ✖ variante ${v.id} de "${ABSORBE_NOMBRE}" sin color — no sé a cuál fusionar`); falla = true; continue; }
    const destinoVariante = porColorDestino.get(colorNombre);
    if (!destinoVariante) { console.log(`   ✖ "${CONSERVA_NOMBRE}" no tiene variante ${colorNombre} — no fusiono a ciegas`); falla = true; continue; }
    const fotos = FOTOS_POR_COLOR[colorNombre];
    if (!fotos) { console.log(`   ✖ no hay ruta de foto declarada para el color ${colorNombre}`); falla = true; continue; }
    plan.push({ fuenteVariante: v, destinoVariante, fotos });
  }
  if (falla) { console.log("\n   ⚠ ABORTADO: alguna variante de origen no tiene destino claro\n"); process.exit(1); }

  for (const p of plan) {
    console.log(`   · ${p.fotos.length} foto(s) de "${p.fuenteVariante.color?.nombre}" → variante existente del mismo color en "${destino.nombre}"`);
  }
  console.log(`   al terminar: "${ABSORBE_NOMBRE}" desaparece, "${destino.nombre}" se renombra a "${CONSERVA_NOMBRE_NUEVO}"`);

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  for (const p of plan) {
    const { data: yaHay, error: eOrden } = await supabase
      .from("foto")
      .select("orden")
      .eq("variante_id", p.destinoVariante.id)
      .order("orden", { ascending: false })
      .limit(1);
    if (eOrden) { console.error("   ✖", eOrden.message); process.exit(1); }
    let siguienteOrden = (yaHay?.[0]?.orden ?? -1) + 1;

    for (const ruta of p.fotos) {
      const { error } = await supabase
        .from("foto")
        .update({ variante_id: p.destinoVariante.id, orden: siguienteOrden++ })
        .eq("variante_id", p.fuenteVariante.id)
        .eq("ruta", ruta);
      if (error) { console.error(`   ✖ moviendo ${ruta}: ${error.message}`); process.exit(1); }
    }

    const { data: quedan, error: eQuedan } = await supabase.from("foto").select("id").eq("variante_id", p.fuenteVariante.id);
    if (eQuedan) { console.error("   ✖", eQuedan.message); process.exit(1); }
    if (quedan?.length) { console.log(`   ⚠ variante ${p.fuenteVariante.id} todavía tiene ${quedan.length} foto(s): NO se borra`); continue; }
    const { error: eDel } = await supabase.from("variante").delete().eq("id", p.fuenteVariante.id);
    if (eDel) console.error(`   ✖ borrando variante ${p.fuenteVariante.id}: ${eDel.message}`);
  }

  const { data: variantesRestantes, error: eVR } = await supabase.from("variante").select("id").eq("tela_id", fuente.id);
  if (eVR) { console.error("✖", eVR.message); process.exit(1); }
  if (variantesRestantes?.length) {
    console.log(`   ⚠ "${ABSORBE_NOMBRE}" todavía tiene ${variantesRestantes.length} variante(s): NO se borra la ficha`);
  } else {
    const { error: eDelTela } = await supabase.from("tela").delete().eq("id", fuente.id);
    if (eDelTela) console.error(`   ✖ borrando "${ABSORBE_NOMBRE}": ${eDelTela.message}`);
    else console.log(`   ✂ "${ABSORBE_NOMBRE}" borrada`);
  }

  const { error: eRename } = await supabase.from("tela").update({ nombre: CONSERVA_NOMBRE_NUEVO }).eq("id", destino.id);
  if (eRename) console.error(`   ✖ renombrando: ${eRename.message}`);
  else console.log(`   ✓ "${destino.nombre}" → "${CONSERVA_NOMBRE_NUEVO}"`);

  console.log("\nListo.\n");
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
