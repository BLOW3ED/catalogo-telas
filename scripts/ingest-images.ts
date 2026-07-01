#!/usr/bin/env tsx
/**
 * Ingesta de imágenes — Telas La Jalisciense
 * ===========================================================================
 * Dos modos:
 *
 *   pnpm ingest                  → MODO MANIFEST (default)
 *       Escanea las fotos, parsea cada nombre (SKU/modelo/color de forma
 *       defensiva) y escribe `catalog-manifest.csv` para revisión MANUAL.
 *       NO sube nada ni toca la BD.
 *
 *   pnpm ingest --upload         → MODO UPLOAD
 *       Lee el CSV (ya revisado por ti), sube las imágenes al bucket `telas`
 *       y hace upsert idempotente contra el esquema (tela, variante, foto, N:N).
 *       Respeta SKUs existentes: upsert por SKU, no duplica.
 *
 * Flags:
 *   --dir=<ruta>   carpeta de fotos (default: ./FOTOS_TELAS si existe, si no ./)
 *   --sep=<char>   separador preferido para el SKU (default autodetecta '-','_',' ')
 *   --out=<ruta>   ruta del CSV (default: ./catalog-manifest.csv)
 * ===========================================================================
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Cargar variables: .env.local tiene prioridad (igual que Next), luego .env
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// ---------------------------------------------------------------------------
// Configuración / args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {
  upload: argv.includes("--upload"),
  dir: argChar("--dir"),
  sep: argChar("--sep"),
  out: argChar("--out") ?? "catalog-manifest.csv",
};

function argChar(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

const IMG_EXT = new Set([".jpg", ".jpeg", ".png"]);

/**
 * Diccionario de colores (espejo del seed en SQL). Sirve para separar
 * modelo/color en el manifest SIN depender de la BD. `hex` se usa como
 * fallback si en upload aparece un color nuevo no sembrado.
 */
const COLORES: { nombre: string; slug: string; hex: string }[] = [
  { nombre: "Azul", slug: "azul", hex: "#2E5BB7" },
  { nombre: "Hueso", slug: "hueso", hex: "#EFE7D8" },
  { nombre: "Lila", slug: "lila", hex: "#B57EDC" },
  { nombre: "Menta", slug: "menta", hex: "#9ED9C0" },
  { nombre: "Verde Limón", slug: "verde-limon", hex: "#B5D44B" },
  { nombre: "Magenta", slug: "magenta", hex: "#C2186A" },
  { nombre: "Negro", slug: "negro", hex: "#1A1714" },
  { nombre: "Cedrón", slug: "cedron", hex: "#E8743B" },
];

const COLOR_POR_NORM = new Map(COLORES.map((c) => [normaliza(c.nombre), c]));

// Alias de escritura → color canónico (ej. los archivos dicen "Shedron" = Cedrón)
const ALIAS_COLOR: Record<string, string> = { shedron: "cedron" };
for (const [alias, slug] of Object.entries(ALIAS_COLOR)) {
  const canon = COLORES.find((c) => c.slug === slug);
  if (canon) COLOR_POR_NORM.set(alias, canon);
}

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------

/** lowercase, sin acentos, sin espacios → clave de comparación */
function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** slug url-safe: sin acentos, alfanumérico con guiones */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "ChifonLunaresAzul" → ["Chifon","Lunares","Azul"] */
function partirCamel(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_]+/)
    .filter(Boolean);
}

/** ¿segmento con pinta de SKU? (solo mayúsculas/dígitos, ej. CHLU99, 6, TBMM229) */
function pareceSku(seg: string): boolean {
  return /^[A-Z0-9]+$/.test(seg) && /[A-Z0-9]/.test(seg);
}

// ---------------------------------------------------------------------------
// Parseo de un nombre de archivo → { sku, modelo, color, esBordado, notas }
// ---------------------------------------------------------------------------
type Parseado = {
  archivo: string;
  sku: string | null;
  modelo: string;
  color: string;
  colorSlug: string;
  esBordado: boolean;
  notas: string[];
};

