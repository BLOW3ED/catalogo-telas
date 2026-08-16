#!/usr/bin/env tsx
/**
 * Ingesta de imágenes — Telas La Jalisciense
 * ===========================================================================
 * Dos modos:
 *
 *   pnpm ingest                  → MODO MANIFEST (default, FUSIONA)
 *       Escanea las fotos, parsea cada nombre (SKU/modelo/color de forma
 *       defensiva) y escribe `catalog-manifest.csv` para revisión MANUAL.
 *       NO sube nada ni toca la BD.
 *
 *   pnpm ingest --upload         → MODO UPLOAD
 *       Lee el CSV (ya revisado por ti), sube las imágenes al bucket `telas`
 *       y hace upsert idempotente contra el esquema (tela, variante, foto, N:N).
 *       Respeta SKUs existentes: upsert por SKU, no duplica.
 *
 * Volver a correr el modo manifest NO borra lo capturado: si el CSV ya existe,
 * se fusiona por `archivo` y lo tecleado gana sobre lo deducido del nombre de
 * archivo. Para regenerar desde cero, `--forzar`.
 *
 * Flags:
 *   --dir=<ruta>   carpeta de fotos (default: ./FOTOS_TELAS si existe, si no ./)
 *   --sep=<char>   separador preferido para el SKU (default autodetecta '-','_',' ')
 *   --out=<ruta>   ruta del CSV (default: ./catalog-manifest.csv)
 *   --forzar       regenera el manifest desde cero (descarta lo capturado)
 *   --validar      revisa el CSV con las reglas de --upload SIN escribir nada
 * ===========================================================================
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";
import { procesarFoto } from "../lib/images/derivados";
import { interpretaFlor, interpretaFamilia, modeloFlor, tablaDeColores } from "../lib/ingesta/nombres";
import { fusionaFila, registroAuto, type Procedencia } from "../lib/ingesta/fusion";

// Cargar variables: .env.local tiene prioridad (igual que Next), luego .env
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// ---------------------------------------------------------------------------
// Configuración / args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {
  upload: argv.includes("--upload"),
  // Regenera el manifest desde cero, tirando lo ya capturado a mano. Sin este
  // flag el CSV existente se fusiona (ver modoManifest).
  forzar: argv.includes("--forzar"),
  // Revisa el CSV con las reglas de la subida sin escribir nada.
  validar: argv.includes("--validar"),
  dir: argChar("--dir"),
  sep: argChar("--sep"),
  out: argChar("--out") ?? "catalog-manifest.csv",
};

function argChar(name: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
  // Colores que traen los nombres de archivo de mercería (grupo "Flor*").
  // Los hex son de arranque: se afinan luego desde /admin contra la pieza real.
  { nombre: "Blanco", slug: "blanco", hex: "#FFFFFF" },
  { nombre: "Blush", slug: "blush", hex: "#E8C4BC" },
  { nombre: "Champagne", slug: "champagne", hex: "#E4CFA8" },
  { nombre: "Palo de Rosa", slug: "palo-de-rosa", hex: "#C48A82" },
  { nombre: "Amarillo", slug: "amarillo", hex: "#F2C744" },
  { nombre: "Oro", slug: "oro", hex: "#C9A227" },
  { nombre: "Verde Botella", slug: "verde-botella", hex: "#1B4D3E" },
  { nombre: "Mauve", slug: "mauve", hex: "#9C7C8C" },
  { nombre: "Rosado", slug: "rosado", hex: "#EFA3B8" },
  { nombre: "Rosa Pastel", slug: "rosa-pastel", hex: "#F4C2C2" },
  { nombre: "Humo", slug: "humo", hex: "#8C8C8C" },
  { nombre: "Melón", slug: "melon", hex: "#F2A477" },
  { nombre: "Plata", slug: "plata", hex: "#C0C0C0" },
  { nombre: "Verde Olivo", slug: "verde-olivo", hex: "#6B7B3A" },
  { nombre: "Piedra", slug: "piedra", hex: "#B0A79A" },
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
  /** Base sin contador de cámara: agrupa las tomas del mismo producto. */
  grupo: string;
  /** Número de toma de la cámara; ordena las fotos de un mismo producto. */
  toma: number | null;
  sku: string | null;
  modelo: string;
  color: string;
  colorSlug: string;
  categoria: string;
  unidad: string;
  esBordado: boolean;
  notas: string[];
};

