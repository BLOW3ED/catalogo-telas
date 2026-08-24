import { LogOut } from "lucide-react";
import { logout } from "@/app/revision/actions";

/**
 * Encabezado de /revision: SOLO título + cerrar sesión. A propósito no
 * reusa `AdminNav` — no tiene sentido ofrecerle inventario ni altas a un
 * revisor, esta cola es su única pantalla (más el detalle de producto).
 */
export function RevisionNav({ email }: { email: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-ink-display sm:text-3xl">
          Revisión de catálogo
        </h1>
        <p className="mt-0.5 truncate text-sm text-ink/60">
          Telas La Jalisciense · {email}
        </p>
      </div>
      <form action={logout} className="shrink-0">
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink-display shadow-sm transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </form>
    </div>
  );
}
