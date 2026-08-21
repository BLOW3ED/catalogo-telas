import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Inspiración & Atelier — Telas La Jalisciense",
  description:
    "Ideas, tendencias de temporada y creaciones de nuestra comunidad textil en Fresnillo.",
};

export default function InspiracionPage() {
  return (
    <main className="min-h-screen bg-sand-bg text-ink-text pb-24">
      {/* Cabecera de la página */}
      <div className="border-b border-line/60 bg-surface-container-low/50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft shadow-xs transition-all hover:bg-surface-container hover:text-ink-display active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver al catálogo
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 bg-amber" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber">
              Editorial & Creación
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-display sm:text-5xl">
            Inspiración Textil
          </h1>
          <p className="mt-2 max-w-2xl text-base text-ink-soft sm:text-lg">
            Descubre combinaciones de texturas, guías de confección y proyectos realizados con nuestras telas.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-16">
        {/* 1. Artículo Destacado (Hero Editorial) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-heritage-navy" />
            <span className="text-xs font-bold uppercase tracking-widest text-ink-display">
              Tendencia de Temporada
            </span>
          </div>

          <div className="grid overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm md:grid-cols-2">
            <div
              className="min-h-[340px] sm:min-h-[440px] w-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC2eceNqfSb6duRWwfTfwbhVbGc3EGicOcZ3IDR-01eQXto2XHkf5_HSCdQ-E2ZcgNF-52vHhdDcJfq1Rh9sL43nbeCOEb2yc-8_VfHdh12sEkU-nSNGfXaMEgxAMnz1hIB9I-g1CR3VKQV0g6RxAGxHE13mj8UrpvTEVeD0jBE7jVbJ9D-R77HUylIkyH91pdEfQ-fmtGhiz7UVsYA9921PlpY41S55_HaI1Y8ntzzZWKuVQ7gm1GW')",
              }}
            />
            <div className="flex flex-col justify-center p-6 sm:p-10 md:p-12">
              <span className="text-xs font-bold uppercase tracking-wider text-amber">
                Terciopelo & Riqueza Táctil
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink-display sm:text-4xl">
                Tendencias de otoño en terciopelo y brocados
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">
                Descubre cómo los tonos cobrizos, esmeraldas profundos y texturas afelpadas están marcando la pauta en la confección de vestidos de gala y acentos para interiores este año.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/?q=terciopelo"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-heritage-navy px-8 text-sm font-bold text-white shadow-sm transition-all hover:bg-deep-slate hover:shadow-md active:scale-95"
                >
                  Ver Terciopelos en Catálogo
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Guía Técnica & Consejos de Confección */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Hilos y Agujas */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:p-8 shadow-xs">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-amber">
              <span className="material-symbols-outlined text-[28px]">design_services</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber">
              Guía de Atelier
            </span>
            <h3 className="mt-1 font-display text-xl font-bold text-ink-display sm:text-2xl">
              Cómo elegir el hilo y aguja correctos
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Para telas finas como chifón y seda, usa agujas Microtex Nº 60 u 70 e hilos de seda o poliéster fino para evitar perforaciones visibles en la trama.
            </p>
            <Link
              href="/?q=hilo"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-display transition-colors hover:text-amber"
            >
              Explorar hilos y mercería
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          {/* Card 2: Caída y Peso */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 sm:p-8 shadow-xs">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-amber">
              <span className="material-symbols-outlined text-[28px]">straighten</span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber">
              Cálculo de Metraje
            </span>
            <h3 className="mt-1 font-display text-xl font-bold text-ink-display sm:text-2xl">
              Calcula la tela para faldas con vuelo y vestidos
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Una falda circular completa requiere entre 2.5 y 3.5 metros según el ancho de la tela (1.40m o 1.50m). Considera siempre un 10% adicional para dobladillos y caídas al bies.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-display transition-colors hover:text-amber"
            >
              Ver telas con caída
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </section>

        {/* 3. Galería de la Comunidad: "Hecho con Telas La Jalisciense" */}
        <section className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[32px] text-amber">
              auto_awesome
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink-display sm:text-3xl">
              Hecho con Nuestras Telas
            </h2>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              Inspiración real nacida de las manos y talleres de confección de nuestra comunidad en Fresnillo y Zacatecas.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Proyecto 1 */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-ink-display font-bold">
                  CL
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-display">Carmen L.</p>
                  <p className="text-xs text-ink-soft">Fresnillo, Zacatecas</p>
                </div>
              </div>
              <div
                className="h-64 w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCbEonjLo_aKZEGiu8UMuNNsE3egots6o_v7dCF7xCIoRmp0blLnI4nkOUaHxG_BCRQEyPG9-eddhyQ4CgUlSEvWsasTkdYGbV6r5iw7Bqs2jjT9Z9hbxxlJsiQQa6fn5ytlCz2fPHSfoQ-9iQAjeDO2LL-_WgbsXWMUOvqJffyOe_bccVjQQ6Fd_StsVYb5YP6gBdVVCo__AR6YeU537y4HOjQHPNSm6yHoJkFF2_0AJclhm5DyQ0Z')",
                }}
              />
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-display">
                    Ensamble Cobrizo de Temporada
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Confeccionado con tejido fino y botones de concha nácar. Perfecto para el clima de otoño.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-2">
                  <Link
                    href="/?q=cobre"
                    className="inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-ink-display hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[14px]">texture</span>
                    Tono Cobre
                  </Link>
                </div>
              </div>
            </div>

            {/* Proyecto 2 */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-ink-display font-bold">
                  MT
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-display">Marta Taller Textil</p>
                  <p className="text-xs text-ink-soft">Zacatecas Centro</p>
                </div>
              </div>
              <div
                className="h-64 w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDgD0LLjBElV4gMTqtezVrmbZKjh4q8ZIArOvhqPiazBcbdCM-j8dFGdR3XVOZ1yjpgZ2ehR9Kj14EbTqVCuzp-lXqDvLkFPfntTi7jjsnAzHiWSgbo9OYwi9Ste13XV20rKiJHYJEc2het1SyosrMAtf6vvgpsu-cKaBXcFvamiJqPzd1nNlmkemxjLuj0NLXkGQFctdITjUEWrhdYn7ViaRP8-Uju7B_cRPwyHXWUkeKP1Kk1_6So')",
                }}
              />
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-display">
                    Vestido de Gala en Seda Esmeralda
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Caída fluida con brillo sutil y costuras invisibles. El color esmeralda cambia con la luz.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-2">
                  <Link
                    href="/?q=seda"
                    className="inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-ink-display hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[14px]">texture</span>
                    Seda Natural
                  </Link>
                </div>
              </div>
            </div>

            {/* Proyecto 3 */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-ink-display font-bold">
                  LF
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-display">Lucía Fernández</p>
                  <p className="text-xs text-ink-soft">Fresnillo, Zacatecas</p>
                </div>
              </div>
              <div
                className="h-64 w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCSXIOtkqdxhj-R5lXNAYC_ulnRD6yC4YAmOlokvqutOwpVVIKlWOq4iu3HNc99yxm5JbqB_y-3VFSpMiClSNptGSO84Eee9DMBWvrL0qtvEPp6H_A5GqK_lg66-qhNrqLw3Iw9kVhhylJ-gyM17Ra9WomUtczNend33HP6ItBNu0dC_ZjA45i44Cf3nYz5-BsfWf-oRA88JudD8ISe5xke5DuvtznuHX3thYDDVJ7TClNd6rkQIPC7')",
                }}
              />
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-display">
                    Velo de Novia con Encaje Italiano
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    Bordado floral sobre tul ilusión con aplicaciones de pedrería fina en el orillo.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-2">
                  <Link
                    href="/?q=encaje"
                    className="inline-flex items-center gap-1 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-ink-display hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[14px]">texture</span>
                    Encaje & Tul
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
