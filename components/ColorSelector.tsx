"use client";

import { useTransition, useOptimistic } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ColorSwatch } from "@/components/ColorSwatch";
import type { CatalogoTela } from "@/lib/types";

/**
 * Selector de color de un modelo. El estado vive en la URL (`?color=<slug>`)
 * para que el link sea compartible y el Server Component re-renderice la
 * variante correcta (foto/precio/SKU) en cada cambio.
 *
 * `useTransition` + `useOptimistic`: el aro y la palomita se mueven al swatch
 * tapeado de inmediato (y el grupo baja de opacidad mientras llega el
 * re-render del servidor). Sin esto, en red lenta el tap "no hace nada" y la
 * gente pica dos veces.
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
  const [isPending, startTransition] = useTransition();
  const [optimisticSlug, setOptimisticSlug] = useOptimistic(selectedSlug);

  // Solo variantes con color real (las sin color no aportan swatch).
  const conColor = variantes.filter((v) => v.color_slug && v.color_hex);
  if (conColor.length < 2) return null;

  const seleccionada = variantes.find((v) => v.color_slug === optimisticSlug);

  function seleccionar(slug: string) {
    startTransition(() => {
      setOptimisticSlug(slug);
      router.replace(`${pathname}?color=${encodeURIComponent(slug)}`, {
        scroll: false,
      });
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b border-line-strong/30 pb-2">
        <p className="text-label-caps text-sm text-ink-deep">
          Tonos disponibles
        </p>
        <span className="text-base font-medium text-ink" aria-live="polite">
          {seleccionada?.color_nombre ?? ""}
        </span>
      </div>
      <div
        className={`flex flex-wrap gap-4 transition-opacity ${
          isPending ? "opacity-60" : ""
        }`}
      >
        {conColor.map((v) => (
          <button
            key={v.color_slug}
            type="button"
            onClick={() => seleccionar(v.color_slug!)}
            aria-label={
              v.stock === 0
                ? `Color ${v.color_nombre} (sin existencia)`
                : `Ver color ${v.color_nombre}`
            }
            aria-pressed={v.color_slug === optimisticSlug}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ColorSwatch
              hex={v.color_hex}
              nombre={v.color_nombre}
              size="lg"
              selected={v.color_slug === optimisticSlug}
              agotado={v.stock === 0}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
