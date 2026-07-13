"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Caja de búsqueda. El estado vive en la URL (`?q=`) para que sea compartible
 * y que el Server Component vuelva a consultar el catálogo. Debounce de 300ms
 * para no navegar en cada tecla.
 */
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(searchParams.get("q") ?? "");
  const primera = useRef(true);

  useEffect(() => {
    // El primer render ya refleja la URL: no re-navegar.
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => {
      const v = valor.trim();
      router.replace(v ? `${pathname}?q=${encodeURIComponent(v)}` : pathname, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [valor, pathname, router]);

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
