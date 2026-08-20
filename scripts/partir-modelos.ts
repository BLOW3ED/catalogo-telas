#!/usr/bin/env tsx
/**
 * Partir fichas que esconden varios modelos — Telas La Jalisciense
 * ===========================================================================
 * Tres fichas (`Mariposa`, `map4`, `Flores`) traían 54 fotos bajo UNA variante
 * cada una. Eso las volvía imposibles de cotizar: el detalle solo pinta la
 * variante seleccionada y `ColorSelector` necesita dos variantes CON color
 * para siquiera aparecer, así que 51 de esas 54 fotos se veían en el carrusel
 * pero no se podían pedir por separado.
 *
 * Revisadas foto por foto, no eran colores de un mismo producto: eran SEIS
 * modelos distintos más cuatro piezas que no pintaban nada ahí (un rollo de
 * encaje, una flor suelta, unos girasoles y unas cabezas de caballo).
 *
 * La partición respeta dos reglas que salieron de la revisión:
 *
 *   · UNA VARIANTE POR COLOR, no por foto. Varias tomas son la misma pieza
 *     sobre fondo negro y sobre fondo blanco (butterfly00216/00223 miden
 *     #5E141D y #5A141A). Una variante por foto pondría dos swatches idénticos
 *     en la misma fila.
 *
 *   · EL HEX SALE DE LA PALETA, no del pixel. Las tomas sobre fondo negro
 *     están subexpuestas: la mariposa azul mide #092C5F y el producto es azul
 *     rey. El pixel sirve para IDENTIFICAR el color (el matiz sobrevive a la
 *     subexposición) pero no para representarlo en un swatch.
 *
 * Y una regla dura: si alguna foto de las fichas de origen se quedara sin
 * asignar, el script ABORTA. Las fichas de origen se borran al final, y con
 * ellas se iría en CASCADE cualquier foto que no se haya movido.
 *
 *   pnpm partir              → SIMULACRO
 *   pnpm partir --aplicar    → escribe
 *
 * Idempotente: relee por slug y por (tela,color) antes de crear nada.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/** Faltaban en la paleta. Hex en el estilo de los ya curados, no medidos. */
const COLORES_NUEVOS = [
  { nombre: "Rojo", hex: "#C1272D" },
  { nombre: "Vino", hex: "#7B1B2B" },
  { nombre: "Celeste", hex: "#9CC6DC" },
  { nombre: "Azul Marino", hex: "#1E2A4A" },
  { nombre: "Morado", hex: "#6B3FA0" },
];

type Modelo = {
  nombre: string;
  categoria: string;
  unidad: string;
  /** nombre de archivo sin extensión → color. Varias fotos del mismo color
   *  se agrupan en UNA variante con todas sus fotos. */
  fotos: Record<string, string>;
  nota?: string;
};

const MODELOS: Modelo[] = [
  {
    nombre: "Mariposa bordada", categoria: "Aplicación de pedrería", unidad: "pieza",
    fotos: {
      butterfly00205: "Azul", butterfly00206: "Rojo", butterfly00207: "Celeste",
      butterfly00208: "Lila", butterfly00209: "Blush", butterfly00210: "Rosado",
      butterfly00212: "Humo", butterfly00213: "Blanco", butterfly00214: "Oro",
      butterfly00216: "Vino", butterfly00223: "Vino", butterfly00224: "Verde Botella",
      butterfly00230: "Negro", butterfly00232: "Azul Marino",
    },
  },
  {
    nombre: "Mariposa de organza", categoria: "Aplicación de pedrería", unidad: "pieza",
    fotos: {
      map400005: "Lila", map400007: "Champagne", map400009: "Azul Marino",
      map400010: "Azul Marino", map400014: "Negro",
    },
  },
  { nombre: "Mariposa glitter", categoria: "Aplicación de pedrería", unidad: "pieza",
    fotos: { map400000: "Plata" } },
  { nombre: "Aplicación de encaje floral", categoria: "Aplicación de pedrería", unidad: "pieza",
    fotos: { map400019: "Blanco" }, nota: "nombre provisional: estaba mezclada entre las mariposas" },
  {
    nombre: "Aplicación de rosas", categoria: "Flores", unidad: "pieza",
    fotos: {
      flores00122: "Azul", flores00123: "Azul", flores00125: "Amarillo", flores00126: "Rojo",
      flores00127: "Magenta", flores00129: "Morado", flores00135: "Vino", flores00137: "Rosado",
      flores00140: "Morado", flores00141: "Rojo", flores00145: "Amarillo", flores00146: "Azul",
      flores00148: "Cedrón", flores00151: "Vino",
    },
  },
  {
    // El único que NO se vende por pieza. Hoy comparte ficha con la aplicación
    // y por lo tanto su `unidad_venta`, así que se está cotizando mal.
    nombre: "Galón de rosas", categoria: "Flores", unidad: "metro",
    fotos: {
      flores00155: "Morado", flores00156: "Morado", flores00157: "Rojo", flores00158: "Blush",
      flores00160: "Rosado", flores00161: "Rosado", flores00164: "Rojo", flores00165: "Blanco",
      flores00171: "Humo", flores00174: "Vino", flores00179: "Oro", flores00180: "Cedrón",
      flores00183: "Magenta", flores00185: "Azul", flores00186: "Lila",
    },
  },
  { nombre: "Galón de encaje hueso", categoria: "Galón de encaje", unidad: "metro",
    fotos: { flores00131: "Hueso" }, nota: "nombre provisional" },
  { nombre: "Aplicación de flor grande", categoria: "Flores", unidad: "pieza",
    fotos: { flores00167: "Humo" }, nota: "nombre provisional" },
  { nombre: "Aplicación de girasoles", categoria: "Flores", unidad: "pieza",
    fotos: { flores00178: "Amarillo" }, nota: "nombre provisional" },
  { nombre: "Aplicación de caballos", categoria: "Aplicación de pedrería", unidad: "pieza",
    fotos: { flores00189: "Plata" }, nota: "nombre provisional; no es flor" },
];

