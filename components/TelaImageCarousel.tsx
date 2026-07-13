"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { TelaImage } from "@/components/TelaImage";
import { useGuideStore } from "@/lib/guide-store";
import type { DerivadosFoto } from "@/lib/types";

/** Una foto por color, en el mismo orden que los swatches del selector. */
export type SlideColor = {
  slug: string;
  src: string | null;
  derivados: DerivadosFoto | null;
  colorNombre: string | null;
};

const HINT_ID = "detalle-swipe";
/** La invitación se oculta sola tras unos segundos para no tapar la tela. */
const HINT_TIMEOUT_MS = 8000;

/**
 * Carrusel de la foto del detalle: deslizar a la izquierda/derecha cambia de
 * color. Usa scroll-snap nativo (el navegador maneja el gesto y la inercia);
 * aquí solo sincronizamos en dos direcciones con la URL `?color=`, que sigue
 * siendo la única fuente de verdad de la variante seleccionada:
 *
 * - swipe → al asentarse el scroll, `router.replace(?color=...)` re-renderiza
 *   precio/SKU/stock en el server igual que un click en el swatch.
 * - swatch → cambia `selectedSlug` y el efecto hace scroll suave al slide.
 *
 * Incluye la invitación animada a deslizar (pill con manita); se descarta
 * para siempre al primer swipe exitoso (guide-store, mismo patrón que Hint).
 */
export function TelaImageCarousel({
  slides,
  selectedSlug,
  telaNombre,
}: {
  slides: SlideColor[];
  selectedSlug: string;
  telaNombre: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const trackRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const scrollTimer = useRef<number | undefined>(undefined);

  const dismissedHints = useGuideStore((s) => s.dismissedHints);
  const dismissHint = useGuideStore((s) => s.dismissHint);

  // La invitación lee localStorage (guide-store): renderizarla solo tras
  // montar evita mismatch de hidratación.
  const [mounted, setMounted] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => setExpired(true), HINT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  const index = slides.findIndex((s) => s.slug === selectedSlug);
  // Solo el slide inicial carga eager (LCP). Al primer toque/gesto (`warm`)
  // se precalientan los vecinos del slide actual, para que al soltar el swipe
  // la foto ya esté cargada en vez de mostrar el skeleton.
  const initialIndex = useRef(index);
  const [warm, setWarm] = useState(false);

  // touchstart/pointerdown llegan antes de que el dedo se mueva; el primer
  // scroll cubre trackpad/teclado, donde no hay pointerdown previo.
  function warmNeighbors() {
    if (!warm) setWarm(true);
  }

  // URL → carrusel: al montar posiciona sin animación (el color puede venir
  // de un link compartido); después, scroll suave cuando pican un swatch.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || index < 0) return;
    const left = index * track.clientWidth;
    if (!didInit.current) {
      didInit.current = true;
      if (left > 0) track.scrollTo({ left, behavior: "instant" });
      return;
    }
    if (Math.abs(track.scrollLeft - left) > 1) {
      track.scrollTo({ left, behavior: "smooth" });
    }
  }, [index]);

  // Carrusel → URL: debounce del scroll (~el snap ya terminó) y navegamos si
  // quedó en un color distinto. El scroll programático del efecto de arriba
  // cae en el mismo índice seleccionado, así que no re-navega (sin bucles).
  function onScroll() {
    warmNeighbors();
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const i = Math.round(track.scrollLeft / track.clientWidth);
      const slide = slides[i];
      if (slide && slide.slug !== selectedSlug) {
        dismissHint(HINT_ID);
        router.replace(`${pathname}?color=${encodeURIComponent(slide.slug)}`, {
          scroll: false,
        });
      }
    }, 150);
  }

  const showHint = mounted && !expired && !dismissedHints.includes(HINT_ID);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={warmNeighbors}
        onPointerDown={warmNeighbors}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carrusel"
        aria-label={`Colores de ${telaNombre}: desliza para cambiar de color`}
      >
        {slides.map((s, i) => (
          <div key={s.slug} className="w-full shrink-0 snap-center">
            <TelaImage
              src={s.src}
              derivados={s.derivados}
              sizes="(max-width: 1023px) 100vw, 50vw"
              alt={s.colorNombre ? `${telaNombre} ${s.colorNombre}` : telaNombre}
              priority={
                i === initialIndex.current ||
                (warm && Math.abs(i - index) <= 1)
              }
            />
          </div>
        ))}
      </div>

      {/* Invitación a deslizar: manita animada sobre la foto. pointer-events-none
          para no robarle el gesto al carrusel. */}
      {showHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-ink-deep/75 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
            <ChevronLeft className="h-3.5 w-3.5 opacity-70" aria-hidden />
            <Hand
              className="h-4 w-4 animate-swipe-nudge motion-reduce:animate-none"
              aria-hidden
            />
            <span>Desliza para cambiar de color</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
