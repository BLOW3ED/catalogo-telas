"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft } from "lucide-react";
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
 *
 * Reemplaza a los coach-marks que antes vivían incrustados en la página
 * (buscador, grid, selector de color, metros, carrito): estorbaban el layout y
 * competían con las telas. Aquí el tutorial es efímero y está fuera del flujo;
 * las maquetas reponen el contexto espacial que daba el coach-mark ("mira ESTE
 * botón") sin ocupar un pixel de la página real.
 *
 * Se abre solo en la primera visita, y se puede reabrir cuando sea desde
 * "Ayuda" en el header. Copy corto y letra grande: el rango de edad va de 20 a
 * 80 años.
 */

type Slide = {
  maqueta: () => React.ReactElement;
  titulo: string;
  texto: string;
};

const SLIDES: Slide[] = [
  {
    maqueta: MaquetaBuscar,
    titulo: "Busca o explora",
    texto:
      "Escribe el nombre, el color o el tipo de tela que buscas. O baja y explora todo el catálogo con calma.",
  },
  {
    maqueta: MaquetaColor,
    titulo: "Elige el color",
    texto:
      "Toca una tela para verla en grande. Cambia de color picando los botones o deslizando la foto: el precio se actualiza solo.",
  },
  {
    maqueta: MaquetaMetros,
    titulo: "Di cuántos metros",
    texto:
      "Elige los metros que necesitas y toca “Agregar”. Se guarda en tu cotización, sin compromiso.",
  },
  {
    maqueta: MaquetaWhatsapp,
    titulo: "Envíalo por WhatsApp",
    texto:
      "Al terminar, toca “Enviar por WhatsApp”: se abre el chat con tu pedido ya escrito. Solo mándalo y te confirmamos precio y disponibilidad.",
  },
];

/** Distancia mínima (px) para que un arrastre cuente como swipe y no como tap. */
const SWIPE_MINIMO = 40;

/**
 * Espera antes de ofrecer el tutorial solo en la primera visita. La idea es
 * atender a quien se quedó parado sin saber qué hacer, no interrumpir a quien
 * llegó por un link de WhatsApp buscando una tela concreta: cualquier señal de
 * que sabe moverse (scroll, toque, clic, tecla) cancela la apertura.
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
  // Para devolver el foco a donde estaba (el botón "Ayuda") al cerrar.
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Apertura DIFERIDA en la primera visita: el catálogo abre limpio y el
  // tutorial solo aparece si a los 3 segundos la persona sigue sin tocar nada.
  // Si se movió (scroll, toque, clic, tecla) ya sabe qué hacer: lo damos por
  // visto y no lo volvemos a intentar en las siguientes páginas.
  useEffect(() => {
    // `tutorialSeen` sale de localStorage: solo se puede leer ya montados.
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

  // Teclado: Esc cierra, flechas navegan, Tab se queda dentro del modal.
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

      // Trampa de foco: sin esto el tabulador se escapa al catálogo de atrás,
      // que para un lector de pantalla no existe (aria-modal) pero para el
      // teclado sí.
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

  // Al abrir: recordar el foco, meterlo al modal y congelar el scroll de atrás.
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={cerrar}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-bg shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="text-label-caps text-xs text-amber-soft">
            Cómo funciona · {slide + 1} de {SLIDES.length}
          </p>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Cerrar tutorial"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-2 pt-6">
          <Maqueta />

          {/* aria-live: al cambiar de slide con las flechas o el swipe, el
              lector de pantalla anuncia el paso nuevo sin mover el foco. */}
          <div className="mt-6 text-center" aria-live="polite">
            <h2
              id="tutorial-titulo"
              className="font-display text-2xl text-ink"
            >
              {actual.titulo}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-base leading-relaxed text-ink-soft">
              {actual.texto}
            </p>
          </div>
        </div>

        {/* Puntos de progreso: también sirven para saltar de slide. */}
        <div className="flex justify-center gap-2 py-5">
          {SLIDES.map((s, i) => (
            <button
              key={s.titulo}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ir al paso ${i + 1}: ${s.titulo}`}
              aria-current={i === slide ? "step" : undefined}
              className="group p-1.5 focus-visible:outline-none"
            >
              <span
                className={`block h-2 rounded-full transition-all group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 ${
                  i === slide ? "w-6 bg-primary" : "w-2 bg-line-strong"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          {esPrimero ? (
            <button
              type="button"
              onClick={cerrar}
              className="rounded px-1 text-sm text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Saltar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => irA(slide - 1)}
              className="flex items-center gap-1 rounded px-1 text-sm text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Atrás
            </button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={esUltimo ? cerrar : () => irA(slide + 1)}
          >
            {esUltimo ? "¡Empecemos!" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
