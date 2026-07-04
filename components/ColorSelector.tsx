"use client";

import { useRouter, usePathname } from "next/navigation";
import { ColorSwatch } from "@/components/ColorSwatch";
import type { CatalogoTela } from "@/lib/types";

/**
 * Selector de color de un modelo. El estado vive en la URL (`?color=<slug>`)
 * para que el link sea compartible y el Server Component re-renderice la
 * variante correcta (foto/precio/SKU) en cada cambio. Por eso aquí solo
 * navegamos: no guardamos estado local.
 */
export function ColorSelector({
  variantes,
  selectedSlug,
}: {
  variantes: CatalogoTela[];
  selectedSlug: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Solo variantes con color real (las sin color no aportan swatch).
  const conColor = variantes.filter((v) => v.color_slug && v.color_hex);
  if (conColor.length < 2) return null;

  function seleccionar(slug: string) {
    router.replace(`${pathname}?color=${encodeURIComponent(slug)}`, {
      scroll: false,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b border-line-strong/30 pb-2">
        <p className="text-label-caps text-xs text-ink-deep">
          Tonos disponibles
        </p>
        <span className="text-sm text-ink-soft">
          {variantes.find((v) => v.color_slug === selectedSlug)?.color_nombre ??
            ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        {conColor.map((v) => (
          <button
            key={v.color_slug}
            type="button"
            onClick={() => seleccionar(v.color_slug!)}
            aria-label={`Ver color ${v.color_nombre}`}
            aria-pressed={v.color_slug === selectedSlug}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2"
          >
            <ColorSwatch
              hex={v.color_hex}
              nombre={v.color_nombre}
              size="lg"
              selected={v.color_slug === selectedSlug}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
