import Link from "next/link";
import { Boxes, LayoutGrid, LogOut, Plus } from "lucide-react";
import { logout } from "@/app/admin/actions";

const enlaces = [
  { href: "/admin", etiqueta: "Catálogo", Icono: LayoutGrid },
  { href: "/admin/inventario", etiqueta: "Inventario", Icono: Boxes },
  { href: "/admin/tela/nueva", etiqueta: "Nueva tela", Icono: Plus },
] as const;

/**
 * Encabezado compartido de las páginas del admin: título, navegación entre
 * secciones y cierre de sesión. Server component: el logout es una action.
 */
export function AdminNav({ titulo, email }: { titulo: string; email: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-ink">{titulo}</h1>
        <p className="mt-1 text-sm text-ink/60">Sesión: {email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {enlaces.map(({ href, etiqueta, Icono }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <Icono className="h-4 w-4" aria-hidden />
            {etiqueta}
          </Link>
        ))}
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
