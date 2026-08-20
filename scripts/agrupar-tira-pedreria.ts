#!/usr/bin/env tsx
/**
 * Ordenar "Tira de pedrería": intrusos por forma y colores escondidos
 * ===========================================================================
 * "Tira de pedrería" tenía 42 fichas y 89 fotos. Abriéndolas una por una
 * (derivados `sm`/`md`, con `linear(2.2,0)` para leer sobre el fondo negro)
 * salieron tres problemas distintos, y este script resuelve los tres.
 *
 * 1) POR FORMA, casi la mitad no son tira. Una tira se vende por metro y se
 *    corta; una aplicación es UNA pieza terminada. 18 fichas son pieza suelta
 *    —broches de barra, coronas con gota, mariposas, medallones— y se van a
 *    "Aplicación de pedrería". Dos más ni siquiera son eso:
 *      · KPA son piedras flatback SUELTAS (fotos macro sobre fondo blanco,
 *        una piedra por toma) → "Piedra suelta".
 *      · 350 no tiene una sola piedra: es orilla de TUL BORDADO festoneada.
 *
 * 2) 350 y 351 son EL MISMO producto. Códigos consecutivos, mismo ancho de
 *    150 mm, y comparando las fotos es el mismo festón con el mismo ramo en
 *    cada pico. `pnpm afinar` ya lo había marcado como sospecha; abrir las
 *    fotos lo confirma. Se fusiona 350 dentro de 351, que es el que tiene el
 *    nombre y la categoría correctos.
 *
 * 3) LOS COLORES ESTABAN ESCONDIDOS EN LAS FOTOS. La tienda avisó que "hay
 *    algunos que son el mismo producto en diferente color, los colores
 *    usuales son oro, tornasol, plata, oro rosa" — y en efecto: 14 fichas
 *    traían el mismo diseño en dos o tres acabados colgando de UNA variante
 *    sin color. Así no se pueden cotizar: `ColorSelector` exige ≥2 variantes
 *    CON color, así que las fotos se veían en el carrusel pero nadie podía
 *    pedir "la de oro". Cada foto se convierte en la variante de su acabado.
 *
 * Sobre los nombres de los acabados: "tornasol" ya vive en la paleta como
 * **Cristal AB** —lo decidió `separar-colores.ts` y ahí quedó documentado que
 * la piedra transparente y su acabado tornasol se venden por acabado—, así
 * que se reusa en vez de abrir un swatch gemelo. "Oro rosa" es el único que
 * falta y se da de alta aquí; el hex es propuesto (estilo paleta curada, no
 * muestreado del pixel: las tomas están subexpuestas) y la tienda lo puede
 * corregir desde /admin.
 *
 * Lo que este script NO hace, a propósito: ponerle nombre real a las 42
 * fichas. Eso es el punto 1-2 (Fase 3). Aquí solo se corrige el PREFIJO de
 * las que cambian de categoría —quedarían como "Tira de pedrería BNK1049"
 * dentro de Aplicación de pedrería— y las dos que la tienda señaló sin
 * prefijo (T4L, KPA).
 *
 *   pnpm agrupar:tiras              → SIMULACRO
 *   pnpm agrupar:tiras --aplicar    → escribe
 *
 * Idempotente: reusa la variante por (tela,color) y solo mueve lo que no esté
 * ya en su lugar.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";
import { CATEGORIAS, UNIDAD_POR_CATEGORIA } from "../lib/ingesta/categorias";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/** Único acabado que faltaba en la paleta. Hex propuesto, editable en /admin. */
const COLOR_NUEVO = { nombre: "Oro Rosa", hex: "#C68A6A" };

/** slug → categoría a la que pertenece por FORMA (y prefijo que le toca). */
const RECLASIFICAR: Record<string, { categoria: string; prefijo: string }> = {
  // broches de barra: una pieza terminada, no una tira que se corte
  bnk2033: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk203823: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk203868: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk203869: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk624: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk709m: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk709s: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk724: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  // coronas y medallones con gota colgante
  bnk3109: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk3115: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk5061: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk5062: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk1082: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  // rosetones y flores redondas
  bnk1049: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk3111: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk5201: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  // mariposas
  bnk2315: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  bnk3110: { categoria: "Aplicación de pedrería", prefijo: "Aplicación de pedrería" },
  // no es tira NI aplicación: piedra flatback suelta, fotografiada al macro
  kpa: { categoria: "Piedra suelta", prefijo: "Piedra suelta" },
};

