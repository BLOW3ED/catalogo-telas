"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { TelaImage } from "@/components/TelaImage";
import { useGuideStore } from "@/lib/guide-store";
import { publicImageUrl, urlDerivado } from "@/lib/supabase/storage";
import type { SlideFoto } from "@/lib/fotos";

const HINT_ID = "detalle-swipe";
/** La invitación se oculta sola tras unos segundos para no tapar la tela. */
const HINT_TIMEOUT_MS = 8000;
/** Margen para dar por asentado el scroll-snap antes de tocar la URL. */
const SNAP_ASENTADO_MS = 150;

/**
 * Carrusel de fotos de la ficha.
 * ---------------------------------------------------------------------------
 * Recorre TODAS las fotos que `construirSlides` dejó alcanzables, que pueden
 * ser varias del mismo color (la vista `catalogo_telas` solo expone la
 * principal, así que hasta ahora el resto era invisible para el cliente).
 *
 * Usa scroll-snap nativo — el navegador maneja el gesto y la inercia — y
 * sincroniza en dos direcciones con `?color=`, que sigue siendo la única
 * fuente de verdad de la variante:
 *
 *  - deslizar dentro del mismo color → solo cambia la foto, NO toca la URL.
 *  - deslizar cruzando a otro color → `router.replace(?color=…)` re-renderiza
 *    precio/SKU/stock en el server, igual que un click en el swatch.
 *  - click en un swatch → el efecto salta a la primera foto de ese color.
 *
 * El efecto no rebota tras un swipe porque solo reposiciona cuando la foto en
 * pantalla NO pertenece ya al color seleccionado: al volver la URL del propio
 * swipe, la condición es falsa y se queda donde está.
 */
