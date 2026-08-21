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
    <div className="flex flex-wrap gap-1.5 pt-0.5">
      {activos.map(({ key, label, Icon }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-1 text-xs font-bold text-ink-display shadow-2xs"
        >
          <Icon className="h-3.5 w-3.5 text-amber" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