/** Las dos que la tienda marcó "peladas": les falta el prefijo de su categoría. */
const RENOMBRAR: Record<string, string> = {
  t4l: "Tira de pedrería T4L",
  kpa: "Piedra suelta KPA",
};

/**
 * Fusión de ficha duplicada: las fotos de `absorbe` pasan a la variante de
 * `conserva` y la ficha vacía se borra.
 */
const FUSION = {
  conserva: "351-tira-tul-bordado150mm",
  absorbe: "350-tira-orilla-piedra150mm",
  porque: "mismo festón, mismo ramo en cada pico, mismo ancho de 150 mm; 350 no tiene ni una piedra",
};

/**
 * Fotos que no eran de su ficha y se van a una ficha nueva.
 * (kp162 traía, entre tres tomas de su cadena de strass, un fleco de cuenta
 * negra sobre fondo blanco — otro producto, otra sesión de fotos.)
 */
const REUBICAR: { desde: string; foto: string; haciaSlug: string; haciaNombre: string; categoria: string; color: string; porque: string }[] = [
  {
    desde: "kp162", foto: "kp16200007",
    haciaSlug: "fleco-de-cuenta-negra", haciaNombre: "Fleco de cuenta negra",
    categoria: "Fleco de pedrería", color: "Negro",
    porque: "cinta negra con flecos de cuenta colgando: no es la cadena de strass de kp162",
  },
];

/**
 * slug → { basename de la foto: acabado }. Sale de abrir cada foto: son el
 * mismo diseño repetido en distinto metal/piedra.
 */
const COLOR_POR_FOTO: Record<string, Record<string, string>> = {
  bnk1041: { bnk104100005: "Oro", bnk104100007: "Plata" },
  bnk1049: { bnk104900003: "Oro Rosa", bnk104900004: "Oro" },
  bnk1082: { bnk108200004: "Plata", bnk108200005: "Oro", bnk108200006: "Plata" },
  bnk2000: { bnk200000003: "Cristal AB", bnk200000006: "Plata" },
  bnk203823: { bnk20382300004: "Oro", bnk20382300005: "Oro Rosa" },
  bnk2284: { bnk228400003: "Plata", "bnk228400003-1": "Oro", bnk228400004: "Plata" },
  bnk2315: { bnk2315: "Oro", bnk231500004: "Cristal AB", bnk231500006: "Oro", bnk231500007: "Plata" },
  bnk3110: { bnk311000003: "Cristal AB", bnk311000005: "Oro" },
  bnk3115: { bnk311500003: "Cristal AB", bnk311500004: "Oro", bnk311500011: "Plata" },
  bnk5061: { bnk506100003: "Oro", bnk506100004: "Oro", bnk506100006: "Plata" },
  bnk5062: { bnk506200003: "Oro", bnk506200005: "Plata", bnk506200006: "Cristal AB" },
  bnk709m: { bnk709m00004: "Oro", bnk709m00005: "Cristal AB", bnk709m00006: "Plata" },
  bnk709s: { bnk709s00003: "Plata", bnk709s00005: "Oro", bnk709s00006: "Cristal AB" },
  kp162: { kp16200003: "Plata", "kp16200003-1": "Oro", kp16200004: "Plata" },
  // Las dos piezas de BNK3111 NO son el mismo diseño en otro color (la de oro
  // trae cuatro perlas que la otra no tiene). La tienda decidió dejarlas en la
  // misma ficha y darle su color a cada una, en vez de partirla.
  bnk3111: { bnk311100004: "Plata", bnk311100005: "Oro" },
  // 003 y 004 son la misma toma clara dos veces (el tinte cálido de 004 es
  // balance de blancos, no un acabado distinto): un solo Cristal, no dos.
  bnk624: { bnk62400003: "Cristal", bnk62400004: "Cristal", bnk62400005: "Cristal AB" },
  bnk2033: { bnk203300006: "Plata", bnk203300008: "Plata" },
  bnk203868: { bnk20386800003: "Cristal AB", bnk20386800004: "Cristal AB" },
  kp159: { kp15900003: "Plata", kp15900004: "Plata" },
  kp178: { kp17800006: "Oro", kp17800007: "Oro" },
};

