#!/usr/bin/env tsx
/**
 * Clasificar y limpiar lo que ya está subido — Telas La Jalisciense
 * ===========================================================================
 * El lote de mercería se subió con NOMBRES PROVISIONALES (ver
 * `nombres-provisionales.ts`) y sin categoría: 78 de 134 modelos quedaron en
 * "sin clasificar", que en el catálogo se traduce en filtros que no filtran.
 *
 * Este script arregla eso sobre la BD, sin volver a correr la ingesta ni
 * tocar las fotos:
 *
 *   1. CATEGORÍA — se la asigna a cada tela según el prefijo de su código,
 *      con las reglas de `lib/ingesta/categorias.ts` (verificadas contra las
 *      fotos, no deducidas del texto).
 *
 *   2. NOMBRE DE BOLSITAS — les quita el número de cámara que llevan pegado
 *      ("Bolsa de Piedras · 1404 · 25 pz · 00021" → "Piedra 1404 · 25 pz").
 *      Las que quedan con el mismo rótulo se desempatan con una letra.
 *
 * Por qué NO fusiona las bolsitas en un solo modelo: revisando las fotos, el
 * código de la etiqueta ("1404") es un PRECIO, no un producto — ocho bolsitas
 * distintas lo comparten con contenidos diferentes. Y como el carrusel y el
 * selector del detalle solo muestran variantes CON COLOR, fusionarlas dejaría
 * sus fotos inalcanzables. Cuando la tienda capture el color de cada bolsita,
 * fusionar pasa a ser seguro.
 *
 *   pnpm clasificar              → SIMULACRO: dice qué haría y no escribe nada
 *   pnpm clasificar --aplicar    → escribe los cambios
 *   pnpm clasificar --forzar     → también repone categorías ya asignadas
 *
 * Idempotente: correrlo dos veces deja el mismo resultado.
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { categoriaDeCodigo, type Categoria } from "../lib/ingesta/categorias";
import { interpretaBolsita, nombreDeBolsita } from "../lib/ingesta/nombres";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");
const FORZAR = process.argv.includes("--forzar");

/** Letras de desempate para bolsitas con rótulo repetido: A, B, … Z, AA… */
function letra(i: number): string {
  let n = i, s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

type Tela = {
  id: string;
  slug: string;
  nombre: string;
  categoria_id: string | null;
  categoriaActual: string | null;
  sku: string | null;
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

  // El SKU vive en la variante, no en la tela; se trae el de la primera
  // variante porque en este lote todas las de un modelo comparten código.
  const { data: telasRaw, error } = await supabase
    .from("tela")
    .select("id, slug, nombre, categoria_id, categoria(nombre), variante(sku)")
    .order("nombre");
  if (error) {
    console.error("✖ No se pudo leer las telas:", error.message);
    process.exit(1);
  }

  const telas: Tela[] = (telasRaw ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    slug: t.slug as string,
    nombre: t.nombre as string,
    categoria_id: t.categoria_id as string | null,
    categoriaActual: (t.categoria as { nombre: string } | null)?.nombre ?? null,
    sku: ((t.variante as { sku: string | null }[]) ?? []).find((v) => v.sku)?.sku ?? null,
  }));

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · ${telas.length} telas\n`);

  // ---------------------------------------------------------------------
  // 1) Categorías
  // ---------------------------------------------------------------------
  const cacheCategoria = new Map<string, string>();

  /** Crea la categoría si hace falta y devuelve su id. */
  async function idDeCategoria(cat: Categoria): Promise<string | null> {
    if (cacheCategoria.has(cat.slug)) return cacheCategoria.get(cat.slug)!;
    if (!APLICAR) return null;
    const { data, error } = await supabase
      .from("categoria")
      .upsert({ nombre: cat.nombre, slug: cat.slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`categoría "${cat.nombre}": ${error?.message}`);
    cacheCategoria.set(cat.slug, data.id);
    return data.id;
  }

  const porCategoria = new Map<string, number>();
  const sinClasificar: Tela[] = [];
  /** Ya tenían categoría y la regla dice otra cosa: se listan una por una. */
  const reclasificadas: { tela: Tela; de: string; a: string }[] = [];
  let categorizadas = 0;

  for (const tela of telas) {
    if (tela.categoria_id && !FORZAR) continue;
    // El código puede estar en el SKU o —si el nombre es provisional— ser el
    // nombre mismo. Se prueban ambos antes de rendirse.
    const cat = categoriaDeCodigo(tela.sku) ?? categoriaDeCodigo(tela.nombre);
    if (!cat) { sinClasificar.push(tela); continue; }

    // Sin cambio real: ni lo cuenta ni escribe (idempotencia).
    if (tela.categoriaActual === cat.nombre) continue;
    if (tela.categoriaActual) {
      reclasificadas.push({ tela, de: tela.categoriaActual, a: cat.nombre });
    }

    porCategoria.set(cat.nombre, (porCategoria.get(cat.nombre) ?? 0) + 1);
    categorizadas++;
    if (!APLICAR) continue;

    const categoriaId = await idDeCategoria(cat);
    const { error: e } = await supabase
      .from("tela")
      .update({ categoria_id: categoriaId })
      .eq("id", tela.id);
    if (e) console.error(`  ✖ ${tela.nombre}: ${e.message}`);
  }

  console.log("── Categorías ──");
  [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`   ${String(n).padStart(3)}  ${c}`));
  console.log(`   ${String(categorizadas).padStart(3)}  TOTAL a cambiar`);

  // Pisar una categoría existente puede borrar trabajo hecho a mano desde
  // /admin, así que nunca pasa en silencio: se enumera qué se reemplaza.
  if (reclasificadas.length) {
    const porCambio = new Map<string, number>();
    for (const r of reclasificadas) {
      const k = `${r.de} → ${r.a}`;
      porCambio.set(k, (porCambio.get(k) ?? 0) + 1);
    }
    console.log(`\n   ⚠ ${reclasificadas.length} YA tenían categoría y se les reemplaza:`);
    [...porCambio.entries()].forEach(([k, n]) => console.log(`     ${String(n).padStart(3)}  ${k}`));
  }

  if (sinClasificar.length) {
    console.log(`\n   ${sinClasificar.length} sin regla que las reconozca (se quedan sin categoría):`);
    sinClasificar.forEach((t) => console.log(`     · ${t.nombre}  (sku ${t.sku ?? "—"})`));
  }

  // ---------------------------------------------------------------------
  // 2) Nombres de bolsitas
  // ---------------------------------------------------------------------
  const bolsitas = telas
    .map((t) => ({ tela: t, b: interpretaBolsita(t.nombre) }))
    .filter((x): x is { tela: Tela; b: NonNullable<ReturnType<typeof interpretaBolsita>> } => x.b !== null)
    // Orden estable por número de cámara: la letra de desempate no cambia
    // entre corridas aunque la BD devuelva las filas en otro orden.
    .sort((a, b) => a.b.toma.localeCompare(b.b.toma));

  // Agrupar por el nombre limpio para saber cuáles necesitan letra.
  const porNombre = new Map<string, typeof bolsitas>();
  for (const x of bolsitas) {
    const base = nombreDeBolsita(x.b);
    if (!porNombre.has(base)) porNombre.set(base, []);
    porNombre.get(base)!.push(x);
  }

  console.log("\n── Bolsitas de piedra ──");
  let renombradas = 0;
  for (const [base, grupo] of porNombre) {
    for (const [i, x] of grupo.entries()) {
      // Una sola bolsita con ese rótulo → no necesita letra.
      const nombre = grupo.length === 1 ? base : nombreDeBolsita(x.b, letra(i));
      const slug = slugify(nombre);
      if (nombre === x.tela.nombre && slug === x.tela.slug) continue;

      renombradas++;
      console.log(`   ${x.tela.nombre}\n     → ${nombre}`);
      if (!APLICAR) continue;

      const { error: e } = await supabase
        .from("tela")
        .update({ nombre, slug })
        .eq("id", x.tela.id);
      if (e) console.error(`  ✖ ${x.tela.nombre}: ${e.message}`);
    }
  }
  console.log(`   ${renombradas} por renombrar (de ${bolsitas.length} bolsitas)`);

  console.log(
    APLICAR
      ? "\n✔ Listo. Las lecturas del catálogo se cachean 60s: espera un minuto o reinicia el server.\n"
      : "\n⧗ No se escribió nada. Corre con --aplicar cuando estés de acuerdo.\n"
  );
}

main().catch((e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
});
