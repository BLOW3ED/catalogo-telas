import { Search, ShoppingBag, MessageCircle } from "lucide-react";

/**
 * MAQUETAS del tutorial — las "capturas" de cada slide.
 */

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="select-none overflow-hidden rounded-2xl border border-outline-variant/40 bg-sand-bg shadow-sm"
    >
      <div className="flex h-8 items-center border-b border-line/60 bg-surface-container-low px-3">
        <span className="font-display text-[11px] font-bold leading-none text-heritage-navy">
          Telas La Jalisciense
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Foco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute -inset-1.5 animate-halo rounded ring-2 ring-accent-copper" />
    </div>
  );
}

function Retazo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`aspect-square w-full rounded-xl bg-gradient-to-br ${className}`}
    />
  );
}

function MiniCard({
  retazo,
  nombre,
  precio,
}: {
  retazo: string;
  nombre: string;
  precio: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-2xs">
      <Retazo className={retazo} />
      <p className="text-[11px] font-bold leading-none text-heritage-navy">{nombre}</p>
      <p className="text-[11px] font-bold leading-none text-accent-copper">
        {precio}
      </p>
    </div>
  );
}

export function MaquetaBuscar() {
  return (
    <Marco>
      <Foco>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
          <span className="text-[11px] leading-none text-ink-text">manta cruda</span>
        </div>
      </Foco>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniCard
          retazo="from-accent-copper/40 to-accent-copper/10"
          nombre="Manta"
          precio="$85 / m"
        />
        <MiniCard
          retazo="from-heritage-navy/40 to-heritage-navy/10"
          nombre="Chifón"
          precio="$120 / m"
        />
        <MiniCard
          retazo="from-surface-container-highest to-surface-container"
          nombre="Tul"
          precio="$60 / m"
        />
      </div>
    </Marco>
  );
}

export function MaquetaColor() {
  const colores = [
    "bg-heritage-navy",
    "bg-accent-copper",
    "bg-success",
    "bg-ink-soft",
    "bg-surface-container-highest",
  ];

  return (
    <Marco>
      <div className="flex gap-3">
        <Retazo className="max-w-[38%] from-heritage-navy/40 to-heritage-navy/10" />

        <div className="flex flex-1 flex-col justify-center gap-2">
          <p className="font-display text-sm font-bold leading-none text-heritage-navy">Chifón</p>
          <p className="text-sm font-bold leading-none text-accent-copper">
            $120 / metro
          </p>

          <Foco>
            <div className="mt-1 flex gap-1.5">
              {colores.map((color, i) => (
                <span
                  key={color}
                  className={`h-5 w-5 rounded-full ${color} ${
                    i === 0 ? "ring-2 ring-heritage-navy ring-offset-1" : ""
                  }`}
                />
              ))}
            </div>
          </Foco>
        </div>
      </div>
    </Marco>
  );
}

export function MaquetaMetros() {
  return (
    <Marco>
      <div className="flex gap-3">
        <Retazo className="max-w-[38%] from-accent-copper/40 to-accent-copper/10" />

        <div className="flex flex-1 flex-col justify-center">
          <Foco>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container px-2 py-1.5">
                <span className="text-sm leading-none text-ink-soft">−</span>
                <span className="text-[11px] font-bold leading-none text-heritage-navy">
                  2.5 metros
                </span>
                <span className="text-sm leading-none text-ink-soft">+</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-heritage-navy py-2 shadow-xs">
                <ShoppingBag className="h-3 w-3 text-white" />
                <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-white">
                  Añadir
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
    { tela: "Chifón Esmeralda", metros: "2.5 m" },
    { tela: "Manta Cruda", metros: "4.0 m" },
  ];

  return (
    <Marco>
      <p className="text-[10px] font-bold uppercase tracking-wider text-accent-copper">Mi Cotización</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {renglones.map(({ tela, metros }) => (
          <div
            key={tela}
            className="flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-2 shadow-2xs"
          >
            <span className="text-[11px] font-bold leading-none text-heritage-navy">{tela}</span>
            <span className="text-[11px] font-semibold leading-none text-accent-copper">
              {metros}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Foco>
          <div className="flex items-center justify-center gap-1.5 rounded-full bg-whatsapp py-2.5 shadow-sm">
            <MessageCircle className="h-3.5 w-3.5 text-white" />
            <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-white">
              Enviar por WhatsApp
            </span>
          </div>
        </Foco>
      </div>
    </Marco>
  );
}

