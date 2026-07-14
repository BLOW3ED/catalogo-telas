"use client";

import { HelpCircle } from "lucide-react";
import { useGuideStore } from "@/lib/guide-store";

/**
 * Puerta de entrada al tutorial desde el cuerpo del catálogo.
 *
 * El header ya tiene "Ayuda", pero un icono en la esquina es fácil de no ver.
 * Se ve como chip/botón (borde + fondo) para que se lea como accionable a
 * primera vista, no como una línea de texto suelta.
 */
export function TutorialTrigger({ className = "" }: { className?: string }) {
  const openTutorial = useGuideStore((s) => s.openTutorial);

  return (
    <button
      type="button"
      onClick={openTutorial}
      className={`inline-flex items-center gap-2 rounded border border-line-strong/40 bg-chip px-4 py-2 text-sm font-medium text-ink-soft shadow-sm transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden />
      ¿Primera vez? Mira cómo pedir en 4 pasos
    </button>
  );
}
