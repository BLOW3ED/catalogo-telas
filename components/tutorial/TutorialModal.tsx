"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ArrowRight, Sparkles } from "lucide-react";
import { useGuideStore } from "@/lib/guide-store";
import { Button } from "@/components/ui/Button";
import {
  MaquetaBuscar,
  MaquetaColor,
  MaquetaMetros,
  MaquetaWhatsapp,
} from "@/components/tutorial/Maquetas";

/**
 * TUTORIAL del catálogo — modal de slides con maquetas.
 * Rediseñado con la estética "Artisanal Modernity" (Atelier Textil).
 */

type Slide = {
  maqueta: () => React.ReactElement;
  etiqueta: string;
  titulo: string;
  texto: string;
};

const SLIDES: Slide[] = [
  {
    maqueta: MaquetaBuscar,
    etiqueta: "Paso 1 · Exploración",
    titulo: "Busca o explora a tu ritmo",
    texto:
      "Escribe el nombre, color o uso de tela que buscas. O desliza hacia abajo para recorrer todo nuestro catálogo selecto.",
  },
  {
    maqueta: MaquetaColor,
    etiqueta: "Paso 2 · Selección de Tono",
    titulo: "Elige el color ideal",
    texto:
      "Toca cualquier tela para verla a detalle. Cambia de tono con un solo toque y consulta las existencias en tiempo real.",
  },
  {
    maqueta: MaquetaMetros,
    etiqueta: "Paso 3 · Cantidad y Cesta",
    titulo: "Define cuántos metros requieres",
    texto:
      "Ajusta los metros que necesitas y agrégalos a tu cotización. Puedes combinar distintas telas sin compromiso.",
  },
  {
    maqueta: MaquetaWhatsapp,
    etiqueta: "Paso 4 · Cotización Directa",
    titulo: "Envíalo por WhatsApp",
    texto:
      "Al terminar, toca “Enviar por WhatsApp”: se abrirá el chat con tu pedido redactado para confirmarte precio exacto y disponibilidad inmediata.",
  },
];

/** Distancia mínima (px) para que un arrastre cuente como swipe y no como tap. */
const SWIPE_MINIMO = 40;

/**
 * Espera antes de ofrecer el tutorial solo en la primera visita.
 */
const ESPERA_AUTO_MS = 3000;

export function TutorialModal() {
  const [mounted, setMounted] = useState(false);
  const [slide, setSlide] = useState(0);

  const tutorialSeen = useGuideStore((s) => s.tutorialSeen);
  const tutorialOpen = useGuideStore((s) => s.tutorialOpen);
  const openTutorial = useGuideStore((s) => s.openTutorial);
  const closeTutorial = useGuideStore((s) => s.closeTutorial);
  const markTutorialSeen = useGuideStore((s) => s.markTutorialSeen);

  const panelRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Apertura diferida en la primera visita
  useEffect(() => {
    if (!mounted || tutorialSeen || tutorialOpen) return;

    const temporizador = setTimeout(openTutorial, ESPERA_AUTO_MS);

    const cancelar = () => {
      clearTimeout(temporizador);
      markTutorialSeen();
    };

    const eventos = ["scroll", "wheel", "pointerdown", "keydown", "touchstart"];
    for (const evento of eventos) {
      window.addEventListener(evento, cancelar, { passive: true, once: true });
    }

    return () => {
      clearTimeout(temporizador);
      for (const evento of eventos) {
        window.removeEventListener(evento, cancelar);
      }
    };
  }, [mounted, tutorialSeen, tutorialOpen, openTutorial, markTutorialSeen]);

  const visible = mounted && tutorialOpen;

  const cerrar = useCallback(() => {
    closeTutorial();
    setSlide(0);
  }, [closeTutorial]);

  const irA = useCallback((i: number) => {
    setSlide(Math.min(SLIDES.length - 1, Math.max(0, i)));
  }, []);

  // Teclado: Esc cierra, flechas navegan, Tab se queda dentro del modal
  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
        return;
      }
      if (e.key === "ArrowRight") {
        setSlide((s) => Math.min(SLIDES.length - 1, s + 1));
        return;
      }
      if (e.key === "ArrowLeft") {
        setSlide((s) => Math.max(0, s - 1));
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;

      if (e.shiftKey && activo === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, cerrar]);

  // Al abrir: foco al modal y congelar scroll
  useEffect(() => {
    if (!visible) return;

    focoPrevio.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowPrevio;
      focoPrevio.current?.focus();
    };
  }, [visible]);

  if (!visible) return null;

  const actual = SLIDES[slide];
  const Maqueta = actual.maqueta;
  const esUltimo = slide === SLIDES.length - 1;
  const esPrimero = slide === 0;

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(delta) < SWIPE_MINIMO) return;
    irA(delta < 0 ? slide + 1 : slide - 1);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-deep/65 p-3 sm:p-4 backdrop-blur-md transition-opacity duration-300 sm:items-center"
      onClick={cerrar}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        tabIndex={-1}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-line/80 bg-surface-container-lowest shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Cabecera del Atelier */}
        <div className="flex items-center justify-between border-b border-line/60 bg-surface-container-low/60 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber text-white text-[11px] font-bold">
              {slide + 1}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber">
              {actual.etiqueta}
            </span>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-container hover:text-ink-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Cerrar guía del catálogo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido Principal y Maqueta */}
        <div className="px-5 pt-5 pb-2 sm:px-7 sm:pt-6">
          <div className="relative">
            <Maqueta />
          </div>

          {/* Textos explicativos */}
          <div className="mt-5 text-center" aria-live="polite">
            <h2
              id="tutorial-titulo"
              className="font-display text-xl sm:text-2xl font-bold text-ink-display tracking-tight"
            >
              {actual.titulo}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-ink-soft">
              {actual.texto}
            </p>
          </div>
        </div>

        {/* Indicadores de Paso (Pills animados) */}
        <div className="flex justify-center items-center gap-1.5 py-4">
          {SLIDES.map((s, i) => (
            <button
              key={s.titulo}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ir al paso ${i + 1}: ${s.titulo}`}
              aria-current={i === slide ? "step" : undefined}
              className="group p-1 focus-visible:outline-none"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-300 ${
                  i === slide
                    ? "w-8 bg-heritage-navy shadow-xs"
                    : "w-2 bg-line-strong/40 hover:bg-outline-variant/70"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="flex items-center justify-between gap-3 border-t border-line/60 bg-surface-container-low/60 px-5 py-3.5 sm:px-6">
          {esPrimero ? (
            <button
              type="button"
              onClick={cerrar}
              className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft transition-colors hover:text-ink-display hover:bg-surface-container focus-visible:outline-none"
            >
              Saltar guía
            </button>
          ) : (
            <button
              type="button"
              onClick={() => irA(slide - 1)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft transition-colors hover:text-ink-display hover:bg-surface-container focus-visible:outline-none"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span>Anterior</span>
            </button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={esUltimo ? cerrar : () => irA(slide + 1)}
            className="shadow-sm"
          >
            <span>{esUltimo ? "¡Explorar telas!" : "Siguiente"}</span>
            {esUltimo ? (
              <Sparkles className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

