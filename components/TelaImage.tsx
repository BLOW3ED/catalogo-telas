"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Imagen de tela con skeleton mientras carga (lazy por defecto).
 * `sizes` le dice a next/image qué resolución servir según el viewport,
 * evitando descargar imágenes enormes en móvil.
 */
export function TelaImage({
  src,
  alt,
  priority = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-t-2xl bg-line/50 text-ink/30">
        <ImageOff className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-2xl bg-line/40">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-line/60" />}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={`object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
