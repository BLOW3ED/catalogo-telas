#!/usr/bin/env tsx
/**
 * Limpiar duplicados de la resubida webp — Telas La Jalisciense
 * ===========================================================================
 * La resubida de fotos en webp (16/ago) volvió a correr la ingesta con el
 * manifest viejo. Como `pnpm clasificar` ya le había limpiado el nombre a las
 * bolsitas ("Bolsa de Piedras · 1404 · 25 pz · 00021" → "Piedra 1404 · 25 pz ·
 * A"), el upsert de `tela` —que va POR SLUG— no encontró el slug viejo y en
 * vez de actualizar, creó una ficha nueva. Resultado: 35 productos duplicados
 * y 177 fotos repetidas dentro de fichas que sí eran las mismas.
 *
 * Las dos copias de cada imagen son el MISMO archivo: mismo contenido webp,
 * subido dos veces con distinta extensión. El script lo comprueba contra el
 * ETag de Storage antes de borrar nada — no se fía de que los nombres calcen.
 *
 *   1. FICHAS DUPLICADAS — de cada par se conserva la MÁS ANTIGUA, que es la
 *      que `clasificar` ya dejó bien nombrada y categorizada ("Piedra suelta")
 *      y la que trae precio y unidad de venta capturados. Se aborta el par si
 *      la copia a borrar tuviera algún dato que la superviviente no tenga.
 *
 *   2. FOTOS REPETIDAS — de cada par (.jpg/.webp) se conserva una sola fila.
 *      Solo borra FILAS de la tabla `foto`; el archivo en Storage NO se toca,
 *      así que cualquier URL vieja que ande circulando sigue abriendo.
 *
 *   3. NOMBRES QUE SON SOLO CÓDIGO — "BNK1041" no le dice nada a un cliente.
 *      Se le antepone el tipo que ya dice su categoría → "Tira de pedrería
 *      BNK1041". El SLUG NO SE TOCA: /tela/bnk1041 sigue funcionando, así que
 *      los enlaces ya compartidos por WhatsApp no se rompen.
 *
 *   4. MANIFEST — se corrige el `modelo` de las filas duplicadas, porque si no
 *      la próxima ingesta vuelve a crear justo lo que se acaba de borrar.
 *
 *   pnpm limpiar              → SIMULACRO: dice qué haría y no escribe nada
 *   pnpm limpiar --aplicar    → escribe los cambios en la BD Y corrige el manifest
 *
 * Idempotente: correrlo dos veces deja el mismo resultado.
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * ===========================================================================
 */
import { promises as fs } from "node:fs";
import { config as loadEnv } from "dotenv";
import { interpretaBolsita } from "../lib/ingesta/nombres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");
const MANIFEST = "catalog-manifest.csv";

/**
 * El tipo de producto que se le antepone al código, según su categoría. En
 * singular porque nombra UNA pieza, aunque la categoría esté en plural
 * ("Botones" → "Botón BO15"). Una categoría que no esté aquí simplemente no
 * se renombra: prefiero dejar el código crudo que inventarle un nombre.
 */
const TIPO_POR_CATEGORIA: Record<string, string> = {
  "Tira de pedrería": "Tira de pedrería",
  "Cintillo de pedrería": "Cintillo de pedrería",
  "Fleco de pedrería": "Fleco de pedrería",
  "Aplicación de pedrería": "Aplicación de pedrería",
  "Galón de encaje": "Galón de encaje",
  "Piedra suelta": "Piedra",
  Botones: "Botón",
  Corchetes: "Corchete",
  Cierres: "Cierre",
  Copas: "Copa",
  Flores: "Flor",
  Hilos: "Hilo",
  Hebilla: "Hebilla",
  Cinta: "Cinta",
};

/** Un nombre que es puro código de proveedor: "BNK1041", "T4L", "4212". */
const ES_SOLO_CODIGO = /^[A-Z]{0,4}[-\s]?\d{2,7}[A-Z]?$/i;

/** La misma imagen subida como .jpg y como .webp comparte todo menos esto. */
const sinExtension = (ruta: string) => ruta.replace(/\.(webp|jpe?g|png)$/i, "");

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El manifest lleva comas y comillas DENTRO de las notas, así que partir por
 * comas destruiría el archivo. Se parsea y se vuelve a serializar entero para
 * tocar solo las tres columnas que importan y dejar el resto byte por byte.
 */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "", fila: string[] = [], comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila); }
  return filas;
}

/** Solo entrecomilla lo que lo necesita, como venía el archivo original. */
const campoCsv = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const serializaCsv = (filas: string[][]) => filas.map((f) => f.map(campoCsv).join(",")).join("\n") + "\n";

