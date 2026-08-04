"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import type { CatalogoTela } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { unidadDe } from "@/lib/unidades";

export function AddToCart({ variante }: { variante: CatalogoTela }) {
  // El stepper se mueve en la unidad del producto: la tela se corta a medios
  // metros, pero un botón no se parte a la mitad. Antes todo iba de 0.5 en 0.5
  // y se podía mandar "0.5 botones" a cotizar.
  const unidad = unidadDe(variante.unidad_venta);
  const [cantidad, setCantidad] = useState<number>(unidad.clave === "metro" ? 1 : unidad.minimo);
  const addItem = useCartStore((state) => state.addItem);

  // Solo stock === 0 es agotado; stock null significa "no capturado".
  const agotado = variante.stock === 0;

  const handleAdd = () => {
    if (cantidad > 0) {
      addItem(variante, cantidad);
      // Opcionalmente podemos resetear la cantidad local
      setCantidad(unidad.clave === "metro" ? 1 : unidad.minimo);
    }
  };

  // "Menos medio metro" solo es cierto para la tela; para lo demás el lector
  // de pantalla debe oír "Menos una pieza".
  const etiquetaMenos =
    unidad.clave === "metro" ? "Menos medio metro" : `Menos ${unidad.singular}`;
  const etiquetaMas =
    unidad.clave === "metro" ? "Más medio metro" : `Más ${unidad.singular}`;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center justify-between rounded border border-line-strong/30 bg-chip p-1 sm:w-40">
          <button
            type="button"
            disabled={agotado}
            onClick={() => setCantidad((prev) => Math.max(unidad.minimo, prev - unidad.paso))}
            className="flex h-14 w-14 items-center justify-center rounded text-xl text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={etiquetaMenos}
          >
            -
          </button>
          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <span className="font-medium leading-none text-ink">{cantidad}</span>
            <span className="mt-1 text-xs uppercase text-ink-soft">{unidad.plural}</span>
          </div>
          <button
            type="button"
            disabled={agotado}
            onClick={() => setCantidad((prev) => prev + unidad.paso)}
            className="flex h-14 w-14 items-center justify-center rounded text-xl text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={etiquetaMas}
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
