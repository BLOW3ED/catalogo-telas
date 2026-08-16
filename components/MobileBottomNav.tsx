"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/store";
import { useGuideStore } from "@/lib/guide-store";

export function MobileBottomNav() {
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
    <nav
      aria-label="Navegación principal móvil"
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-line/60 bg-sand-bg/90 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.05)] backdrop-blur-xl sm:hidden"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {/* Tab 1: Catálogo */}
        <Link
          href="/"
          className={`flex min-h-[44px] min-w-[64px] flex-col items-center justify-center transition-colors active:scale-95 ${
            isCatalogo ? "text-heritage-navy font-bold" : "text-ink-soft/70 hover:text-ink-text"
          }`}
          aria-current={isCatalogo ? "page" : undefined}
        >
          <span className="material-symbols-outlined text-[22px]">grid_view</span>
          <span className="mt-0.5 text-[11px] tracking-tight">Catálogo</span>
        </Link>

        {/* Tab 2: Inspiración */}
        <Link
          href="/inspiracion"
          className={`flex min-h-[44px] min-w-[64px] flex-col items-center justify-center transition-colors active:scale-95 ${
            isInspiracion ? "text-heritage-navy font-bold" : "text-ink-soft/70 hover:text-ink-text"
          }`}
          aria-current={isInspiracion ? "page" : undefined}
        >
          <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
          <span className="mt-0.5 text-[11px] tracking-tight">Inspiración</span>
        </Link>

        {/* Tab 3: Cesta / Cotización */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex min-h-[44px] min-w-[64px] flex-col items-center justify-center text-ink-soft/70 transition-colors hover:text-ink-text active:scale-95"
          aria-label="Ver mi cotización"
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
            {mounted && itemCount > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-copper px-1 text-[10px] font-bold text-white shadow-xs">
                {itemCount}
              </span>
            )}
          </div>
          <span className="mt-0.5 text-[11px] tracking-tight">Cesta</span>
        </button>

        {/* Tab 4: Ayuda / Tutorial */}
        <button
          type="button"
          onClick={openTutorial}
          className="flex min-h-[44px] min-w-[64px] flex-col items-center justify-center text-ink-soft/70 transition-colors hover:text-ink-text active:scale-95"
          aria-label="Cómo funciona el catálogo"
        >
          <span className="material-symbols-outlined text-[22px]">help_outline</span>
          <span className="mt-0.5 text-[11px] tracking-tight">Ayuda</span>
        </button>
      </div>
    </nav>
  );
}