type Foto = { id: string; variante_id: string; ruta: string; orden: number; created_at: string };
type Variante = {
  id: string; tela_id: string; sku: string | null; color_id: string | null;
  precio: number | null; stock: number | null;
};
type Tela = {
  id: string; slug: string; nombre: string; descripcion: string | null;
  created_at: string; categoria: { nombre: string } | null;
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

  const [telasR, variantesR, fotosR] = await Promise.all([
    supabase.from("tela").select("id, slug, nombre, descripcion, created_at, categoria(nombre)"),
    supabase.from("variante").select("id, tela_id, sku, color_id, precio, stock"),
    supabase.from("foto").select("id, variante_id, ruta, orden, created_at"),
  ]);
  for (const r of [telasR, variantesR, fotosR]) {
    if (r.error) { console.error("✖ No se pudo leer la BD:", r.error.message); process.exit(1); }
  }
  const telas = (telasR.data ?? []) as unknown as Tela[];
  const variantes = (variantesR.data ?? []) as unknown as Variante[];
  const fotos = (fotosR.data ?? []) as unknown as Foto[];

  const telaPorId = new Map(telas.map((t) => [t.id, t]));
  const telaDeVariante = new Map(variantes.map((v) => [v.id, v.tela_id]));
  const variantesDeTela = new Map<string, Variante[]>();
  for (const v of variantes) {
    if (!variantesDeTela.has(v.tela_id)) variantesDeTela.set(v.tela_id, []);
    variantesDeTela.get(v.tela_id)!.push(v);
  }

  console.log(
    `\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · ` +
      `${telas.length} telas · ${variantes.length} variantes · ${fotos.length} fotos\n`
  );

  // -------------------------------------------------------------------------
  // ETags de Storage: la prueba de que dos filas apuntan al mismo archivo.
  // Se listan las carpetas (una petición por carpeta) en vez de pedir cada
  // objeto: son ~170 peticiones en vez de ~870, y Storage deja de responder
  // 429 a media corrida.
  // -------------------------------------------------------------------------
  const carpetas = [...new Set(fotos.map((f) => f.ruta.slice(0, f.ruta.lastIndexOf("/"))))];
  const etag = new Map<string, string>();
  let fallos = 0;
  {
    let i = 0;
    const worker = async () => {
      while (i < carpetas.length) {
        const prefix = carpetas[i++];
        let ok = false;
        for (let intento = 0; intento < 6 && !ok; intento++) {
          const res = await fetch(`${url}/storage/v1/object/list/telas`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
          });
          if (res.status === 429) { await dormir(400 * (intento + 1)); continue; }
          if (!res.ok) break;
          for (const o of (await res.json()) as { name: string; metadata?: { eTag?: string } }[]) {
            if (o.metadata?.eTag) etag.set(`${prefix}/${o.name}`, o.metadata.eTag);
          }
          ok = true;
        }
        if (!ok) fallos++;
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }
  if (fallos) {
    console.error(`✖ ${fallos} carpetas de Storage no se pudieron listar. Sin ETags no se`);
    console.error("  puede probar que las copias son iguales, así que no se borra nada.");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 1) Fichas duplicadas
  // -------------------------------------------------------------------------
  console.log("── 1. Fichas duplicadas ──");
  const telasDeImagen = new Map<string, Set<string>>();
  for (const f of fotos) {
    const clave = sinExtension(f.ruta);
    const telaId = telaDeVariante.get(f.variante_id);
    if (!telaId) continue;
    if (!telasDeImagen.has(clave)) telasDeImagen.set(clave, new Set());
    telasDeImagen.get(clave)!.add(telaId);
  }
  const pares = new Map<string, { a: Tela; b: Tela; imagenes: string[] }>();
  for (const [clave, ids] of telasDeImagen) {
    if (ids.size !== 2) continue;
    const [x, y] = [...ids].sort();
    const k = `${x}|${y}`;
    if (!pares.has(k)) pares.set(k, { a: telaPorId.get(x)!, b: telaPorId.get(y)!, imagenes: [] });
    pares.get(k)!.imagenes.push(clave);
  }

  const aBorrar: Tela[] = [];
  for (const { a, b, imagenes } of pares.values()) {
    const [viejo, nuevo] = a.created_at <= b.created_at ? [a, b] : [b, a];

    // Las imágenes tienen que ser el MISMO archivo, no solo llamarse parecido.
    const distintas = imagenes.filter((img) => {
      const tags = fotos.filter((f) => sinExtension(f.ruta) === img).map((f) => etag.get(f.ruta));
      return new Set(tags).size !== 1 || !tags[0];
    });
    if (distintas.length) {
      console.log(`   ⚠ ${nuevo.nombre}: ${distintas.length} imágenes NO son idénticas — se conserva`);
      continue;
    }

    // Nunca borrar la única copia de un dato. Si la ficha condenada tiene algo
    // que la superviviente no tiene, se salta y lo dice: eso lo resuelve una
    // persona, no un script.
    const dv = variantesDeTela.get(viejo.id)?.[0];
    const dn = variantesDeTela.get(nuevo.id)?.[0];
    const perderia: string[] = [];
    if (dn?.precio != null && dv?.precio == null) perderia.push(`precio ${dn.precio}`);
    if (dn?.stock != null && dv?.stock == null) perderia.push(`stock ${dn.stock}`);
    if (dn?.color_id && !dv?.color_id) perderia.push("color");
    if (dn?.sku && !dv?.sku) perderia.push(`sku ${dn.sku}`);
    if (nuevo.descripcion?.trim() && !viejo.descripcion?.trim()) perderia.push("descripción");
    if (perderia.length) {
      console.log(`   ⚠ ${nuevo.nombre}: se saltó, tiene dato propio (${perderia.join(", ")})`);
      continue;
    }

    aBorrar.push(nuevo);
    console.log(`   ✂ ${nuevo.nombre}  [${nuevo.categoria?.nombre ?? "sin categoría"}]`);
    console.log(`     se conserva → ${viejo.nombre}  [${viejo.categoria?.nombre ?? "sin categoría"}]`);
  }
  console.log(`   ${aBorrar.length} fichas por borrar (de ${pares.size} pares detectados)`);

  if (APLICAR && aBorrar.length) {
    // El borrado de `tela` arrastra variante y foto por ON DELETE CASCADE.
    const { error } = await supabase.from("tela").delete().in("id", aBorrar.map((t) => t.id));
    if (error) { console.error(`   ✖ borrando fichas: ${error.message}`); process.exit(1); }
  }

  // -------------------------------------------------------------------------
  // 2) Fotos repetidas dentro de la misma ficha
  // -------------------------------------------------------------------------
  console.log("\n── 2. Fotos repetidas ──");
  const borradas = new Set(aBorrar.map((t) => t.id));
  const grupos = new Map<string, Foto[]>();
  for (const f of fotos) {
    const telaId = telaDeVariante.get(f.variante_id);
    if (!telaId || borradas.has(telaId)) continue; // ya se fue con su ficha
    const k = `${f.variante_id}|${sinExtension(f.ruta)}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(f);
  }

  const fotosABorrar: Foto[] = [];
  let noIdenticas = 0;
  const porProducto = new Map<string, number>();
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const tags = grupo.map((f) => etag.get(f.ruta));
    if (new Set(tags).size !== 1 || !tags[0]) { noIdenticas++; continue; }

    // Se conserva la .webp: el contenido de las dos ES webp, así que la que
    // dice .jpg miente sobre lo que trae. Empate → la más antigua, para que
    // dos corridas elijan siempre la misma.
    const orden = [...grupo].sort((x, y) => {
      const wx = x.ruta.toLowerCase().endsWith(".webp") ? 0 : 1;
      const wy = y.ruta.toLowerCase().endsWith(".webp") ? 0 : 1;
      return wx - wy || x.created_at.localeCompare(y.created_at);
    });
    for (const f of orden.slice(1)) {
      fotosABorrar.push(f);
      const nombre = telaPorId.get(telaDeVariante.get(f.variante_id)!)!.nombre;
      porProducto.set(nombre, (porProducto.get(nombre) ?? 0) + 1);
    }
  }
  [...porProducto.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([n, c]) => console.log(`   ${String(c).padStart(3)}  ${n}`));
  console.log(`   ${fotosABorrar.length} filas de foto por borrar · ${porProducto.size} productos afectados`);
  console.log("   (el archivo en Storage NO se toca: las URLs viejas siguen abriendo)");
  if (noIdenticas) console.log(`   ⚠ ${noIdenticas} pares con contenido distinto — se conservan los dos`);

  if (APLICAR && fotosABorrar.length) {
    for (let i = 0; i < fotosABorrar.length; i += 100) {
      const lote = fotosABorrar.slice(i, i + 100).map((f) => f.id);
      const { error } = await supabase.from("foto").delete().in("id", lote);
      if (error) { console.error(`   ✖ borrando fotos: ${error.message}`); process.exit(1); }
    }
  }

  // -------------------------------------------------------------------------
  // 3) Nombres que son solo código
  // -------------------------------------------------------------------------
  console.log("\n── 3. Nombres que son solo código ──");
  const renombres: { tela: Tela; nombre: string }[] = [];
  const sinRegla: Tela[] = [];
  for (const t of telas) {
    if (borradas.has(t.id)) continue;
    const codigo = t.nombre.trim();
    if (!ES_SOLO_CODIGO.test(codigo)) continue;
    const tipo = TIPO_POR_CATEGORIA[t.categoria?.nombre ?? ""];
    if (!tipo) { sinRegla.push(t); continue; }
    const nombre = `${tipo} ${codigo.toUpperCase()}`;
    if (nombre === t.nombre) continue;
    renombres.push({ tela: t, nombre });
  }
  renombres
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .forEach((r) => console.log(`   ${r.tela.nombre.padEnd(12)} → ${r.nombre}`));
  console.log(`   ${renombres.length} por renombrar · el slug no cambia (los enlaces siguen vivos)`);
  if (sinRegla.length) {
    console.log(`   ${sinRegla.length} sin regla de tipo, se quedan como están:`);
    sinRegla.forEach((t) => console.log(`     · ${t.nombre} [${t.categoria?.nombre ?? "sin categoría"}]`));
  }

  if (APLICAR) {
    for (const { tela, nombre } of renombres) {
      const { error } = await supabase.from("tela").update({ nombre }).eq("id", tela.id);
      if (error) console.error(`   ✖ ${tela.nombre}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4) El manifest, que es de donde vuelven a salir los duplicados
  // -------------------------------------------------------------------------
  // Borrar en la BD no basta: `ingest` hace upsert de `tela` POR SLUG, y el
  // slug sale del `modelo` del CSV. Mientras el manifest diga "Bolsa de
  // Piedras · … · 00021", la próxima ingesta vuelve a crear la ficha que
  // acabamos de borrar. Se corrigen tres columnas por fila:
  //
  //   modelo    → el nombre de la ficha que SÍ se conserva
  //   categoria → "Piedra suelta"; si se quedara en "Pedrería" la ingesta le
  //               repondría a la superviviente la categoría cajón de sastre
  //   notas     → se le guarda el número de cámara ("toma 00021"), que era lo
  //               único que amarraba la fila con la bolsita física y vivía
  //               nada más en el nombre viejo. Va SIN la marca [auto] a
  //               propósito: así `ingest --forzar` lo respeta en vez de
  //               tirarlo junto con lo que dedujo el parser.
  // -------------------------------------------------------------------------
  console.log("\n── 4. Manifest ──");
  const destino = new Map<string, { nombre: string; categoria: string }>();
  for (const { a, b } of pares.values()) {
    const [viejo, nuevo] = a.created_at <= b.created_at ? [a, b] : [b, a];
    if (!aBorrar.some((t) => t.id === nuevo.id)) continue;
    destino.set(nuevo.nombre, {
      nombre: viejo.nombre,
      categoria: viejo.categoria?.nombre ?? "",
    });
  }

  let csvOriginal = "";
  try { csvOriginal = await fs.readFile(MANIFEST, "utf8"); }
  catch { console.log(`   (no se encontró ${MANIFEST}, nada que revisar)`); }

  if (csvOriginal) {
    const filas = parseCsv(csvOriginal);
    const encabezado = filas[0] ?? [];
    const col = (n: string) => encabezado.indexOf(n);
    const iModelo = col("modelo"), iCategoria = col("categoria"), iNotas = col("notas");
    if (iModelo < 0) {
      console.log("   ⚠ el manifest no tiene columna 'modelo'; se deja como está");
    } else {
      let tocadas = 0;
      for (const fila of filas.slice(1)) {
        const meta = destino.get((fila[iModelo] ?? "").trim());
        if (!meta) continue;
        const toma = interpretaBolsita(fila[iModelo].trim())?.toma ?? "";
        const nota = toma ? `toma ${toma}` : "";
        console.log(`   ${fila[iModelo]}`);
        console.log(`     → ${meta.nombre}${nota ? `   ·   nota: ${nota}` : ""}`);
        fila[iModelo] = meta.nombre;
        if (iCategoria >= 0 && meta.categoria) fila[iCategoria] = meta.categoria;
        // Idempotente: si la nota ya está de una corrida anterior, no se repite.
        if (iNotas >= 0 && nota && !(fila[iNotas] ?? "").includes(nota)) {
          fila[iNotas] = fila[iNotas] ? `${fila[iNotas]}; ${nota}` : nota;
        }
        tocadas++;
      }
      if (!tocadas) {
        console.log("   ✓ el manifest ya apunta a las fichas que se conservan");
      } else {
        console.log(`   ${tocadas} filas por corregir (modelo + categoría + nota con el número de cámara)`);
        if (APLICAR) {
          await fs.writeFile(`${MANIFEST}.limpieza.bak`, csvOriginal);
          await fs.writeFile(MANIFEST, serializaCsv(filas));
          console.log(`     ✓ reescrito · respaldo en ${MANIFEST}.limpieza.bak`);
        } else {
          console.log("     (se reescriben al aplicar)");
        }
      }
    }
  }

  console.log(
    `\n${APLICAR ? "Listo." : "Nada de esto se escribió."} ` +
      `Resumen: ${aBorrar.length} fichas · ${fotosABorrar.length} fotos · ${renombres.length} nombres\n`
  );
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
