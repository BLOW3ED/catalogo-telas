#!/usr/bin/env tsx
/**
 * Fusionar fichas que son el mismo modelo — Telas La Jalisciense
 * ===========================================================================
 * Hay productos capturados como fichas separadas que en realidad son UN modelo
 * en varios colores. Separados no se pueden comparar ni cotizar como familia,
 * y el selector de color del detalle nunca aparece.
 *
 * Fusionar es mover las variantes de una ficha a otra y borrar la que queda
 * vacía. La parte delicada NO es el movimiento, es el COLOR:
 *
 *   `ColorSelector` se oculta si hay menos de DOS variantes con `color_slug` y
 *   `color_hex` (components/ColorSelector.tsx). Y el detalle solo pinta la
 *   variante seleccionada. O sea: si se fusionan dos variantes y alguna queda
 *   SIN color, sus fotos se vuelven inalcanzables — el cliente ve menos que
 *   antes de fusionar. Por eso este script ABORTA la fusión completa si no
 *   puede asignarle color a todas las variantes implicadas.
 *
 * Los colores se declaran por RUTA DE FOTO, no por nombre de ficha: la foto es
 * lo único que identifica sin ambigüedad a una variante sin SKU ni color.
 * Y solo se usan colores que YA existen en la tabla `color`, con su hex
 * curado — inventarle un hex a un color es justo lo que vuelve inservible un
 * swatch.
 *
 *   pnpm fusionar              → SIMULACRO
 *   pnpm fusionar --aplicar    → escribe
 *
 * Idempotente: si la ficha absorbida ya no existe, no hace nada.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

type Fusion = {
  /** Ficha que sobrevive, por nombre exacto. */
  conserva: string;
  /** Fichas cuyas variantes se mueven a la anterior y luego se borran. */
  absorbe: string[];
  /** ruta de foto → nombre del color (debe existir ya en la tabla `color`). */
  colores: Record<string, string>;
  porque: string;
};

