"use client";

import { Search, ShoppingBag, MessageCircle, SlidersHorizontal, Check, Sparkles } from "lucide-react";

/**
 * MAQUETAS del tutorial — representaciones visuales interactivas de alta fidelidad
 * acordes al sistema de diseño "Artisanal Modernity" (Atelier Textil).
 */

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="select-none overflow-hidden rounded-2xl border border-line/80 bg-surface-container-lowest shadow-sm"
    >
      {/* Barra superior de la maqueta (Atelier Window Bar) */}
      <div className="flex h-9 items-center justify-between border-b border-line/60 bg-surface-container-low/70 px-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-copper/60" />
          <span className="font-display text-[11px] font-bold tracking-tight text-heritage-navy">
            Telas La Jalisciense
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[9px] font-semibold text-accent-copper">
          <Sparkles className="h-2.5 w-2.5" />
          <span>Catálogo</span>
        </span>
      </div>
      <div className="bg-sand-bg/25 p-3 sm:p-3.5">{children}</div>
    </div>
  );
}

function Foco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute -inset-1.5 animate-halo rounded-2xl ring-2 ring-accent-copper/80 ring-offset-2 ring-offset-surface-container-lowest" />
    </div>
  );
}

function Retazo({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br shadow-inner-xs ${className}`}
    >
      {/* Sutil textura de urdimbre/trama textil */}
      <div className="absolute inset-0 bg-[radial-gradient(#00000010_1px,transparent_1px)] [background-size:6px_6px] opacity-40" />
      {label && (
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-heritage-navy/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
          {label}
        </span>
      )}
    </div>
  );
}

function MiniCard({
  retazo,
  nombre,
  categoria,
  precio,
}: {
  retazo: string;
  nombre: string;
  categoria: string;
  precio: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line/60 bg-surface-container-lowest p-2 shadow-2xs transition-transform">
      <Retazo className={retazo} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-accent-copper">
          {categoria}
        </span>
        <p className="font-display text-[11px] font-bold leading-tight text-heritage-navy truncate">
          {nombre}
        </p>
        <p className="text-[11px] font-bold leading-none text-accent-copper mt-0.5">
          {precio}
        </p>
      </div>
    </div>
  );
}

export function MaquetaBuscar() {
  return (
    <Marco>
      <Foco>
        <div className="flex items-center justify-between gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 shadow-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <Search className="h-3.5 w-3.5 shrink-0 text-accent-copper" />
            <span className="text-[11px] font-medium text-ink-text truncate">
              Lino rústico arena...
            </span>
          </div>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container text-ink-soft">
            <SlidersHorizontal className="h-2.5 w-2.5" />
          </div>
        </div>
      </Foco>

      {/* Mini chips de categoría */}
      <div className="mt-2.5 flex gap-1.5 overflow-hidden">
        <span className="rounded-full bg-heritage-navy px-2.5 py-1 text-[9px] font-bold text-white shadow-2xs">
          Todos
        </span>
        <span className="rounded-full border border-line/60 bg-surface-container px-2.5 py-1 text-[9px] font-semibold text-ink-soft">
          Linos
        </span>
        <span className="rounded-full border border-line/60 bg-surface-container px-2.5 py-1 text-[9px] font-semibold text-ink-soft">
          Algodón
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniCard
          retazo="from-[#C4A482] via-[#B07D62] to-[#80543B]"
          nombre="Lino Crudo"
          categoria="Lino"
          precio="$180 / m"
        />
        <MiniCard
          retazo="from-[#1B263B] via-[#0D1B2A] to-[#050B12]"
          nombre="Chifón Noche"
          categoria="Fiesta"
          precio="$120 / m"
        />
        <MiniCard
          retazo="from-[#3D6B52] via-[#2D533E] to-[#1E3B2C]"
          nombre="Popelina Sage"
          categoria="Algodón"
          precio="$95 / m"
        />
      </div>
    </Marco>
  );
}

export function MaquetaColor() {
  const colores = [
    { hex: "#0D1B2A", nombre: "Azul Noche" },
    { hex: "#B07D62", nombre: "Terracota", activo: true },
    { hex: "#3D6B52", nombre: "Verde Salvia" },
    { hex: "#C89B3C", nombre: "Mostaza" },
    { hex: "#F5EDDC", nombre: "Marfil" },
  ];

  return (
    <Marco>
      <div className="flex gap-3 items-center">
        {/* Retazo en grande */}
        <div className="w-[42%] shrink-0">
          <Retazo
            className="from-[#C4A482] via-[#B07D62] to-[#80543B]"
            label="Terracota"
          />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-accent-copper">
              Lino Selecto
            </span>
            <p className="font-display text-sm font-bold leading-tight text-heritage-navy">
              Lino Italiano
            </p>
            <p className="text-xs font-bold text-accent-copper">$180 / metro</p>
          </div>

          <div className="mt-1 border-t border-line/40 pt-1.5">
            <p className="text-[10px] font-semibold text-ink-soft mb-1.5">
              Tono: <strong className="text-heritage-navy">Terracota</strong>
            </p>
            <Foco>
              <div className="flex gap-1.5 items-center rounded-xl bg-surface-container-lowest p-1 border border-line/50">
                {colores.map((c) => (
                  <span
                    key={c.nombre}
                    className={`relative flex h-5 w-5 items-center justify-center rounded-lg shadow-2xs transition-transform ${
                      c.activo
                        ? "ring-2 ring-heritage-navy ring-offset-1 ring-offset-surface-container-lowest scale-105"
                        : "opacity-80"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {c.activo && (
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    )}
                  </span>
                ))}
              </div>
            </Foco>
          </div>
        </div>
      </div>
    </Marco>
  );
}