/** Fichas que se vacían y se borran al terminar. */
const ORIGENES = ["Mariposa", "map4", "Flores"];

const sinExt = (ruta: string) => ruta.split("/").pop()!.replace(/\.\w+$/, "");

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("✖ Faltan llaves en .env.local"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [telasR, varsR, fotosR, colorR, catR] = await Promise.all([
    supabase.from("tela").select("id, slug, nombre, categoria_id"),
    supabase.from("variante").select("id, tela_id, color_id, unidad_venta"),
    supabase.from("foto").select("id, variante_id, ruta, orden"),
    supabase.from("color").select("id, nombre, hex"),
    supabase.from("categoria").select("id, nombre"),
  ]);
  for (const r of [telasR, varsR, fotosR, colorR, catR]) {
    if (r.error) { console.error("✖ leyendo BD:", r.error.message); process.exit(1); }
  }
  const telas = telasR.data ?? [], variantes = varsR.data ?? [], fotos = fotosR.data ?? [];
  const colores = colorR.data ?? [], categorias = catR.data ?? [];

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"}\n`);

  // -------------------------------------------------------------------------
  // 0) Comprobación previa: ninguna foto de origen puede quedar sin asignar
  // -------------------------------------------------------------------------
  const varsDeOrigen = new Set(
    telas.filter((t) => ORIGENES.includes(t.nombre)).flatMap((t) => variantes.filter((v) => v.tela_id === t.id).map((v) => v.id))
  );
  const fotosOrigen = fotos.filter((f) => varsDeOrigen.has(f.variante_id));
  const asignadas = new Set(MODELOS.flatMap((m) => Object.keys(m.fotos)));
  const huerfanas = fotosOrigen.filter((f) => !asignadas.has(sinExt(f.ruta)));
  console.log(`── Cobertura ──\n   ${fotosOrigen.length} fotos en las fichas de origen · ${asignadas.size} asignadas`);
  if (huerfanas.length) {
    console.error(`   ✖ ${huerfanas.length} fotos SIN asignar; se perderían al borrar el origen:`);
    huerfanas.forEach((f) => console.error(`     · ${f.ruta}`));
    process.exit(1);
  }
  if (!fotosOrigen.length) { console.log("   ✓ ya está partido, no hay nada que mover\n"); return; }
  console.log("   ✓ todas cubiertas");

  // -------------------------------------------------------------------------
  // 1) Colores nuevos
  // -------------------------------------------------------------------------
  console.log("\n── Colores nuevos ──");
  const porColor = new Map(colores.map((c) => [c.nombre.toLowerCase(), c]));
  for (const c of COLORES_NUEVOS) {
    if (porColor.has(c.nombre.toLowerCase())) { console.log(`   · ${c.nombre} ya existía`); continue; }
    console.log(`   + ${c.nombre}  ${c.hex}`);
    if (!APLICAR) { porColor.set(c.nombre.toLowerCase(), { id: `nuevo-${c.nombre}`, ...c }); continue; }
    const { data, error } = await supabase.from("color")
      .upsert({ nombre: c.nombre, slug: slugify(c.nombre), hex: c.hex }, { onConflict: "slug" }).select("id, nombre, hex").single();
    if (error || !data) { console.error(`   ✖ ${c.nombre}: ${error?.message}`); process.exit(1); }
    porColor.set(c.nombre.toLowerCase(), data);
  }

  // Todos los colores usados tienen que existir ANTES de mover nada.
  const usados = new Set(MODELOS.flatMap((m) => Object.values(m.fotos)));
  const faltantes = [...usados].filter((n) => !porColor.has(n.toLowerCase()));
  if (faltantes.length) { console.error(`\n✖ colores inexistentes: ${faltantes.join(", ")}`); process.exit(1); }

  // -------------------------------------------------------------------------
  // 2) Un modelo a la vez
  // -------------------------------------------------------------------------
  const porCategoria = new Map(categorias.map((c) => [c.nombre, c]));
  const fotoPorBase = new Map(fotosOrigen.map((f) => [sinExt(f.ruta), f]));
  let movidas = 0;

  for (const m of MODELOS) {
    const grupos = new Map<string, string[]>();
    for (const [base, color] of Object.entries(m.fotos)) {
      if (!grupos.has(color)) grupos.set(color, []);
      grupos.get(color)!.push(base);
    }
    const cat = porCategoria.get(m.categoria);
    console.log(`\n── ${m.nombre} ──`);
    console.log(`   ${m.categoria} · por ${m.unidad} · ${grupos.size} colores / ${Object.keys(m.fotos).length} fotos${m.nota ? `  (${m.nota})` : ""}`);
    for (const [color, bases] of grupos) console.log(`   · ${color.padEnd(15)} ${bases.length} foto(s)`);
    if (!APLICAR) continue;

    const slug = slugify(m.nombre);
    const { data: tela, error: eT } = await supabase.from("tela")
      .upsert({ slug, nombre: m.nombre, categoria_id: cat?.id ?? null }, { onConflict: "slug" }).select("id").single();
    if (eT || !tela) { console.error(`   ✖ tela: ${eT?.message}`); process.exit(1); }

    for (const [color, bases] of grupos) {
      const col = porColor.get(color.toLowerCase())!;
      // Reusar la variante si ya existe para ese (tela,color): idempotencia.
      const { data: prev } = await supabase.from("variante")
        .select("id").eq("tela_id", tela.id).eq("color_id", col.id).maybeSingle();
      let varianteId = prev?.id as string | undefined;
      if (!varianteId) {
        const { data: nueva, error: eV } = await supabase.from("variante")
          .insert({ tela_id: tela.id, color_id: col.id, unidad_venta: m.unidad }).select("id").single();
        if (eV || !nueva) { console.error(`   ✖ variante ${color}: ${eV?.message}`); process.exit(1); }
        varianteId = nueva.id;
      }
      for (const [i, base] of bases.entries()) {
        const f = fotoPorBase.get(base);
        if (!f) { console.error(`   ✖ no encontré la foto ${base}`); process.exit(1); }
        const { error: eF } = await supabase.from("foto")
          .update({ variante_id: varianteId, orden: i }).eq("id", f.id);
        if (eF) { console.error(`   ✖ foto ${base}: ${eF.message}`); process.exit(1); }
        movidas++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3) Borrar las fichas de origen, ya vacías
  // -------------------------------------------------------------------------
  console.log("\n── Fichas de origen ──");
  for (const nombre of ORIGENES) {
    const t = telas.find((x) => x.nombre === nombre);
    if (!t) { console.log(`   · ${nombre}: ya no está`); continue; }
    console.log(`   ✂ ${nombre}  (/tela/${t.slug} dejará de existir)`);
    if (!APLICAR) continue;
    // Releer: no se borra a ciegas algo que todavía tenga fotos colgando.
    const { data: vv } = await supabase.from("variante").select("id").eq("tela_id", t.id);
    const ids = (vv ?? []).map((v) => v.id);
    if (ids.length) {
      const { data: ff } = await supabase.from("foto").select("id").in("variante_id", ids);
      if (ff?.length) { console.error(`   ✖ ${nombre} todavía tiene ${ff.length} fotos: NO se borra`); continue; }
    }
    const { error } = await supabase.from("tela").delete().eq("id", t.id);
    if (error) console.error(`   ✖ ${nombre}: ${error.message}`);
  }

  console.log(`\n${APLICAR ? "Listo." : "Nada de esto se escribió."} ${MODELOS.length} modelos · ${movidas} fotos movidas\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
