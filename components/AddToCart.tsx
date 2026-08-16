"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/store";
import type { CatalogoTela } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { unidadDe } from "@/lib/unidades";

export function AddToCart({ variante }: { variante: CatalogoTela }) {
  const unidad = unidadDe(variante.unidad_venta);
  const [cantidad, setCantidad] = useState<number>(unidad.clave === "metro" ? 1 : unidad.minimo);
  const addItem = useCartStore((state) => state.addItem);
  const [agregadoAnim, setAgregadoAnim] = useState(false);

  const agotado = variante.stock === 0;

  const handleAdd = () => {
    if (cantidad > 0) {
      addItem(variante, cantidad);
      setAgregadoAnim(true);
      setTimeout(() => setAgregadoAnim(false), 1500);
      setCantidad(unidad.clave === "metro" ? 1 : unidad.minimo);
    }
  };

  const etiquetaMenos =
    unidad.clave === "metro" ? "Menos medio metro" : `Menos ${unidad.singular}`;
  const etiquetaMas =
    unidad.clave === "metro" ? "Más medio metro" : `Más ${unidad.singular}`;

  return (
    <>
      {/* Contenedor desktop / flujo normal */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row items-stretch">
          {/* Stepper */}
          <div className="flex h-14 items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-container px-2 shadow-inner-xs sm:w-44">
            <button
              type="button"
              disabled={agotado}
              onClick={() => setCantidad((prev) => Math.max(unidad.minimo, prev - unidad.paso))}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-lg font-bold text-heritage-navy shadow-xs transition-all hover:bg-surface-container-high active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={etiquetaMenos}
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <div className="flex flex-1 flex-col items-center justify-center px-1">
              <span className="text-base font-bold leading-none text-heritage-navy">{cantidad}</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-copper">{unidad.plural}</span>
            </div>
            <button
              type="button"
              disabled={agotado}
              onClick={() => setCantidad((prev) => prev + unidad.paso)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-lg font-bold text-heritage-navy shadow-xs transition-all hover:bg-surface-container-high active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={etiquetaMas}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>

          {/* Botón Principal */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleAdd}
            disabled={agotado}
            className="sm:flex-1 h-14"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {agregadoAnim ? "check" : "shopping_bag"}
            </span>
            {agotado ? "Sin existencia" : agregadoAnim ? "¡Agregado a la Cesta!" : "Añadir a la Cesta"}
          </Button>
        </div>
        {agotado && (
          <p className="text-sm text-ink-soft">
            Este color está agotado por ahora — consúltanos por WhatsApp para apartarlo.
          </p>
        )}
      </div>

      {/* Barra flotante en Mobile (Fija en el pie sobre el MobileBottomNav) */}
      <div className="fixed bottom-16 left-0 right-0 z-30 block border-t border-line/60 bg-sand-bg/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md sm:hidden">
        <div className="flex gap-2.5 items-center">
          <div className="flex h-12 items-center bg-surface-container rounded-xl px-1.5 border border-outline-variant/30">
            <button
              type="button"
              disabled={agotado}
              onClick={() => setCantidad((prev) => Math.max(unidad.minimo, prev - unidad.paso))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest text-heritage-navy active:bg-surface-container-high disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="w-9 text-center text-xs font-bold text-heritage-navy">{cantidad}</span>
            <button
              type="button"
              disabled={agotado}
              onClick={() => setCantidad((prev) => prev + unidad.paso)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest text-heritage-navy active:bg-surface-container-high disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={agotado}
            className="flex-1 h-12 rounded-xl bg-heritage-navy text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {agregadoAnim ? "check" : "shopping_bag"}
            </span>
            <span>{agregadoAnim ? "¡Agregado!" : "Añadir a la Cesta"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

