"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ArrowRight, FolderInput, ImageOff, Plus, Star } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import {
  eliminarFoto,
  moverFoto,
  moverFotoANuevaVariante,
  moverFotoAVariante,
} from "@/app/admin/actions";
import { MoverFotoModal } from "@/components/admin/MoverFotoModal";

export type FotoGaleria = { id: string; url: string | null; alt: string | null };
export type VarianteGaleria = {
  id: string;
  nombre: string;
  hex: string | null;
  /** Ya ordenadas por `orden`: la primera es la portada de ese color. */
  fotos: FotoGaleria[];
};

/** Qué foto se está arrastrando y de qué variante salió. */
type Arrastre = { fotoId: string; origenId: string };

/**
 * Todas las fotos del producto, agrupadas por color y REASIGNABLES entre ellos.
 *
 * Está fuera de la ficha de cada variante —y no una por variante— porque las
 * zonas de drop son los OTROS colores: hay que verlos todos a la vez para poder
 * arrastrar de uno a otro. Existe por un problema de captura concreto: decenas
 * de variantes traen varios colores amontonados como fotos extra de una sola
 * (Gema llegó con 18). Antes, corregirlo era borrar y volver a subir, tirando
 * el encuadre ya curado; aquí la foto solo cambia de dueño.
 *
 * El arrastre es un ATAJO, nunca la única vía: cada foto trae además un botón
 * "Mover…" que abre el mismo destino en un modal, que es como se usa en la
 * tablet de la tienda y con teclado. Mismo patrón que `OrdenColores`.
 */