export function TelaImageCarousel({
  slides,
  selectedColorSlug,
  telaNombre,
}: {
  slides: SlideFoto[];
  selectedColorSlug: string | null;
  telaNombre: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const trackRef = useRef<HTMLDivElement>(null);
  const tirasRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const scrollTimer = useRef<number | undefined>(undefined);

  const dismissedHints = useGuideStore((s) => s.dismissedHints);
  const dismissHint = useGuideStore((s) => s.dismissHint);

  /** Primera foto de un color: a donde salta el carrusel al picar un swatch. */
  const primeraDeColor = useCallback(
    (color: string | null) => slides.findIndex((s) => s.colorSlug === color),
    [slides]
  );

  const inicial = Math.max(primeraDeColor(selectedColorSlug), 0);
  // El índice es estado propio: con varias fotos por color, `?color=` ya no
  // alcanza para saber en cuál de ellas estamos.
  const [index, setIndex] = useState(inicial);
  const initialIndex = useRef(inicial);

  // La invitación lee localStorage (guide-store): renderizarla solo tras
  // montar evita mismatch de hidratación.
  const [mounted, setMounted] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => setExpired(true), HINT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Solo el slide inicial carga eager (LCP). Al primer toque/gesto (`warm`) se
  // precalientan los vecinos, para que al soltar el swipe la foto ya esté
  // cargada en vez de mostrar el skeleton.
  const [warm, setWarm] = useState(false);
  // ¿El scroll que se está asentando lo provocó un dedo, o lo movimos nosotros?
  // Solo el del dedo descarta la invitación: abrir un link compartido con
  // `?color=` hace scroll programático al montar, y sin esta distinción le
  // quemaba la pista a alguien que todavía no ha deslizado nunca.
  const gestoUsuario = useRef(false);

  function alTocar() {
    gestoUsuario.current = true;
    if (!warm) setWarm(true);
  }
  function warmNeighbors() {
    if (!warm) setWarm(true);
  }

  const irA = useCallback((i: number, suave = true) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: i * track.clientWidth,
      behavior: suave ? "smooth" : "instant",
    });
  }, []);

  // URL → carrusel. Al montar posiciona sin animación (el color puede venir de
  // un link compartido). Después solo reposiciona si la foto visible pertenece
  // a OTRO color — así un swipe dentro del mismo color no se ve arrastrado de
  // vuelta a la primera foto.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (!didInit.current) {
      didInit.current = true;
      if (initialIndex.current > 0) irA(initialIndex.current, false);
      return;
    }

    if (slides[index]?.colorSlug === selectedColorSlug) return;
    const destino = primeraDeColor(selectedColorSlug);
    if (destino >= 0) {
      setIndex(destino);
      irA(destino);
    }
    // `index` se lee a propósito sin declararlo: el efecto reacciona al cambio
    // de color, no a cada foto que pasa bajo el dedo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColorSlug, primeraDeColor, irA, slides]);

  // Carrusel → URL. El contador y las miniaturas siguen al dedo en vivo; la
  // navegación espera a que el snap se asiente para no encolar `replace`s.
  function onScroll() {
    warmNeighbors();
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i >= 0 && i < slides.length) setIndex(i);

    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const slide = slides[i];
      if (!slide) return;
      if (gestoUsuario.current) {
        gestoUsuario.current = false;
        dismissHint(HINT_ID);
      }
      // Solo al cruzar de color: dentro del mismo color la URL no cambia.
      if (slide.colorSlug && slide.colorSlug !== selectedColorSlug) {
        router.replace(`${pathname}?color=${encodeURIComponent(slide.colorSlug)}`, {
          scroll: false,
        });
      }
    }, SNAP_ASENTADO_MS);
  }

  // La miniatura activa se mantiene a la vista al deslizar la foto grande.
  // Se mueve el scroll HORIZONTAL de la tira a mano en vez de usar
  // `scrollIntoView`: ese arrastra también el scroll de la página, y picar una
  // flecha terminaba bajando la ficha entera bajo el cursor.
  useEffect(() => {
    const tira = tirasRef.current;
    const activa = tira?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    if (!tira || !activa) return;
    const centrada = activa.offsetLeft - (tira.clientWidth - activa.clientWidth) / 2;
    tira.scrollTo({ left: Math.max(0, centrada), behavior: "smooth" });
  }, [index]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      irA(Math.min(index + 1, slides.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      irA(Math.max(index - 1, 0));
    }
  }

  // Con varios colores la invitación habla de colores; con un solo producto
  // fotografiado varias veces, de fotos.
  const navegaPorColor = slides.some((s) => s.colorSlug !== null);
  const textoHint = navegaPorColor
    ? "Desliza para cambiar de color"
    : "Desliza para ver más fotos";
  const showHint = mounted && !expired && !dismissedHints.includes(HINT_ID);

  function altDe(s: SlideFoto, i: number) {
    if (s.alt) return s.alt;
    const base = [telaNombre, s.colorNombre].filter(Boolean).join(" ");
    return `${base} — foto ${i + 1} de ${slides.length}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded border border-line-strong/20 bg-white p-px"
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${telaNombre}`}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          onTouchStart={alTocar}
          onPointerDown={alTocar}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${slides.length}`}
            >
              <TelaImage
                src={publicImageUrl(s.ruta)}
                derivados={s.derivados}
                sizes="(max-width: 1023px) 100vw, 50vw"
                alt={altDe(s, i)}
                aspecto="cuadrado"
                priority={
                  i === initialIndex.current || (warm && Math.abs(i - index) <= 1)
                }
              />
            </div>
          ))}
        </div>

        {/* Contador: dice que hay más fotos aunque no se toque nada. */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink-deep/70 px-2.5 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
          {index + 1} / {slides.length}
        </div>

        {/* Flechas: en escritorio no hay gesto de deslizar. Se ocultan en los
            extremos para no ofrecer un paso que no existe. */}
        {index > 0 && (
          <FlechaCarrusel
            lado="izquierda"
            onClick={() => irA(index - 1)}
            etiqueta="Foto anterior"
          />
        )}
        {index < slides.length - 1 && (
          <FlechaCarrusel
            lado="derecha"
            onClick={() => irA(index + 1)}
            etiqueta="Foto siguiente"
          />
        )}

        {/* Invitación a deslizar: solo en móvil, donde el gesto existe.
            pointer-events-none para no robarle el gesto al carrusel. */}
        {showHint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center sm:hidden">
            <div className="flex items-center gap-2 rounded-full bg-ink-deep/75 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
              <ChevronLeft className="h-3.5 w-3.5 opacity-70" aria-hidden />
              <Hand
                className="h-4 w-4 animate-swipe-nudge motion-reduce:animate-none"
                aria-hidden
              />
              <span>{textoHint}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </div>
          </div>
        )}
      </div>

      {/* Miniaturas: con 18 fotos unos puntitos no dicen nada, y en un producto
          que ES su apariencia la miniatura enseña el tono real. Hace de
          indicador y de navegación a la vez. */}
      <div
        ref={tirasRef}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        aria-label="Elegir foto"
      >
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-idx={i}
            onClick={() => irA(i)}
            aria-label={`Ver foto ${i + 1} de ${slides.length}`}
            aria-current={i === index}
            className={`h-14 w-14 shrink-0 overflow-hidden rounded border bg-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
              i === index
                ? "border-primary opacity-100"
                : "border-line-strong/30 opacity-60 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- derivado sm directo del CDN, igual que TelaImage */}
            <img
              src={urlDerivado(s.derivados, "sm") ?? publicImageUrl(s.ruta) ?? ""}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Flecha flotante sobre la foto; oculta en móvil, donde se desliza. */
function FlechaCarrusel({
  lado,
  onClick,
  etiqueta,
}: {
  lado: "izquierda" | "derecha";
  onClick: () => void;
  etiqueta: string;
}) {
  const Icono = lado === "izquierda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink-deep shadow-md transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex ${
        lado === "izquierda" ? "left-3" : "right-3"
      }`}
    >
      <Icono className="h-5 w-5" aria-hidden />
    </button>
  );
}