// Las reglas de negocio del nombrado (cómo se descompone "Flor348Humo", qué
// prefijos son qué familia) viven en lib/ingesta/nombres.ts, con pruebas.

/**
 * Quita el contador de 5 dígitos que la cámara pega al nombre
 * ("BNK231500004" → "BNK2315" + toma 4) y el sufijo "(1)" que deja el
 * navegador al bajar dos veces el mismo archivo.
 *
 * El corte es ambiguo cuando el SKU mismo termina en dígitos: "BNK203823"
 * podría ser el SKU completo o "BNK" + toma 3823. Se decide por corpus — si
 * otro archivo de la carpeta comparte el prefijo recortado, era un contador —
 * y cuando no hay evidencia se recorta igual pero se marca en `notas`, que es
 * justo para lo que existe el paso de revisión manual del CSV.
 */
/**
 * ¿Este archivo es una descarga duplicada de otro que YA está en la carpeta?
 *
 * El navegador nombra "BNK228400003(1).jpg" al bajar dos veces el mismo
 * archivo. `separarToma` ya recortaba el sufijo para agrupar, pero dejaba las
 * DOS fotos, así que el producto salía con la misma imagen repetida en el
 * carrusel. Aquí se descarta la copia.
 *
 * Exige que el original exista de verdad en el corpus: un "(1)" huérfano —el
 * único archivo de ese producto— tiene que conservarse, o se perdería la foto.
 *
 * La comparación ignora mayúsculas porque el lote las mezcla: el original es
 * "TGL25400004.jpg" y la copia "tgl25400004(1).jpg". En el FS de macOS son el
 * mismo nombre, pero `slugify` las manda a rutas distintas, así que sin esto la
 * copia se subía como una foto más del producto.
 */
function esDescargaDuplicada(base: string, corpus: Set<string>): boolean {
  const dup = /^(.*)\(\d+\)$/.exec(base);
  if (!dup) return false;
  const original = dup[1].toLowerCase();
  return [...corpus].some((o) => o.toLowerCase() === original);
}

function separarToma(
  base: string, corpus: Set<string>
): { grupo: string; toma: number | null; notas: string[] } {
  const notas: string[] = [];

  const dup = /^(.*)\(\d+\)$/.exec(base);
  if (dup) {
    base = dup[1];
    notas.push("descarga duplicada: mismo producto que el archivo sin (n)");
  }

  const m = /^(.+?)(\d{5})$/.exec(base);
  if (!m) return { grupo: base, toma: null, notas };

  const [, prefijo, contador] = m;
  const cortePorDigito = /\d$/.test(prefijo);
  const corroborado = [...corpus].some((otro) => otro !== base && otro.startsWith(prefijo));

  // Una toma real viene rellenada con ceros y es un número bajo ("00004"): la
  // cámara arranca en 1 y una sesión de producto no pasa de unas decenas. Un
  // sufijo que fuera parte del SKU no se escribiría así. Cuando el contador no
  // cumple las dos cosas (p.ej. "03823", rellenado pero demasiado alto para
  // ser una toma) el corte sí es dudoso y hay que confirmarlo a mano.
  const tomaPlausible = contador.startsWith("0") && parseInt(contador, 10) < 1000;
  if (cortePorDigito && !corroborado && !tomaPlausible) {
    notas.push(`corte SKU/toma dudoso: "${prefijo}" + "${contador}" — confirmar`);
  }

  return { grupo: prefijo, toma: parseInt(contador, 10), notas };
}

