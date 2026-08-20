#!/usr/bin/env tsx
/**
 * Corregir vocabulario: tornasol y guipiur — Telas La Jalisciense
 * ===========================================================================
 * Dos correcciones que dio la tienda el 2026-08-19 sobre cómo se dicen las
 * cosas en la tienda. Las dos son de VOCABULARIO, no de datos: el catálogo
 * tenía la información bien, pero con la palabra equivocada.
 *
 * 1) "TORNASOL ES TORNASOL". Yo había metido ese acabado bajo `Cristal AB`
 *    reusando el swatch que creó `separar-colores.ts`. Es el mismo acabado,
 *    sí, pero el nombre que usa la tienda —y con el que el cliente lo pide—
 *    es tornasol. El esquema ya le daba la razón: `variante.es_tornasol`
 *    existe como bandera desde la sección 11 del SQL. Así que el color se
 *    RENOMBRA (no se duplica: abrir un "Tornasol" al lado de "Cristal AB"
 *    partiría 23 variantes en dos swatches del mismo acabado).
 *    De paso se enciende `es_tornasol` en todas: la bandera y el color tienen
 *    que decir lo mismo.
 *    `Cristal` a secas NO se toca: ese es la piedra transparente sin acabado.
 *
 *    ⚠ El `slug` del color también cambia (`cristal-ab` → `tornasol`), y el
 *    slug viaja en la URL de los filtros (`lib/filtros.ts`). Un link viejo con
 *    `?color=cristal-ab` deja de filtrar. Se acepta: son links de sesión, no
 *    de producto, y dejar el slug diciendo "cristal-ab" mientras el chip dice
 *    "Tornasol" es peor.
 *
 * 2) "GALÓN DE ROSAS: CONÉCTALO A TIRAS O GUIPIUR, NO USES EL NOMBRE GALÓN".
 *    Es una guirnalda continua de rosas con hoja verde, unidas por su propio
 *    hilo y sin base de tul: eso es guipiur. Comparada con la ficha "Guipiur"
 *    (encaje festoneado) NO es el mismo diseño, así que no se fusiona — se
 *    renombra a "Guipiur de rosas" y se muda a la categoría donde vive esa
 *    familia.
 *
 *    Además arregla un conflicto real: estaba en "Flores", que por
 *    `UNIDAD_POR_CATEGORIA` se vende por PIEZA, pero se corta por metro. Cada
 *    corrida de `pnpm clasificar --aplicar` le quería cambiar la unidad a sus
 *    12 variantes. En la categoría de guipiur la unidad es metro y el
 *    conflicto desaparece.
 *
 *   pnpm corregir:vocabulario              → SIMULACRO
 *   pnpm corregir:vocabulario --aplicar    → escribe
 *
 * `tela.slug` NO se toca. Idempotente.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const COLOR = {
  de: "Cristal AB",
  a: "Tornasol",
  slug: "tornasol",
  /** Se conserva el hex: el acabado no cambió, solo cómo se le dice. */
};

/**
 * "Oro rosa es rose gold" — el hex que había propuesto (#C68A6A) tiraba a
 * cobre. Se corrige al rosa metálico, que es lo que la tienda quiere decir.
 */
const ORO_ROSA_HEX = "#B76E79";

