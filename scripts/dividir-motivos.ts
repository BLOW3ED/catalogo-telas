#!/usr/bin/env tsx
/**
 * Separar "Motivos" por figura — Telas La Jalisciense
 * ===========================================================================
 * "Motivos" era una sola ficha con 12 variantes y 21 fotos que en realidad
 * son OCHO diseños distintos: el nombre no describía nada y el selector de
 * color ofrecía 12 colores de los que ninguno era el mismo producto.
 *
 * Las 8 figuras salieron de abrir las 21 fotos (derivados `sm`/`md` del
 * bucket, con `linear(2.2,0)` para leer sobre el fondo negro subexpuesto —
 * el mismo truco de `pnpm preparar --exposicion=2`, que escala los tres
 * canales por igual y no mueve el matiz). Lo que las separa NO es el color:
 * es la construcción y la silueta.
 *
 *   1. Flores 3D con guías rizadas: pétalo de abanico + alambre en espiral.
 *   2. Guipiur con espigas: par espejo, espigas de trigo y cola de racimos.
 *   3. Margaritas con pedrería: par espejo, margarita con piedra al centro
 *      y fronda de helecho sobre tul.
 *   4. Ramo 3D de flor abierta: una flor grande de pétalo liso + jacintos.
 *   5. Encaje con lentejuela: cordón blanco de contorno, hoja de gota
 *      rellena de lentejuela, roseta doble al centro.
 *   6. Encaje con rosas: rosas redondas grandes sobre tul, hojita fina.
 *   7. Encaje con flores 3D: rama de encaje con flores levantadas encima.
 *   8. Ramo 3D de rosas: racimo denso de rosas en capas + hoja con nervadura.
 *
 * El caso 5 fue el que obligó a subir a resolución `md`: morado, magenta y
 * azul petróleo parecían tres diseños en la hoja de contactos chica y son
 * el MISMO — mismo cordón, misma hoja de gota, misma silueta con "ala" a la
 * izquierda y cola a la derecha. Separarlos habría inventado dos productos.
 *
 * La variante Blanco es la única que se PARTE: sus 3 fotos van a 3 diseños
 * distintos (00008→guipiur, 00009→margaritas, 00040→ramo 3D). Las otras 11
 * variantes viajan enteras, conservando su id.
 *
 * El slug `motivos` se queda con el grupo más grande en colores (el 5) para
 * no romper los links de WhatsApp ya compartidos; los otros 7 estrenan slug.
 *
 * `descripcion` se limpia en las 8 fichas: la que había decía "Disponible en
 * 12 colores" y ninguna ficha tiene ya 12. `pnpm describir --aplicar` la
 * regenera con el conteo real (no pisa texto existente, por eso hay que
 * dejarla en null).
 *
 *   pnpm dividir:motivos              → SIMULACRO
 *   pnpm dividir:motivos --aplicar    → escribe
 *
 * Idempotente: relee por slug y por (tela,color) antes de crear nada; si
 * "Motivos" ya se partió, no encuentra fotos por mover y no hace nada.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

const ORIGEN_SLUG = "motivos";

type Grupo = {
  /** slug destino; `motivos` = el grupo que se queda con la ficha original. */
  slug: string;
  nombre: string;
  /** basename sin extensión de cada foto que le toca. */
  fotos: string[];
  /** qué distingue a esta figura de las otras siete (va al reporte). */
  seña: string;
};

