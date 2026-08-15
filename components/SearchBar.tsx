"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Caja de búsqueda. El estado vive en la URL (`?q=`) para que sea compartible
 * y que el Server Component vuelva a consultar el catálogo. Debounce de 300ms
 * para no navegar en cada tecla.
 *
 * Al navegar CONSERVA el resto del querystring: los chips de filtro viven ahí
 * mismo, y reescribir la URL entera los borraría en cada tecla.
 */
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const terminoEnUrl = searchParams.get("q") ?? "";
  const [valor, setValor] = useState(terminoEnUrl);
  // El objeto de searchParams cambia de identidad en cada render; su texto no.
  // Dependemos del texto para no re-disparar el efecto sin que nada cambie.
  const qsActual = searchParams.toString();

  useEffect(() => {
    // Este efecto REACCIONA a la URL y además la ESCRIBE, así que solo debe
    // navegar cuando la caja y la URL discrepan — o sea, cuando el usuario
    // acaba de teclear. Cualquier otra navegación ("Ver más", un chip) también
    // cambia `qsActual` y volvería a entrar aquí: sin esta guarda, el
    // `delete("ver")` de abajo deshace la paginación 300ms después de picarla.
    // Cubre de paso el primer render, donde `valor` sale de la propia URL.
    if (valor.trim() === terminoEnUrl) return;

    const t = setTimeout(() => {
      const v = valor.trim();
      const params = new URLSearchParams(qsActual);
      if (v) params.set("q", v);
      else params.delete("q");
      // Otra búsqueda son otros resultados: volver a la primera página. Sin
      // esto, quien venía de picar "Ver más" tres veces se traería ese `ver`
      // a una búsqueda de dos resultados.
      params.delete("ver");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [valor, pathname, router, qsActual, terminoEnUrl]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft"
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar por nombre, color o SKU…"
        aria-label="Buscar telas"
        className="w-full rounded border border-line-strong/30 bg-chip py-3 pl-12 pr-12 text-ink placeholder:text-ink-soft focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-soft transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
