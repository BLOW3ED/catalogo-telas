"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearCategoria } from "@/app/revision/actions";

export type CategoriaNueva = { id: string; nombre: string; slug: string };

/**
 * Alta rápida de una categoría desde /revision, para cuando la que hace
 * falta no está en la lista — mismo patrón que `NuevoColorSheet`, sin el
 * selector de tono (una categoría no tiene color).
 */
export function NuevaCategoriaSheet({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (categoria: CategoriaNueva) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idNombre = useId();

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
    setError(null);
    onCerrar();
  }

  function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setError("Escribe un nombre para la categoría.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const datos = new FormData();
      datos.set("nombre", nombreLimpio);
      try {
        const categoria = await crearCategoria(datos);
        onCreado(categoria);
        cerrar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear la categoría.");
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
        aria-labelledby="nueva-categoria-titulo"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="nueva-categoria-titulo" className="font-display text-xl text-ink-display">
            Nueva categoría
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
              Nombre de la categoría
            </span>
            <input
              id={idNombre}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Encaje, Pedrería, Botones"
              autoFocus
              className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            />
          </label>

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
            {pendiente ? "Guardando…" : "Guardar categoría"}
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
