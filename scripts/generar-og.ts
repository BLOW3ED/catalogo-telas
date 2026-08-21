#!/usr/bin/env tsx
/**
 * Tarjeta de OpenGraph — Telas La Jalisciense
 * ===========================================================================
 * Compone `app/opengraph-image.png` (1200×630) a partir del logo de la marca:
 * fondo negro, monograma dorado, nombre de la tienda y bajada.
 *
 *   pnpm og            → regenera la tarjeta
 *   pnpm og --ver      → la escribe en /tmp para revisarla sin pisar la buena
 *
 * Es la miniatura que sale cuando alguien pega el enlace del catálogo en
 * WhatsApp — el canal por el que se comparte de verdad. Las páginas de tela
 * NO usan esta imagen: `app/tela/[slug]/page.tsx` arma su propio `openGraph`
 * con la foto del producto, que es más útil para una tela concreta.
 *
 * El monograma es 2.13:1 y el PNG original lo trae dentro de un lienzo
 * cuadrado con ~60% de negro vacío, así que aquí se recorta a su caja real
 * (los mismos números que `public/logo-jalisciense-marca.webp`) antes de
 * componer. El fondo del logo es negro puro (0,0,0), igual que el lienzo, así
 * que el composite no deja recuadro visible.
 *
 * La tipografía es la del sistema (Helvetica Neue), no Hanken Grotesk: esto
 * se renderiza con librsvg vía sharp, que resuelve fuentes instaladas y no
 * lee los .woff2 que `next/font` descarga al build. Es un activo estático que
 * se genera una vez, no UI, y a este tamaño la diferencia no se nota.
 * ===========================================================================
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { dirname } from "node:path";

/** Caja real del monograma dentro de `public/logo-jalisciense.png`. */
const RECORTE = { left: 56, top: 311, width: 1090, height: 560 };

const LIENZO = { ancho: 1200, alto: 630 }; // 1.91:1, el estándar de OpenGraph.
const LOGO_ANCHO = 520;

/** Tokens de `app/globals.css`, para que la tarjeta no invente su paleta. */
const COLOR = {
  fondo: "#000000", // el propio fondo del logo
  nombre: "#F1EDE2", // --color-sand-bg
  // --color-amber (#7A4E0D) aclarado. El token tal cual da 2.9:1 sobre negro:
  // se ve lodoso y la bajada no pasa AA. Mismo matiz (36°) y misma saturación,
  // solo más luz → 5.6:1. Aclarar por HSL es lo único que sube el contraste
  // SIN mover el tono; tocar los canales por separado lo viraría a naranja.
  mostaza: "#B87614",
};

const NOMBRE = "TELAS LA JALISCIENSE";
const BAJADA = "Telas finas, encajes y mercería · Fresnillo";

const FUENTE = "Helvetica Neue, Helvetica, Arial, sans-serif";

/** Escapa lo que va dentro de un nodo de texto SVG. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const soloVer = process.argv.includes("--ver");
  const salida = soloVer ? "/tmp/og-telas-jalisciense.png" : "app/opengraph-image.png";

  const logo = await sharp("public/logo-jalisciense.png")
    .extract(RECORTE)
    .resize(LOGO_ANCHO)
    .toBuffer();

  // El bloque va centrado ópticamente contando el aire que el logo trae
  // dentro del archivo (~11% arriba y abajo), no el alto de la imagen.
  const texto = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LIENZO.ancho}" height="${LIENZO.alto}">
      <text x="600" y="436" text-anchor="middle" font-family="${FUENTE}"
            font-size="54" font-weight="700" letter-spacing="6" fill="${COLOR.nombre}">${esc(NOMBRE)}</text>
      <rect x="510" y="466" width="180" height="2" fill="${COLOR.mostaza}"/>
      <text x="600" y="516" text-anchor="middle" font-family="${FUENTE}"
            font-size="28" font-weight="500" fill="${COLOR.mostaza}">${esc(BAJADA)}</text>
    </svg>`
  );

  await mkdir(dirname(salida), { recursive: true });

  await sharp({
    create: {
      width: LIENZO.ancho,
      height: LIENZO.alto,
      channels: 3,
      background: COLOR.fondo,
    },
  })
    .composite([
      { input: logo, left: Math.round((LIENZO.ancho - LOGO_ANCHO) / 2), top: 78 },
      { input: texto, left: 0, top: 0 },
    ])
    // PNG y no JPEG: el texto sobre negro plano es justo donde se ven los
    // artefactos de compresión, y 115 KB entra de sobra en cualquier scraper.
    .png({ compressionLevel: 9 })
    .toFile(salida);

  const kb = Math.round(statSync(salida).size / 1024);
  console.log(`✓ ${salida} — ${LIENZO.ancho}×${LIENZO.alto}, ${kb} KB`);
  if (soloVer) console.log("  (prueba: no se tocó app/opengraph-image.png)");
}

main().catch((e) => {
  console.error("✗ No se pudo generar la tarjeta:", e);
  process.exit(1);
});