function parseNombre(
  archivo: string, corpus: Set<string>, coloresFlor: Map<string, string>
): Parseado {
  const ext = path.extname(archivo);
  const nombreBase = path.basename(archivo, ext);
  const { grupo: base, toma, notas } = separarToma(nombreBase, corpus);

  // 1) Flores: el diámetro define el modelo y el color la variante.
  const flor = interpretaFlor(base, coloresFlor);
  if (flor) {
    const hit = flor.color ? COLOR_POR_NORM.get(normaliza(flor.color)) : undefined;
    if (!flor.color) {
      notas.push(`sin nombre de color en el archivo — poner el del código ${flor.codigoColor}`);
    } else if (!hit) {
      notas.push(`color "${flor.color}" no está en el catálogo — se dará de alta`);
    }
    notas.push(`diámetro ${flor.diametro}, código de color ${flor.codigoColor} (del nombre de archivo)`);
    return {
      archivo,
      grupo: base,
      toma,
      // Sin SKU: el nombre trae diámetro y código de color, no un SKU de la
      // tienda. La variante queda identificada por (modelo, color), que aquí
      // sí es única — dos flores del mismo diámetro y color son la misma.
      sku: null,
      modelo: modeloFlor(flor.diametro),
      color: hit?.nombre ?? flor.color,
      colorSlug: hit?.slug ?? slugify(flor.color),
      categoria: "Flores",
      unidad: "pieza",
      esBordado: false,
      notas,
    };
  }
  if (/^Flor/i.test(base)) {
    notas.push("empieza con 'Flor' pero no sigue el patrón diámetro+código de color — asignar modelo a mano");
  }

  // 2) Familias por prefijo (botones, corchetes): el código sí es el SKU.
  const fam = interpretaFamilia(base);
  if (fam) {
    notas.push(`nombre derivado del prefijo (${fam.categoria.toLowerCase()}) — renombrar si la tienda lo llama de otro modo`);
    return {
      archivo,
      grupo: fam.codigo,
      toma,
      sku: fam.codigo,
      modelo: fam.modelo,
      color: "",
      colorSlug: "",
      categoria: fam.categoria,
      unidad: "pieza",
      esBordado: false,
      notas,
    };
  }

  // 3) Separar por el separador preferido (default '-').
  const sep = flags.sep ?? "-";
  const segs = base.split(sep).filter(Boolean);

  // 4) Caso "el archivo ES el SKU y nada más" (BNK2315, tgl4238, T4L): las
  //    fotos de mercería vienen nombradas solo con el código, sin nada
  //    descriptivo. El detector "desde la cola" de abajo no aplica porque
  //    exige dejar un segmento descriptivo al frente, y aquí no lo hay.
  //    Se normaliza a mayúsculas para que "TGL254" y "tgl254" no terminen
  //    como dos variantes distintas del mismo producto.
  if (segs.length === 1 && (pareceSku(base) || /^[a-z]{1,4}\d{2,8}$/.test(base))) {
    if (base !== base.toUpperCase()) notas.push(`SKU normalizado a mayúsculas desde "${base}"`);
    notas.push("sin nombre de producto en el archivo");
    return {
      archivo,
      grupo: base.toUpperCase(),
      toma,
      sku: base.toUpperCase(),
      modelo: "",
      color: "",
      colorSlug: "",
      categoria: "",
      unidad: "",
      esBordado: false,
      notas,
    };
  }

  // 3) Detectar SKU "desde la cola": run final de segmentos con pinta de SKU,
  //    siempre dejando al menos un segmento descriptivo al frente.
  let corte = segs.length;
  while (corte > 1 && pareceSku(segs[corte - 1])) corte--;
  const skuParts = segs.slice(corte);
  const tieneAlpha = skuParts.some((p) => /[A-Z]/.test(p));
  const sku = skuParts.length > 0 && tieneAlpha ? skuParts.join("-") : null;
  if (!sku) notas.push("sin SKU en archivo");

  // 4) Parte descriptiva = lo que quedó al frente, partido por CamelCase.
  const descriptivo = segs.slice(0, corte).join(" ");
  const palabras = partirCamel(descriptivo);

  // 5) Color: matchear la cola (1..3 palabras) contra el diccionario.
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

  return {
    archivo, grupo: base, toma, sku, modelo, color, colorSlug,
    categoria: "", unidad: "", esBordado, notas,
  };
}

