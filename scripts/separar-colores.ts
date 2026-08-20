#!/usr/bin/env tsx
/**
 * Separar colores escondidos y reubicar intrusos — Telas La Jalisciense
 * ===========================================================================
 * Catorce fichas tenían decenas de fotos colgando de UNA sola variante. Eso
 * las hacía imposibles de cotizar: el detalle solo pinta la variante
 * seleccionada, y `ColorSelector` ni siquiera aparece si no hay dos variantes
 * CON color (components/ColorSelector.tsx). Las fotos se veían en el carrusel
 * pero nadie podía pedir "la turquesa".
 *
 * Revisadas foto por foto, siete resultaron limpias —un modelo en N colores—
 * y siete eran cajones mixtos, porque la ficha se llamaba como la CARPETA de
 * fotos y la carpeta era la sesión de fotografía, no el producto. Por eso los
 * intrusos siempre están al final de la numeración: son lo siguiente que pasó
 * por la mesa. Aquí se hacen dos cosas:
 *
 *   · SEPARAR: la ficha se queda donde está y su variante única se abre en una
 *     variante POR COLOR, con sus fotos. No se crea ni se borra ninguna tela.
 *
 *   · REUBICAR: las fotos que no eran de ese producto se mandan a la ficha a
 *     la que sí pertenecen, que ya existe de las tandas anteriores.
 *
 * Los colores salen de mirar la foto, apoyada en una medición de la pieza
 * (mediana de los píxeles lejanos al fondo). El HEX del swatch, en cambio,
 * sale de la paleta curada: las tomas están subexpuestas y el pixel sirve
 * para identificar el color, no para representarlo.
 *
 *   pnpm separar              → SIMULACRO
 *   pnpm separar --aplicar    → escribe
 *
 * Idempotente: reusa la variante por (tela,color) y solo mueve lo que no esté
 * ya en su lugar.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/** Faltaban en la paleta. Más claros que lo medido, a propósito. */
const COLORES_NUEVOS = [
  { nombre: "Azul Petróleo", hex: "#0E4C63" },
  { nombre: "Turquesa", hex: "#2AA5A5" },
  { nombre: "Café", hex: "#6B4B34" },
  // Piedra transparente y su acabado tornasol: así se venden, por acabado.
  { nombre: "Cristal", hex: "#E6ECEF" },
  { nombre: "Cristal AB", hex: "#D9C9E4" },
];

type Asignacion = { tela: string; nota?: string; fotos: Record<string, string> };

/** nombre de archivo sin extensión → color. Varias fotos del mismo color van
 *  a UNA variante con todas sus fotos, no a dos swatches iguales. */
