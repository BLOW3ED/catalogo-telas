"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ColorSwatch } from "@/components/ColorSwatch";
import {
  type Filtros as EstadoFiltros,
  type FacetaLista,
  alternar,
  aQuerystring,
  cuentaFiltros,
} from "@/lib/filtros";
import type { Facetas } from "@/lib/queries";
import { useScrollCompacto } from "@/lib/useScrollCompacto";

interface CatalogToolbarProps {
  filtros: EstadoFiltros;
  facetas: Facetas;
}

export function CatalogToolbar({ filtros, facetas }: CatalogToolbarProps) {
  const [panelFiltrosAbierto, setPanelFiltrosAbierto] = useState(false);
  const compacto = useScrollCompacto();

  const activos = cuentaFiltros(filtros);
  const totalFiltrosAvanzados =
    filtros.colores.length +
    filtros.propiedades.length +
    (filtros.soloDisponibles ? 1 : 0);

  const hayAvanzados =
    facetas.colores.length > 0 ||
    facetas.propiedades.length > 0 ||
    facetas.hayStock;

  const href = (faceta: FacetaLista, valor: string) =>
    ruta(alternar(filtros, faceta, valor));

  return (
    <div
      className={`sticky z-30 w-full border-b border-line/60 bg-sand-bg/90 pb-2.5 pt-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all sm:top-16 sm:pb-3 sm:pt-3 ${
        compacto ? "top-12" : "top-16"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Fila 1: Barra de Búsqueda + Botón de Filtros Detallados + Limpiar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Suspense
              fallback={
                <div className="h-11 w-full animate-pulse rounded-full bg-surface-container" />
              }
            >
              <SearchBar />
            </Suspense>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botón Filtros Detallados */}
            {hayAvanzados && (
              <button
                type="button"
                onClick={() => setPanelFiltrosAbierto((prev) => !prev)}
                aria-expanded={panelFiltrosAbierto}
                className={`inline-flex h-11 items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${
                  panelFiltrosAbierto || totalFiltrosAvanzados > 0
                    ? "border-heritage-navy bg-heritage-navy text-white shadow-xs"
                    : "border-outline-variant/40 bg-surface-container-lowest/90 text-heritage-navy hover:bg-surface-container shadow-xs"
                }`}
                title="Filtros avanzados por color y acabado"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {panelFiltrosAbierto ? "close" : "tune"}
                </span>
                <span className="hidden sm:inline">Filtros</span>
                {totalFiltrosAvanzados > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      panelFiltrosAbierto || totalFiltrosAvanzados > 0
                        ? "bg-accent-copper text-white"
                        : "bg-heritage-navy text-white"
                    }`}
                  >
                    {totalFiltrosAvanzados}
                  </span>
                )}
              </button>
            )}

            {/* Limpiar Filtros si hay algo activo */}
            {(activos > 0 || filtros.q) && (
              <Link
                href="/"
                scroll={false}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-accent-copper/40 bg-surface-container-lowest/80 px-3 text-xs font-bold text-accent-copper shadow-xs transition-all hover:bg-surface-container hover:border-accent-copper active:scale-95"
                title="Limpiar búsqueda y filtros"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Limpiar</span>
              </Link>
            )}
          </div>
        </div>

        {/* Fila 2: Carrusel Horizontal de Categorías. Es lo primero que se
            oculta al hacer scroll en móvil (`compacto`): entre esto y la
            cabecera se comían casi un tercio de la pantalla, sin dejar
            espacio a las fotos. En sm+ siempre visible, hay espacio de
            sobra. */}
        {facetas.categorias.length > 0 && (
          <div
            className={`relative mt-2 overflow-hidden transition-all sm:max-h-none sm:opacity-100 ${
              compacto ? "max-h-0 opacity-0" : "max-h-16 opacity-100"
            }`}
          >
            <h2 className="sr-only">Categorías</h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0 no-scrollbar">
              {/* Chip "Todos" */}
              <Link
                href={ruta({ ...filtros, categorias: [] })}
                scroll={false}
                aria-current={filtros.categorias.length === 0 ? "true" : undefined}
                className={`inline-flex shrink-0 snap-start items-center justify-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${
                  filtros.categorias.length === 0
                    ? "bg-heritage-navy text-white shadow-xs"
                    : "border border-outline-variant/30 bg-surface-container-lowest/80 text-ink-text hover:bg-surface-container shadow-xs"
                }`}
              >
                Todos
              </Link>

              {/* Categorías */}
              {facetas.categorias.map((c) => {
                const activo = filtros.categorias.includes(c.slug);
                return (
                  <Link
                    key={c.slug}
                    href={href("categorias", c.slug)}
                    scroll={false}
                    aria-current={activo ? "true" : undefined}
                    className={`inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${
                      activo
                        ? "bg-heritage-navy text-white shadow-xs"
                        : "border border-outline-variant/30 bg-surface-container-lowest/80 text-ink-text hover:bg-surface-container hover:border-outline shadow-xs"
                    }`}
                  >
                    <span>{c.nombre}</span>
                    {c.conteo != null && (
                      <span
                        className={`text-[11px] ${
                          activo ? "text-white/80" : "text-ink-soft"
                        }`}
                      >
                        {c.conteo}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel Desplegable de Filtros Avanzados (Colores, Acabados, Stock).
            Vive dentro de la barra sticky, no en un modal — sin límite de
            alto, si hay muchos colores/acabados el final del panel se salía
            de la pantalla en móvil y esas opciones no se podían tocar. */}
        {panelFiltrosAbierto && hayAvanzados && (
          <div className="mt-3 max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface-container-lowest p-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-accent-copper">
                  tune
                </span>
                <span className="font-display text-sm font-bold text-heritage-navy">
                  Filtros Avanzados
                </span>
                {totalFiltrosAvanzados > 0 && (
                  <span className="rounded-full bg-accent-copper px-2 py-0.5 text-[10px] font-bold text-white">
                    {totalFiltrosAvanzados} activos
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPanelFiltrosAbierto(false)}
                className="rounded-full p-1 text-ink-soft hover:bg-surface-container hover:text-ink-text"
                aria-label="Cerrar panel de filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {facetas.colores.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent-copper">
                  Tonalidades
                </h3>
                <div className="flex flex-wrap gap-2">
                  {facetas.colores.map((c) => {
                    const activo = filtros.colores.includes(c.slug);
                    return (
                      <Link
                        key={c.slug}
                        href={href("colores", c.slug)}
                        scroll={false}
                        aria-current={activo ? "true" : undefined}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                          activo
                            ? "bg-heritage-navy text-white shadow-xs"
                            : "border border-outline-variant/30 bg-surface-container text-ink-text hover:bg-surface-container-high"
                        }`}
                      >
                        <ColorSwatch hex={c.hex ?? null} nombre={c.nombre} size="sm" />
                        <span>{c.nombre}</span>
                        {c.conteo != null && (
                          <span
                            className={`text-[10px] ${
                              activo ? "text-white/80" : "text-ink-soft"
                            }`}
                          >
                            {c.conteo}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {facetas.propiedades.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent-copper">
                  Acabado y Textura
                </h3>
                <div className="flex flex-wrap gap-2">
                  {facetas.propiedades.map((p) => {
                    const activo = filtros.propiedades.includes(p.clave as never);
                    return (
                      <Link
                        key={p.clave}
                        href={href("propiedades", p.clave)}
                        scroll={false}
                        aria-current={activo ? "true" : undefined}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                          activo
                            ? "bg-heritage-navy text-white shadow-xs"
                            : "border border-outline-variant/30 bg-surface-container text-ink-text hover:bg-surface-container-high"
                        }`}
                      >
                        <span>{p.etiqueta}</span>
                        {p.conteo != null && (
                          <span
                            className={`text-[10px] ${
                              activo ? "text-white/80" : "text-ink-soft"
                            }`}
                          >
                            {p.conteo}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {facetas.hayStock && (
              <div>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent-copper">
                  Disponibilidad
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={ruta({
                      ...filtros,
                      soloDisponibles: !filtros.soloDisponibles,
                    })}
                    scroll={false}
                    aria-current={filtros.soloDisponibles ? "true" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                      filtros.soloDisponibles
                        ? "bg-heritage-navy text-white shadow-xs"
                        : "border border-outline-variant/30 bg-surface-container text-ink-text hover:bg-surface-container-high"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      check_circle
                    </span>
                    <span>Solo con existencia inmediata</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ruta(f: EstadoFiltros): string {
  const qs = aQuerystring(f);
  return qs ? `/?${qs}` : "/";
}