export function MaquetaMetros() {
  return (
    <Marco>
      <div className="flex gap-3 items-center">
        <div className="w-[36%] shrink-0">
          <Retazo
            className="from-[#C4A482] via-[#B07D62] to-[#80543B]"
            label="$180/m"
          />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2">
          <div>
            <p className="font-display text-xs font-bold leading-tight text-heritage-navy">
              Lino Italiano · Terracota
            </p>
            <p className="text-[10px] text-ink-soft">Especifica tu metraje</p>
          </div>

          <Foco>
            <div className="flex flex-col gap-1.5">
              {/* Stepper idéntico a AddToCart */}
              <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-container px-2 py-1 shadow-inner-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-container-lowest text-xs font-bold text-heritage-navy shadow-2xs">
                  −
                </span>
                <div className="text-center">
                  <span className="text-xs font-bold text-heritage-navy">3.5</span>
                  <span className="ml-1 text-[9px] font-bold uppercase text-accent-copper">
                    metros
                  </span>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-container-lowest text-xs font-bold text-heritage-navy shadow-2xs">
                  +
                </span>
              </div>

              {/* Botón Añadir a la Cesta */}
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-heritage-navy py-2 shadow-xs">
                <ShoppingBag className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                  Añadir a la Cesta ($630)
                </span>
              </div>
            </div>
          </Foco>
        </div>
      </div>
    </Marco>
  );
}

export function MaquetaWhatsapp() {
  const renglones = [
    { tela: "Lino Italiano (Terracota)", metros: "3.5 m", subtotal: "$630" },
    { tela: "Chifón Noche", metros: "2.0 m", subtotal: "$240" },
  ];

  return (
    <Marco>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 text-accent-copper" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-copper">
            Tu Cesta
          </span>
        </div>
        <span className="rounded-full bg-accent-copper/15 px-2 py-0.5 text-[9px] font-bold text-accent-copper">
          2 telas
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {renglones.map(({ tela, metros, subtotal }) => (
          <div
            key={tela}
            className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-container-lowest px-2.5 py-1.5 shadow-2xs"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold leading-tight text-heritage-navy">
                {tela}
              </span>
              <span className="text-[9px] text-ink-soft">{metros}</span>
            </div>
            <span className="text-[10px] font-bold text-accent-copper">
              {subtotal}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Foco>
          <div className="flex flex-col items-center justify-center gap-0.5 rounded-full bg-whatsapp py-2 px-3 shadow-xs text-white">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 fill-current" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Enviar cotización por WhatsApp
              </span>
            </div>
          </div>
        </Foco>
        <p className="mt-1 text-center text-[9px] text-ink-soft">
          Sin compromiso • Confirmamos existencias al instante
        </p>
      </div>
    </Marco>
  );
}


