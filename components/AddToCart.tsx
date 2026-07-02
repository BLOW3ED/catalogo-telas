"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import type { CatalogoTela } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Hint } from "@/components/Hint";

export function AddToCart({ variante }: { variante: CatalogoTela }) {
  const [cantidad, setCantidad] = useState<number>(1);
  const addItem = useCartStore((state) => state.addItem);

  const handleAdd = () => {
    if (cantidad > 0) {
      addItem(variante, cantidad);
      // Opcionalmente podemos resetear la cantidad local
      setCantidad(1);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Hint id="detalle-metros">
        Elige cuántos metros necesitas y toca “Agregar”. Se
        guarda en tu cotización.
      </Hint>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-1 shadow-sm sm:w-40">
          <button
            type="button"
            onClick={() => setCantidad((prev) => Math.max(0.5, prev - 0.5))}
            className="flex h-14 w-14 items-center justify-center rounded-lg text-xl text-ink/60 transition-colors hover:bg-line/30 hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            aria-label="Menos medio metro"
          >
            -
          </button>
          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <span className="font-medium leading-none text-ink">{cantidad}</span>
            <span className="mt-1 text-[10px] uppercase text-ink/50">metros</span>
          </div>
          <button
            type="button"
            onClick={() => setCantidad((prev) => prev + 0.5)}
            className="flex h-14 w-14 items-center justify-center rounded-lg text-xl text-ink/60 transition-colors hover:bg-line/30 hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            aria-label="Más medio metro"
          >
            +
          </button>
        </div>
        <Button variant="primary" size="lg" fullWidth onClick={handleAdd} className="flex-1">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          Agregar a mi cotización
        </Button>
      </div>
    </div>
  );
}
