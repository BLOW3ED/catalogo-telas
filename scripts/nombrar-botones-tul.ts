#!/usr/bin/env tsx
/**
 * Nombrar botones y tiras de tul bordado — Telas La Jalisciense
 * ===========================================================================
 * Punto 1 de la lista: "ponle nombre a cada botón y a tiras tul bordado".
 * Las 12 fichas de Botones se llamaban "Botón BO1025", "Botón BO52923"… y las
 * 17 de Tul Bordado "96277 Tira Tul Bordado 25 mm": el código del proveedor
 * en lugar del producto. Nadie busca "BO52923" en el catálogo.
 *
 * Los nombres salen de abrir las 15 fotos de botones y las 55 de tul a
 * resolución `md`, y describen lo que DISTINGUE a cada pieza de sus hermanas
 * —cuántas orillas de piedra, si trae perla, si la piedra central es ovalada—
 * porque nueve de los doce botones son "un racimo de piedra redondo" y el
 * nombre tiene que servir para escogerlos.
 *
 * El ANCHO se conserva: es dato real que la tienda usa para cotizar, y ya lo
 * venía formateando `afinar-catalogo`. Lo que se va es el código.
 *
 * Tres cosas más que salieron de mirar, y que el nombre solo no arregla:
 *
 * 1) DOS PARES DE BOTONES SON EL MISMO DISEÑO, cambia el metal. Se fusionan,
 *    igual que se hizo con las tiras de pedrería, para no dejar dos cards
 *    idénticas en la vitrina:
 *      · BO133923 (oro) + BO13RG39 (oro rosa) → misma rosa calada. El código
 *        lo dice solo: BO13 + **RG** = rose gold.
 *      · BO6035 (oro) + BO635 (oro rosa) → mismo solitario con doble halo.
 *
 * 2) NUEVE FICHAS DE TUL TRAÍAN VARIOS COLORES COMO FOTOS SUELTAS, el mismo
 *    problema que las tiras de pedrería: se veían en el carrusel y no se
 *    podían pedir. "Tira Bordado" traía verde Y rojo; 95221 traía cuatro
 *    colores; 201 traía tres. Cada foto pasa a ser la variante de su color.
 *
 * 3) 203 tiene DOS fichas con el mismo código y son productos distintos
 *    (una es margarita calada, la otra rosas con hoja): no se fusionan, se
 *    nombran por su motivo. El código no alcanza para identificar producto.
 *
 * Un color nuevo: el verde de "Tira Bordado" es esmeralda y la paleta solo
 * tenía botella (muy oscuro), olivo y limón. Hex propuesto, editable en
 * /admin, igual que Oro Rosa.
 *
 *   pnpm nombrar:botones-tul              → SIMULACRO
 *   pnpm nombrar:botones-tul --aplicar    → escribe
 *
 * `tela.slug` NO se toca: los links de WhatsApp ya compartidos siguen vivos.
 * Idempotente: reusa la variante por (tela,color) y no renombra lo ya escrito.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/** El verde esmeralda no estaba en la paleta. Propuesto, editable en /admin. */
const COLORES_NUEVOS = [{ nombre: "Verde Esmeralda", hex: "#1F8A4C" }];

/** slug → nombre real. Sin código; el ancho se conserva porque sí es dato. */
const NOMBRES: Record<string, string> = {
  // ── Botones (todos son botón de pedrería con pie; lo que cambia es el dibujo)
  "boton-bo1025": "Botón de racimo de piedra",
  "boton-bo12": "Botón de doble orilla de piedra",
  "boton-bo133923": "Botón de rosa calada",
  "boton-bo135": "Botón de margarita con centro pavé",
  "boton-bo15": "Botón de perlas",
  "boton-bo52923": "Botón de piedra central con orilla",
  "boton-bo6035": "Botón solitario con doble halo",
  "boton-bo7": "Botón de flor chico",
  "boton-bo8": "Botón de estrella de piedra",
  "boton-bo9": "Botón de piedra ovalada",

  // ── Tul bordado (el ancho se queda; el código se va)
  "201-tira-tul-bordado40mm": "Tira de tul bordado flor 3D · 40 mm",
  "203-tira-tul-bordado": "Tira de tul bordado margarita calada",
  "203-tira-tul-bordado35mm": "Tira de tul bordado rosa con hoja · 35 mm",
  "216-tira-bordado": "Tira de tul bordado vid con lentejuela",
  "351-tira-tul-bordado150mm": "Tira de tul bordado festón · 150 mm",
  "354-tira-tul-bordado220mm": "Tira de tul bordado festón alto · 220 mm",
  "358-tira-tul-bordado315mm": "Tira de tul bordado medallón · 315 mm",
  "359-tira-tul-bordado105mm": "Tira de tul bordado festón fino · 105 mm",
  "95221-tira-tul-bordado": "Tira de tul bordado espiral con lentejuela",
  "96277-tira-tul-bordado25mm": "Tira de tul bordado vid con cuenta · 25 mm",
  "96753-tira-tul-bordado": "Tira de tul bordado flor con cuenta",
  "97108-tira-tul-bordado30mm": "Tira de tul bordado vid fina · 30 mm",
  "h1548-tira-tul-bordado105mm": "Tira de tul bordado festón floral · 105 mm",
  "h1548-tira-tul-bordado30mm": "Tira de tul bordado festón angosto · 30 mm",
  "tira-bordado": "Tira de tul bordado vid con lentejuela ancha",
};