const TELA = {
  slug: "galon-de-rosas",
  nombre: "Guipiur de rosas",
  categoria: "Galón de encaje",
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

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · corregir-vocabulario\n`);

  // ── 1. Cristal AB → Tornasol ──
  const { data: viejo } = await supabase.from("color").select("id, nombre, hex").eq("nombre", COLOR.de).maybeSingle();
  const { data: nuevo } = await supabase.from("color").select("id, nombre").eq("nombre", COLOR.a).maybeSingle();

  console.log("── color ──");
  let colorId: string | null = null;
  if (viejo) {
    const { count } = await supabase.from("variante").select("id", { count: "exact", head: true }).eq("color_id", viejo.id);
    console.log(`   · "${COLOR.de}" → "${COLOR.a}"  (${count} variante(s), hex ${viejo.hex} se conserva)`);
    colorId = viejo.id;
  } else if (nuevo) {
    console.log(`   ✓ ya se llama "${COLOR.a}"`);
    colorId = nuevo.id;
  } else {
    console.log(`   ⚠ no encontré ni "${COLOR.de}" ni "${COLOR.a}" — se omite`);
  }
  if (viejo && nuevo) {
    console.error(`   ✖ ABORTADO: existen los dos colores a la vez; hay que fusionarlos a mano antes`);
    process.exit(1);
  }

  if (colorId) {
    const { count: sinBandera } = await supabase
      .from("variante").select("id", { count: "exact", head: true }).eq("color_id", colorId).eq("es_tornasol", false);
    console.log(`   · es_tornasol: ${sinBandera} variante(s) lo tienen apagado y se enciende`);
  }

  const { data: oroRosa } = await supabase.from("color").select("id, hex").eq("nombre", "Oro Rosa").maybeSingle();
  if (oroRosa && oroRosa.hex.toLowerCase() !== ORO_ROSA_HEX.toLowerCase()) {
    console.log(`   · Oro Rosa: ${oroRosa.hex} → ${ORO_ROSA_HEX} (rose gold, no cobre)`);
  } else if (oroRosa) {
    console.log(`   ✓ Oro Rosa ya está en ${ORO_ROSA_HEX}`);
  }

  // ── 2. Galón de rosas → Guipiur de rosas ──
  console.log("\n── ficha ──");
  const { data: tela } = await supabase
    .from("tela").select("id, nombre, categoria:categoria_id(nombre)").eq("slug", TELA.slug).maybeSingle();
  const { data: cat } = await supabase.from("categoria").select("id, nombre").eq("nombre", TELA.categoria).maybeSingle();
  if (!tela) console.log(`   ⚠ no encontré "${TELA.slug}" — se omite`);
  else if (!cat) { console.error(`   ✖ ABORTADO: no existe la categoría "${TELA.categoria}"`); process.exit(1); }
  else {
    const catActual = (tela as any).categoria?.nombre ?? "—";
    const { count } = await supabase.from("variante").select("id", { count: "exact", head: true }).eq("tela_id", tela.id);
    if (tela.nombre === TELA.nombre && catActual === TELA.categoria) console.log(`   ✓ ya está corregida`);
    else {
      console.log(`   · "${tela.nombre}" → "${TELA.nombre}"`);
      console.log(`   · categoría ${catActual} → ${TELA.categoria}  (${count} variante(s) dejan de pelearse con pnpm clasificar)`);
      console.log(`     es guipiur: guirnalda continua de rosas unidas por su propio hilo, sin base de tul`);
    }
  }

  console.log(`\n── para la tienda ──`);
  console.log(`   ⚠ La CATEGORÍA sigue llamándose "Galón de encaje" y es la que va a salir`);
  console.log(`     en la card y en el chip de filtros. Si la palabra "galón" tampoco te`);
  console.log(`     gusta ahí, la renombro a "Guipiur" — pero afecta también a los 5`);
  console.log(`     Guipiur Litúrgicos, a "Guipiur" y a "Galón de encaje hueso", que en`);
  console.log(`     la fase 1 pediste NO tocar. Dime y lo hago aparte.`);

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  if (viejo) {
    const { error } = await supabase.from("color")
      .update({ nombre: COLOR.a, slug: COLOR.slug }).eq("id", viejo.id);
    if (error) { console.error(`   ✖ renombrando el color: ${error.message}`); process.exit(1); }
    console.log(`   ✓ color renombrado a "${COLOR.a}"`);
  }
  if (colorId) {
    const { data, error } = await supabase.from("variante")
      .update({ es_tornasol: true }).eq("color_id", colorId).eq("es_tornasol", false).select("id");
    if (error) { console.error(`   ✖ encendiendo es_tornasol: ${error.message}`); process.exit(1); }
    if (data?.length) console.log(`   ✓ es_tornasol encendido en ${data.length} variante(s)`);
  }
  if (oroRosa && oroRosa.hex.toLowerCase() !== ORO_ROSA_HEX.toLowerCase()) {
    const { error } = await supabase.from("color").update({ hex: ORO_ROSA_HEX }).eq("id", oroRosa.id);
    if (error) { console.error(`   ✖ ajustando Oro Rosa: ${error.message}`); process.exit(1); }
    console.log(`   ✓ Oro Rosa ahora es ${ORO_ROSA_HEX}`);
  }

  if (tela && cat) {
    const { error } = await supabase.from("tela")
      .update({ nombre: TELA.nombre, categoria_id: cat.id, descripcion: null }).eq("id", tela.id);
    if (error) { console.error(`   ✖ corrigiendo la ficha: ${error.message}`); process.exit(1); }
    // el alt de las fotos trae el nombre viejo
    const { data: vs } = await supabase.from("variante").select("id, color:color_id(nombre)").eq("tela_id", tela.id);
    for (const v of vs ?? []) {
      await supabase.from("foto").update({ alt: `${TELA.nombre} · ${(v as any).color?.nombre ?? ""}`.replace(/ · $/, "") })
        .eq("variante_id", v.id);
    }
    console.log(`   ✓ "${TELA.nombre}" en ${TELA.categoria}, ${vs?.length ?? 0} variante(s) con alt actualizado`);
  }

  console.log(`\nCorre "pnpm describir --aplicar" para regenerar la descripción de la ficha.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