export function GaleriaFotos({
  telaId,
  telaNombre,
  variantes,
}: {
  telaId: string;
  telaNombre: string;
  variantes: VarianteGaleria[];
}) {
  const router = useRouter();
  const arrastrada = useRef<Arrastre | null>(null);
  // Solo para el resaltado de la zona bajo el cursor: no decide nada.
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, startTransition] = useTransition();
  const [modal, setModal] = useState<Arrastre | null>(null);

  const total = variantes.reduce((n, v) => n + v.fotos.length, 0);

  /** Corre un movimiento y refresca; el error se pinta sin tirar la página. */
  const correr = (accion: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await accion();
      if (res.error) return setError(res.error);
      router.refresh();
    });
  };

  /** Toma la foto arrastrada (y limpia el estado de arrastre) o `null`. */
  const soltada = (): Arrastre | null => {
    const arrastre = arrastrada.current;
    arrastrada.current = null;
    setSobre(null);
    return arrastre;
  };

  const propsZona = (clave: string, alSoltar: (a: Arrastre) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setSobre(clave);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Solo cuando el puntero sale de la zona ENTERA: al pasar de una
      // miniatura a otra el evento se dispara aunque sigas dentro.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setSobre((actual) => (actual === clave ? null : actual));
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const arrastre = soltada();
      if (arrastre) alSoltar(arrastre);
    },
  });

  const anillo = (clave: string) =>
    sobre === clave ? "border-amber ring-2 ring-amber" : "border-line";

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">
          Fotos del producto ({total})
        </h3>
        <span className="shrink-0 text-xs text-ink/50" aria-live="polite">
          {moviendo ? "Moviendo…" : ""}
        </span>
      </div>
      <p className="mb-4 text-xs text-ink/50">
        La primera foto de cada color es su portada. <strong>Arrastra</strong> una
        foto al color al que de verdad pertenece —o usa su botón{" "}
        <strong>Mover…</strong>, que hace lo mismo sin arrastrar—. La foto
        conserva su recorte y sus tamaños; solo cambia de color.
      </p>

      <div className="space-y-3">
        {variantes.map((v) => (
          <section
            key={v.id}
            {...propsZona(v.id, (a) => {
              if (a.origenId === v.id) return; // ya estaba en este color
              correr(() => moverFotoAVariante(a.fotoId, v.id));
            })}
            className={`rounded-xl border bg-bg p-3 transition-colors ${anillo(v.id)}`}
          >
            <h4 className="mb-2 flex items-center gap-2 text-sm text-ink">
              <ColorSwatch hex={v.hex} nombre={v.nombre} size="sm" />
              <span className="truncate font-medium">{v.nombre}</span>
              <span className="text-xs font-normal text-ink/50">
                {v.fotos.length === 0
                  ? "sin fotos"
                  : `${v.fotos.length} ${v.fotos.length === 1 ? "foto" : "fotos"}`}
              </span>
            </h4>

            {v.fotos.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-xs text-ink/50">
                <ImageOff className="h-4 w-4 shrink-0" aria-hidden />
                Sin fotos: este color sale con un marcador gris en el catálogo.
                Arrástrale una.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {v.fotos.map((f, idx, lista) => (
                  <li
                    key={f.id}
                    draggable
                    onDragStart={(e) => {
                      arrastrada.current = { fotoId: f.id, origenId: v.id };
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      arrastrada.current = null;
                      setSobre(null);
                    }}
                    className="w-28 cursor-grab active:cursor-grabbing"
                  >
                    <div className="relative aspect-square w-28 overflow-hidden rounded-xl border border-line bg-line/40">
                      {f.url && (
                        <Image
                          src={f.url}
                          alt={f.alt ?? telaNombre}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      )}
                      {idx === 0 && (
                        <span
                          className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-lg bg-amber px-1.5 py-0.5 text-[10px] font-medium text-white"
                          title="Foto principal"
                        >
                          <Star className="h-3 w-3" aria-hidden /> Portada
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <form action={moverFoto}>
                        <input type="hidden" name="foto_id" value={f.id} />
                        <input type="hidden" name="variante_id" value={v.id} />
                        <input type="hidden" name="tela_id" value={telaId} />
                        <input type="hidden" name="direccion" value="subir" />
                        <BotonIcono etiqueta="Mover antes" deshabilitado={idx === 0}>
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        </BotonIcono>
                      </form>
                      <form action={eliminarFoto}>
                        <input type="hidden" name="foto_id" value={f.id} />
                        <input type="hidden" name="tela_id" value={telaId} />
                        <ConfirmSubmit
                          label="Borrar"
                          pendingLabel="…"
                          size="xs"
                          mensaje="¿Eliminar esta foto? Se borra también del almacenamiento y no se puede deshacer."
                        />
                      </form>
                      <form action={moverFoto}>
                        <input type="hidden" name="foto_id" value={f.id} />
                        <input type="hidden" name="variante_id" value={v.id} />
                        <input type="hidden" name="tela_id" value={telaId} />
                        <input type="hidden" name="direccion" value="bajar" />
                        <BotonIcono
                          etiqueta="Mover después"
                          deshabilitado={idx === lista.length - 1}
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </BotonIcono>
                      </form>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModal({ fotoId: f.id, origenId: v.id })}
                      className="mt-1 inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg border border-line bg-surface text-[11px] font-medium text-ink/70 transition-colors hover:border-amber hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                    >
                      <FolderInput className="h-3 w-3" aria-hidden />
                      Mover…
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* Zonas SOLO de arrastre: el camino equivalente sin ratón es el botón
          "Mover…" de cada foto, que abre estos mismos destinos en el modal. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div
          {...propsZona("nueva", (a) =>
            correr(() => moverFotoANuevaVariante(a.fotoId, telaId))
          )}
          className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-xs text-ink/60 transition-colors ${anillo(
            "nueva"
          )}`}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Suelta aquí para darle su propio color
        </div>
        <div
          {...propsZona("otro", (a) => setModal(a))}
          className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-xs text-ink/60 transition-colors ${anillo(
            "otro"
          )}`}
        >
          <FolderInput className="h-4 w-4 shrink-0" aria-hidden />
          Suelta aquí para mandarla a otro producto
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {modal && (
        <MoverFotoModal
          fotoId={modal.fotoId}
          telaId={telaId}
          hermanas={variantes
            .filter((v) => v.id !== modal.origenId)
            .map((v) => ({ id: v.id, nombre: v.nombre, hex: v.hex }))}
          onCerrar={() => setModal(null)}
          onHecho={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Botón compacto de submit para reordenar fotos dentro de su color. */
function BotonIcono({
  etiqueta,
  deshabilitado,
  children,
}: {
  etiqueta: string;
  deshabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={etiqueta}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink/70 transition-colors hover:bg-surface-high hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
