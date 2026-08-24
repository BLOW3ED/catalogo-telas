"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { DerivadosFoto } from "@/lib/types";
import { srcsetDerivados, urlDerivado } from "@/lib/supabase/storage";

/**
 * Ancho al que se pinta la foto en el grid del catálogo, medido contra la
 * retícula real (`app/page.tsx`, contenedor `max-w-7xl` con `p-2 sm:p-3` en la
 * card y `p-px` en el marco), no estimado:
 *
 *   ≤1023px  → 2 columnas   (el grid no pasa a 3 hasta `lg:`)  ~40–44vw
 *   1024–1279 → 3 columnas                                      ~28–29vw
 *   1280–1343 → 4 columnas                                      ~21vw
 *   ≥1344px  → 4 columnas con el contenedor TOPADO: ancho FIJO ~282px
 *
 * El valor anterior declaraba `33vw` en la banda de 2 columnas, así que a
 * 1023px y DPR 2 pedía 676px y recibía el derivado `sm` (800) para un hueco de
 * 911 → se veía blando. Y arriba de 1344 pedía `25vw` del viewport completo,
 * bajando el `md` (1600) cuando basta el `sm`.
 */
const SIZES_GRID =
  "(min-width: 1344px) 288px, " +
  "(min-width: 1280px) 22vw, " +
  "(min-width: 1024px) 30vw, " +
  "45vw";

/**
 * Proporción de la ventana. Tiene que ser un mapa de clases COMPLETAS: Tailwind
 * v4 escanea el código fuente buscando literales, así que una clase armada en
 * runtime (`aspect-[${x}]`) compila, pasa los tipos y no existe en el CSS.
 *
 * El default es `cuadrado` porque TODO lo que pinta fotos ya es cuadrado: el
 * grid, la ficha, el carrito y el listado de /admin. Los maestros también lo
 * son —`lib/images/recorte.ts` entrega siempre un cuadrado y el curador de
 * /admin recorta a 1:1—, así que la ventana enseña la foto ÍNTEGRA y lo que
 * se encuadró es literalmente lo que se ve.
 *
 * El default era `retrato`, de cuando la card era 3:4, y sobrevivió al cambio:
 * `object-cover` en 3:4 descarta 12.5% del ancho por lado, y la miniatura del
 * listado de /admin —el único punto que no pasaba `aspecto`— recortaba en
 * silencio lo que el admin acababa de encuadrar a mano. `retrato` sigue
 * disponible para una ventana que de verdad lo sea, pero ya nadie lo pide.
 */
const ASPECTOS = {
  retrato: "aspect-[3/4]",
  cuadrado: "aspect-square",
  libre: "h-full",
} as const;

export type AspectoTelaImage = keyof typeof ASPECTOS;

/**
 * Imagen de tela con skeleton mientras carga (lazy por defecto).
 *
 * Con `derivados` (foto ya procesada por el pipeline) usa <img srcset> directo
 * a los WebP del CDN de Supabase: los bytes calibrados (sharpening, sRGB)
 * llegan al navegador SIN recompresión del optimizador de Next, y no consumen
 * cuota de transformaciones de Vercel. Sin `derivados` cae a next/image sobre
 * el original (fotos aún no procesadas → corre `pnpm backfill:derivados`).
 */
export function TelaImage({
  src,
  alt,
  derivados,
  sizes = SIZES_GRID,
  priority = false,
  aspecto = "cuadrado",
}: {
  src: string | null;
  alt: string;
  derivados?: DerivadosFoto | null;
  /** Cómo se renderiza según viewport (para elegir el derivado correcto). */
  sizes?: string;
  priority?: boolean;
  /** Proporción de la ventana; el default 1:1 es el de todo el catálogo. */
  aspecto?: AspectoTelaImage;
}) {
  const [loaded, setLoaded] = useState(false);
  const proporcion = ASPECTOS[aspecto];

  if (!src) {
    return (
      <div className={`flex ${proporcion} w-full items-center justify-center rounded-t bg-line/50 text-ink-soft`}>
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  const srcSet = srcsetDerivados(derivados);
  const clase = `object-cover transition-opacity duration-500 ${
    loaded ? "opacity-100" : "opacity-0"
  }`;

  return (
    <div className={`relative ${proporcion} w-full overflow-hidden rounded-t bg-line/40`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-line/60" />}
      {srcSet ? (
        // eslint-disable-next-line @next/next/no-img-element -- srcset directo a los derivados WebP: evita la recompresión de next/image a propósito
        <img
          src={urlDerivado(derivados, "md") ?? src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            // Imagen ya en caché al hidratar: onLoad no dispara → apagar skeleton.
            if (el?.complete && !loaded) setLoaded(true);
          }}
          className={`absolute inset-0 h-full w-full ${clase}`}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={clase}
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            // Mismo catch-up que la rama <img> de arriba: si next/image ya
            // resolvió la imagen desde caché al hidratar, onLoad no dispara
            // y el skeleton se queda pegado en opacity-0 para siempre.
            if (el?.complete && !loaded) setLoaded(true);
          }}
        />
      )}
    </div>
  );
}
