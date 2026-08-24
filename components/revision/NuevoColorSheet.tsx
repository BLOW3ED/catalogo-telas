"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearColor } from "@/app/revision/actions";

export type ColorNuevo = { id: string; nombre: string; slug: string; hex: string };

/** Punto de partida del selector de tono: el propio púrpura de marca, sin significado especial. */
const HEX_INICIAL = "#6e4b7a";

/**
 * Alta rápida de un color desde /revision, para cuando el que hace falta no
 * está en la lista. Bottom sheet a pantalla completa en móvil (donde vive
 * este flujo: un empleado revisando el catálogo desde su celular).
 */
export function NuevoColorSheet({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (color: ColorNuevo) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [hex, setHex] = useState(HEX_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idNombre = useId();
  const idHex = useId();

  // Escape cierra el sheet, salvo mientras se está guardando.
  useEffect(() => {
    if (!abierto) return;
    function alEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !pendiente) cerrar();
    }
    window.addEventListener("keydown", alEscape);
    return () => window.removeEventListener("keydown", alEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar() solo lee/limpia estado local, no hace falta en deps
  }, [abierto, pendiente]);

  if (!abierto) return null;

  function cerrar() {
    setNombre("");
    setHex(HEX_INICIAL);
    setError(null);
    onCerrar();
  }

  function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError("Escribe un nombre para el color.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const datos = new FormData();
      datos.set("nombre", nombreLimpio);
      datos.set("hex", hex);
      try {
        const color = await crearColor(datos);
        onCreado(color);
        cerrar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear el color.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink-deep/60"
        onClick={pendiente ? undefined : cerrar}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nuevo-color-titulo"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="nuevo-color-titulo" className="font-display text-xl text-ink-display">
            Nuevo color
          </h2>
          <button
            type="button"
            onClick={cerrar}
            disabled={pendiente}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-surface-high hover:text-ink-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto">
          <label htmlFor={idNombre} className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-display">
              Nombre del color
            </span>
            <input
              id={idNombre}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Verde botella"
              autoFocus
              className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-display">Tono</span>
            <div className="flex items-center gap-3">
              <span
                className="h-14 w-14 shrink-0 rounded-full border border-line shadow-xs"
                style={{ backgroundColor: hex }}
                aria-hidden="true"
              />
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2">
                <input
                  id={idHex}
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  aria-label="Elegir tono del color"
                  className="h-10 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <label htmlFor={idHex} className="font-mono text-sm uppercase text-ink/70">
                  {hex}
                </label>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-sm text-ink/80">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={pendiente}
            className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-heritage-navy text-base font-semibold text-white shadow-sm transition-colors hover:bg-deep-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : "Guardar color"}
          </button>
          <button
            type="button"
            onClick={cerrar}
            disabled={pendiente}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-ink/60 transition-colors hover:text-ink-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
