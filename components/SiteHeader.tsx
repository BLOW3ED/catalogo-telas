"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/store";
import { useGuideStore } from "@/lib/guide-store";
import { useScrollCompacto } from "@/lib/useScrollCompacto";
import { ShareCatalog } from "@/components/ShareCatalog";

export function SiteHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const openTutorial = useGuideStore((state) => state.openTutorial);
  const compacto = useScrollCompacto();

  useEffect(() => {
    setMounted(true);
  }, []);

  const itemCount = items.length;
  const isCatalogo = pathname === "/" || pathname.startsWith("/tela/");
  const isInspiracion = pathname === "/inspiracion";

  return (
    /* Mismo blanco que las tarjetas (`--color-surface-container-lowest`, #fff),
        no un `bg-white` suelto: la paleta vive en globals.css. Al 60% deja
        entrever la banda de foto del hero, que la sección mete debajo con
        `-mt-16`; el `backdrop-blur-xl` es lo que mantiene legible el texto
        sobre una foto tan movida. */
    <header className="sticky top-0 z-40 w-full border-b border-line/60 bg-surface-container-lowest/60 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-all">
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-3 transition-all sm:h-16 sm:px-6 lg:px-8 ${
          compacto ? "h-12" : "h-16"
        }`}
      >
        {/* Marca / Logo */}
        <Link href="/" className="group flex items-center gap-2 sm:gap-2.5 focus-visible:outline-none min-w-0">
          {/* El monograma es 2.13:1, no cuadrado: se sirve ya recortado a su caja
              (`-marca.webp`) para no arrastrar el 60% de negro vacio del original.
              El fondo negro es parte del archivo; `bg-black` solo evita el
              destello blanco mientras carga. `alt=""` a proposito: el nombre de
              la tienda ya va como texto aqui al lado, no hay que repetirlo. */}
          <div className="shrink-0 overflow-hidden rounded-xl bg-black shadow-xs">
            <Image
              src="/logo-jalisciense-marca.webp"
              alt=""
              width={640}
              height={329}
              priority
              sizes="78px"
              className={`w-auto transition-all sm:h-10 ${compacto ? "h-7" : "h-9"}`}
            />
          </div>
          <div className="flex flex-col min-w-0">
            {/* En móvil, la franja "Fresnillo · Atelier" es lo primero que se
                sacrifica al hacer scroll: no aporta orientación una vez que
                ya se sabe en qué sitio se está, y es puro alto reclamado. */}
            <span
              className={`text-[9px] font-bold uppercase tracking-widest text-amber truncate sm:block sm:text-[10px] ${
                compacto ? "hidden" : "block"
              }`}
            >
              Fresnillo · Atelier
            </span>
            <span className="font-display text-lg sm:text-2xl font-bold tracking-tight text-ink-display transition-colors group-hover:text-amber truncate">
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
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Botón ¿Cómo pedir? / Guía en 4 pasos (oculto en móvil pequeño porque ya está en MobileBottomNav) */}
          <button
            type="button"
            onClick={openTutorial}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-amber/40 bg-surface-container-lowest/80 px-3.5 py-1.5 text-xs font-bold text-ink-display shadow-xs transition-all hover:bg-surface-container hover:border-amber active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Cómo funciona el catálogo en 4 pasos"
          >
            <span className="material-symbols-outlined text-[18px] text-amber">
              help_outline
            </span>
            <span>¿Cómo pedir?</span>
            <span className="inline-flex rounded bg-amber/15 px-1.5 py-0.2 text-[10px] font-bold text-amber">
              4 pasos
            </span>
          </button>

          {/* Compartir catálogo. El `hidden` va en este span y NO en el className del
              Button: `Button` concatena clases sin tailwind-merge, asi que su
              `inline-flex` de base le gana al `hidden` y el boton se colaba en movil
              comiendose ~142px del header (el nombre de la tienda salia truncado). */}
          <span className="hidden sm:inline-flex">
            <ShareCatalog variant="ghost" size="md" label="Compartir" />
          </span>

          {/* Botón Carrito / Cotización */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-surface-container text-ink-display border border-outline-variant/30 shadow-xs transition-all hover:bg-surface-container-high hover:shadow active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Ver mi cotización"
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[20px]">shopping_bag</span>
            {mounted && itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1.5 text-xs font-bold text-white shadow-xs ring-2 ring-sand-bg">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
