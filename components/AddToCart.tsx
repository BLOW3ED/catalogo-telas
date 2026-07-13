"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import type { CatalogoTela } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export function AddToCart({ variante }: { variante: CatalogoTela }) {
  const [cantidad, setCantidad] = useState<number>(1);
  const addItem = useCartStore((state) => state.addItem);

  // Solo stock === 0 es agotado; stock null significa "no capturado".
  const agotado = variante.stock === 0;

  const handleAdd = () => {
    if (cantidad > 0) {
      addItem(variante, cantidad);
      // Opcionalmente podemos resetear la cantidad local
      setCantidad(1);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center justify-between rounded border border-line-strong/30 bg-chip p-1 sm:w-40">
          <button
            type="button"
            disabled={agotado}
            onClick={() => setCantidad((prev) => Math.max(0.5, prev - 0.5))}
            className="flex h-14 w-14 items-center justify-center rounded text-xl text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Menos medio metro"
          >
            -
          </button>
          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <span className="font-medium leading-none text-ink">{cantidad}</span>
            <span className="mt-1 text-xs uppercase text-ink-soft">metros</span>
          </div>
          <button
            type="button"
            disabled={agotado}
            onClick={() => setCantidad((prev) => prev + 0.5)}
            className="flex h-14 w-14 items-center justify-center rounded text-xl text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Más medio metro"
          >
            +
          </button>
        </div>
        {/* `sm:flex-1` y no `flex-1`: en el layout móvil (flex-col) un flex-basis
            de 0 colapsa la ALTURA del botón y lo deja casi invisible; solo en
            fila (sm+) queremos que crezca a lo ancho junto al stepper. */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleAdd}
          disabled={agotado}
          className="sm:flex-1"
        >
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {agotado ? "Sin existencia" : "Agregar a mi cotización"}
        </Button>
      </div>
      {agotado && (
        <p className="text-sm text-ink-soft">
          Este color está agotado por ahora — pregunta por WhatsApp si lo
          quieres apartar o saber cuándo llega.
        </p>
      )}
    </div>
  );
}
