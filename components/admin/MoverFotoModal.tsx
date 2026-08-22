"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import {
  buscarProductos,
  crearProductoYMoverFoto,
  moverFotoANuevaVariante,
  moverFotoAVariante,
  variantesDeProducto,
} from "@/app/admin/actions";

export type VarianteDestino = { id: string; nombre: string; hex: string | null };

type Producto = { id: string; nombre: string; categoria: string | null };

/** Espera antes de buscar mientras se teclea. */
const DEBOUNCE_MS = 300;

/**
 * A dónde mandar una foto mal clasificada. Es el camino accesible del drag &
 * drop de `GaleriaFotos` —y el ÚNICO que sirve para "otro producto", que no
 * está en pantalla para arrastrarle nada—.
 *
 * Dos secciones, en el orden en que ocurren los errores de captura: casi
 * siempre la foto es un color más de ESTE producto (por eso los hermanos van
 * arriba, a un toque); de vez en cuando se coló la foto de otro producto.
 */
export function MoverFotoModal({
  fotoId,
  telaId,
  hermanas,
  onCerrar,
  onHecho,
}: {
  fotoId: string;
  telaId: string;
  /** Variantes de ESTE producto, sin la de origen (mover ahí no haría nada). */
  hermanas: VarianteDestino[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  const [termino, setTermino] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Producto[] | null>(null);
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [destinos, setDestinos] = useState<VarianteDestino[] | null>(null);

  // --- Foco: devolverlo a donde estaba al cerrar, y atraparlo mientras abre.
  useEffect(() => {
    focoPrevio.current = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, button")?.focus();
    const previo = focoPrevio.current;
    return () => previo?.focus();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCerrar();
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (!primero) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  // --- Búsqueda con debounce: un setTimeout cancelado en el cleanup basta;
  //     el efecto ya se re-dispara con cada tecla.
  useEffect(() => {
    const texto = termino.trim();
    if (texto.length < 2) {
      setResultados(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      const res = await buscarProductos(texto);
      // Se descartan los del producto actual: para eso está la sección de
      // arriba, y ofrecerlo aquí haría creer que es "otro" producto.
      setResultados(res.productos.filter((p) => p.id !== telaId));
      if (res.error) setError(res.error);
      setBuscando(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [termino, telaId]);

  const correr = useCallback(
    (accion: () => Promise<{ error?: string }>) => {
      setError(null);
      startTransition(async () => {
        const res = await accion();
        if (res.error) return setError(res.error);
        onHecho();
      });
    },
    [onHecho]
  );

  const abrirProducto = (producto: Producto) => {
    setElegido(producto);
    setDestinos(null);
    setError(null);
    startTransition(async () => {
      const res = await variantesDeProducto(producto.id);
      if (res.error) return setError(res.error);
      setDestinos(res.variantes);
    });
  };

  const sinResultados =
    resultados !== null && resultados.length === 0 && !buscando && termino.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mover-foto-titulo"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="mover-foto-titulo" className="font-display text-lg text-ink">
              Mover esta foto
            </h2>
            <p className="mt-0.5 text-xs text-ink/50">
              La foto conserva su recorte y sus tamaños; solo cambia de color.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink/60 transition-colors hover:bg-line/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* ---------------------------------------- En este mismo producto */}
        <section className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-ink">En este producto</h3>
          <div className="flex flex-wrap gap-2">
            {hermanas.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={guardando}
                onClick={() => correr(() => moverFotoAVariante(fotoId, v.id))}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink transition-colors hover:border-amber hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50"
              >
                <ColorSwatch hex={v.hex} nombre={v.nombre} size="sm" />
                <span className="max-w-40 truncate">{v.nombre}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={guardando}
              onClick={() => correr(() => moverFotoANuevaVariante(fotoId, telaId))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line bg-bg px-3 py-2 text-sm text-ink/70 transition-colors hover:border-amber hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo color
            </button>
          </div>
          {hermanas.length === 0 && (
            <p className="mt-2 text-xs text-ink/50">
              Este producto tiene un solo color. “Nuevo color” crea uno y le pasa
              esta foto — es lo que hace falta cuando varios colores se
              capturaron como fotos de uno.
            </p>
          )}
        </section>

        {/* ------------------------------------------------- En otro producto */}
        <section className="border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-medium text-ink">En otro producto</h3>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
              aria-hidden
            />
            <input
              type="search"
              value={termino}
              onChange={(e) => {
                setTermino(e.target.value);
                setElegido(null);
                setDestinos(null);
              }}
              placeholder="Buscar producto por nombre…"
              aria-label="Buscar producto de destino"
              className="h-11 w-full rounded-xl border border-line bg-bg pl-9 pr-9 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
            {buscando && (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink/40"
                aria-hidden
              />
            )}
          </div>

          {/* Un producto elegido: sus colores como destino */}
          {elegido ? (
            <div className="mt-3 rounded-xl border border-line bg-bg p-3">
              <p className="mb-2 text-sm font-medium text-ink">{elegido.nombre}</p>
              <div className="flex flex-wrap gap-2">
                {(destinos ?? []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={guardando}
                    onClick={() => correr(() => moverFotoAVariante(fotoId, v.id))}
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50"
                  >
                    <ColorSwatch hex={v.hex} nombre={v.nombre} size="sm" />
                    <span className="max-w-40 truncate">{v.nombre}</span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => correr(() => moverFotoANuevaVariante(fotoId, elegido.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line bg-surface px-3 py-1.5 text-sm text-ink/70 transition-colors hover:border-amber hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Nuevo color aquí
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setElegido(null);
                  setDestinos(null);
                }}
                className="mt-2 rounded text-xs text-ink/50 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                Elegir otro producto
              </button>
            </div>
          ) : (
            <>
              {resultados && resultados.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {resultados.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => abrirProducto(p)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3 py-2 text-left text-sm text-ink transition-colors hover:border-amber hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                      >
                        <span className="truncate">{p.nombre}</span>
                        <span className="shrink-0 text-xs text-ink/40">
                          {p.categoria ?? "Sin categoría"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sinResultados && (
                <div className="mt-3">
                  <p className="mb-2 text-sm text-ink/60">
                    Ningún producto se llama así.
                  </p>
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => correr(() => crearProductoYMoverFoto(fotoId, termino.trim()))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line bg-bg px-3 py-2 text-sm text-ink transition-colors hover:border-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Crear producto “{termino.trim()}” con esta foto
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-ink/40" aria-live="polite">
          {guardando ? "Moviendo…" : ""}
        </p>
      </div>
    </div>
  );
}