const ASIGNACIONES: Asignacion[] = [
  {
    tela: "Florecitas 5 cm",
    fotos: {
      florecitas500150: "Blanco",
      florecitas500151: "Oro",
      florecitas500154: "Blush",
      florecitas500155: "Azul Petróleo",
      florecitas500156: "Azul Petróleo",
      florecitas500157: "Blanco",
      florecitas500161: "Vino",
      florecitas500162: "Rosa Pastel",
      florecitas500163: "Rosa Pastel",
      florecitas500165: "Palo de Rosa",
      florecitas500170: "Vino",
      florecitas500171: "Palo de Rosa",
      florecitas500172: "Plata",
      florecitas500175: "Vino",
      florecitas500176: "Menta",
      florecitas500179: "Rojo",
      florecitas500180: "Turquesa",
      florecitas500181: "Blanco",
      florecitas500188: "Morado",
      florecitas500196: "Champagne",
      florecitas500198: "Celeste",
      florecitas500201: "Lila",
      florecitas500202: "Celeste",
      florecitas500203: "Oro",
      florecitas500207: "Rojo",
      florecitas500208: "Blush",
      florecitas500209: "Blush",
      florecitas500210: "Verde Botella",
      florecitas500211: "Verde Botella",
      florecitas500212: "Melón",
      florecitas500214: "Humo",
      florecitas500215: "Rosado",
      florecitas500216: "Rosado",
      florecitas500217: "Champagne",
    },
  },
  {
    tela: "Florecitas",
    fotos: {
      florecitas00122: "Champagne",
      florecitas00125: "Verde Limón",
      florecitas00128: "Verde Botella",
      florecitas00129: "Plata",
      florecitas00130: "Blanco",
      florecitas00131: "Blanco",
      florecitas00132: "Azul Marino",
      florecitas00133: "Blush",
      florecitas00134: "Menta",
      florecitas00135: "Verde Botella",
      florecitas00136: "Celeste",
      florecitas00138: "Rojo",
      florecitas00139: "Oro",
      florecitas00140: "Amarillo",
      florecitas00141: "Humo",
      florecitas00142: "Turquesa",
      florecitas00144: "Palo de Rosa",
      florecitas00146: "Azul",
      florecitas00147: "Mauve",
      florecitas00148: "Blanco",
      florecitas00149: "Blush",
      florecitas00151: "Oro",
    },
  },
  {
    tela: "Flores con piedra central",
    nota: "4 flores que estaban bajo KPA",
    fotos: {
      florescentral00227: "Verde Botella",
      florescentral00229: "Azul",
      florescentral00232: "Negro",
      florescentral00233: "Verde Olivo",
      florescentral00234: "Celeste",
      florescentral00236: "Menta",
      florescentral00238: "Vino",
      florescentral00241: "Blanco",
      florescentral00243: "Rojo",
      florescentral00244: "Champagne",
      florescentral00245: "Palo de Rosa",
      florescentral00249: "Hueso",
      kpa00033: "Verde Botella",
      kpa00034: "Cedrón",
      kpa00035: "Azul Marino",
      kpa00036: "Azul Marino",
    },
  },
  {
    tela: "96277 Tira Tul Bordado 25 mm",
    fotos: {
      "96277tiratulbordado25mm00000": "Rojo",
      "96277tiratulbordado25mm00001": "Negro",
      "96277tiratulbordado25mm00002": "Negro",
      "96277tiratulbordado25mm00003": "Verde Botella",
      "96277tiratulbordado25mm00004": "Verde Botella",
      "96277tiratulbordado25mm00005": "Verde Botella",
      "96277tiratulbordado25mm00006": "Azul Marino",
    },
  },
  {
    tela: "Copa Ovalada Mediana",
    fotos: {
      copaovaladamediana00004: "Blanco",
      copaovaladamediana00008: "Champagne",
      copaovaladamediana00009: "Champagne",
      copaovaladamediana00010: "Café",
      copaovaladamediana00011: "Café",
      copaovaladamediana00012: "Hueso",
      copaovaladamediana00013: "Hueso",
    },
  },
  {
    tela: "354 Tira Tul Bordado 220 mm",
    fotos: {
      "354tiratulbordado220mm00000": "Blanco",
      "354tiratulbordado220mm00001": "Blanco",
      "354tiratulbordado220mm00002": "Champagne",
      "354tiratulbordado220mm00003": "Blanco",
      "354tiratulbordado220mm00004": "Oro",
      "354tiratulbordado220mm00005": "Blanco",
    },
  },
  {
    tela: "358 Tira Tul Bordado 315 mm",
    fotos: {
      "358tiratulbordado315mm00005": "Blanco",
      "358tiratulbordado315mm00009": "Blanco",
      "358tiratulbordado315mm00010": "Oro",
      "358tiratulbordado315mm00016": "Oro",
      "358tiratulbordado315mm00017": "Blanco",
    },
  },
  {
    tela: "Aplicación de rosas",
    nota: "7 aplicaciones que estaban archivadas bajo Guipiur",
    fotos: {
      guipiur00113: "Rosado",
      guipiur00115: "Amarillo",
      guipiur00116: "Azul",
      guipiur00117: "Lila",
      guipiur00118: "Blanco",
      guipiur00120: "Plata",
      guipiur00124: "Magenta",
    },
  },
  {
    tela: "Aplicación de caballos",
    nota: "2 broches más, estaban bajo Gema",
    fotos: {
      gema00024: "Plata",
      gema00030: "Plata",
    },
  },
  {
    tela: "Cierre",
    nota: "sus 2 fotos reciben color + 2 cierres negros que estaban bajo Crin",
    fotos: {
      cierre00026: "Hueso",
      cierre00028: "Champagne",
      crin00119: "Negro",
      crin00122: "Negro",
    },
  },

  // ---- Segunda tanda: los 10 que quedaban con colores escondidos ----
  {
    tela: "Hilo Gutermann",
    fotos: {
      hilogutermann00001: "Champagne",
      hilogutermann00002: "Blush",
      hilogutermann00004: "Café",
      hilogutermann00005: "Champagne",
      hilogutermann00008: "Café",
      hilogutermann00010: "Café",
      hilogutermann00011: "Champagne",
      hilogutermann00012: "Champagne",
      hilogutermann00013: "Champagne",
      hilogutermann00014: "Champagne",
      hilogutermann00016: "Negro",
      hilogutermann00017: "Rojo",
      hilogutermann00019: "Vino",
      hilogutermann00020: "Humo",
      hilogutermann00021: "Humo",
      hilogutermann00022: "Humo",
      hilogutermann00023: "Negro",
      hilogutermann00026: "Palo de Rosa",
      hilogutermann00027: "Rosa Pastel",
      hilogutermann00028: "Rosa Pastel",
      hilogutermann00029: "Champagne",
      hilogutermann00030: "Palo de Rosa",
      hilogutermann00031: "Mauve",
      hilogutermann00032: "Magenta",
      hilogutermann00033: "Rosado",
      hilogutermann00034: "Magenta",
      hilogutermann00035: "Vino",
      hilogutermann00036: "Lila",
      hilogutermann00038: "Verde Olivo",
      hilogutermann00041: "Verde Botella",
      hilogutermann00042: "Azul Petróleo",
      hilogutermann00044: "Menta",
      hilogutermann00045: "Verde Olivo",
      hilogutermann00046: "Menta",
      hilogutermann00047: "Menta",
      hilogutermann00048: "Verde Botella",
      hilogutermann00049: "Humo",
      hilogutermann00050: "Azul Petróleo",
      hilogutermann00051: "Azul Marino",
    },
  },
  {
    tela: "Hilo Duralon",
    fotos: {
      hiloduralon00001: "Rosado",
      hiloduralon00003: "Rosado",
      hiloduralon00004: "Rosa Pastel",
      hiloduralon00008: "Rosado",
      hiloduralon00009: "Celeste",
      hiloduralon00010: "Negro",
      hiloduralon00011: "Hueso",
      hiloduralon00012: "Blanco",
      hiloduralon00014: "Negro",
      hiloduralon00015: "Melón",
      hiloduralon00016: "Plata",
      hiloduralon00017: "Humo",
      hiloduralon00019: "Plata",
      hiloduralon00020: "Hueso",
      hiloduralon00021: "Blanco",
      hiloduralon00022: "Verde Olivo",
      hiloduralon00023: "Verde Olivo",
      hiloduralon00024: "Vino",
      hiloduralon00025: "Vino",
      hiloduralon00026: "Rojo",
      hiloduralon00027: "Rosado",
      hiloduralon00028: "Rosado",
      hiloduralon00029: "Plata",
    },
  },
  {
    tela: "Hilo",
    fotos: {
      hilo00001: "Azul Marino",
      hilo00002: "Azul Petróleo",
      hilo00003: "Turquesa",
      hilo00005: "Menta",
      hilo00006: "Rojo",
      hilo00007: "Rojo",
      hilo00009: "Vino",
      hilo00011: "Vino",
      hilo00013: "Menta",
      hilo00014: "Plata",
      hilo00020: "Blush",
      hilo00021: "Café",
      hilo00022: "Verde Botella",
      hilo00023: "Vino",
      hilo00027: "Turquesa",
      hilo00029: "Palo de Rosa",
      hilo00030: "Palo de Rosa",
      hilo00033: "Oro",
      hilo00034: "Palo de Rosa",
      hilo00037: "Menta",
    },
  },
  {
    tela: "Crin",
    fotos: {
      crin00054: "Palo de Rosa",
      crin00072: "Melón",
      crin00073: "Rosado",
      crin00074: "Magenta",
      crin00075: "Blush",
      crin00076: "Café",
      crin00077: "Hueso",
      crin00078: "Champagne",
      crin00079: "Blanco",
      crin00084: "Verde Botella",
      crin00086: "Menta",
      crin00087: "Lila",
      crin00099: "Rojo",
      crin00102: "Lila",
      crin00105: "Azul",
      crin00107: "Celeste",
      crin00113: "Vino",
      crin00116: "Humo",
      crin00117: "Oro",
    },
  },
  {
    tela: "Guipiur",
    fotos: {
      guipiur00092: "Rosado",
      guipiur00093: "Rosado",
      guipiur00096: "Oro",
      guipiur00099: "Negro",
      guipiur00104: "Rojo",
      guipiur00106: "Vino",
      guipiur00108: "Oro",
      guipiur00110: "Cedrón",
      guipiur00111: "Vino",
      guipiur00112: "Cedrón",
    },
  },
  {
    tela: "Cierre oculto",
    nota: "36 cierres; los 11 galones de pedrería se quedan, necesitan ficha propia",
    fotos: {
      cierreoculto00013: "Champagne",
      cierreoculto00014: "Café",
      cierreoculto00018: "Plata",
      cierreoculto00021: "Blanco",
      cierreoculto00024: "Azul",
      cierreoculto00026: "Vino",
      cierreoculto00027: "Magenta",
      cierreoculto00030: "Magenta",
      cierreoculto00031: "Hueso",
      cierreoculto00033: "Rojo",
      cierreoculto00034: "Rojo",
      cierreoculto00036: "Rojo",
      cierreoculto00038: "Celeste",
      cierreoculto00039: "Melón",
      cierreoculto00040: "Rosa Pastel",
      cierreoculto00043: "Turquesa",
      cierreoculto00044: "Palo de Rosa",
      cierreoculto00045: "Turquesa",
      cierreoculto00047: "Lila",
      cierreoculto00049: "Lila",
      cierreoculto00051: "Menta",
      cierreoculto00052: "Verde Olivo",
      cierreoculto00054: "Verde Botella",
      cierreoculto00055: "Verde Botella",
      cierreoculto00056: "Plata",
      cierreoculto00057: "Azul Petróleo",
      cierreoculto00066: "Azul Petróleo",
      cierreoculto00068: "Plata",
      cierreoculto00069: "Hueso",
      cierreoculto00071: "Humo",
      cierreoculto00072: "Humo",
      cierreoculto00073: "Azul Petróleo",
      cierreoculto00075: "Azul Marino",
      cierreoculto00076: "Plata",
      cierreoculto00077: "Plata",
      cierreoculto00081: "Negro",
    },
  },
  {
    tela: "Gema",
    nota: "14 frascos de piedra + 1 frasco azul que estaba bajo Copa con tirante; las 2 hebillas se quedan, necesitan ficha propia",
    fotos: {
      gema00003: "Cristal",
      gema00004: "Oro",
      gema00005: "Cristal AB",
      gema00006: "Cristal",
      gema00007: "Vino",
      gema00008: "Azul Petróleo",
      gema00009: "Vino",
      gema00010: "Vino",
      gema00011: "Cristal",
      gema00012: "Cristal",
      gema00013: "Cristal AB",
      gema00014: "Cristal",
      gema00017: "Oro",
      gema00020: "Cristal",
      coptirante00030: "Azul Marino",
    },
  },
  {
    tela: "Motivos",
    nota: "21 aplicaciones florales; las ~20 mariposas y la filigrana se quedan, necesitan ficha propia",
    fotos: {
      motivos00002: "Menta",
      motivos00003: "Blush",
      motivos00005: "Blush",
      motivos00008: "Blanco",
      motivos00009: "Blanco",
      motivos00010: "Hueso",
      motivos00019: "Morado",
      motivos00020: "Morado",
      motivos00021: "Magenta",
      motivos00022: "Azul Petróleo",
      motivos00023: "Azul Petróleo",
      motivos00024: "Plata",
      motivos00025: "Plata",
      motivos00026: "Plata",
      motivos00027: "Plata",
      motivos00028: "Oro",
      motivos00029: "Lila",
      motivos00033: "Rojo",
      motivos00038: "Vino",
      motivos00039: "Vino",
      motivos00040: "Blanco",
    },
  },
  {
    tela: "Copa con tirante",
    nota: "5 copas; los 3 tirantes se quedan, necesitan ficha propia",
    fotos: {
      coptirante00003: "Blanco",
      coptirante00005: "Blanco",
      coptirante00006: "Blanco",
      coptirante00008: "Blanco",
      coptirante00009: "Hueso",
    },
  },
];

