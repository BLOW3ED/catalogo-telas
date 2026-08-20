#!/usr/bin/env tsx
/**
 * Hoja de contactos del bucket — Telas La Jalisciense
 * ===========================================================================
 * La curaduría de este catálogo se hace ABRIENDO cada foto: ningún script
 * deduce del nombre de archivo si una pieza es tira o aplicación, ni de qué
 * color es. Revisar 90 fotos de una en una, sin embargo, se vuelve el cuello
 * de botella. Esto arma una rejilla etiquetada con los derivados del bucket
 * para poder mirarlas de corrido y luego hacer zoom solo donde haga falta.
 *
 * Dos detalles que sí importan para no equivocarse mirando:
 *   · `--exposicion=N` multiplica los tres canales RGB por igual (`linear`),
 *     igual que `pnpm preparar --exposicion`. Las tomas de mercería van sobre
 *     fondo negro y subexpuestas; sin subirlas no se distingue la figura. Al
 *     escalar los canales por igual el MATIZ no se mueve, así que el color
 *     sigue siendo el del producto (ver `fidelidad-de-color-fotos`).
 *   · `--celda` grande + derivados `md` es lo que separa dos diseños que en
 *     miniatura parecen el mismo. En `dividir-motivos` tres fichas se habrían
 *     inventado por no hacer ese zoom.
 *
 *   pnpm hoja:contactos --lista=<archivo.tsv> --out=<salida.png> [--cols=4]
 *                       [--celda=380] [--exposicion=1]
 *
 * El TSV lleva por línea: <etiqueta><TAB><ruta dentro del bucket `telas`>.
 * Las descargas se cachean en /tmp para no volver a bajar lo mismo.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const arg = (n: string, def?: string) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? def;

const CACHE = "/tmp/hoja-contactos-cache";
const ETIQUETA = 34;

async function main() {
  const lista = arg("lista");
  const salida = arg("out");
  if (!lista || !salida) {
    console.error("Uso: pnpm hoja:contactos --lista=<archivo.tsv> --out=<salida.png> [--cols=4] [--celda=380] [--exposicion=1]");
    process.exit(1);
  }
  const cols = Number(arg("cols", "4"));
  const celda = Number(arg("celda", "380"));
  const exposicion = Number(arg("exposicion", "1"));

  const sharp = (await import("sharp")).default;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/telas/`;
  mkdirSync(CACHE, { recursive: true });

  const filas = readFileSync(lista, "utf8").trim().split("\n")
    .map((l) => l.split("\t")).filter((p) => p.length >= 2 && p[1].trim());

  const celdas: Buffer[] = [];
  for (const [etiqueta, ruta] of filas) {
    const local = join(CACHE, ruta.replace(/[/]/g, "_"));
    if (!existsSync(local)) {
      const res = await fetch(base + ruta);
      if (!res.ok) { console.error(`   ✖ ${ruta} → ${res.status}`); continue; }
      writeFileSync(local, Buffer.from(await res.arrayBuffer()));
    }
    let img = sharp(local, { autoOrient: true }).resize(celda, celda, { fit: "contain", background: "#ffffff" });
    if (exposicion !== 1) img = img.linear(exposicion, 0);
    const foto = await img.toColorspace("srgb").png().toBuffer();
    const texto = etiqueta.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = Buffer.from(
      `<svg width="${celda}" height="${ETIQUETA}"><rect width="100%" height="100%" fill="#1A1714"/>` +
      `<text x="8" y="23" font-family="Helvetica,Arial" font-size="17" fill="#FAF8F5">${texto}</text></svg>`
    );
    celdas.push(await sharp({ create: { width: celda, height: celda + ETIQUETA, channels: 3, background: "#ffffff" } })
      .composite([{ input: foto, top: 0, left: 0 }, { input: svg, top: celda, left: 0 }]).png().toBuffer());
  }

  const filasN = Math.ceil(celdas.length / cols);
  await sharp({ create: { width: cols * celda, height: filasN * (celda + ETIQUETA), channels: 3, background: "#ffffff" } })
    .composite(celdas.map((input, i) => ({
      input, left: (i % cols) * celda, top: Math.floor(i / cols) * (celda + ETIQUETA),
    })))
    .png().toFile(salida);
  console.log(`✓ ${salida} — ${celdas.length} foto(s), ${cols}×${filasN}, celda ${celda}px, exposición ${exposicion}`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
