"use client";

import Link from "next/link";
import { ShoppingBag, HelpCircle } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useGuideStore } from "@/lib/guide-store";
import { ShareCatalog } from "@/components/ShareCatalog";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const openTutorial = useGuideStore((state) => state.openTutorial);

  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = items.length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/85 backdrop-blur-xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] transition-all">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex flex-col focus-visible:outline-none">
          <span className="text-label-caps text-[10px] tracking-widest text-ink-soft sm:text-xs">
            Fresnillo · Catálogo
          </span>
          <h1 className="font-display text-2xl tracking-tight text-ink-deep transition-colors group-hover:text-primary sm:text-3xl">
            Telas La Jalisciense
          </h1>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* ¿Cómo funciona? — reabre el tutorial de slides */}
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-ink-soft transition-all hover:bg-surface-container hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Cómo funciona el catálogo"
          >
            <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="hidden text-sm font-medium sm:inline">Ayuda</span>
          </button>

          {/* Compartir catálogo por WhatsApp */}
          <ShareCatalog variant="ghost" size="md" label="Compartir" className="hidden sm:inline-flex" />
          <ShareCatalog variant="ghost" size="md" label="" className="sm:hidden !px-2" />

          {/* Carrito / cotización */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-sm border border-line transition-all hover:bg-surface-container hover:shadow active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ver mi cotización"
          >
            <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
            {mounted && itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white shadow-sm ring-2 ring-surface">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