function parseNombre(archivo: string): Parseado {
  const ext = path.extname(archivo);
  const base = path.basename(archivo, ext);
  const notas: string[] = [];

  // 1) Separar por el separador preferido (default '-').
  const sep = flags.sep ?? "-";
  const segs = base.split(sep).filter(Boolean);

  // 2) Detectar SKU "desde la cola": run final de segmentos con pinta de SKU,
  //    siempre dejando al menos un segmento descriptivo al frente.
  let corte = segs.length;
  while (corte > 1 && pareceSku(segs[corte - 1])) corte--;
  const skuParts = segs.slice(corte);
  const tieneAlpha = skuParts.some((p) => /[A-Z]/.test(p));
  const sku = skuParts.length > 0 && tieneAlpha ? skuParts.join("-") : null;
  if (!sku) notas.push("sin SKU en archivo");

  // 3) Parte descriptiva = lo que quedó al frente, partido por CamelCase.
  const descriptivo = segs.slice(0, corte).join(" ");
  const palabras = partirCamel(descriptivo);

  // 4) Color: matchear la cola (1..3 palabras) contra el diccionario.
  let color = "";
  let colorSlug = "";
  let palabrasModelo = palabras;
  for (let n = Math.min(3, palabras.length); n >= 1; n--) {
    const cola = palabras.slice(palabras.length - n);
    const hit = COLOR_POR_NORM.get(normaliza(cola.join("")));
    if (hit) {
      color = hit.nombre;
      colorSlug = hit.slug;
      palabrasModelo = palabras.slice(0, palabras.length - n);
      break;
    }
  }
  if (!color) {
    const ultima = palabras[palabras.length - 1];
    if (ultima && !/bordado/i.test(ultima)) {
      notas.push(`posible color "${ultima}" (no está en el catálogo)`);
    } else {
      notas.push("sin color detectado");
    }
  }

  const modelo = palabrasModelo.join(" ").trim() || descriptivo;
  const esBordado = /bordado/i.test(base);

  return { archivo, sku, modelo, color, colorSlug, esBordado, notas };
}

// ---------------------------------------------------------------------------
// CSV (escritura y lectura robusta con campos entrecomillados)
// ---------------------------------------------------------------------------
const COLUMNAS = [
  "archivo", "sku", "modelo", "color",
  "precio_metro", "gramaje", "stock",
  "es_bordado", "es_brillante", "es_traslucida", "es_tornasol",
  "categoria", "casos_uso", "notas",
] as const;

function escCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function parseCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila); }

  const [head, ...resto] = filas;
  return resto.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// ---------------------------------------------------------------------------
// Listar imágenes
// ---------------------------------------------------------------------------
async function resolverDir(): Promise<string> {
  if (flags.dir) return flags.dir;
  try {
    await fs.access("FOTOS_TELAS");
    return "FOTOS_TELAS";
  } catch {
    return ".";
  }
}

async function listarImagenes(dir: string): Promise<string[]> {
  const entradas = await fs.readdir(dir);
  return entradas
    .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()))
    .sort();
}

