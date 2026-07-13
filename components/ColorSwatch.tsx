import { Check } from "lucide-react";

/**
 * Muestra el hex real del color, desde la tabla `color`.
 * - `sm`/`md`: punto redondo (cards, listas compactas).
 * - `lg`: cuadro de 48px casi recto, como los "Available Tones" del detalle.
 *
 * Accesibilidad (WCAG 1.4.1): el estado seleccionado no depende solo del
 * color — además del aro añil lleva una palomita cuyo tono (tinta o blanco)
 * se decide por la luminancia del hex para que contraste sobre cualquier
 * tela. Los tonos claros (crema, blanco) reciben un aro interior sutil para
 * no fundirse con el fondo marfil. `agotado` cruza el swatch en diagonal.
 */

/** Luminancia relativa WCAG del hex (0 = negro, 1 = blanco). */
function luminancia(hex: string | null): number {
  if (!hex) return 1;
  const h = hex.replace("#", "");
  if (h.length !== 6) return 1;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ColorSwatch({
  hex,
  nombre,
  size = "md",
  selected = false,
  agotado = false,
}: {
  hex: string | null;
  nombre: string | null;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  agotado?: boolean;
}) {
  const shape =
    size === "lg"
      ? "h-12 w-12 rounded"
      : size === "sm"
        ? "h-5 w-5 rounded-full"
        : "h-6 w-6 rounded-full";

  const lum = luminancia(hex);
  const esClaro = lum > 0.6;
  // Palomita/diagonal: tinta sobre telas claras, blanco sobre oscuras.
  const marca = lum > 0.4 ? "#1b1e26" : "#ffffff";

  return (
    <span
      className={`relative inline-flex items-center justify-center border ${shape} ${
        selected
          ? "border-line-strong/60 ring-2 ring-primary ring-offset-1 ring-offset-bg"
          : "border-line-strong/60"
      } ${esClaro ? "shadow-[inset_0_0_0_1px_rgba(27,30,38,0.12)]" : ""}`}
      style={{ backgroundColor: hex ?? "transparent" }}
      title={nombre ?? undefined}
      aria-label={nombre ?? "color"}
      aria-disabled={agotado || undefined}
    >
      {selected && !agotado && (
        <Check
          className={size === "lg" ? "h-5 w-5" : "h-3 w-3"}
          style={{ color: marca }}
          strokeWidth={3}
          aria-hidden
        />
      )}
      {agotado && (
        <span
          className="absolute left-1/2 top-1/2 h-[130%] w-px -translate-x-1/2 -translate-y-1/2 rotate-45"
          style={{ backgroundColor: marca, opacity: 0.7 }}
          aria-hidden
        />
      )}
    </span>
  );
}
