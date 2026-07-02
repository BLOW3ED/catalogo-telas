import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Pencil, Search, ShieldAlert } from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { actualizarVariante, logout } from "./actions";
import type { CatalogoTela } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin — Telas La Jalisciense",
  robots: { index: false, follow: false },
};

/**
 * Panel de administración: edición inline de precio y stock por variante —
 * lo que la tienda ajusta a diario. El lápiz de cada fila abre el editor
 * completo (/admin/tela/[id]: valores, variantes, fotos) y la navegación
 * lleva a inventario (/admin/inventario) y al alta de telas (/admin/tela/nueva).
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

  const { data, error } = await query;
  const variantes = (data ?? []) as CatalogoTela[];

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
        Precio en MXN por metro; stock en metros. Deja el campo{" "}
        <strong>vacío</strong> para “a consultar” (no es lo mismo que 0). Si el
        modo de precios demo está activo, los campos vacíos se muestran al
        público con un precio de referencia.
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
          <li
            key={v.variante_id}
            className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
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
                    alt={
                      v.color_nombre
                        ? `${v.tela_nombre} ${v.color_nombre}`
                        : v.tela_nombre
                    }
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight text-ink">
                    {v.tela_nombre}
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
                </div>
              </div>

              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
                  Precio/m
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
                  Stock (m)
                  <input
                    type="number"
                    name="stock"
                    defaultValue={v.stock ?? ""}
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    placeholder="—"
                    className="h-10 w-24 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                  />
                </label>
                <SubmitButton label="Guardar" pendingLabel="Guardando…" size="sm" />
                <Link
                  href={`/admin/tela/${v.tela_id}`}
                  aria-label={`Editar ${v.tela_nombre}: valores, variantes y fotos`}
                  title="Editar tela (valores, variantes y fotos)"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink/70 shadow-sm transition-colors hover:bg-surface-high hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
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