// ===========================================================================
// MODO MANIFEST
// ===========================================================================
async function modoManifest() {
  const dir = await resolverDir();
  const imagenes = await listarImagenes(dir);

  if (imagenes.length === 0) {
    console.error(`✖ No encontré imágenes en "${dir}".`);
    process.exit(1);
  }

  const parseados = imagenes.map(parseNombre);

  const lineas = [COLUMNAS.join(",")];
  for (const p of parseados) {
    const row: Record<string, string> = {
      archivo: p.archivo,
      sku: p.sku ?? "",
      modelo: p.modelo,
      color: p.color,
      precio_metro: "",
      gramaje: "",
      stock: "",
      es_bordado: p.esBordado ? "true" : "",
      es_brillante: "",
      es_traslucida: "",
      es_tornasol: "",
      categoria: "",
      casos_uso: "",
      notas: p.notas.join("; "),
    };
    lineas.push(COLUMNAS.map((c) => escCsv(row[c])).join(","));
  }

  await fs.writeFile(flags.out, lineas.join("\n") + "\n", "utf8");

  // Resumen
  const sinSku = parseados.filter((p) => !p.sku);
  const sinColor = parseados.filter((p) => !p.color);
  const modelos = new Set(parseados.map((p) => slugify(p.modelo)));

  console.log("\n📋 Manifest generado:");
  console.log(`   archivo : ${path.resolve(flags.out)}`);
  console.log(`   fotos   : ${parseados.length}`);
  console.log(`   modelos : ${modelos.size} (estimado por nombre)`);
  console.log(`   sin SKU : ${sinSku.length}  ${sinSku.length ? "← requieren tu atención" : ""}`);
  console.log(`   sin color detectado: ${sinColor.length}`);
  if (sinSku.length) {
    console.log("\n   Archivos sin SKU:");
    sinSku.forEach((p) => console.log(`     · ${p.archivo}`));
  }
  console.log("\n👉 Revisa y completa el CSV. Cuando esté listo: pnpm ingest --upload\n");
}

