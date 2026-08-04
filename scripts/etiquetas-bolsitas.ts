#!/usr/bin/env tsx
/**
 * Etiquetas manuscritas de las bolsitas de piedras — lote de agosto 2026.
 * ===========================================================================
 * En este grupo el código, la cantidad y el precio NO están en el nombre del
 * archivo: están escritos a mano en una etiqueta dentro de la bolsa, y se
 * leyeron de la foto una por una. Es dato que ningún parser puede recuperar,
 * así que vive aquí versionado en vez de solo dentro del CSV, que se regenera.
 *
 * Vuelca los datos sobre `catalog-manifest.csv`. Idempotente: correrlo dos
 * veces deja el mismo resultado.
 *
 *   pnpm tsx scripts/etiquetas-bolsitas.ts
 *
 * TODO de la tienda: el código de la etiqueta se REPITE entre bolsas de
 * contenido distinto (el "1404" aparece en ~20), así que no sirve como SKU
 * único. Por eso `sku` se deja vacío. Hasta que cada bolsa tenga el suyo, la
 * subida las rechaza con el error de colisión en vez de fusionarlas.
 * ===========================================================================
 */
import { promises as fs } from "node:fs";

/** [código de etiqueta, piezas, precio MXN, aviso] — null = la etiqueta no lo dice. */
const ETIQUETAS: Record<string, [string | null, number | null, number | null, string?]> = {
  BolsitaPiedras00009: ["B9301", 12, 42],
  BolsitaPiedras00010: ["1404", 50, 18],
  BolsitaPiedras00013: ["1404", 35, 18],
  BolsitaPiedras00015: ["1404", 50, 18],
  BolsitaPiedras00016: ["1404", 50, 18],
  BolsitaPiedras00017: ["1404", 26, 18],
  BolsitaPiedras00018: ["1404", 26, 18],
  BolsitaPiedras00020: ["1404", 35, 18],
  BolsitaPiedras00021: ["1404", 25, 18],
  BolsitaPiedras00022: ["1404", 60, 18],
  BolsitaPiedras00023: ["1404", 25, 18, "precio poco legible: podría ser $78"],
  BolsitaPiedras00024: ["9301", 12, 42],
  BolsitaPiedras00025: [null, 25, null, "etiqueta solo dice cantidad"],
  BolsitaPiedras00026: ["1404", 25, 18],
  BolsitaPiedras00027: ["1404", 35, 18],
  BolsitaPiedras00028: ["1404", 50, 18],
  BolsitaPiedras00029: ["1404", 25, 18],
  BolsitaPiedras00030: ["B1403", 12, 30],
  BolsitaPiedras00031: [null, null, null, "etiqueta solo dice 'Bolsa Piedra'"],
  BolsitaPiedras00032: ["1404", 25, 18],
  BolsitaPiedras00033: ["1404", null, 18, "etiqueta sin cantidad"],
  BolsitaPiedras00035: ["1404", 35, 18],
  BolsitaPiedras00037: ["1404", 25, 18],
  BolsitaPiedras00038: ["1404", 30, 18],
  BolsitaPiedras00039: ["1404", 25, 18],
  BolsitaPiedras00040: [null, null, null, "etiqueta no visible en la toma"],
  BolsitaPiedras00041: ["1404", 15, 18],
  BolsitaPiedras00042: ["1404", 25, 18],
  BolsitaPiedras00043: ["BBE25", 6, 25],
  BolsitaPiedras00044: ["B8440", 6, 18],
  BolsitaPiedras00046: ["BAC1", 6, 9],
  BolsitaPiedras00047: [null, null, null, "etiqueta no visible en la toma"],
  BolsitaPiedras00048: ["BPL18C", 12, 10],
  BolsitaPiedras00049: ["BD12", 12, 12],
  BolsitaPiedras00050: ["B1403", 12, 30],
};

const CSV = process.argv[2] ?? "catalog-manifest.csv";

function partirLinea(l: string): string[] {
  const campos: string[] = [];
  let campo = "", enComillas = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (enComillas) {
      if (c === '"') { if (l[i + 1] === '"') { campo += '"'; i++; } else enComillas = false; }
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { campos.push(campo); campo = ""; }
    else campo += c;
  }
  campos.push(campo);
  return campos;
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function main() {
  const lineas = (await fs.readFile(CSV, "utf8")).trim().split("\n");
  const cols = lineas[0].split(",");
  const i = Object.fromEntries(cols.map((c, n) => [c, n])) as Record<string, number>;

  let tocadas = 0;
  const salida = [lineas[0]];
  for (const l of lineas.slice(1)) {
    const c = partirLinea(l);
    const et = ETIQUETAS[c[i.archivo].replace(/\.jpg$/i, "")];
    if (et) {
      const [codigo, piezas, precio, aviso] = et;
      c[i.modelo] = "Bolsa de Piedras";
      c[i.categoria] = "Pedrería";
      c[i.unidad_venta] = "bolsa";
      c[i.color] = "";
      if (piezas != null) c[i.piezas_por_unidad] = String(piezas);
      if (precio != null) c[i.precio] = String(precio);

      // Las notas del parser van marcadas [auto] y las regenera la ingesta;
      // éstas no llevan marca justamente para que las conserve.
      const mias = [
        codigo ? `etiqueta: código ${codigo}` : "etiqueta sin código",
        piezas != null && precio != null ? `${piezas} pz $${precio}` : "",
        aviso ?? "",
        "LEÍDO DE LA FOTO — CONFIRMAR antes de subir",
        "sku vacío a propósito: el código se repite entre bolsas distintas",
      ].filter(Boolean);
      const previas = c[i.notas].split(";").map((s) => s.trim())
        .filter((s) => s.startsWith("[auto]"));
      c[i.notas] = [...previas, ...mias].join("; ");
      tocadas++;
    }
    salida.push(c.map(esc).join(","));
  }

  await fs.writeFile(CSV, salida.join("\n") + "\n", "utf8");
  console.log(`\n🏷  Etiquetas volcadas en ${CSV}: ${tocadas}/${Object.keys(ETIQUETAS).length} bolsitas`);
  console.log("   Los precios están LEÍDOS DE FOTO: confírmalos antes de subir.\n");
}

main().catch((e) => { console.error("✖", e.message); process.exit(1); });
