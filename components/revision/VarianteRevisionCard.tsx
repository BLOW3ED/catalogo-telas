"use client";

import { useState, useTransition } from "react";
import { Expand, Plus, X } from "lucide-react";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { publicImageUrl } from "@/lib/supabase/storage";
import type { DerivadosFoto } from "@/lib/types";
import { unidadDe } from "@/lib/unidades";
import { actualizarVarianteRevision, marcarRevisado } from "@/app/revision/actions";
import { NuevoColorSheet, type ColorNuevo } from "@/components/revision/NuevoColorSheet";

export type ColorLookup = { id: string; nombre: string; hex: string | null };

export type VarianteRevision = {
  id: string;
  sku: string | null;
  color_id: string | null;
  precio: number | null;
  unidad_venta: string | null;
  medida: string | null;
  nota: string | null;
  revisado_en: string | null;
  color: { nombre: string; hex: string | null } | null;
  foto: { ruta: string; orden: number; created_at: string; derivados: DerivadosFoto | null }[];
};

const inputClase =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber";

/**
 * Una tarjeta por variante: el toggle "Revisado" se guarda al instante
 * (independiente del resto de los campos, que solo se guardan con "Guardar
 * cambios"), y el selector de color puede abrir el alta rápida de un color
 * que todavía no existe en la lista.
 */
