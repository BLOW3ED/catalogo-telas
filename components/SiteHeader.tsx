"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/store";
import { useGuideStore } from "@/lib/guide-store";
import { ShareCatalog } from "@/components/ShareCatalog";

export function SiteHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const openTutorial = useGuideStore((state) => state.openTutorial);

  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = items.length;
  const isCatalogo = pathname === "/" || pathname.startsWith("/tela/");
  const isInspiracion = pathname === "/inspiracion";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line/60 bg-sand-bg/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Marca / Logo */}
        <Link href="/" className="group flex items-center gap-2.5 focus-visible:outline-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-heritage-navy text-sand-bg font-bold shadow-xs">
            <span className="material-symbols-outlined text-[20px]">texture</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent-copper">
              Fresnillo · Atelier
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-heritage-navy transition-colors group-hover:text-accent-copper sm:text-2xl">
              Telas La Jalisciense
            </span>
          </div>
        </Link>

        {/* Links de navegación para desktop / tablet */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              isCatalogo
                ? "bg-heritage-navy text-white shadow-xs"
                : "text-ink-soft hover:bg-surface-container hover:text-ink-text"
            }`}
          >
            Catálogo
          </Link>
          <Link
            href="/inspiracion"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              isInspiracion
                ? "bg-heritage-navy text-white shadow-xs"
                : "text-ink-soft hover:bg-surface-container hover:text-ink-text"
            }`}
          >
            Inspiración
          </Link>
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {/* Botón ¿Cómo funciona? / Ayuda */}
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-ink-soft transition-all hover:bg-surface-container hover:text-ink-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Cómo funciona el catálogo"
          >
            <span className="material-symbols-outlined text-[20px] text-heritage-navy">help_outline</span>
            <span className="hidden text-sm font-medium sm:inline">Ayuda</span>
          </button>

          {/* Compartir catálogo */}
          <ShareCatalog variant="ghost" size="md" label="Compartir" className="hidden sm:inline-flex" />

          {/* Botón Carrito / Cotización */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-heritage-navy border border-outline-variant/30 shadow-xs transition-all hover:bg-surface-container-high hover:shadow active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Ver mi cotización"
          >
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            {mounted && itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-copper px-1.5 text-xs font-bold text-white shadow-xs ring-2 ring-sand-bg">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

