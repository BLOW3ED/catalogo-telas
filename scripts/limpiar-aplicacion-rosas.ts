#!/usr/bin/env tsx
/**
 * Sacar los intrusos de "Aplicación de rosas" — Telas La Jalisciense
 * ===========================================================================
 * De las 21 fotos de "Aplicación de rosas", 19 son la misma cosa: un par
 * espejo de rosas BORDADAS a color con hoja verde, dispuestas en voluta
 * horizontal. Dos no lo son:
 *
 *   · guipiur/guipiur00115  (hoy bajo el color Amarillo)
 *   · guipiur/guipiur00120  (hoy bajo el color Plata)
 *
 * Esas dos son un par espejo en ARCO de guipiur metálico monocromo — sin
 * hoja verde, sin bordado a color, y con la silueta cayendo en cascada en
 * vez de extenderse en voluta. Abriendo las dos a resolución `md` son el
 * MISMO diseño en dos acabados: oro y plata. No son rosas de esta ficha:
 * son otro producto que se coló.
 *
 * Se revisaron una por una las otras 19 antes de decidir. Dos que parecían
 * intrusas NO lo son y se quedan: `guipiur00118` (rosa blanca — es rosa, con
 * hoja verde) y `flores00148` (naranja — rosa abierta, con hoja verde). El
 * criterio que separa no es el prefijo de la carpeta en Storage: hay fotos
 * `guipiur/` que sí son de esta ficha.
 *
 * A dónde van: se revisó el catálogo buscando casa para ellas y ninguna
 * existente sirve — "Galón de rosas" es tira continua por metro, "Aplicación
 * de flor grande" es una sola rosa, "Aplicación de encaje floral" es otro
 * diseño. Estrenan ficha propia.
 *
 * El color de guipiur00115 pasa de Amarillo a **Oro**: "Amarillo" describía
 * las rosas bordadas amarillas de la ficha vieja, no esta pieza metálica.
 * La variante Plata se mueve ENTERA (guipiur00120 era su única foto) y por
 * eso desaparece de la ficha origen — si se quedara sin fotos ahí saldría
 * como swatch vacío en `ColorSelector`.
 *
 *   pnpm limpiar:rosas              → SIMULACRO
 *   pnpm limpiar:rosas --aplicar    → escribe
 *
 * Idempotente: si las dos fotos ya no están en la ficha origen, no hace nada.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const ORIGEN_SLUG = "aplicacion-de-rosas";
const DESTINO_SLUG = "aplicacion-de-rosas-en-cascada";
const DESTINO_NOMBRE = "Aplicación de rosas en cascada";

/** foto intrusa → color que le toca en la ficha nueva. */
const INTRUSOS: { ruta: string; color: string; porque: string }[] = [
  { ruta: "guipiur/guipiur00115.webp", color: "Oro", porque: "guipiur metálico dorado en arco, sin hoja verde" },
  { ruta: "guipiur/guipiur00120.webp", color: "Plata", porque: "el mismo diseño en plata" },
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

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · limpiar-aplicacion-rosas\n`);

  const { data: origen, error: eO } = await supabase
    .from("tela").select("id, nombre, categoria_id").eq("slug", ORIGEN_SLUG).maybeSingle();
  if (eO) { console.error("✖", eO.message); process.exit(1); }
  if (!origen) { console.log(`   ✖ no encontré "${ORIGEN_SLUG}"`); process.exit(1); }

  const { data: variantes, error: eV } = await supabase
    .from("variante")
    .select("id, color_id, precio, stock, gramaje, acabado_id, unidad_venta, piezas_por_unidad, es_bordado, es_brillante, es_traslucida, es_tornasol, color:color_id(nombre)")
    .eq("tela_id", origen.id);
  if (eV) { console.error("✖", eV.message); process.exit(1); }

  const { data: fotos, error: eF } = await supabase
    .from("foto").select("id, ruta, variante_id").in("variante_id", (variantes ?? []).map((v) => v.id));
  if (eF) { console.error("✖", eF.message); process.exit(1); }

  const pendientes = INTRUSOS.filter((i) => fotos?.some((f) => f.ruta === i.ruta));
  if (!pendientes.length) { console.log(`   ✓ los intrusos ya no están en "${origen.nombre}" — nada que hacer`); return; }

  // ── colores destino: deben existir ya en la tabla `color` ──
  const { data: colores, error: eC } = await supabase
    .from("color").select("id, nombre").in("nombre", INTRUSOS.map((i) => i.color));
  if (eC) { console.error("✖", eC.message); process.exit(1); }
  const colorId = new Map((colores ?? []).map((c) => [c.nombre, c.id]));
  const faltanColores = INTRUSOS.filter((i) => !colorId.has(i.color)).map((i) => i.color);
  if (faltanColores.length) {
    console.error(`✖ ABORTADO: color(es) inexistente(s) en la tabla color: ${faltanColores.join(", ")}`);
    process.exit(1);
  }

  console.log(`"${origen.nombre}" — ${variantes?.length ?? 0} variantes, ${fotos?.length ?? 0} fotos\n`);
  console.log(`── se van a "${DESTINO_NOMBRE}" (/tela/${DESTINO_SLUG}) ──`);
  const vaciar: { id: string; color: string }[] = [];
  for (const i of pendientes) {
    const f = fotos!.find((x) => x.ruta === i.ruta)!;
    const v = variantes!.find((x) => x.id === f.variante_id)!;
    const hermanas = fotos!.filter((x) => x.variante_id === v.id).length;
    const colorViejo = (v as any).color?.nombre ?? "SIN COLOR";
    const modo = hermanas === 1 ? "variante entera" : `solo esta foto (la variante ${colorViejo} conserva ${hermanas - 1})`;
    console.log(`   · ${i.ruta}`);
    console.log(`     ${i.porque}`);
    console.log(`     ${colorViejo} → ${i.color}  ·  ${modo}`);
    if (hermanas === 1) vaciar.push({ id: v.id, color: colorViejo });
  }

  const quedan = (fotos?.length ?? 0) - pendientes.length;
  const coloresQueQuedan = new Set(
    fotos!.filter((f) => !pendientes.some((i) => i.ruta === f.ruta))
      .map((f) => (variantes!.find((v) => v.id === f.variante_id) as any)?.color?.nombre)
  );
  console.log(`\n── se queda en "${origen.nombre}" ──`);
  console.log(`   ${quedan} foto(s) en ${coloresQueQuedan.size} color(es): ${[...coloresQueQuedan].join(", ")}`);
  if (vaciar.length) console.log(`   ✂ variante(s) que quedan sin fotos y se borran: ${vaciar.map((v) => v.color).join(", ")}`);

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  // ── 1. ficha destino ──
  const { data: destino, error: eD } = await supabase
    .from("tela")
    .upsert({ slug: DESTINO_SLUG, nombre: DESTINO_NOMBRE, categoria_id: origen.categoria_id, descripcion: null }, { onConflict: "slug" })
    .select("id").single();
  if (eD) { console.error(`   ✖ creando "${DESTINO_NOMBRE}": ${eD.message}`); process.exit(1); }

  // ── 2. mover cada intruso ──
  for (const i of pendientes) {
    const f = fotos!.find((x) => x.ruta === i.ruta)!;
    const v = variantes!.find((x) => x.id === f.variante_id)! as any;
    const cid = colorId.get(i.color)!;
    const soloEsa = fotos!.filter((x) => x.variante_id === v.id).length === 1;

    const { data: yaExiste } = await supabase
      .from("variante").select("id").eq("tela_id", destino.id).eq("color_id", cid).maybeSingle();

    if (soloEsa && !yaExiste) {
      // la variante entera se muda; se le corrige el color de paso
      const { error } = await supabase.from("variante").update({ tela_id: destino.id, color_id: cid }).eq("id", v.id);
      if (error) { console.error(`   ✖ moviendo variante ${i.color}: ${error.message}`); process.exit(1); }
      console.log(`   ✓ variante ${i.color} movida entera`);
      continue;
    }

    let destinoVarianteId = yaExiste?.id as string | undefined;
    if (!destinoVarianteId) {
      const { data, error } = await supabase.from("variante").insert({
        tela_id: destino.id, color_id: cid, acabado_id: v.acabado_id,
        precio: v.precio, stock: v.stock, gramaje: v.gramaje,
        unidad_venta: v.unidad_venta, piezas_por_unidad: v.piezas_por_unidad,
        es_bordado: v.es_bordado, es_brillante: v.es_brillante,
        es_traslucida: v.es_traslucida, es_tornasol: v.es_tornasol,
      }).select("id").single();
      if (error) { console.error(`   ✖ creando variante ${i.color}: ${error.message}`); process.exit(1); }
      destinoVarianteId = data.id;
    }
    const { error: eMov } = await supabase.from("foto").update({ variante_id: destinoVarianteId }).eq("id", f.id);
    if (eMov) { console.error(`   ✖ moviendo foto ${i.ruta}: ${eMov.message}`); process.exit(1); }
    console.log(`   ✓ ${i.ruta} → variante ${i.color}`);

    const { data: restantes } = await supabase.from("foto").select("id").eq("variante_id", v.id);
    if (!restantes?.length) {
      await supabase.from("variante").delete().eq("id", v.id);
      console.log(`   ✂ variante ${(v as any).color?.nombre} de "${origen.nombre}" borrada (se quedó sin fotos)`);
    }
  }

  // ── 3. la ficha origen cambió de conteo de colores: que describir la rehaga ──
  await supabase.from("tela").update({ descripcion: null }).eq("id", origen.id);

  // ── 4. orden y alt en las dos fichas ──
  for (const [telaId, nombre] of [[origen.id, origen.nombre], [destino.id, DESTINO_NOMBRE]] as const) {
    const { data: vs } = await supabase
      .from("variante").select("id, color:color_id(nombre)").eq("tela_id", telaId).order("orden");
    let orden = 0;
    for (const v of vs ?? []) {
      await supabase.from("variante").update({ orden: orden++ }).eq("id", v.id);
      await supabase.from("foto").update({ alt: `${nombre} · ${(v as any).color?.nombre ?? ""}`.replace(/ · $/, "") }).eq("variante_id", v.id);
    }
    console.log(`   ✓ ${nombre} — ${vs?.length ?? 0} variante(s)`);
  }

  console.log(`\nListo. Corre "pnpm describir --aplicar" para regenerar las descripciones de las dos fichas.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