const sinExt = (ruta: string) => ruta.split("/").pop()!.replace(/\.\w+$/, "");

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("✖ Faltan llaves en .env.local"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [telasR, varsR, fotosR, colorR] = await Promise.all([
    supabase.from("tela").select("id, nombre"),
    supabase.from("variante").select("id, tela_id, color_id, unidad_venta"),
    supabase.from("foto").select("id, variante_id, ruta"),
    supabase.from("color").select("id, nombre, hex"),
  ]);
  for (const r of [telasR, varsR, fotosR, colorR]) {
    if (r.error) { console.error("✖ leyendo BD:", r.error.message); process.exit(1); }
  }
  const telas = telasR.data ?? [], variantes = varsR.data ?? [];
  const fotos = fotosR.data ?? [], colores = colorR.data ?? [];

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"}\n`);

  // ---------------------------------------------------------------------
  // 0) Comprobaciones antes de tocar nada
  // ---------------------------------------------------------------------
  const porNombreTela = new Map(telas.map((t) => [t.nombre, t]));
  const fotoPorBase = new Map(fotos.map((f) => [sinExt(f.ruta), f]));
  const problemas: string[] = [];
  for (const a of ASIGNACIONES) {
    if (!porNombreTela.has(a.tela)) problemas.push(`no existe la ficha "${a.tela}"`);
    for (const base of Object.keys(a.fotos)) {
      if (!fotoPorBase.has(base)) problemas.push(`no existe la foto "${base}"`);
    }
  }
  if (problemas.length) {
    console.error("✖ No se puede continuar:");
    problemas.slice(0, 15).forEach((p) => console.error("   ·", p));
    process.exit(1);
  }
  console.log(`── Comprobación ──\n   ${ASIGNACIONES.length} fichas · ${ASIGNACIONES.reduce((s, a) => s + Object.keys(a.fotos).length, 0)} fotos · todo localizado\n`);

  // ---------------------------------------------------------------------
  // 1) Colores nuevos
  // ---------------------------------------------------------------------
  const porColor = new Map(colores.map((c) => [c.nombre.toLowerCase(), c]));
  console.log("── Colores nuevos ──");
  for (const c of COLORES_NUEVOS) {
    if (porColor.has(c.nombre.toLowerCase())) { console.log(`   · ${c.nombre} ya existía`); continue; }
    console.log(`   + ${c.nombre}  ${c.hex}`);
    if (!APLICAR) { porColor.set(c.nombre.toLowerCase(), { id: `nuevo-${c.nombre}`, ...c }); continue; }
    const { data, error } = await supabase.from("color")
      .upsert({ nombre: c.nombre, slug: slugify(c.nombre), hex: c.hex }, { onConflict: "slug" })
      .select("id, nombre, hex").single();
    if (error || !data) { console.error(`   ✖ ${c.nombre}: ${error?.message}`); process.exit(1); }
    porColor.set(c.nombre.toLowerCase(), data);
  }
  const usados = new Set(ASIGNACIONES.flatMap((a) => Object.values(a.fotos)));
  const faltan = [...usados].filter((n) => !porColor.has(n.toLowerCase()));
  if (faltan.length) { console.error(`\n✖ colores inexistentes: ${faltan.join(", ")}`); process.exit(1); }

  // ---------------------------------------------------------------------
  // 2) Una ficha a la vez
  // ---------------------------------------------------------------------
  const afectadas = new Set<string>();
  let movidas = 0;
  for (const a of ASIGNACIONES) {
    const tela = porNombreTela.get(a.tela)!;
    afectadas.add(tela.id);
    const grupos = new Map<string, string[]>();
    for (const [base, color] of Object.entries(a.fotos)) {
      if (!grupos.has(color)) grupos.set(color, []);
      grupos.get(color)!.push(base);
    }
    console.log(`\n── ${a.tela} ──${a.nota ? `\n   (${a.nota})` : ""}`);
    console.log(`   ${grupos.size} colores / ${Object.keys(a.fotos).length} fotos`);
    for (const [color, bases] of [...grupos].sort()) console.log(`   · ${color.padEnd(16)} ${bases.length}`);
    if (!APLICAR) continue;

    for (const [color, bases] of grupos) {
      const col = porColor.get(color.toLowerCase())!;
      const { data: prev } = await supabase.from("variante")
        .select("id").eq("tela_id", tela.id).eq("color_id", col.id).maybeSingle();
      let varianteId = prev?.id as string | undefined;
      if (!varianteId) {
        // Hereda la unidad de venta de la variante que ya tenía la ficha:
        // la unidad es del producto, no del color.
        const unidad = variantes.find((v) => v.tela_id === tela.id)?.unidad_venta ?? "pieza";
        const { data: nueva, error } = await supabase.from("variante")
          .insert({ tela_id: tela.id, color_id: col.id, unidad_venta: unidad }).select("id").single();
        if (error || !nueva) { console.error(`   ✖ variante ${color}: ${error?.message}`); process.exit(1); }
        varianteId = nueva.id;
      }
      for (const [i, base] of bases.entries()) {
        const f = fotoPorBase.get(base)!;
        if (f.variante_id === varianteId) continue;   // ya estaba
        const otra = variantes.find((v) => v.id === f.variante_id);
        if (otra) afectadas.add(otra.tela_id);         // la ficha de origen puede quedar vacía
        const { error } = await supabase.from("foto")
          .update({ variante_id: varianteId, orden: i }).eq("id", f.id);
        if (error) { console.error(`   ✖ foto ${base}: ${error.message}`); process.exit(1); }
        movidas++;
      }
    }
  }

  // ---------------------------------------------------------------------
  // 3) Variantes que quedaron sin fotos
  // ---------------------------------------------------------------------
  // Al repartir las fotos, la variante única y sin color de cada ficha se
  // queda vacía. Se borra solo si de verdad no le colgó nada: se relee, no se
  // asume.
  console.log("\n── Variantes vacías ──");
  if (!APLICAR) {
    console.log("   (se calculan al aplicar)");
  } else {
    let borradas = 0;
    for (const telaId of afectadas) {
      const { data: vv } = await supabase.from("variante").select("id, color_id").eq("tela_id", telaId);
      for (const v of vv ?? []) {
        const { data: ff } = await supabase.from("foto").select("id").eq("variante_id", v.id).limit(1);
        if (ff?.length) continue;
        const { error } = await supabase.from("variante").delete().eq("id", v.id);
        if (error) console.error(`   ✖ variante ${v.id}: ${error.message}`);
        else borradas++;
      }
    }
    console.log(`   ${borradas} borradas`);
  }

  console.log(`\n${APLICAR ? "Listo." : "Nada de esto se escribió."} ${movidas} fotos reasignadas\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
