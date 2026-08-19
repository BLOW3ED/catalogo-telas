"use client";

import { useGuideStore } from "@/lib/guide-store";

interface TutorialTriggerProps {
  variant?: "hero-banner" | "button" | "pill" | "floating" | "compact";
  className?: string;
}

/**
 * Puerta de entrada al tutorial del catálogo con estilos refinados "Artisanal Modernity".
 */
export function TutorialTrigger({
  variant = "hero-banner",
  className = "",
}: TutorialTriggerProps) {
  const openTutorial = useGuideStore((s) => s.openTutorial);

  if (variant === "hero-banner") {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-accent-copper/40 bg-surface-container-lowest/90 p-4 sm:p-5 shadow-sm backdrop-blur-md transition-all hover:border-accent-copper hover:shadow-md ${className}`}
      >
        {/* Detalle decorativo de fondo */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-accent-copper/10 blur-xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-copper text-white shadow-xs">
              <span className="material-symbols-outlined text-[22px]">help_outline</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-copper">
                  Guía interactiva
                </span>
                <span className="inline-flex items-center rounded-full bg-accent-copper/15 px-2 py-0.5 text-[10px] font-semibold text-accent-copper">
                  4 sencillos pasos
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-heritage-navy sm:text-lg">
                ¿Primera vez?
              </h3>
              <p className="text-xs sm:text-sm text-ink-soft">
                Descubre cómo pedir tu cotización por WhatsApp en 1 minuto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openTutorial}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-heritage-navy px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-deep-slate hover:shadow active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
          >
            <span>Ver cómo pedir</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={openTutorial}
        aria-label="Ver guía: Cómo pedir en 4 pasos"
        className={`group fixed sm:bottom-6 sm:right-6 z-30 hidden sm:flex items-center gap-2.5 rounded-full border border-accent-copper/50 bg-surface-container-lowest/95 px-4 py-2.5 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:border-accent-copper hover:bg-white hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-copper ${className}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-copper text-white shadow-xs group-hover:rotate-12 transition-transform">
          <span className="material-symbols-outlined text-[16px]">help_outline</span>
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-copper">
            ¿Dudas?
          </span>
          <span className="text-xs font-bold text-heritage-navy">
            Cómo pedir (4 pasos)
          </span>
        </div>
      </button>
    );
  }

  if (variant === "compact" || variant === "pill") {
    return (
      <button
        type="button"
        onClick={openTutorial}
        className={`inline-flex items-center gap-2 rounded-full border border-accent-copper/35 bg-surface-container-lowest px-3.5 py-1.5 text-xs font-semibold text-heritage-navy shadow-xs transition-all hover:border-accent-copper hover:bg-surface-container hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${className}`}
      >
        <span className="material-symbols-outlined text-[16px] text-accent-copper">help_outline</span>
        <span>¿Cómo pedir en 4 pasos?</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openTutorial}
      className={`inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-heritage-navy shadow-xs transition-all hover:bg-surface-container hover:border-heritage-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${className}`}
    >
      <span className="material-symbols-outlined text-[18px] text-accent-copper">help_outline</span>
      <span>¿Primera vez? Mira cómo pedir en 4 pasos</span>
    </button>
  );
}
