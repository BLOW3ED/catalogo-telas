#!/usr/bin/env tsx
/**
 * Nombres provisionales para subir un lote sin esperar al catálogo definitivo.
 * ===========================================================================
 * `pnpm ingest --upload` rechaza cualquier fila sin `modelo`, porque crear
 * telas con el nombre del archivo llena el catálogo de basura. Pero a veces
 * conviene subir igual —para acomodar los datos desde /admin, que es más
 * cómodo que teclear 150 filas de CSV— y para eso hace falta un nombre.
 *
 * Este script pone uno PROVISIONAL, y lo hace con datos reales, nunca
 * inventados:
 *
 *   · Productos con código: el modelo pasa a ser el CÓDIGO DE LA TIENDA, que
 *     ya venía en `sku`. "BNK2315" se llama "BNK2315" hasta que alguien le
 *     ponga su nombre. No es un nombre bonito, pero no es falso.
 *
 *   · Bolsitas de piedras: comparten modelo y no tienen SKU, así que la
 *     subida las fusionaría en una sola variante. Se les da un modelo propio
 *     armado con lo que dice su etiqueta (código, piezas) más el número de
 *     toma, que es lo único único entre bolsas de la misma etiqueta.
 *
 * Lo que NO hace: inventar SKUs. El SKU se muestra al cliente en la página de
 * producto y en el carrito, y un SKU falso ahí se convierte en un pedido mal
 * levantado. Las filas sin SKU real se quedan sin SKU.
 *
 *   pnpm nombres-provisionales
 * ===========================================================================
 */
import { promises as fs } from "node:fs";

const CSV = process.argv[2] ?? "catalog-manifest.csv";

function partirLinea(l: string): string[] {
  const campos: string[] = [];
  let campo = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"') { if (l[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ",") { campos.push(campo); campo = ""; }
    else campo += c;
  }
  campos.push(campo);
  return campos;
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Número de toma que la cámara pegó al nombre: "BolsitaPiedras00021" → "00021". */
function toma(archivo: string): string {
  const m = /(\d{5})\.[^.]+$/i.exec(archivo);
  return m ? m[1] : "";
}

/** Lo que la etiqueta dejó en `notas`: "etiqueta: código 1404" → "1404". */
function codigoEtiqueta(notas: string): string {
  return /etiqueta: código ([^\s;]+)/.exec(notas)?.[1] ?? "";
}

async function main() {
  const lineas = (await fs.readFile(CSV, "utf8")).trim().split("\n");
  const cols = lineas[0].split(",");
  const i = Object.fromEntries(cols.map((c, n) => [c, n])) as Record<string, number>;

  const puestos: string[] = [];
  const salida = [lineas[0]];

  for (const l of lineas.slice(1)) {
    const c = partirLinea(l);
    const archivo = c[i.archivo];
    const modelo = (c[i.modelo] ?? "").trim();
    const grupo = (c[i.grupo] ?? "").trim();
    const sku = (c[i.sku] ?? "").trim();

    // Bolsitas: ya tienen modelo, pero es el MISMO para las 35 y sin SKU se
    // fusionarían. Se separan por etiqueta + toma.
    if (grupo === "BolsitaPiedras") {
      const cod = codigoEtiqueta(c[i.notas] ?? "");
      const pz = (c[i.piezas_por_unidad] ?? "").trim();
      const partes = ["Bolsa de Piedras"];
      if (cod) partes.push(cod);
      if (pz) partes.push(`${pz} pz`);
      partes.push(toma(archivo));
      c[i.modelo] = partes.filter(Boolean).join(" · ");
      puestos.push(`${archivo} → ${c[i.modelo]}`);
      salida.push(c.map(esc).join(","));
      continue;
    }

    if (modelo) { salida.push(l); continue; }

    // Sin nombre: se usa el código de la tienda, que ya está en `sku`. Si ni
    // eso hay, el grupo — que es el nombre del archivo sin el contador.
    c[i.modelo] = sku || grupo;
    if (c[i.modelo]) puestos.push(`${archivo} → ${c[i.modelo]}`);
    salida.push(c.map(esc).join(","));
  }

  await fs.writeFile(CSV, salida.join("\n") + "\n", "utf8");
  console.log(`\n🏷  Nombres provisionales puestos: ${puestos.length}`);
  console.log("   Son códigos de la tienda, no nombres de catálogo: renómbralos en /admin.");
  console.log(`   Ningún SKU inventado.\n`);
}

main().catch((e) => { console.error("✖", e.message); process.exit(1); });
