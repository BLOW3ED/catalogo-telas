import { Search, ShoppingBag, MessageCircle } from "lucide-react";

/**
 * MAQUETAS del tutorial — las "capturas" de cada slide.
 *
 * No son imágenes: son mini-réplicas de la UI dibujadas con los mismos tokens
 * del design system (ver app/globals.css). Ventaja sobre un PNG: nunca se
 * despintan cuando cambia la paleta, pesan cero, se ven nítidas en cualquier
 * pantalla y podemos poner un halo justo encima del elemento que explicamos.
 *
 * Son decorativas: `aria-hidden` y sin foco. El significado lo carga el texto
 * del slide, no el dibujo.
 */

/** Marco de "pantalla del catálogo": barra de marca + lienzo. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="select-none overflow-hidden rounded-xl border border-line-strong/30 bg-bg shadow-sm"
    >
      <div className="flex h-8 items-center border-b border-line px-3">
        <span className="font-display text-[11px] leading-none text-ink-deep">
          Telas La Jalisciense
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/**
 * Halo que señala el elemento del que habla el slide. El `-inset` lo saca del
 * borde del hijo para que se lea como "mira esto", no como estado activo.
 */
function Foco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute -inset-1.5 animate-halo rounded ring-2 ring-primary" />
    </div>
  );
}

/** Retazo de tela: sugerido con un degradado, no con una foto real. */
function Retazo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`aspect-square w-full rounded bg-gradient-to-br ${className}`}
    />
  );
}

/** Tarjeta de tela del grid (nombre + precio en ámbar, como la real). */
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
    <div className="flex flex-col gap-1.5">
      <Retazo className={retazo} />
      <p className="text-[11px] leading-none text-ink">{nombre}</p>
      <p className="text-[11px] font-semibold leading-none text-amber">
        {precio}
      </p>
    </div>
  );
}

/** 1. Busca o explora — halo sobre el buscador. */
export function MaquetaBuscar() {
  return (
    <Marco>
      <Foco>
        <div className="flex items-center gap-2 rounded border border-line-strong/30 bg-surface px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
          <span className="text-[11px] leading-none text-ink">manta cruda</span>
        </div>
      </Foco>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <MiniCard
          retazo="from-amber/25 to-amber/10"
          nombre="Manta"
          precio="$85 / m"
        />
        <MiniCard
          retazo="from-primary/25 to-primary/10"
          nombre="Chifón"
          precio="$120 / m"
        />
        <MiniCard
          retazo="from-surface-high to-line"
          nombre="Tul"
          precio="$60 / m"
        />
      </div>
    </Marco>
  );
}

/** 2. Elige el color — halo sobre la fila de colores. */
export function MaquetaColor() {
  const colores = [
    "bg-primary",
    "bg-amber",
    "bg-success",
    "bg-ink-soft",
    "bg-surface-high",
  ];

  return (
    <Marco>
      <div className="flex gap-3">
        <Retazo className="max-w-[38%] from-primary/30 to-primary/10" />

        <div className="flex flex-1 flex-col justify-center gap-2">
          <p className="font-display text-sm leading-none text-ink">Chifón</p>
          <p className="text-sm font-semibold leading-none text-amber">
            $120 / metro
          </p>

          <Foco>
            <div className="mt-1 flex gap-1.5">
              {colores.map((color, i) => (
                <span
                  key={color}
                  className={`h-5 w-5 rounded-full ${color} ${
                    i === 0 ? "ring-2 ring-primary ring-offset-1" : ""
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

/** 3. Elige los metros — halo sobre el stepper y el botón agregar. */
export function MaquetaMetros() {
  return (
    <Marco>
      <div className="flex gap-3">
        <Retazo className="max-w-[38%] from-amber/25 to-amber/10" />

        <div className="flex flex-1 flex-col justify-center">
          <Foco>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between rounded border border-line-strong/30 bg-chip px-2 py-1.5">
                <span className="text-sm leading-none text-ink-soft">−</span>
                <span className="text-[11px] leading-none text-ink">
                  2.5 metros
                </span>
                <span className="text-sm leading-none text-ink-soft">+</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded bg-primary py-2">
                <ShoppingBag className="h-3 w-3 text-white" />
                <span className="text-[10px] font-bold uppercase leading-none tracking-wider text-white">
                  Agregar
                </span>
              </div>
            </div>
          </Foco>
        </div>
      </div>
    </Marco>
  );
}

/** 4. Envía por WhatsApp — halo sobre el botón verde de la cotización. */
export function MaquetaWhatsapp() {
  const renglones = [
    { tela: "Chifón añil", metros: "2.5 m" },
    { tela: "Manta cruda", metros: "4 m" },
  ];

  return (
    <Marco>
      <p className="text-label-caps text-[9px] text-ink-soft">Mi cotización</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {renglones.map(({ tela, metros }) => (
          <div
            key={tela}
            className="flex items-center justify-between rounded bg-surface px-2.5 py-2"
          >
            <span className="text-[11px] leading-none text-ink">{tela}</span>
            <span className="text-[11px] leading-none text-ink-soft">
              {metros}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Foco>
          <div className="flex items-center justify-center gap-1.5 rounded bg-whatsapp py-2.5">
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
