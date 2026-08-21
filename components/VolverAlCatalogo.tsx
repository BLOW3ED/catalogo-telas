"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * `router.back()` en vez de `Link href="/"`: reproduce la navegación previa
 * tal cual (filtros, `?ver=`, scroll) porque reutiliza la entrada de
 * historial existente. Un `Link` a "/" siempre manda a la portada limpia,
 * sin importar de dónde vino el cliente.
 *
 * Si no hay historial propio (llegó por un link compartido, nueva pestaña),
 * `history.length` es 1 y `back()` no tendría a dónde ir — ahí cae a "/".
 */
export function VolverAlCatalogo() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-soft shadow-xs transition-all hover:bg-surface-container hover:text-ink-display active:scale-95"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Volver al catálogo
    </button>
  );
}
