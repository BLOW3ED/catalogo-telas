import { Check } from "lucide-react";

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
      ? "h-12 w-12 rounded-2xl shadow-xs transition-transform hover:scale-105 active:scale-95"
      : size === "sm"
        ? "h-5 w-5 rounded-full shadow-2xs"
        : "h-6 w-6 rounded-full shadow-2xs";

  const lum = luminancia(hex);
  const esClaro = lum > 0.6;
  const marca = lum > 0.4 ? "#0d1b2a" : "#ffffff";

  return (
    <span
      className={`relative inline-flex items-center justify-center border ${shape} ${
        selected
          ? "border-heritage-navy ring-2 ring-heritage-navy ring-offset-2 ring-offset-sand-bg shadow-sm"
          : "border-outline-variant/40"
      } ${esClaro ? "shadow-[inset_0_0_0_1px_rgba(13,27,42,0.12)]" : ""}`}
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