// ===========================================================================
// MODO UPLOAD
// ===========================================================================
async function modoUpload() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const BUCKET = "telas";

  // Leer CSV revisado
  let csv: string;
  try {
    csv = await fs.readFile(flags.out, "utf8");
  } catch {
    console.error(`✖ No encontré ${flags.out}. Corre primero "pnpm ingest" y revísalo.`);
    process.exit(1);
  }
  const filas = parseCsv(csv);
  const dir = await resolverDir();

  // Caches para no repetir lookups
  const colorCache = new Map<string, string>();   // slug -> id
  const catCache = new Map<string, string>();      // slug -> id
  const casoCache = new Map<string, string>();     // slug -> id
  const telaCache = new Map<string, string>();     // slug -> id

  const ctx = {
    contadores: { telas: new Set<string>(), variantes: 0, fotos: 0, sinSku: 0, errores: [] as string[] },
  };

  for (const fila of filas) {
    try {
      await procesarFila(fila);
    } catch (e) {
      ctx.contadores.errores.push(`${fila.archivo}: ${(e as Error).message}`);
    }
  }

  // ----- helpers de upsert -----
  async function upsertLookup(
    tabla: string, nombre: string, cache: Map<string, string>, extra: Record<string, unknown> = {}
  ): Promise<string | null> {
    const slug = slugify(nombre);
    if (!slug) return null;
    if (cache.has(slug)) return cache.get(slug)!;
    const { data, error } = await supabase
      .from(tabla)
      .upsert({ nombre, slug, ...extra }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw new Error(`${tabla} "${nombre}": ${error.message}`);
    cache.set(slug, data.id);
    return data.id;
  }

  async function procesarFila(fila: Record<string, string>) {
    const archivo = fila.archivo?.trim();
    if (!archivo) return;

    // 1) lookups
    const categoriaId = fila.categoria?.trim()
      ? await upsertLookup("categoria", fila.categoria.trim(), catCache)
      : null;

    let colorId: string | null = null;
    if (fila.color?.trim()) {
      const cn = fila.color.trim();
      const conocido = COLOR_POR_NORM.get(normaliza(cn));
      colorId = await upsertLookup("color", conocido?.nombre ?? cn, colorCache, {
        hex: conocido?.hex ?? "#CCCCCC", // color nuevo sin hex → placeholder a revisar
      });
    }

    // 2) tela (por slug del modelo)
    const modelo = fila.modelo?.trim() || path.basename(archivo, path.extname(archivo));
    const telaSlug = slugify(modelo);
    let telaId: string;
    const telaCached = telaCache.get(telaSlug);
    if (telaCached) {
      telaId = telaCached;
    } else {
      const { data, error } = await supabase
        .from("tela")
        .upsert({ slug: telaSlug, nombre: modelo, categoria_id: categoriaId }, { onConflict: "slug" })
        .select("id")
        .single();
      if (error || !data) throw new Error(`tela "${modelo}": ${error?.message ?? "sin datos"}`);
      telaId = data.id as string;
      telaCache.set(telaSlug, telaId);
    }
    ctx.contadores.telas.add(telaSlug);

    // 3) variante — upsert por SKU si existe; si no, por (tela_id,color_id)
    const sku = fila.sku?.trim() || null;
    if (!sku) ctx.contadores.sinSku++;
    const varPayload = {
      tela_id: telaId,
      sku,
      color_id: colorId,
      precio_metro: numero(fila.precio_metro),
      gramaje: entero(fila.gramaje),
      stock: numero(fila.stock),
      es_bordado: bool(fila.es_bordado),
      es_brillante: bool(fila.es_brillante),
      es_traslucida: bool(fila.es_traslucida),
      es_tornasol: bool(fila.es_tornasol),
    };

    let varianteId: string;
    if (sku) {
      const { data, error } = await supabase
        .from("variante").upsert(varPayload, { onConflict: "sku" }).select("id").single();
      if (error) throw new Error(`variante SKU ${sku}: ${error.message}`);
      varianteId = data.id;
    } else {
      // sin SKU: buscar existente por tela+color para no duplicar
      const q = supabase.from("variante").select("id").eq("tela_id", telaId);
      const { data: prev } = colorId ? await q.eq("color_id", colorId).maybeSingle()
                                     : await q.is("color_id", null).maybeSingle();
      if (prev) {
        await supabase.from("variante").update(varPayload).eq("id", prev.id);
        varianteId = prev.id;
      } else {
        const { data, error } = await supabase.from("variante").insert(varPayload).select("id").single();
        if (error) throw new Error(`variante (sin SKU) ${archivo}: ${error.message}`);
        varianteId = data.id;
      }
    }
    ctx.contadores.variantes++;

    // 4) subir imagen al bucket (idempotente con upsert) + fila foto
    const ext = path.extname(archivo).toLowerCase();
    const ruta = `${telaSlug}/${slugify(path.basename(archivo, ext))}${ext}`;
    const buffer = await fs.readFile(path.join(dir, archivo));
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(ruta, buffer, {
      contentType: ext === ".png" ? "image/png" : "image/jpeg",
      upsert: true,
    });
    if (upErr) throw new Error(`storage ${ruta}: ${upErr.message}`);

    const { error: fotoErr } = await supabase
      .from("foto")
      .upsert(
        { variante_id: varianteId, ruta, orden: 0, alt: `${modelo}${fila.color ? " " + fila.color : ""}` },
        { onConflict: "variante_id,ruta" }
      );
    if (fotoErr) throw new Error(`foto ${ruta}: ${fotoErr.message}`);
    ctx.contadores.fotos++;

    // 5) casos de uso (N:N) — lista separada por ; o ,
    const casos = (fila.casos_uso ?? "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    for (const caso of casos) {
      const casoId = await upsertLookup("caso_uso", caso, casoCache);
      if (casoId) {
        await supabase.from("tela_caso_uso")
          .upsert({ tela_id: telaId, caso_uso_id: casoId }, { onConflict: "tela_id,caso_uso_id" });
      }
    }
  }

  // ----- resumen -----
  const c = ctx.contadores;
  console.log("\n✅ Ingesta completada:");
  console.log(`   telas (modelos) : ${c.telas.size}`);
  console.log(`   variantes (SKU) : ${c.variantes}`);
  console.log(`   fotos subidas   : ${c.fotos}`);
  console.log(`   variantes sin SKU: ${c.sinSku}  ${c.sinSku ? "← requieren tu atención" : ""}`);
  if (c.errores.length) {
    console.log(`\n⚠ ${c.errores.length} errores:`);
    c.errores.forEach((e) => console.log(`   · ${e}`));
  }
  console.log("");
}

// helpers de coerción
function numero(v: string): number | null { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function entero(v: string): number | null { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function bool(v: string): boolean { return /^(true|1|si|sí|x)$/i.test(v.trim()); }

// ---------------------------------------------------------------------------
(async () => {
  if (flags.upload) await modoUpload();
  else await modoManifest();
})().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
