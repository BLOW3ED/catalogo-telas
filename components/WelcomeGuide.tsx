"use client";

import { useEffect, useState } from "react";
import { Search, ShoppingBag, MessageCircle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGuideStore } from "@/lib/guide-store";
import { Button } from "@/components/ui/Button";

/**
 * Modal de BIENVENIDA (primera visita) — 3 pasos para "aprender a comprar".
 *
 * Se muestra automáticamente si nunca se ha visto (welcomeSeen === false) o
 * cuando se pide abrir desde el header ("¿Cómo funciona?"). El copy es cálido,
 * corto y con letra grande, pensado para el rango de edad 20–80.
 */

type Paso = {
  icon: LucideIcon;
  titulo: string;
  texto: string;
};

const PASOS: Paso[] = [
  {
    icon: Search,
    titulo: "1. Explora las telas",
    texto:
      "Toca cualquier tela para verla y descubrir todos sus colores.",
  },
  {
    icon: ShoppingBag,
    titulo: "2. Arma tu pedido",
    texto:
      "Elige cuántos metros quieres y toca “Agregar”. Se guarda en tu cotización, sin compromiso.",
  },
  {
    icon: MessageCircle,
    titulo: "3. Envía por WhatsApp",
    texto:
      "Cuando termines, toca “Enviar pedido por WhatsApp” y con gusto te confirmamos precio y disponibilidad.",
  },
];

export function WelcomeGuide() {
  const [mounted, setMounted] = useState(false);
  const [paso, setPaso] = useState(0);

  const welcomeSeen = useGuideStore((s) => s.welcomeSeen);
  const welcomeOpen = useGuideStore((s) => s.welcomeOpen);
  const closeWelcome = useGuideStore((s) => s.closeWelcome);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // Visible si se pidió abrir explícitamente o si nunca se ha visto.
  const visible = welcomeOpen || !welcomeSeen;
  if (!visible) return null;

  const esUltimo = paso === PASOS.length - 1;
  const cerrar = () => {
    closeWelcome();
    setPaso(0);
  };

  const actual = PASOS[paso];
  const Icono = actual.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      onClick={cerrar}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="text-label-caps text-xs text-amber-soft">
            Cómo funciona
          </p>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-full p-1.5 text-ink/50 transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/10 text-amber">
            <Icono className="h-8 w-8" aria-hidden />
          </div>
          <h2 id="welcome-title" className="font-display text-2xl text-ink">
            {actual.titulo}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-base leading-relaxed text-ink/70">
            {actual.texto}
          </p>
        </div>

        {/* Puntos de progreso */}
        <div className="flex justify-center gap-2 pb-5" aria-hidden>
          {PASOS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === paso ? "w-6 bg-amber" : "w-2 bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={cerrar}
            className="text-sm text-ink/50 transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
          >
            Saltar
          </button>
          {esUltimo ? (
            <Button variant="primary" size="md" onClick={cerrar}>
              ¡Empecemos!
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))}
            >
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
