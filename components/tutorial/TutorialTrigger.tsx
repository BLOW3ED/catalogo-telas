"use client";

import { HelpCircle } from "lucide-react";
import { useGuideStore } from "@/lib/guide-store";

/**
 * Enlace discreto para abrir el tutorial desde dentro de la página.
 *
 * El header ya tiene "Ayuda", pero un icono en la esquina es fácil de no ver.
 * Esta es la puerta de entrada en el cuerpo del catálogo: una línea de texto,
 * sin caja ni fondo, que no le pelea espacio a las telas.
 */
export function TutorialTrigger({ className = "" }: { className?: string }) {
  const openTutorial = useGuideStore((s) => s.openTutorial);

  return (
    <button
      type="button"
      onClick={openTutorial}
      className={`inline-flex items-center gap-1.5 rounded text-sm text-ink-soft underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden />
      ¿Primera vez? Mira cómo pedir en 4 pasos
    </button>
  );
}