const FUSIONES: Fusion[] = [
  {
    conserva: "359 Tira Tul Bordado 105 mm",
    absorbe: ["359 Tira Tul Bordado 115 mm"],
    colores: {
      "359-tira-tul-bordado105mm/359tiratulbordado105mm00000.webp": "Blanco",
      "359-tira-tul-bordado115mm/359tiratulbordado115mm00000.webp": "Oro",
    },
    // Medido sobre la foto, no juzgado de vista: el 105 da saturación 4.8% y
    // calidez R-B de -6 (neutro); el 115 da 17.8% y +27 (cálido). Son colores
    // distintos del mismo diseño. La tienda confirmó que la diferencia de
    // ancho (105 vs 115) es ruido de medición, no dos anchos reales.
    porque: "mismo diseño en blanco y oro; el ancho de 115 mm era error de medición",
  },
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

  const [telasR, varsR, fotosR, colorR] = await Promise.all([
    supabase.from("tela").select("id, slug, nombre"),
    supabase.from("variante").select("id, tela_id, sku, color_id, precio, stock, unidad_venta"),
    supabase.from("foto").select("id, variante_id, ruta"),
    supabase.from("color").select("id, nombre, hex"),
  ]);
  for (const r of [telasR, varsR, fotosR, colorR]) {
    if (r.error) { console.error("✖ No se pudo leer la BD:", r.error.message); process.exit(1); }
  }
  const telas = telasR.data ?? [], variantes = varsR.data ?? [];
  const fotos = fotosR.data ?? [], colores = colorR.data ?? [];

  const porNombre = new Map(telas.map((t) => [t.nombre, t]));
  const colorPorNombre = new Map(colores.map((c) => [c.nombre.toLowerCase(), c]));
  const fotosDeVariante = new Map<string, string[]>();
  for (const f of fotos) {
    if (!fotosDeVariante.has(f.variante_id)) fotosDeVariante.set(f.variante_id, []);
    fotosDeVariante.get(f.variante_id)!.push(f.ruta);
  }

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · ${FUSIONES.length} fusión(es)\n`);

  let hechas = 0, saltadas = 0;
  for (const f of FUSIONES) {
    const destino = porNombre.get(f.conserva);
    const fuentes = f.absorbe.map((n) => porNombre.get(n)).filter(Boolean) as typeof telas;

    if (!destino) { console.log(`   · "${f.conserva}" no está — ¿ya se fusionó?`); saltadas++; continue; }
    if (!fuentes.length) { console.log(`   ✓ ${f.conserva}: ya fusionada`); continue; }

    console.log(`── ${f.conserva} ──`);
    console.log(`   absorbe: ${fuentes.map((t) => t.nombre).join(", ")}`);
    console.log(`   porque: ${f.porque}`);

    // Todas las variantes que van a convivir bajo la ficha destino.
    const implicadas = variantes.filter(
      (v) => v.tela_id === destino.id || fuentes.some((t) => t.id === v.tela_id)
    );

    // Regla dura: cada una necesita color, o sus fotos quedan inalcanzables.
    const plan: { variante: (typeof variantes)[number]; color: (typeof colores)[number] }[] = [];
    let falla = false;
    for (const v of implicadas) {
      const rutas = fotosDeVariante.get(v.id) ?? [];
      const nombreColor = rutas.map((r) => f.colores[r]).find(Boolean);
      if (!nombreColor) {
        console.log(`   ✖ variante ${v.id} sin color declarado (fotos: ${rutas.join(", ") || "ninguna"})`);
        falla = true; continue;
      }
      const color = colorPorNombre.get(nombreColor.toLowerCase());
      if (!color) { console.log(`   ✖ el color "${nombreColor}" no existe en la tabla \`color\``); falla = true; continue; }
      plan.push({ variante: v, color });
    }
    if (falla) {
      console.log("   ⚠ fusión ABORTADA: sin color para todas, el cliente vería menos fotos que ahora\n");
      saltadas++; continue;
    }

    plan.forEach((p) => {
      const donde = p.variante.tela_id === destino.id ? "ya estaba" : "se mueve";
      console.log(`   · ${donde} → color ${p.color.nombre} (${p.color.hex})`);
    });
    console.log(`   quedaría 1 ficha con ${plan.length} colores`);
    hechas++;

    if (!APLICAR) { console.log(""); continue; }

    // 1) color + tela_id de cada variante. Primero MOVER, y solo después
    //    borrar: `variante` cae por CASCADE si se borra la tela antes.
    for (const p of plan) {
      const { error } = await supabase
        .from("variante")
        .update({ color_id: p.color.id, tela_id: destino.id })
        .eq("id", p.variante.id);
      if (error) { console.error(`   ✖ variante ${p.variante.id}: ${error.message}`); process.exit(1); }
    }
    // 2) borrar las fichas que quedaron sin variantes (se relee para no borrar
    //    a ciegas algo que todavía cuelgue de ellas).
    for (const t of fuentes) {
      const { data: quedan, error: e1 } = await supabase.from("variante").select("id").eq("tela_id", t.id);
      if (e1) { console.error(`   ✖ ${t.nombre}: ${e1.message}`); process.exit(1); }
      if (quedan?.length) { console.log(`   ⚠ ${t.nombre} todavía tiene ${quedan.length} variantes: NO se borra`); continue; }
      const { error: e2 } = await supabase.from("tela").delete().eq("id", t.id);
      if (e2) console.error(`   ✖ borrando ${t.nombre}: ${e2.message}`);
      else console.log(`   ✂ ${t.nombre} borrada (slug /tela/${t.slug} dejará de existir)`);
    }
    console.log("");
  }

  console.log(`${APLICAR ? "Listo." : "Nada de esto se escribió."} ${hechas} fusión(es)${saltadas ? ` · ${saltadas} saltada(s)` : ""}\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
