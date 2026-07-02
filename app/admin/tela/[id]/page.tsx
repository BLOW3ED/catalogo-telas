import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, ImageOff, Star } from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl } from "@/lib/supabase/storage";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { OrdenColores } from "@/components/admin/OrdenColores";
import {
  actualizarTela,
  actualizarVarianteDetalle,
  crearVariante,
  eliminarFoto,
  eliminarVariante,
  moverFoto,
  subirFotos,
} from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Editar tela — Admin",
  robots: { index: false, follow: false },
};

type Lookup = { id: string; nombre: string };
type Foto = { id: string; ruta: string; orden: number; alt: string | null; created_at: string };
type Variante = {
  id: string;
  orden?: number; // solo existe tras la sección 11 del SQL
  sku: string | null;
  color_id: string | null;
  acabado_id: string | null;
  precio_metro: number | null;
  gramaje: number | null;
  stock: number | null;
  es_bordado: boolean;
  es_brillante: boolean;
  es_traslucida: boolean;
  es_tornasol: boolean;
  foto: Foto[];
};

const inputClase =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber";

/**
 * Variantes en el orden manual (`orden`, sección 11 del SQL). Si esa columna
 * aún no existe (42703) cae al orden por antigüedad y la página muestra el
 * aviso de migración pendiente en lugar del ordenador de colores.
 */
async function getVariantes(
  supabase: ReturnType<typeof createAdminClient>,
  telaId: string
): Promise<{ variantes: Variante[]; faltaMigracionOrden: boolean }> {
  const seleccion = "*, foto(id, ruta, orden, alt, created_at)";
  let { data, error } = await supabase
    .from("variante")
    .select(seleccion)
    .eq("tela_id", telaId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error?.code === "42703") {
    ({ data, error } = await supabase
      .from("variante")
      .select(seleccion)
      .eq("tela_id", telaId)
      .order("created_at", { ascending: true }));
    return { variantes: (data ?? []) as Variante[], faltaMigracionOrden: true };
  }

  return { variantes: (data ?? []) as Variante[], faltaMigracionOrden: false };
}

/**
 * Editor completo de un modelo: valores de la tela, sus relaciones N:N,
 * cada variante (SKU/color/precio/stock/propiedades) y sus fotos
 * (subir, reordenar, eliminar). Todo con formularios → server actions:
 * cero estado en el cliente, funciona igual en la tablet de la tienda.
 */
