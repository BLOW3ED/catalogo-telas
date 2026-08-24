"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { GuardadoFeedback } from "@/components/revision/GuardadoFeedback";
import { actualizarCategoriaProducto, type EstadoGuardado } from "@/app/revision/actions";
import { NuevaCategoriaSheet, type CategoriaNueva } from "@/components/revision/NuevaCategoriaSheet";

export type CategoriaLookup = { id: string; nombre: string };

/**
 * Categoría del producto: mismo patrón que el selector de color de cada
 * variante (`VarianteRevisionCard`) pero a nivel `tela` — elegir de la lista
 * o, si no existe, abrir el alta rápida. Su propio form con su propio botón
 * de guardar, igual que `NombreProductoForm`.
 */
export function CategoriaProductoForm({
  telaId,
  categoriaId,
  categorias: categoriasIniciales,
}: {
  telaId: string;
  categoriaId: string | null;
  categorias: CategoriaLookup[];
}) {
  const [categorias, setCategorias] = useState<CategoriaLookup[]>(categoriasIniciales);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(categoriaId ?? "");
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [estado, setEstado] = useState<EstadoGuardado | null>(null);
  const [pendiente, startTransition] = useTransition();

  function alCrearCategoria(categoria: CategoriaNueva) {
    setCategorias((prev) => [...prev, categoria].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setCategoriaSeleccionada(categoria.id);
  }

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(async () => {
      setEstado(await actualizarCategoriaProducto(datos));
    });
  }

  return (
    <div className="mt-2">
      <form onSubmit={guardar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tela_id" value={telaId} />
        <select
          name="categoria_id"
          value={categoriaSeleccionada}
          onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          aria-label="Categoría del producto"
          className="h-9 rounded-full border border-line bg-bg px-3 text-xs text-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <option value="">— Sin categoría —</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <SubmitButton label="Guardar" pendingLabel="Guardando…" size="sm" pending={pendiente} />
      </form>
      <GuardadoFeedback estado={estado} />
      <button
        type="button"
        onClick={() => setSheetAbierto(true)}
        className="-ml-1 mt-1 inline-flex h-8 items-center gap-1 rounded px-1 text-xs font-semibold text-ink-display underline decoration-heritage-navy/50 underline-offset-4 hover:decoration-heritage-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Toca aquí si no encuentras la categoría del producto
      </button>

      <NuevaCategoriaSheet
        abierto={sheetAbierto}
        onCerrar={() => setSheetAbierto(false)}
        onCreado={alCrearCategoria}
      />
    </div>
  );
}
