"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { reordenarVariantes } from "@/app/admin/actions";

export type ColorOrdenable = {
  id: string;
  nombre: string;
  hex: string | null;
  fotoUrl: string | null;
};

/**
 * Ordenador de colores de una tela: arrastra las fichas (mouse) o usa las
 * flechas (tablet/teclado). Guarda solo al soltar o al tocar una flecha; el
 * orden manda en el selector de color del catálogo público.
 */
export function OrdenColores({
  telaId,
  colores,
}: {
  telaId: string;
  colores: ColorOrdenable[];
}) {
  const router = useRouter();
  const [orden, setOrden] = useState(colores);
  const [error, setError] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();
  const indiceArrastrado = useRef<number | null>(null);
  // Último orden confirmado en la BD: para no guardar de más ni perder el
  // punto de retorno si el guardado falla.
  const ordenGuardado = useRef(colores.map((c) => c.id).join(","));

  // Tras router.refresh() (o alta/baja de variantes) el server manda la lista
  // fresca: re-sincronizar el estado local con ella.
  const idsProps = colores.map((c) => c.id).join(",");
  useEffect(() => {
    setOrden(colores);
    ordenGuardado.current = idsProps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsProps]);

  const guardar = (nuevo: ColorOrdenable[]) => {
    const ids = nuevo.map((c) => c.id);
    if (ids.join(",") === ordenGuardado.current) return; // sin cambios reales

    setError(null);
    startTransition(async () => {
      const res = await reordenarVariantes(telaId, ids);
      if (res.error) {
        setError(res.error);
        // Revertir al último orden que sí está en la BD.
        const posicion = new Map(
          ordenGuardado.current.split(",").map((id, i) => [id, i])
        );
        setOrden([...nuevo].sort((a, b) => (posicion.get(a.id) ?? 0) - (posicion.get(b.id) ?? 0)));
        return;
      }
      ordenGuardado.current = ids.join(",");
      router.refresh();
    });
  };

  const mover = (desde: number, hacia: number) => {
    if (hacia < 0 || hacia >= orden.length || desde === hacia) return orden;
    const copia = [...orden];
    const [pieza] = copia.splice(desde, 1);
    copia.splice(hacia, 0, pieza);
    return copia;
  };

  /** Flechas: un paso y guardar de inmediato (funciona en tablet y teclado). */
  const moverYGuardar = (desde: number, hacia: number) => {
    const nuevo = mover(desde, hacia);
    setOrden(nuevo);
    guardar(nuevo);
  };

  if (orden.length < 2) return null;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">
          Orden de los colores
          <span className="ml-2 font-normal text-ink/50">
            arrastra las fichas o usa las flechas; así salen en el catálogo
          </span>
        </h3>
        <span className="shrink-0 text-xs text-ink/50" aria-live="polite">
          {guardando ? "Guardando…" : ""}
        </span>
      </div>

      <ol className="flex flex-wrap gap-2">
        {orden.map((c, i) => (
          <li
            key={c.id}
            draggable
            onDragStart={(e) => {
              indiceArrastrado.current = i;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnter={() => {
              const desde = indiceArrastrado.current;
              if (desde === null || desde === i) return;
              setOrden(mover(desde, i));
              indiceArrastrado.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              indiceArrastrado.current = null;
              guardar(orden);
            }}
            className={`flex cursor-grab items-center gap-2 rounded-xl border border-line bg-bg py-1.5 pl-2 pr-1 text-sm text-ink shadow-sm transition-shadow active:cursor-grabbing ${
              indiceArrastrado.current === i ? "ring-2 ring-amber" : ""
            }`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-ink/30" aria-hidden />
            <span className="text-xs tabular-nums text-ink/40">{i + 1}</span>
            {c.fotoUrl ? (
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-line">
                <Image src={c.fotoUrl} alt="" fill sizes="28px" className="object-cover" />
              </span>
            ) : (
              <span
                className="h-7 w-7 shrink-0 rounded-lg border border-line"
                style={{ backgroundColor: c.hex ?? "var(--color-line)" }}
                aria-hidden
              />
            )}
            <span className="max-w-32 truncate">{c.nombre}</span>
            <span className="ml-1 flex">
              <button
                type="button"
                disabled={guardando || i === 0}
                onClick={() => moverYGuardar(i, i - 1)}
                aria-label={`Mover ${c.nombre} antes`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-line/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                disabled={guardando || i === orden.length - 1}
                onClick={() => moverYGuardar(i, i + 1)}
                aria-label={`Mover ${c.nombre} después`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-line/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
