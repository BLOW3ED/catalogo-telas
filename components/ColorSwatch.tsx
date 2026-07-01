/** Círculo con el hex real del color, desde la tabla `color`. */
export function ColorSwatch({
  hex,
  nombre,
  size = "md",
  selected = false,
}: {
  hex: string | null;
  nombre: string | null;
  size?: "sm" | "md";
  selected?: boolean;
}) {
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <span
      className={`inline-block rounded-full border ${dim} ${
        selected ? "ring-2 ring-amber ring-offset-1" : "border-line"
      }`}
      style={{ backgroundColor: hex ?? "transparent" }}
      title={nombre ?? undefined}
      aria-label={nombre ?? "color"}
    />
  );
}
