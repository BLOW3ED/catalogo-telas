import { Sparkles, Scissors, Sun, Eye } from "lucide-react";

export type Atributos = {
  es_bordado?: boolean;
  es_brillante?: boolean;
  es_traslucida?: boolean;
  es_tornasol?: boolean;
};

const BADGES = [
  { key: "es_bordado", label: "Bordado", Icon: Scissors },
  { key: "es_brillante", label: "Brillante", Icon: Sparkles },
  { key: "es_traslucida", label: "Translúcida", Icon: Eye },
  { key: "es_tornasol", label: "Tornasol", Icon: Sun },
] as const;

export function AttributeBadges({ atributos }: { atributos: Atributos }) {
  const activos = BADGES.filter((b) => atributos[b.key]);
  if (activos.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {activos.map(({ key, label, Icon }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded border border-line-strong/30 bg-chip px-2 py-0.5 text-label-caps text-[10px] text-ink-soft"
        >
          <Icon className="h-3 w-3 text-amber" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