/** Cosas vistas que NO se tocan porque las decide la tienda, no la foto. */
const PENDIENTES = [
  "BNK709M y BNK709S son el MISMO diseño en oro, plata y tornasol. La tienda confirmó que " +
    "la M y la S son TAMAÑO (mediana / chica): dos fichas correctas, y el tamaño entra al " +
    "nombre en `nombrar-merceria` (punto 2), para no bautizarlas dos veces.",
  "BNK3111 tiene dos piezas DISTINTAS en la misma ficha: una de piedra clara en montura " +
    "plata, y otra en montura oro con cuatro PERLAS. La tienda decidió dejarlas juntas y " +
    "darle su color a cada una; queda como ficha con dos piezas, no dos fichas.",
  "KP159 (base de strass con picos dorados) y KP178 (todo dorado, sin strass) son el mismo " +
    "zigzag pero de distinta construcción. Se dejan separadas.",
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

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · agrupar-tira-pedreria\n`);

  const slugs = [
    ...Object.keys(RECLASIFICAR), ...Object.keys(RENOMBRAR), ...Object.keys(COLOR_POR_FOTO),
    ...REUBICAR.map((r) => r.desde), FUSION.conserva, FUSION.absorbe,
  ];
  const { data: telas, error: eT } = await supabase
    .from("tela").select("id, slug, nombre, categoria_id").in("slug", [...new Set(slugs)]);
  if (eT) { console.error("✖", eT.message); process.exit(1); }
  const porSlug = new Map((telas ?? []).map((t) => [t.slug, t]));

  const { data: cats, error: eC } = await supabase.from("categoria").select("id, nombre");
  if (eC) { console.error("✖", eC.message); process.exit(1); }
  const catId = new Map((cats ?? []).map((c) => [c.nombre, c.id]));
  const catNombre = new Map((cats ?? []).map((c) => [c.id, c.nombre]));

  const catsPedidas = [...new Set([...Object.values(RECLASIFICAR).map((r) => r.categoria), ...REUBICAR.map((r) => r.categoria)])];
  const catsFaltantes = catsPedidas.filter((c) => !catId.has(c));
  if (catsFaltantes.length) { console.error(`✖ ABORTADO: categoría(s) inexistente(s): ${catsFaltantes.join(", ")}`); process.exit(1); }

  // ── 1. reclasificación por forma ──
  console.log(`── por forma no son tira (${Object.keys(RECLASIFICAR).length}) ──`);
  const porCategoria = new Map<string, string[]>();
  for (const [slug, r] of Object.entries(RECLASIFICAR)) {
    const t = porSlug.get(slug);
    if (!t) { console.log(`   ⚠ ${slug}: no existe`); continue; }
    const actual = catNombre.get(t.categoria_id!) ?? "—";
    if (actual === r.categoria) continue; // ya aplicado
    if (!porCategoria.has(r.categoria)) porCategoria.set(r.categoria, []);
    porCategoria.get(r.categoria)!.push(`${slug} ("${t.nombre}")`);
  }
  for (const [cat, lista] of porCategoria) {
    console.log(`   → ${cat} (${lista.length}): ${lista.map((s) => s.split(" ")[0]).join(", ")}`);
  }
  if (!porCategoria.size) console.log("   ✓ ya reclasificadas");

  const renombres = Object.entries(RENOMBRAR)
    .map(([slug, nombre]) => [porSlug.get(slug), nombre] as const)
    .filter(([t, nombre]) => t && t.nombre !== nombre);
  console.log(`\n── fichas sin prefijo de categoría (${renombres.length}) ──`);
  for (const [t, nombre] of renombres) console.log(`   · "${t!.nombre}" → "${nombre}"`);
  if (!renombres.length) console.log("   ✓ ya renombradas");

  // ── 2. fusión de la duplicada ──
  console.log(`\n── ficha duplicada ──`);
  const conserva = porSlug.get(FUSION.conserva);
  const absorbe = porSlug.get(FUSION.absorbe);
  if (!absorbe) console.log(`   ✓ "${FUSION.absorbe}" ya no existe — fusión aplicada`);
  else if (!conserva) console.log(`   ✖ no encontré "${FUSION.conserva}" — se omite la fusión`);
  else {
    console.log(`   · "${absorbe.nombre}" → "${conserva.nombre}"`);
    console.log(`     ${FUSION.porque}`);
  }

  // ── 3. colores escondidos ──
  console.log(`\n── colores escondidos en las fotos (${Object.keys(COLOR_POR_FOTO).length} fichas) ──`);
  const trabajo: { slug: string; telaId: string; nombre: string; porColor: Map<string, string[]> }[] = [];
  const fotosNoVistas: string[] = [];
  for (const [slug, mapa] of Object.entries(COLOR_POR_FOTO)) {
    const t = porSlug.get(slug);
    if (!t) { console.log(`   ⚠ ${slug}: no existe`); continue; }
    const { data: vs } = await supabase.from("variante").select("id").eq("tela_id", t.id);
    const { data: fs } = await supabase.from("foto").select("id, ruta, variante_id").in("variante_id", (vs ?? []).map((v) => v.id));
    const porColor = new Map<string, string[]>();
    for (const f of fs ?? []) {
      const color = mapa[base(f.ruta)];
      if (!color) { fotosNoVistas.push(`${slug}/${base(f.ruta)}`); continue; }
      if (!porColor.has(color)) porColor.set(color, []);
      porColor.get(color)!.push(f.id);
    }
    trabajo.push({ slug, telaId: t.id, nombre: t.nombre, porColor });
    const resumen = [...porColor.entries()].map(([c, ids]) => `${c}×${ids.length}`).join(", ");
    console.log(`   · ${t.nombre.padEnd(32)} ${porColor.size} color(es): ${resumen}`);
  }
  if (fotosNoVistas.length) {
    console.log(`\n   ⚠ foto(s) sin acabado asignado (no se tocan): ${fotosNoVistas.join(", ")}`);
  }

  // ── 4. reubicaciones ──
  console.log(`\n── fotos que no eran de su ficha (${REUBICAR.length}) ──`);
  for (const r of REUBICAR) {
    console.log(`   · ${r.desde}/${r.foto} → "${r.haciaNombre}" (${r.categoria}, ${r.color})`);
    console.log(`     ${r.porque}`);
  }

  console.log(`\n── acabado nuevo en la paleta ──`);
  const { data: yaHay } = await supabase.from("color").select("id").eq("nombre", COLOR_NUEVO.nombre).maybeSingle();
  console.log(yaHay ? `   ✓ ${COLOR_NUEVO.nombre} ya existe` : `   + ${COLOR_NUEVO.nombre} ${COLOR_NUEVO.hex} (propuesto, editable en /admin)`);
  console.log(`   ℹ "tornasol" se escribe Cristal AB: ya está en la paleta desde separar-colores`);

  console.log(`\n── para la tienda (no se toca nada de esto) ──`);
  for (const p of PENDIENTES) console.log(`   ⚠ ${p}`);

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  // ═══════════════ escritura ═══════════════

  const { data: colorRosa, error: eCol } = await supabase
    .from("color").upsert({ nombre: COLOR_NUEVO.nombre, slug: slugify(COLOR_NUEVO.nombre), hex: COLOR_NUEVO.hex }, { onConflict: "slug" })
    .select("id").single();
  if (eCol) { console.error(`   ✖ creando color ${COLOR_NUEVO.nombre}: ${eCol.message}`); process.exit(1); }

  const coloresUsados = [...new Set(Object.values(COLOR_POR_FOTO).flatMap((m) => Object.values(m)).concat(REUBICAR.map((r) => r.color)))];
  const { data: colores } = await supabase.from("color").select("id, nombre").in("nombre", coloresUsados);
  const colorId = new Map((colores ?? []).map((c) => [c.nombre, c.id]));
  colorId.set(COLOR_NUEVO.nombre, colorRosa.id);
  const faltan = coloresUsados.filter((c) => !colorId.has(c));
  if (faltan.length) { console.error(`   ✖ ABORTADO: color(es) sin dar de alta: ${faltan.join(", ")}`); process.exit(1); }

  // 1. reclasificar + renombrar prefijo
  let reclasificadas = 0;
  for (const [slug, r] of Object.entries(RECLASIFICAR)) {
    const t = porSlug.get(slug);
    if (!t) continue;
    if (catNombre.get(t.categoria_id!) === r.categoria) continue;
    const nombre = t.nombre.replace(/^Tira de pedrería\b/, r.prefijo);
    const { error } = await supabase.from("tela")
      .update({ categoria_id: catId.get(r.categoria), nombre, descripcion: null }).eq("id", t.id);
    if (error) { console.error(`   ✖ reclasificando ${slug}: ${error.message}`); process.exit(1); }
    reclasificadas++;
  }
  console.log(`   ✓ ${reclasificadas} ficha(s) reclasificada(s) por forma`);

  // Cambiar de categoría no basta: la unidad venía de cuando eran tira, y una
  // pieza suelta cobrada "/m" es un precio mal puesto en la vitrina. La unidad
  // la decide la categoría (`UNIDAD_POR_CATEGORIA`), no este script.
  // Solo se toca lo que siga en `metro`, igual que `clasificar`: si la tienda
  // ya capturó otra unidad a mano, esa gana.
  let unidades = 0;
  for (const [slug, r] of Object.entries(RECLASIFICAR)) {
    const t = porSlug.get(slug);
    if (!t) continue;
    const catSlug = Object.values(CATEGORIAS).find((c) => c.nombre === r.categoria)?.slug;
    const debe = catSlug ? UNIDAD_POR_CATEGORIA[catSlug] : null;
    if (!debe || debe === "metro") continue;
    const { data, error } = await supabase.from("variante")
      .update({ unidad_venta: debe }).eq("tela_id", t.id).eq("unidad_venta", "metro").select("id");
    if (error) { console.error(`   ✖ unidad de ${slug}: ${error.message}`); process.exit(1); }
    unidades += data?.length ?? 0;
  }
  if (unidades) console.log(`   ✓ ${unidades} variante(s) pasaron de "/m" a su unidad real`);

  for (const [slug, nombre] of Object.entries(RENOMBRAR)) {
    const t = porSlug.get(slug);
    if (!t || t.nombre === nombre) continue;
    const { error } = await supabase.from("tela").update({ nombre, descripcion: null }).eq("id", t.id);
    if (error) { console.error(`   ✖ renombrando ${slug}: ${error.message}`); process.exit(1); }
    console.log(`   ✓ "${t.nombre}" → "${nombre}"`);
  }

  // 2. fusión 350 → 351
  if (absorbe && conserva) {
    const { data: vsC } = await supabase.from("variante").select("id").eq("tela_id", conserva.id).order("orden");
    const { data: vsA } = await supabase.from("variante").select("id").eq("tela_id", absorbe.id);
    const destinoVar = vsC?.[0]?.id;
    if (!destinoVar) console.log(`   ⚠ "${conserva.nombre}" no tiene variante; se omite la fusión`);
    else {
      const { data: fsA } = await supabase.from("foto").select("id, ruta").in("variante_id", (vsA ?? []).map((v) => v.id));
      for (const f of fsA ?? []) {
        const { error } = await supabase.from("foto").update({ variante_id: destinoVar }).eq("id", f.id);
        if (error) { console.error(`   ✖ moviendo ${f.ruta}: ${error.message}`); process.exit(1); }
      }
      for (const v of vsA ?? []) await supabase.from("variante").delete().eq("id", v.id);
      await supabase.from("tela").delete().eq("id", absorbe.id);
      await supabase.from("tela").update({ descripcion: null }).eq("id", conserva.id);
      console.log(`   ✂ "${absorbe.nombre}" fusionada en "${conserva.nombre}" (${fsA?.length ?? 0} foto(s))`);
    }
  }

  // 3. reubicar intrusos
  for (const r of REUBICAR) {
    const origen = porSlug.get(r.desde);
    if (!origen) continue;
    const { data: vs } = await supabase.from("variante").select("id, unidad_venta, precio, stock").eq("tela_id", origen.id);
    const { data: fs } = await supabase.from("foto").select("id, ruta, variante_id").in("variante_id", (vs ?? []).map((v) => v.id));
    const foto = (fs ?? []).find((f) => base(f.ruta) === r.foto);
    if (!foto) { console.log(`   ✓ ${r.foto} ya no está en ${r.desde}`); continue; }
    const modelo = (vs ?? []).find((v) => v.id === foto.variante_id)!;
    const { data: destino, error: eD } = await supabase.from("tela")
      .upsert({ slug: r.haciaSlug, nombre: r.haciaNombre, categoria_id: catId.get(r.categoria), descripcion: null }, { onConflict: "slug" })
      .select("id").single();
    if (eD) { console.error(`   ✖ creando "${r.haciaNombre}": ${eD.message}`); process.exit(1); }
    const { data: yaVar } = await supabase.from("variante")
      .select("id").eq("tela_id", destino.id).eq("color_id", colorId.get(r.color)!).maybeSingle();
    let varId = yaVar?.id as string | undefined;
    if (!varId) {
      const { data, error } = await supabase.from("variante")
        .insert({ tela_id: destino.id, color_id: colorId.get(r.color), unidad_venta: modelo.unidad_venta, precio: modelo.precio, stock: modelo.stock })
        .select("id").single();
      if (error) { console.error(`   ✖ creando variante ${r.color}: ${error.message}`); process.exit(1); }
      varId = data.id;
    }
    await supabase.from("foto").update({ variante_id: varId, alt: `${r.haciaNombre} · ${r.color}` }).eq("id", foto.id);
    await supabase.from("tela").update({ descripcion: null }).eq("id", origen.id);
    console.log(`   ✓ ${r.desde}/${r.foto} → "${r.haciaNombre}"`);
  }

  // 4. colores escondidos → variantes de verdad
  let creadas = 0, movidas = 0, vaciadas = 0;
  for (const t of trabajo) {
    const { data: vs } = await supabase
      .from("variante")
      .select("id, color_id, sku, precio, stock, gramaje, acabado_id, unidad_venta, piezas_por_unidad, es_bordado, es_brillante, es_traslucida, es_tornasol")
      .eq("tela_id", t.telaId).order("orden");
    if (!vs?.length) continue;
    const modelo = vs[0];
    const { data: nombreActual } = await supabase.from("tela").select("nombre").eq("id", t.telaId).single();

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
          es_traslucida: modelo.es_traslucida,
          // el acabado AB ES tornasol: que la bandera diga la verdad
          es_tornasol: color === "Cristal AB" ? true : modelo.es_tornasol,
          orden: orden,
        }).select("id").single();
        if (error) { console.error(`   ✖ creando ${color} en ${t.slug}: ${error.message}`); process.exit(1); }
        destino = data.id;
        creadas++;
      }
      for (const fid of fotoIds) {
        const { error } = await supabase.from("foto")
          .update({ variante_id: destino, alt: `${nombreActual?.nombre ?? t.nombre} · ${color}` }).eq("id", fid);
        if (error) { console.error(`   ✖ moviendo foto de ${t.slug}: ${error.message}`); process.exit(1); }
        movidas++;
      }
      await supabase.from("variante").update({ orden: orden++ }).eq("id", destino);
    }
    // las variantes viejas sin color se quedan sin fotos: fuera
    for (const v of vs) {
      const { data: quedan } = await supabase.from("foto").select("id").eq("variante_id", v.id);
      if (!quedan?.length) { await supabase.from("variante").delete().eq("id", v.id); vaciadas++; }
    }
    await supabase.from("tela").update({ descripcion: null }).eq("id", t.telaId);
  }

  console.log(
    `\nListo: ${reclasificadas} reclasificada(s), ${creadas} variante(s) de color creada(s), ` +
    `${movidas} foto(s) reasignada(s), ${vaciadas} variante(s) sin color borrada(s).`
  );
  console.log(`Corre "pnpm describir --aplicar" para regenerar las descripciones que se limpiaron.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