/** Mismo diseño, distinto metal: `absorbe` se vacía dentro de `conserva`. */
const FUSIONES: { conserva: string; absorbe: string; colorAbsorbe: string; porque: string }[] = [
  {
    conserva: "boton-bo133923", absorbe: "boton-bo13rg39", colorAbsorbe: "Oro Rosa",
    porque: "misma rosa calada, mismo pavé, misma vuelta de pétalo; el código lo dice: BO13+RG = rose gold",
  },
  {
    conserva: "boton-bo6035", absorbe: "boton-bo635", colorAbsorbe: "Oro Rosa",
    porque: "mismo solitario con doble halo, cambia el metal",
  },
];

/** slug → { basename de la foto: color }. Todo salió de abrir la foto. */
const COLOR_POR_FOTO: Record<string, Record<string, string>> = {
  // ── Botones
  "boton-bo1025": { bo102500003: "Oro", bo102500004: "Plata" },
  "boton-bo12": { bo1200003: "Plata" },
  "boton-bo133923": { bo13392300004: "Oro" },
  "boton-bo135": { bo13500004: "Oro" },
  "boton-bo15": { bo1500003: "Oro" },
  "boton-bo52923": { bo5292300003: "Oro" },
  "boton-bo6035": { bo603500003: "Oro" },
  "boton-bo7": { bo700003: "Oro" },
  "boton-bo8": { bo800003: "Oro", bo800004: "Plata" },
  "boton-bo9": { bo900004: "Oro", bo900006: "Plata" },

  // ── Tul bordado: los colores venían escondidos como fotos sueltas
  "201-tira-tul-bordado40mm": {
    "201tiratulbordado40mm00000": "Vino", "201tiratulbordado40mm00002": "Magenta",
    "201tiratulbordado40mm00003": "Blanco", "201tiratulbordado40mm00007": "Blanco",
  },
  "203-tira-tul-bordado": {
    "203tiratulbordado00000": "Negro", "203tiratulbordado00003": "Vino",
    "203tiratulbordado00021": "Mauve",
  },
  "203-tira-tul-bordado35mm": {
    "203tiratulbordado35mm00000": "Blanco", "203tiratulbordado35mm00001": "Blanco",
    "203tiratulbordado35mm00003": "Blanco",
  },
  "216-tira-bordado": { "216tirabordado00013": "Turquesa", "216tirabordado00014": "Lila" },
  "95221-tira-tul-bordado": {
    "95221tiratulbordado00013": "Turquesa", "95221tiratulbordado00014": "Azul Petróleo",
    "95221tiratulbordado00017": "Blanco", "95221tiratulbordado00020": "Negro",
  },
  "96753-tira-tul-bordado": { "96753tiratulbordado00014": "Blanco", "96753tiratulbordado00017": "Rojo" },
  "97108-tira-tul-bordado30mm": {
    "97108tiratulbordado30mm00000": "Oro", "97108tiratulbordado30mm00001": "Verde Limón",
    "97108tiratulbordado30mm00002": "Champagne",
  },
  "h1548-tira-tul-bordado105mm": { h1548tiratulbordado105mm00000: "Blanco" },
  "h1548-tira-tul-bordado30mm": { h1548tiratulbordado30mm00003: "Oro" },
  // 00014 y 00015 son la MISMA tira verde, la segunda con más exposición
  // (por eso tira a limón); el matiz no cambia, la toma sí.
  "tira-bordado": {
    "tirabordado00014": "Verde Esmeralda", "tirabordado00015": "Verde Esmeralda",
    "tirabordado00016": "Rojo", "tirabordado00017": "Rojo",
  },
  // Las seis tomas son el mismo encaje marfil, incluidas las dos que llegaron
  // de la ficha 350 al fusionarla en `agrupar-tira-pedreria`.
  "351-tira-tul-bordado150mm": {
    "351tiratulbordado150mm00000": "Blanco", "351tiratulbordado150mm00001": "Blanco",
    "351tiratulbordado150mm00002": "Blanco", "351tiratulbordado150mm00003": "Blanco",
    "350tiraorillapiedra150mm00000": "Blanco", "350tiraorillapiedra150mm00001": "Blanco",
  },
  "tul-bordado": { "variante-1782970462523-0": "Blanco" },
};