// ---------------------------------------------------------------------------
// CSV (escritura y lectura robusta con campos entrecomillados)
// ---------------------------------------------------------------------------
const COLUMNAS = [
  "archivo", "grupo", "orden", "sku", "modelo", "color",
  "precio", "unidad_venta", "piezas_por_unidad", "gramaje", "stock",
  "es_bordado", "es_brillante", "es_traslucida", "es_tornasol",
  "categoria", "casos_uso", "notas",
] as const;

/** Debe coincidir con el CHECK de variante.unidad_venta (sección 13 del SQL). */
const UNIDADES = new Set(["metro", "pieza", "par", "bolsa", "rollo", "juego"]);

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

/** Sidecar con lo que dedujo el parser; vive junto al CSV. */
function rutaAuto(): string {
  return flags.out.replace(/\.csv$/i, "") + ".auto.json";
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

  const corpus = new Set(imagenes.map((f) => path.basename(f, path.extname(f))));
  // La tabla de colores se arma sobre los GRUPOS, no sobre los nombres de
  // archivo: con el contador de cámara pegado, "Flor420Blanco00008" enseñaría
  // que el código 20 es el color "Blanco00008".
  const coloresFlor = tablaDeColores(
    [...corpus].map((b) => separarToma(b, corpus).grupo)
  );
  // Las descargas duplicadas se descartan DESPUÉS de armar `corpus` y
  // `coloresFlor`: esas dos tablas se construyen con todos los nombres a
  // propósito, porque quitar archivos cambiaría la heurística de corte
  // SKU/toma y la tabla de códigos de color.
  const duplicadas = imagenes.filter((f) =>
    esDescargaDuplicada(path.basename(f, path.extname(f)), corpus)
  );
  const parseados = imagenes
    .filter((f) => !duplicadas.includes(f))
    .map((f) => parseNombre(f, corpus, coloresFlor));

  // Las fotos del mismo grupo van juntas y en orden de toma: así el CSV se
  // llena por bloques (un producto, sus N fotos) en vez de saltando, y `orden`
  // sale determinista — la foto 0 de cada grupo será la principal del catálogo.
  parseados.sort((a, b) =>
    a.grupo.localeCompare(b.grupo) || (a.toma ?? 0) - (b.toma ?? 0) || a.archivo.localeCompare(b.archivo)
  );
  const ordenEnGrupo = new Map<string, number>();

  // Si ya hay un CSV, se FUSIONA en vez de sobrescribirlo. Llenar los ~115
  // nombres y precios a mano cuesta horas, y volver a correr la ingesta es
  // normal (llegan fotos nuevas, se reprocesa un lote): sobrescribir borraría
  // ese trabajo sin avisar. Lo tecleado gana SIEMPRE; lo deducido del nombre de
  // archivo solo rellena celdas vacías. Con `--forzar` se regenera desde cero.
  const previo = new Map<string, Record<string, string>>();
  let autoPrevio: Procedencia = {};
  if (!flags.forzar) {
    try {
      for (const f of parseCsv(await fs.readFile(flags.out, "utf8"))) {
        if (f.archivo) previo.set(f.archivo.trim(), f);
      }
    } catch { /* no existe todavía: primera corrida */ }
    // Lo que dedujo el parser la vez pasada. Va en un archivo aparte y no en
    // una columna del CSV para no meterle ruido a lo que la tienda edita.
    try {
      autoPrevio = JSON.parse(await fs.readFile(rutaAuto(), "utf8")) as Procedencia;
    } catch { /* sin registro: se conserva todo lo no vacío, que es lo prudente */ }
  }
  const autoAhora: Procedencia = {};

  let conservadas = 0;
  const lineas = [COLUMNAS.join(",")];
  for (const p of parseados) {
    const n = ordenEnGrupo.get(p.grupo) ?? 0;
    ordenEnGrupo.set(p.grupo, n + 1);

    const row: Record<string, string> = {
      archivo: p.archivo,
      grupo: p.grupo,
      orden: String(n),
      sku: p.sku ?? "",
      modelo: p.modelo,
      color: p.color,
      precio: "",
      unidad_venta: p.unidad,   // vacío → 'metro' (el default de la tabla)
      piezas_por_unidad: "",
      gramaje: "",
      stock: "",
      es_bordado: p.esBordado ? "true" : "",
      es_brillante: "",
      es_traslucida: "",
      es_tornasol: "",
      categoria: p.categoria,
      casos_uso: "",
      notas: "",
    };

    autoAhora[p.archivo] = registroAuto(row);
    const { fila, conservo } = fusionaFila(
      row, previo.get(p.archivo), p.notas, autoPrevio[p.archivo]
    );
    if (conservo) conservadas++;

    lineas.push(COLUMNAS.map((c) => escCsv(fila[c])).join(","));
  }

  await fs.writeFile(flags.out, lineas.join("\n") + "\n", "utf8");
  await fs.writeFile(rutaAuto(), JSON.stringify(autoAhora, null, 1), "utf8");

  // Resumen. Las cuentas se hacen sobre lo que QUEDÓ en el CSV, no sobre lo
  // deducido: si no, una fila ya completada a mano se seguiría reportando como
  // faltante y el resumen no serviría para saber cuánto falta de verdad.
  const finales = parseCsv(await fs.readFile(flags.out, "utf8"));
  const porGrupo = new Map<string, Record<string, string>>();
  for (const f of finales) if (!porGrupo.has(f.grupo)) porGrupo.set(f.grupo, f);
  const grupos = [...porGrupo.values()];
  const sinSku = finales.filter((f) => !f.sku);
  const sinModelo = grupos.filter((f) => !f.modelo);
  const sinPrecio = grupos.filter((f) => !f.precio);
  const dudosos = parseados.filter((p) => p.notas.some((n) => n.startsWith("corte SKU/toma")));

  console.log("\n📋 Manifest generado:");
  console.log(`   archivo : ${path.resolve(flags.out)}`);
  console.log(`   fotos   : ${finales.length}`);
  console.log(`   grupos  : ${grupos.length} (producto detectado por nombre de archivo)`);
  if (previo.size) {
    console.log(`   fusionado con el CSV anterior: ${conservadas} filas conservaron datos tuyos`);
  }
  if (duplicadas.length) {
    console.log(`   descargas duplicadas ignoradas : ${duplicadas.length}`);
    duplicadas.forEach((f) => console.log(`     · ${f}`));
  }
  console.log(`   fotos sin SKU : ${sinSku.length}`);
  console.log(`   grupos sin nombre : ${sinModelo.length}  ${sinModelo.length ? "← hay que ponérselo a mano" : ""}`);
  console.log(`   grupos sin precio : ${sinPrecio.length}`);
  if (dudosos.length) {
    console.log(`\n⚠ ${dudosos.length} con corte SKU/toma dudoso (confirmar antes de subir):`);
    dudosos.forEach((p) => console.log(`     · ${p.archivo} → grupo "${p.grupo}"`));
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
  // variante id -> datos de la primera fila que la reclamó (guardia anti-colapso)
  const huellaPorVariante = new Map<string, { huella: string; archivo: string }>();

  const ctx = {
    contadores: { telas: new Set<string>(), variantes: 0, fotos: 0, derivados: 0, sinSku: 0, errores: [] as string[] },
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

    // 2) tela (por slug del modelo). Sin modelo se aborta la fila en vez de
    //    caer al nombre del archivo: en este lote los nombres son códigos de
    //    cámara ("BNK231500004") y ese fallback sembraría el catálogo de telas
    //    basura, con slugs que después hay que borrar a mano.
    const modelo = fila.modelo?.trim();
    if (!modelo) throw new Error("falta 'modelo' — ponle nombre al producto en el CSV");
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
    // Vacío → 'metro', el default de la tabla: así el CSV de una ingesta de
    // telas se puede dejar sin tocar esta columna.
    const unidad = fila.unidad_venta?.trim().toLowerCase() || "metro";
    if (!UNIDADES.has(unidad)) {
      throw new Error(`unidad_venta "${unidad}" inválida (${[...UNIDADES].join(", ")})`);
    }

    const varPayload = {
      tela_id: telaId,
      sku,
      color_id: colorId,
      precio: numero(fila.precio),
      unidad_venta: unidad,
      piezas_por_unidad: entero(fila.piezas_por_unidad),
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

    // Guardia anti-colapso. Dos filas pueden legítimamente caer en la misma
    // variante: son dos tomas del mismo producto, y entonces traen los MISMOS
    // datos. Si caen en la misma variante con datos distintos, no son dos
    // tomas: son dos productos distintos que van a pisarse — gana el último y
    // los demás quedan como fotos sueltas colgando de una variante ajena.
    //
    // Pasa de verdad con este catálogo: la tienda escribe el mismo código
    // ("#1404") en bolsas de contenido y cantidad distintos, y con SKU vacío
    // la deduplicación por (tela, color) mete todas las bolsas en una. Mejor
    // reventar la fila y que se corrija el CSV que perder productos en
    // silencio.
    const huella = JSON.stringify([sku, modelo, fila.color?.trim() ?? "",
      varPayload.precio, varPayload.piezas_por_unidad, varPayload.unidad_venta]);
    const previa = huellaPorVariante.get(varianteId);
    if (previa && previa.huella !== huella) {
      throw new Error(
        `chocaría con "${previa.archivo}": ambos caen en la misma variante pero ` +
        `con datos distintos. Dales SKU (o modelo) propio en el CSV.`
      );
    }
    huellaPorVariante.set(varianteId, { huella, archivo });
    ctx.contadores.variantes++;

    // 4) subir imagen al bucket (idempotente con upsert) + fila foto
    const ext = path.extname(archivo).toLowerCase();
    const ruta = `${telaSlug}/${slugify(path.basename(archivo, ext))}${ext}`;
    let buffer = await fs.readFile(path.join(dir, archivo));
    let contentType =
      ext === ".webp"
        ? "image/webp"
        : ext === ".png"
        ? "image/png"
        : "image/jpeg";

    if (buffer.length > 4.5 * 1024 * 1024) {
      buffer = await sharp(buffer)
        .resize(3200, 3200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      contentType = "image/webp";
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(ruta, buffer, {
      contentType,
      upsert: true,
    });
    if (upErr) throw new Error(`storage ${ruta}: ${upErr.message}`);

    // `orden` viene del CSV: una variante con varias tomas necesita un orden
    // estable, porque la vista elige foto_principal con `order by orden`.
    // Con todas en 0 la foto de portada la decidiría el desempate por
    // created_at, o sea el azar de la concurrencia de subida.
    const { data: fotoFila, error: fotoErr } = await supabase
      .from("foto")
      .upsert(
        {
          variante_id: varianteId,
          ruta,
          orden: entero(fila.orden) ?? 0,
          alt: `${modelo}${fila.color ? " " + fila.color : ""}`,
        },
        { onConflict: "variante_id,ruta" }
      )
      .select("id")
      .single();
    if (fotoErr || !fotoFila) throw new Error(`foto ${ruta}: ${fotoErr?.message ?? "sin datos"}`);
    ctx.contadores.fotos++;

    // 4b) derivados WebP (sm/md/lg) con el buffer ya en memoria. Si falla
    //     (p.ej. falta la sección 12 del SQL), la foto queda con
    //     derivados=null y `pnpm backfill:derivados` la recoge después.
    try {
      await procesarFoto(supabase, { fotoId: fotoFila.id, ruta, original: buffer });
      ctx.contadores.derivados++;
    } catch (e) {
      ctx.contadores.errores.push(`derivados ${ruta}: ${(e as Error).message}`);
    }

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
  console.log(`   derivados web   : ${c.derivados}${c.derivados < c.fotos ? "  ← faltantes: pnpm backfill:derivados" : ""}`);
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

// ===========================================================================
// MODO VALIDAR
// ===========================================================================
/**
 * Revisa el CSV con las MISMAS reglas que hacen fallar a `--upload`, sin tocar
 * nada. Existe porque la subida es fila por fila contra producción: sin esto,
 * los problemas se descubren a media carga, con parte del lote ya escrito y el
 * resto no. Aquí se ven todos juntos y antes de empezar.
 */
async function modoValidar() {
  const filas = parseCsv(await fs.readFile(flags.out, "utf8"));

  const sinModelo: string[] = [];
  const unidadMala: string[] = [];
  // Clave de la variante a la que caería cada fila, igual que en la subida:
  // por SKU si lo hay, si no por (modelo, color).
  const porVariante = new Map<string, { archivo: string; huella: string }[]>();

  for (const f of filas) {
    const archivo = (f.archivo ?? "").trim();
    if (!archivo) continue;

    const modelo = (f.modelo ?? "").trim();
    if (!modelo) { sinModelo.push(archivo); continue; }

    const unidad = (f.unidad_venta ?? "").trim().toLowerCase() || "metro";
    if (!UNIDADES.has(unidad)) unidadMala.push(`${archivo} → "${unidad}"`);

    const sku = (f.sku ?? "").trim();
    const clave = sku ? `sku:${sku}` : `tela:${slugify(modelo)}|color:${slugify((f.color ?? "").trim())}`;
    const huella = JSON.stringify([
      sku, modelo, (f.color ?? "").trim(),
      numero(f.precio), entero(f.piezas_por_unidad), unidad,
    ]);
    if (!porVariante.has(clave)) porVariante.set(clave, []);
    porVariante.get(clave)!.push({ archivo, huella });
  }

  // Colisión = misma variante con datos distintos. Varias fotos del MISMO
  // producto comparten variante y traen la misma huella: eso es correcto.
  const colisiones = [...porVariante.entries()]
    .map(([clave, fs_]) => ({ clave, fs_, distintas: new Set(fs_.map((x) => x.huella)).size }))
    .filter((c) => c.distintas > 1);

  // En una colisión la PRIMERA fila sí entra (es la que crea la variante y
  // fija la huella); fallan las siguientes. Contarlas todas como perdidas
  // subestimaría lo que de verdad sube.
  const perdidasPorChoque = colisiones.reduce((s, c) => s + c.fs_.length - 1, 0);
  const listas = filas.length - sinModelo.length - perdidasPorChoque;

  console.log("\n🔎 Validación del manifest (nada se sube):");
  console.log(`   filas totales     : ${filas.length}`);
  console.log(`   subirían bien     : ${Math.max(0, listas)}`);
  console.log(`   se saltarían      : ${sinModelo.length} sin 'modelo'`);
  console.log(`   chocarían         : ${perdidasPorChoque} en ${colisiones.length} variante(s)`);

  if (sinModelo.length) {
    console.log(`\n⚠ Sin nombre de producto (${sinModelo.length}) — la subida las rechaza fila por fila:`);
    console.log(`   ${sinModelo.slice(0, 8).join(", ")}${sinModelo.length > 8 ? `, … y ${sinModelo.length - 8} más` : ""}`);
  }
  if (unidadMala.length) {
    console.log(`\n✖ unidad_venta inválida (${unidadMala.length}): ${unidadMala.slice(0, 5).join("; ")}`);
  }
  for (const c of colisiones) {
    console.log(`\n✖ ${c.fs_.length} fotos caerían en la misma variante (${c.clave}) con datos DISTINTOS:`);
    console.log(`   ${c.fs_.slice(0, 4).map((x) => x.archivo).join(", ")}${c.fs_.length > 4 ? `, …` : ""}`);
    console.log(`   → dales SKU propio, o modelo propio, para que sean productos separados.`);
  }
  console.log(sinModelo.length || colisiones.length
    ? "\n👉 Arregla el CSV y vuelve a validar. Cuando salga limpio: pnpm ingest --upload\n"
    : "\n✅ El manifest está listo para pnpm ingest --upload\n");
}

// ---------------------------------------------------------------------------
(async () => {
  if (flags.validar) await modoValidar();
  else if (flags.upload) await modoUpload();
  else await modoManifest();
})().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
