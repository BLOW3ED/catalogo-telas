import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Image as ImageIcon,
  ImageOff,
  LogOut,
  Pencil,
  Search,
  ShieldAlert,
} from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { contarFotosPorVariante } from "@/lib/fotos";
import { unidadDe } from "@/lib/unidades";
import { actualizarVariante, logout } from "./actions";
import type { CatalogoTela } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin — Telas La Jalisciense",
  robots: { index: false, follow: false },
};

/**
 * Panel de administración: edición inline de precio y stock por variante —
 * lo que la tienda ajusta a diario. La CARD COMPLETA abre el editor
 * (/admin/tela/[id]: valores, variantes, fotos); solo los campos de captura y
 * el botón Guardar quedan exentos, para que tocar el precio en la tablet no
 * navegue. La navegación lleva a inventario (/admin/inventario) y a las dos
 * altas: telas (/admin/tela/nueva) y mercería (/admin/merceria/nueva).
 *
 * Lee la vista con el cliente service_role SIN caché: el admin siempre ve
 * la verdad de la BD (sin precios demo). Al guardar, `revalidateTag` refresca
 * el sitio público al instante.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, autorizado } = await getSesionAdmin();
  if (!user) redirect("/admin/login");
  if (!autorizado) return <NoAutorizado email={user.email ?? ""} />;

  const { q } = await searchParams;
  const termino = q?.trim() ?? "";

  const supabase = createAdminClient();
  let query = supabase
    .from("catalogo_telas")
    .select("*")
    .order("tela_nombre", { ascending: true })
    .order("color_nombre", { ascending: true });

  if (termino) {
    const patron = `%${termino.replace(/[,()"\\]/g, " ")}%`;
    query = query.or(
      `tela_nombre.ilike.${patron},color_nombre.ilike.${patron},sku.ilike.${patron}`
    );
  }

  // El conteo de fotos NO está en la vista (colapsa las N fotos de la variante
  // en `foto_principal`), así que va en una lectura aparte que se agrupa en
  // memoria. Se piden TODAS las filas, sin filtrar por las variantes visibles:
  // un `in(...)` con cientos de UUIDs revienta el largo de la URL de PostgREST.
  const [{ data, error }, { data: fotos }] = await Promise.all([
    query,
    supabase.from("foto").select("variante_id"),
  ]);
  const variantes = (data ?? []) as CatalogoTela[];
  const fotosPorVariante = contarFotosPorVariante(fotos ?? []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav titulo="Administración" email={user.email ?? ""} />

      {/* Búsqueda (GET → estado compartible en la URL, igual que el sitio público) */}
      <form method="get" className="mb-3 flex max-w-md gap-2" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={termino}
            placeholder="Buscar por tela, color o SKU…"
            aria-label="Buscar variantes"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          Buscar
        </button>
      </form>

      <p className="mb-6 text-xs text-ink/50">
        <strong>Toca la tarjeta</strong> para abrir el editor completo (fotos,
        colores, categoría). Precio y stock se capturan aquí mismo, en la
        UNIDAD DE VENTA de cada variante (metro, pieza, bolsa…), que se indica
        bajo cada campo. Deja el campo <strong>vacío</strong> para “a consultar”
        (no es lo mismo que 0). Si el modo de precios demo está activo, los
        campos vacíos se muestran al público con un precio de referencia.
      </p>

      {error && (
        <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm text-ink/80">
          No se pudo leer el catálogo: {error.message}
        </div>
      )}

      {!error && variantes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-sm text-ink/50">
          {termino
            ? `Sin resultados para “${termino}”.`
            : "Aún no hay variantes en el catálogo. Corre la ingesta (ver README)."}
        </div>
      )}

      <ul className="space-y-3">
        {variantes.map((v) => (
          <FilaVariante
            key={v.variante_id}
            v={v}
            fotos={fotosPorVariante.get(v.variante_id) ?? 0}
          />
        ))}
      </ul>
    </main>
  );
}