const base = (ruta: string) => ruta.split("/").pop()!.replace(/\.[^.]+$/, "");

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · nombrar-botones-tul\n`);

  const slugs = [...new Set([
    ...Object.keys(NOMBRES), ...Object.keys(COLOR_POR_FOTO),
    ...FUSIONES.flatMap((f) => [f.conserva, f.absorbe]),
  ])];
  const { data: telas, error: eT } = await supabase.from("tela").select("id, slug, nombre").in("slug", slugs);
  if (eT) { console.error("✖", eT.message); process.exit(1); }
  const porSlug = new Map((telas ?? []).map((t) => [t.slug, t]));

  const faltan = slugs.filter((s) => !porSlug.has(s));
  if (faltan.length) console.log(`   ⚠ ficha(s) que ya no existen (¿fusionadas?): ${faltan.join(", ")}\n`);

  // ── reporte: nombres ──
  const renombres = Object.entries(NOMBRES)
    .map(([slug, nombre]) => ({ t: porSlug.get(slug), nombre }))
    .filter((r) => r.t && r.t.nombre !== r.nombre);
  console.log(`── nombres (${renombres.length} por cambiar de ${Object.keys(NOMBRES).length}) ──`);
  for (const r of renombres) console.log(`   · "${r.t!.nombre}"  →  "${r.nombre}"`);
  if (!renombres.length) console.log("   ✓ ya nombradas");

  // ── reporte: fusiones ──
  console.log(`\n── mismo diseño, distinto metal (${FUSIONES.length}) ──`);
  for (const f of FUSIONES) {
    const a = porSlug.get(f.absorbe);
    if (!a) { console.log(`   ✓ "${f.absorbe}" ya no existe — fusión aplicada`); continue; }
    console.log(`   · "${a.nombre}" → "${NOMBRES[f.conserva] ?? f.conserva}" como ${f.colorAbsorbe}`);
    console.log(`     ${f.porque}`);
  }

  // ── reporte: colores ──
  console.log(`\n── colores por foto (${Object.keys(COLOR_POR_FOTO).length} fichas) ──`);
  const trabajo: { slug: string; telaId: string; porColor: Map<string, string[]> }[] = [];
  const sinAsignar: string[] = [];
  for (const [slug, mapa] of Object.entries(COLOR_POR_FOTO)) {
    const t = porSlug.get(slug);
    if (!t) continue;
    const { data: vs } = await supabase.from("variante").select("id").eq("tela_id", t.id);
    const { data: fs } = await supabase.from("foto").select("id, ruta").in("variante_id", (vs ?? []).map((v) => v.id));
    const porColor = new Map<string, string[]>();
    for (const f of fs ?? []) {
      const color = mapa[base(f.ruta)];
      if (!color) { sinAsignar.push(`${slug}/${base(f.ruta)}`); continue; }
      if (!porColor.has(color)) porColor.set(color, []);
      porColor.get(color)!.push(f.id);
    }
    trabajo.push({ slug, telaId: t.id, porColor });
    console.log(`   · ${(NOMBRES[slug] ?? t.nombre).padEnd(46)} ${[...porColor.entries()].map(([c, i]) => `${c}×${i.length}`).join(", ")}`);
  }
  if (sinAsignar.length) console.log(`\n   ⚠ foto(s) sin color asignado (no se tocan): ${sinAsignar.join(", ")}`);

  console.log(`\n── colores nuevos en la paleta ──`);
  for (const c of COLORES_NUEVOS) {
    const { data } = await supabase.from("color").select("id").eq("nombre", c.nombre).maybeSingle();
    console.log(data ? `   ✓ ${c.nombre} ya existe` : `   + ${c.nombre} ${c.hex} (propuesto, editable en /admin)`);
  }

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  // ═══════════════ escritura ═══════════════

  for (const c of COLORES_NUEVOS) {
    const { error } = await supabase.from("color")
      .upsert({ nombre: c.nombre, slug: slugify(c.nombre), hex: c.hex }, { onConflict: "slug" });
    if (error) { console.error(`   ✖ color ${c.nombre}: ${error.message}`); process.exit(1); }
  }
  const usados = [...new Set([...Object.values(COLOR_POR_FOTO).flatMap((m) => Object.values(m)), ...FUSIONES.map((f) => f.colorAbsorbe)])];
  const { data: colores } = await supabase.from("color").select("id, nombre").in("nombre", usados);
  const colorId = new Map((colores ?? []).map((c) => [c.nombre, c.id]));
  const sinColor = usados.filter((c) => !colorId.has(c));
  if (sinColor.length) { console.error(`   ✖ ABORTADO: color(es) que no existen: ${sinColor.join(", ")}`); process.exit(1); }

  // 1. nombres (antes de fusionar, para que el reporte y los alt salgan bien)
  for (const r of renombres) {
    const { error } = await supabase.from("tela").update({ nombre: r.nombre, descripcion: null }).eq("id", r.t!.id);
    if (error) { console.error(`   ✖ renombrando ${r.t!.slug}: ${error.message}`); process.exit(1); }
  }
  console.log(`   ✓ ${renombres.length} ficha(s) renombrada(s)`);

  // 2. fusiones: la variante de `absorbe` se muda con su color corregido
  for (const f of FUSIONES) {
    const destino = porSlug.get(f.conserva);
    const origen = porSlug.get(f.absorbe);
    if (!destino || !origen) continue;
    const cid = colorId.get(f.colorAbsorbe)!;
    const { data: yaHay } = await supabase.from("variante")
      .select("id").eq("tela_id", destino.id).eq("color_id", cid).maybeSingle();
    const { data: vsOrigen } = await supabase.from("variante").select("id").eq("tela_id", origen.id);
    if (yaHay) {
      for (const v of vsOrigen ?? []) {
        await supabase.from("foto").update({ variante_id: yaHay.id }).eq("variante_id", v.id);
        await supabase.from("variante").delete().eq("id", v.id);
      }
    } else {
      for (const v of vsOrigen ?? []) {
        const { error } = await supabase.from("variante").update({ tela_id: destino.id, color_id: cid }).eq("id", v.id);
        if (error) { console.error(`   ✖ fusionando ${f.absorbe}: ${error.message}`); process.exit(1); }
      }
    }
    const { data: quedan } = await supabase.from("variante").select("id").eq("tela_id", origen.id);
    if (!quedan?.length) {
      await supabase.from("tela").delete().eq("id", origen.id);
      console.log(`   ✂ "${origen.nombre}" fusionada en "${NOMBRES[f.conserva]}" como ${f.colorAbsorbe}`);
    }
    await supabase.from("tela").update({ descripcion: null }).eq("id", destino.id);
  }

  // 3. colores por foto
  let creadas = 0, movidas = 0, vaciadas = 0;
  for (const t of trabajo) {
    const { data: vs } = await supabase
      .from("variante")
      .select("id, color_id, precio, stock, gramaje, acabado_id, unidad_venta, piezas_por_unidad, es_bordado, es_brillante, es_traslucida, es_tornasol")
      .eq("tela_id", t.telaId).order("orden");
    if (!vs?.length) continue;
    const modelo = vs[0];
    const { data: tela } = await supabase.from("tela").select("nombre").eq("id", t.telaId).single();

    let orden = 0;
    for (const [color, fotoIds] of t.porColor) {
      const cid = colorId.get(color)!;
      let destino = vs.find((v) => v.color_id === cid)?.id;
      if (!destino) {
        const { data, error } = await supabase.from("variante").insert({
          tela_id: t.telaId, color_id: cid, acabado_id: modelo.acabado_id,
          precio: modelo.precio, stock: modelo.stock, gramaje: modelo.gramaje,
          unidad_venta: modelo.unidad_venta, piezas_por_unidad: modelo.piezas_por_unidad,
          es_bordado: modelo.es_bordado, es_brillante: modelo.es_brillante,
          es_traslucida: modelo.es_traslucida, es_tornasol: modelo.es_tornasol,
          orden,
        }).select("id").single();
        if (error) { console.error(`   ✖ creando ${color} en ${t.slug}: ${error.message}`); process.exit(1); }
        destino = data.id; creadas++;
      }
      for (const fid of fotoIds) {
        const { error } = await supabase.from("foto")
          .update({ variante_id: destino, alt: `${tela?.nombre} · ${color}` }).eq("id", fid);
        if (error) { console.error(`   ✖ moviendo foto de ${t.slug}: ${error.message}`); process.exit(1); }
        movidas++;
      }
      await supabase.from("variante").update({ orden: orden++ }).eq("id", destino);
    }
    for (const v of vs) {
      const { data: quedan } = await supabase.from("foto").select("id").eq("variante_id", v.id);
      if (!quedan?.length) { await supabase.from("variante").delete().eq("id", v.id); vaciadas++; }
    }
    await supabase.from("tela").update({ descripcion: null }).eq("id", t.telaId);
  }

  console.log(
    `   ✓ ${creadas} variante(s) de color creada(s), ${movidas} foto(s) reasignada(s), ` +
    `${vaciadas} variante(s) sin color borrada(s)`
  );
  console.log(`\nCorre "pnpm describir --aplicar" para regenerar las descripciones.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