export function VarianteRevisionCard({
  telaId,
  variante,
  colores: coloresIniciales,
  placeholderMedida,
}: {
  telaId: string;
  variante: VarianteRevision;
  colores: ColorLookup[];
  placeholderMedida: string;
}) {
  const [revisado, setRevisado] = useState(variante.revisado_en != null);
  const [pendienteRevisado, startRevisadoTransition] = useTransition();
  const [errorRevisado, setErrorRevisado] = useState<string | null>(null);

  const [colores, setColores] = useState<ColorLookup[]>(coloresIniciales);
  const [colorSeleccionado, setColorSeleccionado] = useState(variante.color_id ?? "");
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState(false);

  const colorActual = colores.find((c) => c.id === colorSeleccionado) ?? null;

  const fotoPrincipal = [...variante.foto].sort(
    (a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at)
  )[0];

  function alternarRevisado() {
    const siguiente = !revisado;
    setRevisado(siguiente); // optimista: el empleado no espera a la red para ver el cambio
    setErrorRevisado(null);
    startRevisadoTransition(async () => {
      const datos = new FormData();
      datos.set("variante_id", variante.id);
      datos.set("tela_id", telaId);
      if (siguiente) datos.set("revisado", "on");
      try {
        await marcarRevisado(datos);
      } catch (e) {
        setRevisado(!siguiente); // revertir si el servidor lo rechazó
        setErrorRevisado(e instanceof Error ? e.message : "No se pudo actualizar.");
      }
    });
  }

  function alCrearColor(color: ColorNuevo) {
    setColores((prev) => [...prev, color].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setColorSeleccionado(color.id);
  }

  const unidad = unidadDe(variante.unidad_venta);

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      {/* ------------------------------------------------------- Fila superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <ColorSwatch hex={colorActual?.hex ?? null} nombre={colorActual?.nombre ?? "Sin color"} size="lg" />
          <div>
            <span className="block font-display text-lg text-ink-display">
              {colorActual?.nombre ?? "Sin color"}
            </span>
            <span className="mt-0.5 inline-block rounded-full border border-line bg-bg px-2 py-0.5 text-xs text-ink/60">
              Se vende por {unidad.singular}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <ToggleRevisado
            revisado={revisado}
            pendiente={pendienteRevisado}
            onToggle={alternarRevisado}
          />
          {errorRevisado && <p className="text-xs text-amber">{errorRevisado}</p>}
        </div>
      </div>

      {/* ------------------------------------------------------- Foto + form */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {fotoPrincipal ? (
          <button
            type="button"
            onClick={() => setFotoAbierta(true)}
            aria-label="Ver foto en grande"
            className="group relative h-24 w-24 shrink-0 self-start overflow-hidden rounded-lg border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
          >
            <TelaImage
              src={publicImageUrl(fotoPrincipal.ruta)}
              derivados={fotoPrincipal.derivados}
              sizes="96px"
              alt={`Foto de referencia — ${colorActual?.nombre ?? "sin color"}`}
              aspecto="cuadrado"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-ink-deep/0 transition-colors group-hover:bg-ink-deep/30 group-active:bg-ink-deep/30">
              <Expand
                className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                aria-hidden
              />
            </span>
          </button>
        ) : (
          <div className="h-24 w-24 shrink-0 self-start overflow-hidden rounded-lg border border-line">
            <TelaImage src={null} sizes="96px" alt="Sin foto de referencia" aspecto="cuadrado" />
          </div>
        )}

        <form action={actualizarVarianteRevision} className="flex-1 space-y-4">
          <input type="hidden" name="variante_id" value={variante.id} />
          <input type="hidden" name="tela_id" value={telaId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">SKU</span>
              <input
                type="text"
                name="sku"
                defaultValue={variante.sku ?? ""}
                placeholder="Ej. BNK1041-DOR"
                className={inputClase}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">Precio (MXN)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/50">
                  $
                </span>
                <input
                  type="number"
                  name="precio"
                  defaultValue={variante.precio ?? ""}
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="a consultar"
                  className="h-11 w-full rounded-xl border border-line bg-bg pl-7 pr-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                />
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">Color</span>
              <select
                name="color_id"
                value={colorSeleccionado}
                onChange={(e) => setColorSeleccionado(e.target.value)}
                className={inputClase}
              >
                <option value="">— Sin color —</option>
                {colores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSheetAbierto(true)}
                className="-ml-1 mt-0.5 inline-flex h-10 items-center gap-1 rounded px-1 text-xs font-semibold text-ink-display underline decoration-heritage-navy/50 underline-offset-4 hover:decoration-heritage-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Toca aquí si no encuentras el color del producto
              </button>
              <span className="mt-0.5 block text-xs text-ink/40">
                Revisa bien la lista antes de agregar uno — evita crear colores repetidos.
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">Medida</span>
              <input
                type="text"
                name="medida"
                defaultValue={variante.medida ?? ""}
                placeholder={placeholderMedida}
                className={inputClase}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">Notas (opcional)</span>
            <textarea
              name="nota"
              defaultValue={variante.nota ?? ""}
              rows={2}
              placeholder="Ej. no estoy seguro del color, falta la foto…"
              className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>

          <SubmitButton label="Guardar cambios" pendingLabel="Guardando…" />
        </form>
      </div>

      <NuevoColorSheet
        abierto={sheetAbierto}
        onCerrar={() => setSheetAbierto(false)}
        onCreado={alCrearColor}
      />

      {fotoAbierta && fotoPrincipal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de referencia — ${colorActual?.nombre ?? "sin color"}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/80 p-4"
          onClick={() => setFotoAbierta(false)}
        >
          <button
            type="button"
            onClick={() => setFotoAbierta(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink-display shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div
            className="relative aspect-square w-full max-w-lg overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <TelaImage
              src={publicImageUrl(fotoPrincipal.ruta)}
              derivados={fotoPrincipal.derivados}
              sizes="90vw"
              alt={`Foto de referencia — ${colorActual?.nombre ?? "sin color"}`}
              aspecto="cuadrado"
              priority
            />
          </div>
        </div>
      )}
    </article>
  );
}

/** Interruptor "Revisado": guarda al instante, sin esperar al form principal. */
function ToggleRevisado({
  revisado,
  pendiente,
  onToggle,
}: {
  revisado: boolean;
  pendiente: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={revisado}
      disabled={pendiente}
      onClick={onToggle}
      className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy disabled:cursor-not-allowed disabled:opacity-60 ${
        revisado
          ? "border-success/40 bg-success/10 text-success"
          : "border-line bg-bg text-ink-display hover:bg-surface-high"
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          revisado ? "bg-success" : "bg-line"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            revisado ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      {revisado ? "Revisado" : "Marcar revisado"}
    </button>
  );
}