/**
 * Una variante en la lista: identidad (foto, modelo, color/SKU), sus dos datos
 * de catalogación —categoría y cuántas fotos tiene— y la captura diaria de
 * precio y stock. Toda la card es un enlace al editor MENOS esa captura.
 */
function FilaVariante({ v, fotos }: { v: CatalogoTela; fotos: number }) {
  return (
    <li
      /* `relative` ancla el stretched link del nombre (su ::after cubre
         toda la card). `group` deja que el lápiz decorativo reaccione al
         hover de la card completa, no solo al del enlace. */
      className="group relative rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-amber/40 hover:bg-surface-high"
    >
      <form
        action={actualizarVariante}
        className="flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="variante_id" value={v.variante_id} />

        <div className="flex flex-1 items-center gap-3">
          <div className="w-12 shrink-0 overflow-hidden rounded-lg border border-line">
            <TelaImage
              src={publicImageUrl(v.foto_principal)}
              derivados={v.foto_principal_derivados}
              sizes="48px"
              alt={
                v.color_nombre
                  ? `${v.tela_nombre} ${v.color_nombre}`
                  : v.tela_nombre
              }
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold leading-tight text-ink">
              {/* Stretched link: enlace REAL sobre el nombre (así tiene
                  texto accesible y se puede abrir en otra pestaña) cuyo
                  ::after se estira sobre la card entera. No se puede
                  envolver el <form> en un <a>: HTML inválido. */}
              <Link
                href={`/admin/tela/${v.tela_id}`}
                title="Editar tela (valores, variantes y fotos)"
                className="truncate rounded after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                {v.tela_nombre}
              </Link>
              <Pencil
                className="h-3.5 w-3.5 shrink-0 text-ink/30 transition-colors group-hover:text-amber"
                aria-hidden
              />
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/60">
              {v.color_hex && (
                <ColorSwatch
                  hex={v.color_hex}
                  nombre={v.color_nombre}
                  size="sm"
                />
              )}
              <span className="truncate">
                {v.color_nombre ?? "Sin color"}
                {v.sku && ` · ${v.sku}`}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={
                  v.categoria
                    ? "rounded-full border border-line bg-bg px-2 py-0.5 text-ink/70"
                    : "rounded-full border border-dashed border-line px-2 py-0.5 text-ink/40"
                }
              >
                {v.categoria ?? "Sin categoría"}
              </span>
              {/* Cero fotos se marca en ámbar: es un producto invisible
                  en el catálogo, no un dato de menos. */}
              <span
                className={
                  fotos === 0
                    ? "inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 font-medium text-amber"
                    : "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-ink/50"
                }
              >
                {fotos === 0 ? (
                  <ImageOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                )}
                {fotos === 0 ? "Sin fotos" : `${fotos} ${fotos === 1 ? "foto" : "fotos"}`}
              </span>
            </p>
          </div>
        </div>

        {/* z-10 levanta la captura por encima del ::after del enlace: sin
            esto, tocar el precio en la tablet abriría el editor. */}
        <div className="relative z-10 flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            Precio {unidadDe(v.unidad_venta).sufijoPrecio}
            <input
              type="number"
              name="precio_metro"
              defaultValue={v.precio_metro ?? ""}
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="a consultar"
              className="h-10 w-28 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            Stock ({unidadDe(v.unidad_venta).abreviatura})
            <input
              type="number"
              name="stock"
              defaultValue={v.stock ?? ""}
              min="0"
              step={unidadDe(v.unidad_venta).paso}
              inputMode="decimal"
              placeholder="—"
              className="h-10 w-24 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
          <SubmitButton label="Guardar" pendingLabel="Guardando…" size="sm" />
        </div>
      </form>
    </li>
  );
}

/** Sesión válida pero correo fuera de ADMIN_EMAILS. */
function NoAutorizado({ email }: { email: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-amber">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl text-ink">Cuenta sin permisos</h1>
      <p className="mt-2 text-sm text-ink/60">
        La cuenta <strong>{email}</strong> no está en la lista de
        administradores (<code className="rounded bg-line/60 px-1">ADMIN_EMAILS</code>).
      </p>
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
