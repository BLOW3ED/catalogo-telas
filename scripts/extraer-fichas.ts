#!/usr/bin/env tsx
/**
 * Extraer a ficha propia lo que quedó sin color — Telas La Jalisciense
 * ===========================================================================
 * Al separar por color (`pnpm separar`) quedaron fotos que NO eran del producto
 * bajo el que estaban archivadas, y que por lo tanto no recibieron color. Eso
 * las volvió INVISIBLES, y hay que entender por qué antes sí se veían:
 *
 *   `construirSlides` (lib/fotos.ts) tiene una invariante deliberada — cuando
 *   la ficha tiene DOS O MÁS colores direccionables, el carrusel solo saca
 *   slides de variantes CON color, porque una variante sin `color_slug` no se
 *   puede seleccionar con `?color=` y su foto acabaría mostrándose junto al
 *   precio y el SKU de otra.
 *
 *   Mientras esas fichas tenían UNA sola variante, caían en la otra rama y se
 *   veían todas. Al separarlas en 20 colores, las que se quedaron sin color
 *   dejaron de aparecer. La invariante es correcta; lo que estaba mal era
 *   tener dos productos distintos bajo una misma ficha.
 *
 * Aquí cada grupo sale a su propia ficha, donde vuelve a ser direccionable.
 * Los NOMBRES SON PROVISIONALES: describen lo que se ve en la foto y están
 * para que la tienda los corrija, no para quedarse.
 *
 *   pnpm extraer              → SIMULACRO
 *   pnpm extraer --aplicar    → escribe
 *
 * Idempotente: upsert de tela por slug y de variante por (tela,color).
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

type Ficha = {
  nombre: string;
  categoria: string;
  unidad: string;
  provisional: string;
  fotos: Record<string, string>;
};

const FICHAS: Ficha[] = [
  {
    nombre: "Galón de pedrería bordado",
    categoria: "Tira de pedrería",
    unidad: "metro",
    provisional: "estaban bajo 'Cierre oculto' — son bandas bordadas con pedrería, no cierres",
    fotos: {
      cierreoculto00094: "Azul Petróleo", cierreoculto00095: "Azul Petróleo",
      cierreoculto00100: "Azul Petróleo", cierreoculto00101: "Plata",
      cierreoculto00102: "Blanco", cierreoculto00104: "Menta",
      cierreoculto00105: "Oro", cierreoculto00107: "Plata",
      cierreoculto00111: "Negro", cierreoculto00112: "Humo",
      cierreoculto00114: "Verde Botella",
    },
  },
  {
    nombre: "Mariposa de tela",
    categoria: "Aplicación de pedrería",
    unidad: "pieza",
    provisional: "estaban bajo 'Motivos'; podrían ser el mismo modelo que 'Mariposa glitter' — confirmar",
    fotos: {
      motivos00041: "Plata", motivos00042: "Blanco", motivos00045: "Oro",
      motivos00046: "Lila", motivos00049: "Palo de Rosa", motivos00050: "Oro",
      motivos00051: "Plata", motivos00052: "Celeste", motivos00056: "Azul Petróleo",
      motivos00058: "Hueso", motivos00061: "Menta", motivos00062: "Blanco",
      motivos00063: "Magenta", motivos00065: "Morado", motivos00067: "Blanco",
      motivos00068: "Azul Marino", motivos00069: "Azul", motivos00070: "Rojo",
      motivos00071: "Champagne", motivos00075: "Turquesa",
    },
  },
  {
    nombre: "Aplicación de filigrana",
    categoria: "Aplicación de pedrería",
    unidad: "pieza",
    provisional: "estaba bajo 'Motivos'; es una filigrana plateada, no una flor",
    fotos: { motivos00012: "Plata" },
  },
  {
    nombre: "Hebilla de pedrería",
    categoria: "Hebilla",
    unidad: "pieza",
    provisional: "estaban bajo 'Gema'; son hebillas, no piedra suelta",
    fotos: { gema00032: "Plata", gema00033: "Plata" },
  },
  {
    nombre: "Tirante elástico",
    categoria: "Copas",
    unidad: "par",
    provisional: "estaban bajo 'Copa con tirante'; el tirante es otro producto que la copa",
    fotos: { coptirante00010: "Blanco", coptirante00013: "Blanco", coptirante00016: "Blanco" },
  },
];

const sinExt = (ruta: string) => ruta.split("/").pop()!.replace(/\.\w+$/, "");

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("✖ Faltan llaves en .env.local"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [varsR, fotosR, colorR, catR] = await Promise.all([
    supabase.from("variante").select("id, tela_id, color_id"),
    supabase.from("foto").select("id, variante_id, ruta"),
    supabase.from("color").select("id, nombre"),
    supabase.from("categoria").select("id, nombre"),
  ]);
  for (const r of [varsR, fotosR, colorR, catR]) {
    if (r.error) { console.error("✖ leyendo BD:", r.error.message); process.exit(1); }
  }
  const variantes = varsR.data ?? [], fotos = fotosR.data ?? [];
  const colores = colorR.data ?? [], categorias = catR.data ?? [];

  const fotoPorBase = new Map(fotos.map((f) => [sinExt(f.ruta), f]));
  const porColor = new Map(colores.map((c) => [c.nombre.toLowerCase(), c]));
  const porCategoria = new Map(categorias.map((c) => [c.nombre, c]));

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"}\n`);

  const faltan: string[] = [];
  for (const f of FICHAS) {
    for (const [base, color] of Object.entries(f.fotos)) {
      if (!fotoPorBase.has(base)) faltan.push(`foto ${base}`);
      if (!porColor.has(color.toLowerCase())) faltan.push(`color ${color}`);
    }
    if (!porCategoria.has(f.categoria)) faltan.push(`categoría ${f.categoria}`);
  }
  if (faltan.length) {
    console.error("✖ No se puede continuar:");
    [...new Set(faltan)].forEach((x) => console.error("   ·", x));
    process.exit(1);
  }

  const afectadas = new Set<string>();
  for (const f of FICHAS) {
    const grupos = new Map<string, string[]>();
    for (const [base, color] of Object.entries(f.fotos)) {
      if (!grupos.has(color)) grupos.set(color, []);
      grupos.get(color)!.push(base);
    }
    console.log(`── ${f.nombre} ──`);
    console.log(`   ${f.categoria} · por ${f.unidad} · ${grupos.size} colores / ${Object.keys(f.fotos).length} fotos`);
    console.log(`   provisional: ${f.provisional}`);
    if (!APLICAR) { console.log(""); continue; }

    const slug = slugify(f.nombre);
    const { data: tela, error: eT } = await supabase.from("tela")
      .upsert({ slug, nombre: f.nombre, categoria_id: porCategoria.get(f.categoria)!.id }, { onConflict: "slug" })
      .select("id").single();
    if (eT || !tela) { console.error(`   ✖ tela: ${eT?.message}`); process.exit(1); }

    for (const [color, bases] of grupos) {
      const col = porColor.get(color.toLowerCase())!;
      const { data: prev } = await supabase.from("variante")
        .select("id").eq("tela_id", tela.id).eq("color_id", col.id).maybeSingle();
      let varianteId = prev?.id as string | undefined;
      if (!varianteId) {
        const { data: nueva, error } = await supabase.from("variante")
          .insert({ tela_id: tela.id, color_id: col.id, unidad_venta: f.unidad }).select("id").single();
        if (error || !nueva) { console.error(`   ✖ variante ${color}: ${error?.message}`); process.exit(1); }
        varianteId = nueva.id;
      }
      for (const [i, base] of bases.entries()) {
        const foto = fotoPorBase.get(base)!;
        if (foto.variante_id === varianteId) continue;
        const origen = variantes.find((v) => v.id === foto.variante_id);
        if (origen) afectadas.add(origen.tela_id);
        const { error } = await supabase.from("foto")
          .update({ variante_id: varianteId, orden: i }).eq("id", foto.id);
        if (error) { console.error(`   ✖ foto ${base}: ${error.message}`); process.exit(1); }
      }
    }
    console.log("");
  }

  // Las variantes de origen quedan vacías: se borran tras releer, nunca a ciegas.
  console.log("── Variantes vacías en las fichas de origen ──");
  if (!APLICAR) { console.log("   (se calculan al aplicar)\n"); }
  else {
    let n = 0;
    for (const telaId of afectadas) {
      const { data: vv } = await supabase.from("variante").select("id").eq("tela_id", telaId);
      for (const v of vv ?? []) {
        const { data: ff } = await supabase.from("foto").select("id").eq("variante_id", v.id).limit(1);
        if (ff?.length) continue;
        const { error } = await supabase.from("variante").delete().eq("id", v.id);
        if (!error) n++;
      }
    }
    console.log(`   ${n} borradas\n`);
  }

  const total = FICHAS.reduce((s, f) => s + Object.keys(f.fotos).length, 0);
  console.log(`${APLICAR ? "Listo." : "Nada de esto se escribió."} ${FICHAS.length} fichas · ${total} fotos\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
