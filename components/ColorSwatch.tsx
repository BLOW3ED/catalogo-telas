/**
 * Muestra el hex real del color, desde la tabla `color`.
 * - `sm`/`md`: punto redondo (cards, listas compactas).
 * - `lg`: cuadro de 48px casi recto, como los "Available Tones" del detalle.
 */
export function ColorSwatch({
  hex,
  nombre,
  size = "md",
  selected = false,
}: {
  hex: string | null;
  nombre: string | null;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
}) {
  const shape =
    size === "lg"
      ? "h-12 w-12 rounded"
      : size === "sm"
        ? "h-4 w-4 rounded-full"
        : "h-6 w-6 rounded-full";
  return (
    <span
      className={`inline-block border ${shape} ${
        selected
          ? "ring-2 ring-amber ring-offset-1 ring-offset-bg border-line-strong/30"
          : "border-line-strong/30"
      }`}
      style={{ backgroundColor: hex ?? "transparent" }}
      title={nombre ?? undefined}
      aria-label={nombre ?? "color"}
    />
  );
}
