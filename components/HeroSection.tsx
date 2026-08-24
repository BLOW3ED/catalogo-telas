"use client";

import Image from "next/image";
import { TutorialTrigger } from "@/components/tutorial/TutorialTrigger";

interface HeroSectionProps {
  totalModelos?: number;
}

export function HeroSection({ totalModelos }: HeroSectionProps) {
  const scrollToCatalog = () => {
    const catalogElement = document.getElementById("catalogo-seccion");
    if (catalogElement) {
      const offset = 70; // altura aproximada del header sticky
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = catalogElement.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative w-full overflow-hidden border-b border-line/70 bg-gradient-to-b from-sand-bg via-surface-container-low/60 to-sand-bg -mt-16 pt-16">
      {/* Fondo decorativo con luces sutiles */}
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-amber/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-heritage-navy/5 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 pt-6 pb-8 sm:px-6 sm:pt-10 sm:pb-12 lg:px-8 lg:pt-12 lg:pb-14">
        {/* Layout en 2 columnas para Desktop (lg+) y vertical armónico en Móvil */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">

          {/* Columna Izquierda: Información de Marca, Mensaje y Acciones */}
          <div className="flex flex-col lg:col-span-7">
            {/* Eyebrow de atelier con sello de Fresnillo */}
            <div className="mb-3.5 inline-flex items-center gap-2 self-start rounded-full border border-amber/30 bg-surface-container-lowest/80 px-3 py-1 shadow-xs backdrop-blur-xs">
              <span className="flex h-2 w-2 rounded-full bg-amber animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber">
                Fresnillo, Zac. · Tienda Textil y Mercería
              </span>
            </div>

            {/* Título Principal de Alto Impacto */}
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-display sm:text-5xl lg:text-[3.25rem] sm:leading-[1.15]">
              Telas finas y mercería para tus creaciones y manualidades.
            </h1>

            {/* Descripción / Propuesta de Valor */}
            <p className="mt-3.5 text-base sm:text-lg text-ink-text/85 max-w-2xl leading-relaxed">
              Explora nuestra colección selecta de encajes bordados, pedrería, linos, sedas y mercería fina. Cotiza fácilmente tus metros y recibe atención directa por WhatsApp.
            </p>

            {/* Píldoras de valor y ventajas */}
            <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs font-semibold text-ink-soft">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest/90 px-3 py-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-amber">straighten</span>
                <span>Corte a tu medida</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest/90 px-3 py-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-whatsapp">chat</span>
                <span>Cotización directa en WhatsApp</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-lowest/90 px-3 py-1.5 shadow-2xs">
                <span className="material-symbols-outlined text-[16px] text-heritage-navy">verified</span>
                <span>Calidad garantizada</span>
              </span>
            </div>

            {/* Acciones Principales: Explorar Catálogo + Tutorial */}
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="group inline-flex items-center justify-center gap-2.5 rounded bg-heritage-navy px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-deep-slate hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
              >
                <span>Explorar Catálogo</span>
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-y-0.5">
                  south
                </span>
              </button>

              <TutorialTrigger variant="hero-banner" className="flex-1 sm:max-w-md" />
            </div>
          </div>

          {/* Columna Derecha: Vitrina Visual de Telas de Alta Gama */}
          <div className="relative lg:col-span-5">
            <div className="relative mx-auto aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] w-full max-w-lg overflow-hidden rounded-xl border border-line-strong/60 bg-surface-container-highest shadow-xl transition-transform duration-300 hover:scale-[1.01]">
              <Image
                src="/hero-encajes.webp"
                alt="Selección de encajes bordados y telas finas de Telas La Jalisciense"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 70vw, 90vw"
                className="object-cover"
              />

              {/* Velo degradado sutil en bordes para realzar profundidad */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-deep/60 via-transparent to-black/10" />

              {/* Insignia Flotante Superior: Colección Destacada */}
              <div className="absolute left-3.5 top-3.5 sm:left-4 sm:top-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-ink-deep/75 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-md">
                <span className="material-symbols-outlined text-[15px] text-amber-300">auto_awesome</span>
                <span>Encajes & Pedrería Fina</span>
              </div>

              {/* Insignia Flotante Inferior: Disponibilidad / Muestrario */}
              <div className="absolute bottom-3.5 left-3.5 right-3.5 sm:bottom-4 sm:left-4 sm:right-4 flex items-center justify-between rounded-lg border border-white/20 bg-ink-deep/80 p-3 text-white shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/20 text-amber-200">
                    <span className="material-symbols-outlined text-[18px]">texture</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">Muestrario de Temporada</p>
                    <p className="text-[11px] text-white/80">Fiesta, Novia, XV y Ceremonia</p>
                  </div>
                </div>
                {totalModelos != null && totalModelos > 0 && (
                  <span className="rounded bg-white/20 px-2 py-1 text-[11px] font-bold text-white tracking-wide">
                    {totalModelos}+ modelos
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Indicador de Deslizamiento Inferior (Scroll Nudge) */}
        <div className="mt-6 flex justify-center sm:mt-8">
          <button
            type="button"
            onClick={scrollToCatalog}
            aria-label="Deslizar hacia el catálogo"
            className="group flex flex-col items-center gap-1 text-xs font-bold text-ink-soft transition-colors hover:text-amber focus-visible:outline-none"
          >
            <span className="tracking-wide uppercase text-[10px] text-ink-soft/80 group-hover:text-amber">
              Ver colección completa
            </span>
            <span className="material-symbols-outlined text-[20px] text-amber animate-bounce">
              keyboard_arrow_down
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
