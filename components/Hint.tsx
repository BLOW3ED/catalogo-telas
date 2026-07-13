"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useGuideStore } from "@/lib/guide-store";

/**
 * Coach-mark / nota contextual estilizada.
 *
 * Recuadro ámbar suave con una pista corta y clara. Puede llevar una flechita
 * que apunta al elemento que explica. Si `id` está definido, es descartable
 * ("Entendido") y no vuelve a aparecer (se recuerda en localStorage vía
 * guide-store). Sin `id`, es una nota permanente.
 *
 * Ejemplo:
 *   <Hint id="detalle-color" arrow="down">
 *     Puedes cambiar el color picando estos botones.
 *   </Hint>
 */
export function Hint({
  id,
  children,
  arrow = "none",
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  arrow?: "up" | "down" | "none";
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const dismissedHints = useGuideStore((s) => s.dismissedHints);
  const dismissHint = useGuideStore((s) => s.dismissHint);

  useEffect(() => setMounted(true), []);

  // Evita parpadeo/mismatch de hidratación: nada hasta montar en cliente.
  if (!mounted) return null;
  if (id && dismissedHints.includes(id)) return null;

  return (
    <div className={`relative ${className}`}>
      {arrow === "up" && <Arrow direction="up" />}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber/25 bg-amber/5 px-3.5 py-2.5 text-sm text-ink shadow-sm">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
        <p className="flex-1 leading-snug">{children}</p>
        {id && (
          <button
            type="button"
            onClick={() => dismissHint(id)}
            className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-amber/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Entendido, ocultar esta pista"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {arrow === "down" && <Arrow direction="down" />}
    </div>
  );
}

/** Triangulito que apunta al elemento explicado. */
function Arrow({ direction }: { direction: "up" | "down" }) {
  const pos =
    direction === "up"
      ? "-top-1.5 border-b border-l"
      : "-bottom-1.5 border-t border-r";
  return (
    <span
      aria-hidden
      className={`absolute left-6 h-3 w-3 rotate-45 border-amber/25 bg-amber/5 ${pos}`}
    />
  );
}
