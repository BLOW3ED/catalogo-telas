"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { DerivadosFoto } from "@/lib/types";
import { srcsetDerivados, urlDerivado } from "@/lib/supabase/storage";

const SIZES_GRID = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

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
}: {
  src: string | null;
  alt: string;
  derivados?: DerivadosFoto | null;
  /** Cómo se renderiza según viewport (para elegir el derivado correcto). */
  sizes?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-t-2xl bg-line/50 text-ink-soft">
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  const srcSet = srcsetDerivados(derivados);
  const clase = `object-cover transition-opacity duration-500 ${
    loaded ? "opacity-100" : "opacity-0"
  }`;

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-line/40">
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
        />
      )}
    </div>
  );
}
