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
  const openWelcome = useGuideStore((state) => state.openWelcome);

  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = items.length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex flex-col">
          <p className="text-label-caps text-[10px] text-amber-soft sm:text-xs">
            Fresnillo · Telas al menudeo
          </p>
          <h1 className="font-display text-2xl text-ink transition-colors group-hover:text-amber sm:text-3xl">
            Telas La Jalisciense
          </h1>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* ¿Cómo funciona? — reabre la guía de bienvenida */}
          <button
            type="button"
            onClick={openWelcome}
            className="flex items-center gap-1.5 rounded-full p-2 text-ink/70 transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber sm:px-3"
            aria-label="Cómo funciona el catálogo"
          >
            <HelpCircle className="h-6 w-6" aria-hidden="true" />
            <span className="hidden text-sm font-medium sm:inline">Ayuda</span>
          </button>

          {/* Compartir catálogo por WhatsApp */}
          <ShareCatalog variant="ghost" size="md" label="Compartir" className="hidden sm:inline-flex" />
          <ShareCatalog variant="ghost" size="md" label="" className="sm:hidden !px-2" />

          {/* Carrito / cotización */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex items-center justify-center rounded-full p-2 text-ink transition-colors hover:bg-line/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            aria-label="Ver mi cotización"
          >
            <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            {mounted && itemCount > 0 && (
              <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-white shadow-sm ring-2 ring-bg">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
