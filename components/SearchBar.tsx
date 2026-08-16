"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const terminoEnUrl = searchParams.get("q") ?? "";
  const [valor, setValor] = useState(terminoEnUrl);
  const qsActual = searchParams.toString();

  useEffect(() => {
    if (valor.trim() === terminoEnUrl) return;

    const t = setTimeout(() => {
      const v = valor.trim();
      const params = new URLSearchParams(qsActual);
      if (v) params.set("q", v);
      else params.delete("q");
      params.delete("ver");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [valor, pathname, router, qsActual, terminoEnUrl]);

  return (
    <div className="relative w-full group">
      <span
        className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-ink-soft/70 transition-colors group-focus-within:text-heritage-navy"
        aria-hidden
      >
        search
      </span>
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Buscar telas, mercería, color o SKU..."
        aria-label="Buscar productos del catálogo"
        className="w-full h-14 pl-12 pr-12 rounded-full border border-outline-variant/40 bg-surface-container-lowest/80 backdrop-blur-sm text-base text-ink-text placeholder:text-ink-soft/70 shadow-xs transition-all focus:bg-surface-container-lowest focus:border-accent-copper focus:outline-none focus:ring-2 focus:ring-accent-copper/30 focus:shadow-md"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-soft/70 transition-all hover:bg-surface-container hover:text-ink-text active:scale-95"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