export default async function EditarTelaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, autorizado } = await getSesionAdmin();
  if (!user) redirect("/admin/login");
  if (!autorizado) redirect("/admin");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createAdminClient();
  const [
    { data: tela },
    { data: categorias },
    { data: colores },
    { data: acabados },
    { data: casosUso },
    { data: oportunidades },
    { variantes, faltaMigracionOrden },
    { data: casosActuales },
    { data: oportunidadesActuales },
  ] = await Promise.all([
    supabase.from("tela").select("*").eq("id", id).single(),
    supabase.from("categoria").select("id, nombre").order("nombre"),
    supabase.from("color").select("id, nombre, hex").order("nombre"),
    supabase.from("acabado").select("id, nombre").order("nombre"),
    supabase.from("caso_uso").select("id, nombre").order("nombre"),
    supabase.from("oportunidad").select("id, nombre").order("nombre"),
    getVariantes(supabase, id),
    supabase.from("tela_caso_uso").select("caso_uso_id").eq("tela_id", id),
    supabase.from("tela_oportunidad").select("oportunidad_id").eq("tela_id", id),
  ]);

  if (!tela) notFound();

  const casosMarcados = new Set((casosActuales ?? []).map((c) => c.caso_uso_id));
  const oportunidadesMarcadas = new Set(
    (oportunidadesActuales ?? []).map((o) => o.oportunidad_id)
  );
  const nombreColor = new Map((colores ?? []).map((c) => [c.id, c.nombre]));
  const hexColor = new Map((colores ?? []).map((c) => [c.id, c.hex as string | null]));

  // Fichas para el ordenador de colores: nombre, swatch y miniatura de portada.
  const coloresOrdenables = variantes.map((v) => {
    const portada = [...v.foto].sort(
      (a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at)
    )[0];
    return {
      id: v.id,
      nombre:
        (v.color_id ? nombreColor.get(v.color_id) : null) ??
        (v.sku ? `SKU ${v.sku}` : "Sin color"),
      hex: v.color_id ? (hexColor.get(v.color_id) ?? null) : null,
      fotoUrl: portada ? publicImageUrl(portada.ruta) : null,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav titulo={`Editar: ${tela.nombre}`} email={user.email ?? ""} />

      <Link
        href={`/tela/${tela.slug}`}
        target="_blank"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-amber underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      >
        Ver en el catálogo público
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>

      {/* ------------------------------------------------ Valores del modelo */}
      <section aria-labelledby="datos-tela">
        <h2 id="datos-tela" className="mb-3 font-display text-xl text-ink">
          Datos del modelo
        </h2>
        <form
          action={actualizarTela}
          className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm"
        >
          <input type="hidden" name="tela_id" value={tela.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Nombre *</span>
              <input type="text" name="nombre" required defaultValue={tela.nombre} className={inputClase} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">URL (slug)</span>
              <input type="text" name="slug" defaultValue={tela.slug} className={inputClase} />
              <span className="mt-1 block text-xs text-ink/50">
                Cambiarla rompe enlaces ya compartidos por WhatsApp.
              </span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Categoría</span>
            <select name="categoria_id" defaultValue={tela.categoria_id ?? ""} className={inputClase}>
              <option value="">— Sin categoría —</option>
              {(categorias ?? []).map((c: Lookup) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Descripción</span>
            <textarea
              name="descripcion"
              rows={3}
              defaultValue={tela.descripcion ?? ""}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Casos de uso</legend>
            <div className="flex flex-wrap gap-2">
              {(casosUso ?? []).map((c: Lookup) => (
                <CheckboxChip
                  key={c.id}
                  name="casos_uso"
                  value={c.id}
                  etiqueta={c.nombre}
                  marcado={casosMarcados.has(c.id)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Oportunidades</legend>
            <div className="flex flex-wrap gap-2">
              {(oportunidades ?? []).map((o: Lookup) => (
                <CheckboxChip
                  key={o.id}
                  name="oportunidades"
                  value={o.id}
                  etiqueta={o.nombre}
                  marcado={oportunidadesMarcadas.has(o.id)}
                />
              ))}
            </div>
          </fieldset>

          <SubmitButton label="Guardar datos del modelo" pendingLabel="Guardando…" />
        </form>
      </section>

      {/* ------------------------------------------------------- Variantes */}
      <section aria-labelledby="variantes" className="mt-10">
        <h2 id="variantes" className="mb-3 font-display text-xl text-ink">
          Variantes ({variantes.length})
        </h2>

        {faltaMigracionOrden && variantes.length > 1 && (
          <p className="mb-6 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-ink/80">
            Para poder ordenar los colores arrastrándolos, corre la sección 11 de{" "}
            <code className="rounded bg-line/60 px-1">catalogo_telas_supabase.sql</code> en
            Supabase Studio.
          </p>
        )}

        {!faltaMigracionOrden && (
          <OrdenColores telaId={tela.id} colores={coloresOrdenables} />
        )}

        <div className="space-y-6">
          {variantes.map((v) => (
            <article
              key={v.id}
              className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <h3 className="mb-4 font-semibold text-ink">
                {v.color_id ? nombreColor.get(v.color_id) ?? "Variante" : "Sin color"}
                {v.sku && <span className="ml-2 text-sm font-normal text-ink/50">SKU {v.sku}</span>}
              </h3>

              <form action={actualizarVarianteDetalle} className="space-y-4">
                <input type="hidden" name="variante_id" value={v.id} />
                <input type="hidden" name="tela_id" value={tela.id} />
                <CamposVariante
                  colores={colores ?? []}
                  acabados={acabados ?? []}
                  valores={v}
                />
                <SubmitButton label="Guardar variante" pendingLabel="Guardando…" size="sm" />
              </form>

              {/* Fotos de la variante */}
              <div className="mt-6 border-t border-line pt-4">
                <h4 className="mb-3 text-sm font-medium text-ink">
                  Fotos ({v.foto.length}) — la primera es la portada en el catálogo
                </h4>

                {v.foto.length === 0 && (
                  <p className="mb-3 flex items-center gap-2 text-sm text-ink/50">
                    <ImageOff className="h-4 w-4" aria-hidden />
                    Sin fotos: esta variante sale con un marcador gris en el catálogo.
                  </p>
                )}

                <ul className="mb-4 flex flex-wrap gap-3">
                  {[...v.foto]
                    .sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at))
                    .map((f, idx, lista) => (
                      <li key={f.id} className="w-28">
                        <div className="relative aspect-square w-28 overflow-hidden rounded-xl border border-line bg-line/40">
                          <Image
                            src={publicImageUrl(f.ruta) ?? ""}
                            alt={f.alt ?? tela.nombre}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
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
                            <input type="hidden" name="tela_id" value={tela.id} />
                            <input type="hidden" name="direccion" value="subir" />
                            <BotonIcono etiqueta="Mover antes" deshabilitado={idx === 0}>
                              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                            </BotonIcono>
                          </form>
                          <form action={eliminarFoto}>
                            <input type="hidden" name="foto_id" value={f.id} />
                            <input type="hidden" name="tela_id" value={tela.id} />
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
                            <input type="hidden" name="tela_id" value={tela.id} />
                            <input type="hidden" name="direccion" value="bajar" />
                            <BotonIcono etiqueta="Mover después" deshabilitado={idx === lista.length - 1}>
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </BotonIcono>
                          </form>
                        </div>
                      </li>
                    ))}
                </ul>

                <form action={subirFotos} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <input type="hidden" name="variante_id" value={v.id} />
                  <input type="hidden" name="tela_id" value={tela.id} />
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-medium text-ink/60">
                      Agregar fotos (JPG, PNG o WebP; puedes elegir varias)
                    </span>
                    <input
                      type="file"
                      name="fotos"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      required
                      className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-xl file:border-0 file:bg-amber file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-amber/90"
                    />
                  </label>
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-medium text-ink/60">
                      Texto alternativo (accesibilidad)
                    </span>
                    <input
                      type="text"
                      name="alt"
                      placeholder={`${tela.nombre}${v.color_id ? ` ${nombreColor.get(v.color_id) ?? ""}` : ""}`}
                      className="h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                    />
                  </label>
                  <SubmitButton label="Subir fotos" pendingLabel="Subiendo…" size="sm" />
                </form>
              </div>

              <div className="mt-6 border-t border-line pt-4">
                <form action={eliminarVariante}>
                  <input type="hidden" name="variante_id" value={v.id} />
                  <input type="hidden" name="tela_id" value={tela.id} />
                  <ConfirmSubmit
                    label="Eliminar variante"
                    pendingLabel="Eliminando…"
                    mensaje="¿Eliminar esta variante con sus fotos y su historial de inventario? No se puede deshacer."
                  />
                </form>
              </div>
            </article>
          ))}
        </div>

        {/* Nueva variante */}
        <article className="mt-6 rounded-2xl border border-dashed border-line bg-surface/60 p-6">
          <h3 className="mb-4 font-semibold text-ink">Agregar variante (color/SKU)</h3>
          <form action={crearVariante} className="space-y-4">
            <input type="hidden" name="tela_id" value={tela.id} />
            <CamposVariante colores={colores ?? []} acabados={acabados ?? []} />
            <SubmitButton label="Agregar variante" pendingLabel="Agregando…" size="sm" />
          </form>
        </article>
      </section>
    </main>
  );
}

/** Campos compartidos entre "editar variante" y "nueva variante". */
function CamposVariante({
  colores,
  acabados,
  valores,
}: {
  colores: (Lookup & { hex?: string })[];
  acabados: Lookup[];
  valores?: Variante;
}) {
  const propiedades = [
    ["es_bordado", "Bordado"],
    ["es_brillante", "Brillante"],
    ["es_traslucida", "Traslúcida"],
    ["es_tornasol", "Tornasol"],
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Color</span>
          <select name="color_id" defaultValue={valores?.color_id ?? ""} className={inputClase}>
            <option value="">— Sin color —</option>
            {colores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Acabado</span>
          <select name="acabado_id" defaultValue={valores?.acabado_id ?? ""} className={inputClase}>
            <option value="">— Sin acabado —</option>
            {acabados.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">SKU</span>
          <input
            type="text"
            name="sku"
            defaultValue={valores?.sku ?? ""}
            placeholder="solo si existe físico"
            className={inputClase}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Precio/m (MXN)</span>
          <input
            type="number"
            name="precio_metro"
            defaultValue={valores?.precio_metro ?? ""}
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="a consultar"
            className={inputClase}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Stock (m)</span>
          <input
            type="number"
            name="stock"
            defaultValue={valores?.stock ?? ""}
            min="0"
            step="0.5"
            inputMode="decimal"
            placeholder="—"
            className={inputClase}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Gramaje (g/m²)</span>
          <input
            type="number"
            name="gramaje"
            defaultValue={valores?.gramaje ?? ""}
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="—"
            className={inputClase}
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink/60">Propiedades ópticas</legend>
        <div className="flex flex-wrap gap-2">
          {propiedades.map(([name, etiqueta]) => (
            <CheckboxChip
              key={name}
              name={name}
              value="on"
              etiqueta={etiqueta}
              marcado={valores?.[name] ?? false}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** Checkbox estilizado como chip (mismo lenguaje visual que AttributeBadges). */
function CheckboxChip({
  name,
  value,
  etiqueta,
  marcado,
}: {
  name: string;
  value: string;
  etiqueta: string;
  marcado: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-high has-[:checked]:border-amber has-[:checked]:bg-amber/10">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={marcado}
        className="h-4 w-4 rounded border-line accent-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      />
      {etiqueta}
    </label>
  );
}

/** Botón compacto de submit para reordenar fotos. */
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