const GRUPOS: Grupo[] = [
  {
    slug: "motivos",
    nombre: "Aplicación de encaje con lentejuela",
    seña: "cordón blanco de contorno, hoja de gota con lentejuela, roseta doble",
    fotos: ["motivos00019", "motivos00020", "motivos00021", "motivos00022", "motivos00023"],
  },
  {
    slug: "aplicacion-de-encaje-con-rosas",
    nombre: "Aplicación de encaje con rosas",
    seña: "rosas redondas grandes sobre tul, hojita fina alrededor",
    fotos: ["motivos00024", "motivos00025", "motivos00026", "motivos00027", "motivos00028"],
  },
  {
    slug: "aplicacion-de-encaje-con-flores-3d",
    nombre: "Aplicación de encaje con flores 3D",
    seña: "rama de encaje con flores levantadas cosidas encima",
    fotos: ["motivos00029", "motivos00033"],
  },
  {
    slug: "aplicacion-de-guipiur-con-espigas",
    nombre: "Aplicación de guipiur con espigas",
    seña: "par espejo, espigas de trigo y cola de racimos colgando",
    fotos: ["motivos00003", "motivos00005", "motivos00008"],
  },
  {
    slug: "aplicacion-de-margaritas-con-pedreria",
    nombre: "Aplicación de margaritas con pedrería",
    seña: "par espejo, margarita con piedra al centro y fronda de helecho",
    fotos: ["motivos00009", "motivos00010"],
  },
  {
    slug: "aplicacion-de-flores-3d-con-guias",
    nombre: "Aplicación de flores 3D con guías",
    seña: "pétalo de abanico y alambre en espiral saliendo del racimo",
    fotos: ["motivos00002"],
  },
  {
    slug: "ramo-3d-de-flor-abierta",
    nombre: "Ramo 3D de flor abierta",
    seña: "una flor grande de pétalo liso con jacintos a un costado",
    fotos: ["motivos00040"],
  },
  {
    slug: "ramo-3d-de-rosas",
    nombre: "Ramo 3D de rosas",
    seña: "racimo denso de rosas en capas con hoja de nervadura bordada",
    fotos: ["motivos00038", "motivos00039"],
  },
];

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

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · dividir-motivos\n`);

  const { data: origen, error: eO } = await supabase
    .from("tela").select("id, slug, nombre, categoria_id").eq("slug", ORIGEN_SLUG).maybeSingle();
  if (eO) { console.error("✖", eO.message); process.exit(1); }
  if (!origen) { console.log(`   ✓ no existe "${ORIGEN_SLUG}" — nada que dividir`); return; }

  const { data: variantes, error: eV } = await supabase
    .from("variante")
    .select("id, color_id, sku, precio, stock, gramaje, acabado_id, unidad_venta, piezas_por_unidad, es_bordado, es_brillante, es_traslucida, es_tornasol, color:color_id(nombre)")
    .eq("tela_id", origen.id);
  if (eV) { console.error("✖", eV.message); process.exit(1); }

  type Var = typeof variantes extends (infer T)[] | null ? T : never;
  const porVariante = new Map<string, Var>();
  for (const v of variantes ?? []) porVariante.set(v.id, v as Var);

  const { data: fotos, error: eF } = await supabase
    .from("foto").select("id, ruta, variante_id, orden")
    .in("variante_id", [...porVariante.keys()]);
  if (eF) { console.error("✖", eF.message); process.exit(1); }

  if (!fotos?.length) { console.log(`   ✓ "${origen.nombre}" no tiene fotos — ya se dividió`); return; }

  // ── validación: cada foto a exactamente un grupo, cada grupo con sus fotos ──
  const grupoDe = new Map<string, Grupo>();
  const duplicadas: string[] = [];
  for (const g of GRUPOS) for (const f of g.fotos) {
    if (grupoDe.has(f)) duplicadas.push(f);
    grupoDe.set(f, g);
  }
  const sinGrupo = fotos.filter((f) => !grupoDe.has(base(f.ruta))).map((f) => base(f.ruta));
  const presentes = new Set(fotos.map((f) => base(f.ruta)));
  const faltantes = [...grupoDe.keys()].filter((b) => !presentes.has(b));

  const slugsMalos = GRUPOS.filter((g) => slugify(g.slug) !== g.slug).map((g) => g.slug);
  if (slugsMalos.length) { console.error(`✖ slug(s) que no sobreviven a slugify (romperían /tela/[slug]): ${slugsMalos.join(", ")}`); process.exit(1); }
  if (duplicadas.length) { console.error(`✖ foto(s) en más de un grupo: ${duplicadas.join(", ")}`); process.exit(1); }
  if (sinGrupo.length) { console.error(`✖ foto(s) sin grupo asignado: ${sinGrupo.join(", ")}`); process.exit(1); }
  if (faltantes.length) console.log(`   ⚠ foto(s) del plan que ya no están en "${origen.nombre}": ${faltantes.join(", ")}\n`);

  // ── qué colores lleva cada grupo, y qué variantes se parten ──
  const colorDe = (vid: string) => (porVariante.get(vid) as any)?.color?.nombre ?? "SIN COLOR";
  const gruposDeVariante = new Map<string, Set<string>>();
  for (const f of fotos) {
    const g = grupoDe.get(base(f.ruta))!;
    if (!gruposDeVariante.has(f.variante_id)) gruposDeVariante.set(f.variante_id, new Set());
    gruposDeVariante.get(f.variante_id)!.add(g.slug);
  }
  const sinColor = [...gruposDeVariante.keys()].filter((vid) => colorDe(vid) === "SIN COLOR");
  if (sinColor.length) {
    console.error(`✖ ABORTADO: ${sinColor.length} variante(s) sin color — dividir las dejaría invisibles en el selector`);
    process.exit(1);
  }

  console.log(`"${origen.nombre}" → ${GRUPOS.length} fichas · ${fotos.length} fotos · ${porVariante.size} variantes\n`);
  for (const g of GRUPOS) {
    const suyas = fotos.filter((f) => grupoDe.get(base(f.ruta)) === g);
    const colores = [...new Set(suyas.map((f) => colorDe(f.variante_id)))];
    console.log(`── ${g.nombre}${g.slug === ORIGEN_SLUG ? "  (conserva /tela/motivos)" : `  → /tela/${g.slug}`}`);
    console.log(`   ${g.seña}`);
    console.log(`   ${colores.length} color(es): ${colores.join(", ")}  ·  ${suyas.length} foto(s)`);
  }

  const partidas = [...gruposDeVariante.entries()].filter(([, gs]) => gs.size > 1);
  if (partidas.length) {
    console.log(`\n── variantes que se parten (${partidas.length}) ──`);
    for (const [vid, gs] of partidas) console.log(`   · ${colorDe(vid)} → ${[...gs].join(", ")}`);
  }

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  // ── 1. fichas destino ──
  const telaDe = new Map<string, string>(); // slug → tela.id
  telaDe.set(ORIGEN_SLUG, origen.id);
  for (const g of GRUPOS) {
    if (g.slug === ORIGEN_SLUG) continue;
    const { data, error } = await supabase
      .from("tela")
      .upsert({ slug: g.slug, nombre: g.nombre, categoria_id: origen.categoria_id, descripcion: null }, { onConflict: "slug" })
      .select("id").single();
    if (error) { console.error(`   ✖ creando "${g.nombre}": ${error.message}`); process.exit(1); }
    telaDe.set(g.slug, data.id);
  }

  // ── 2. mover variantes enteras / partir las que se reparten ──
  const nombreDe = new Map(GRUPOS.map((g) => [g.slug, g.nombre]));
  let movidasEnteras = 0, fotosMovidas = 0, variantesCreadas = 0, variantesBorradas = 0;

  for (const [vid, slugs] of gruposDeVariante) {
    const v = porVariante.get(vid)! as any;
    if (slugs.size === 1) {
      const destino = [...slugs][0];
      if (destino !== ORIGEN_SLUG) {
        const { error } = await supabase.from("variante").update({ tela_id: telaDe.get(destino) }).eq("id", vid);
        if (error) { console.error(`   ✖ moviendo variante ${v.color?.nombre}: ${error.message}`); process.exit(1); }
        movidasEnteras++;
      }
      continue;
    }
    // variante partida: una variante nueva por grupo destino, mismas propiedades
    for (const destino of slugs) {
      if (destino === ORIGEN_SLUG) continue;
      const { data: existente } = await supabase
        .from("variante").select("id").eq("tela_id", telaDe.get(destino)!).eq("color_id", v.color_id).maybeSingle();
      let nuevaId = existente?.id as string | undefined;
      if (!nuevaId) {
        const { data, error } = await supabase.from("variante").insert({
          tela_id: telaDe.get(destino), color_id: v.color_id, acabado_id: v.acabado_id,
          precio: v.precio, stock: v.stock, gramaje: v.gramaje,
          unidad_venta: v.unidad_venta, piezas_por_unidad: v.piezas_por_unidad,
          es_bordado: v.es_bordado, es_brillante: v.es_brillante,
          es_traslucida: v.es_traslucida, es_tornasol: v.es_tornasol,
        }).select("id").single();
        if (error) { console.error(`   ✖ creando variante ${v.color?.nombre} en ${destino}: ${error.message}`); process.exit(1); }
        nuevaId = data.id;
        variantesCreadas++;
      }
      const suyas = fotos.filter((f) => f.variante_id === vid && grupoDe.get(base(f.ruta))!.slug === destino);
      for (const f of suyas) {
        const { error } = await supabase.from("foto").update({ variante_id: nuevaId }).eq("id", f.id);
        if (error) { console.error(`   ✖ moviendo foto ${f.ruta}: ${error.message}`); process.exit(1); }
        fotosMovidas++;
      }
    }
    const { data: quedan } = await supabase.from("foto").select("id").eq("variante_id", vid);
    if (!quedan?.length) {
      await supabase.from("variante").delete().eq("id", vid);
      variantesBorradas++;
      console.log(`   ✂ variante ${v.color?.nombre} de "${origen.nombre}" borrada (se quedó sin fotos)`);
    }
  }

  // ── 3. renombrar la ficha conservada y limpiar descripciones ──
  const conserva = GRUPOS.find((g) => g.slug === ORIGEN_SLUG)!;
  const { error: eR } = await supabase
    .from("tela").update({ nombre: conserva.nombre, descripcion: null }).eq("id", origen.id);
  if (eR) { console.error(`   ✖ renombrando "${origen.nombre}": ${eR.message}`); process.exit(1); }

  // ── 4. orden de variantes y alt de fotos, por ficha ──
  for (const g of GRUPOS) {
    const telaId = telaDe.get(g.slug)!;
    const { data: vs } = await supabase
      .from("variante").select("id, color:color_id(nombre)").eq("tela_id", telaId).order("orden");
    let orden = 0;
    for (const v of vs ?? []) {
      await supabase.from("variante").update({ orden: orden++ }).eq("id", v.id);
      const alt = `${nombreDe.get(g.slug)} · ${(v as any).color?.nombre ?? ""}`.trim().replace(/ ·$/, "");
      await supabase.from("foto").update({ alt }).eq("variante_id", v.id);
    }
    console.log(`   ✓ ${nombreDe.get(g.slug)} — ${vs?.length ?? 0} variante(s)`);
  }

  console.log(
    `\nListo: ${movidasEnteras} variante(s) movida(s) entera(s), ${variantesCreadas} creada(s) al partir, ` +
    `${fotosMovidas} foto(s) reasignada(s), ${variantesBorradas} variante(s) vacía(s) borrada(s).`
  );
  console.log(`Corre "pnpm describir --aplicar" para regenerar las descripciones de las 8 fichas.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
