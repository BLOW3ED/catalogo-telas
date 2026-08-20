"use client";

import { useEffect, useState } from "react";

/**
 * true en cuanto el scroll vertical pasa `umbral`. La usan SiteHeader y
 * CatalogToolbar para compactarse en móvil y dejarle más espacio a las
 * fotos del catálogo — sin esto la cabecera + la barra de categorías se
 * quedan fijas ocupando ~1/3 de la pantalla todo el tiempo.
 */
export function useScrollCompacto(umbral = 24): boolean {
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    function onScroll() {
      setCompacto(window.scrollY > umbral);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [umbral]);

  return compacto;
}
