"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import type { CatalogoTela } from "@/lib/types";

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
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <div className="flex items-center justify-between rounded-xl border border-line bg-white p-1 shadow-sm sm:w-40">
        <button
          type="button"
          onClick={() => setCantidad((prev) => Math.max(0.5, prev - 0.5))}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-line/30 hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          aria-label="Menos"
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
          className="flex h-12 w-12 items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-line/30 hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          aria-label="Más"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-amber px-5 font-medium text-white shadow-sm transition-colors hover:bg-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2"
      >
        <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        Agregar al Carrito
      </button>
    </div>
  );
}
