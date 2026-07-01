"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setIsOpen = useCartStore((state) => state.setIsOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = items.length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex flex-col">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-soft sm:text-xs">
            Fresnillo · Telas al menudeo
          </p>
          <h1 className="font-display text-2xl text-ink transition-colors group-hover:text-amber sm:text-3xl">
            Telas La Jalisciense
          </h1>
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center rounded-full p-2 text-ink transition-colors hover:bg-line/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          aria-label="Ver carrito"
        >
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
          {mounted && itemCount > 0 && (
            <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-white shadow-sm ring-2 ring-bg">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
