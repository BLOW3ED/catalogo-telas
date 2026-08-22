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
        onClick={openTutorial}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openTutorial();
          }
        }}
        className={`group relative cursor-pointer overflow-hidden rounded border border-amber/35 bg-surface-container-lowest/90 p-3.5 sm:p-4 shadow-xs backdrop-blur-md transition-all hover:border-amber hover:bg-surface-container-lowest hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${className}`}
      >
        {/* Detalle decorativo de fondo */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber/10 blur-xl transition-opacity group-hover:opacity-100 opacity-60" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber text-white shadow-2xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber truncate">
                  Guía interactiva
                </span>
                <span className="inline-flex items-center rounded bg-amber/15 px-1.5 py-0.2 text-[9px] font-bold text-amber">
                  4 pasos
                </span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-ink-display truncate">
                ¿Primera vez comprando?
              </h3>
              <p className="text-xs text-ink-soft truncate hidden sm:block">
                Aprende cómo cotizar por WhatsApp en 1 min.
              </p>
            </div>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1 rounded bg-surface-container px-3 py-2 text-xs font-bold text-ink-display group-hover:bg-heritage-navy group-hover:text-white transition-colors shadow-2xs">
            <span className="hidden xs:inline sm:inline">Ver guía</span>
            <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </div>
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
        className={`group fixed sm:bottom-6 sm:right-6 z-30 hidden sm:flex items-center gap-2.5 rounded border border-amber/50 bg-surface-container-lowest/95 px-4 py-2.5 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:border-amber hover:bg-white hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${className}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded bg-amber text-white shadow-xs group-hover:rotate-12 transition-transform">
          <span className="material-symbols-outlined text-[16px]">help_outline</span>
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber">
            ¿Dudas?
          </span>
          <span className="text-xs font-bold text-ink-display">
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
        className={`inline-flex items-center gap-2 rounded border border-amber/35 bg-surface-container-lowest px-3.5 py-1.5 text-xs font-semibold text-ink-display shadow-xs transition-all hover:border-amber hover:bg-surface-container hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${className}`}
      >
        <span className="material-symbols-outlined text-[16px] text-amber">help_outline</span>
        <span>¿Cómo pedir en 4 pasos?</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openTutorial}
      className={`inline-flex items-center gap-2 rounded border border-outline-variant/50 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-ink-display shadow-xs transition-all hover:bg-surface-container hover:border-heritage-navy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${className}`}
    >
      <span className="material-symbols-outlined text-[18px] text-amber">help_outline</span>
      <span>¿Primera vez? Mira cómo pedir en 4 pasos</span>
    </button>
  );
}
