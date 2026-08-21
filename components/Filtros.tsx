import Link from "next/link";
import { X } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import {
  type Filtros as EstadoFiltros,
  type FacetaLista,
  alternar,
  aQuerystring,
  cuentaFiltros,
} from "@/lib/filtros";
import type { Facetas } from "@/lib/queries";

export function Filtros({
  filtros,
  facetas,
}: {
  filtros: EstadoFiltros;
  facetas: Facetas;
}) {
  const activos = cuentaFiltros(filtros);
  const hayAvanzados =
    facetas.colores.length > 0 || facetas.propiedades.length > 0 || facetas.hayStock;
  const avanzadosPuestos =
    filtros.colores.length > 0 || filtros.propiedades.length > 0 || filtros.soloDisponibles;

  if (facetas.categorias.length === 0 && !hayAvanzados) return null;

  const href = (faceta: FacetaLista, valor: string) => ruta(alternar(filtros, faceta, valor));

  return (
    <section aria-label="Filtros del catálogo" className="mb-8">
      {/* Categorías Principales */}
      {facetas.categorias.length > 0 && (
        <div className="relative">
          <h2 className="sr-only">Categorías</h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 no-scrollbar">
            {/* Chip "Todos" */}
            <Link
              href={ruta({ ...filtros, categorias: [] })}
              scroll={false}
              aria-current={filtros.categorias.length === 0 ? "true" : undefined}
              className={`inline-flex shrink-0 snap-start items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                filtros.categorias.length === 0
                  ? "bg-heritage-navy text-white shadow-sm"
                  : "border border-outline-variant/30 bg-surface-container text-ink-text hover:bg-surface-container-high shadow-xs"
              }`}
            >
              Todos
            </Link>

            {facetas.categorias.map((c) => (
              <Chip
                key={c.slug}
                href={href("categorias", c.slug)}
                activo={filtros.categorias.includes(c.slug)}
                conteo={c.conteo}
              >
                {c.nombre}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Filtros Avanzados (Colores, Acabados, Stock) */}
      {hayAvanzados && (
        <details open={avanzadosPuestos} className="group mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-display transition-all hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Filtros Detallados
            {avanzadosPuestos && (
              <span className="ml-1 rounded-full bg-amber px-2 py-0.5 text-[10px] text-white">
                {filtros.colores.length + filtros.propiedades.length + (filtros.soloDisponibles ? 1 : 0)}
              </span>
            )}
          </summary>

          <div className="mt-3 space-y-4 rounded-2xl border border-line bg-surface-container-low p-5 shadow-xs">
            {facetas.colores.length > 0 && (
              <Grupo titulo="Tonalidades">
                {facetas.colores.map((c) => (
                  <Chip
                    key={c.slug}
                    href={href("colores", c.slug)}
                    activo={filtros.colores.includes(c.slug)}
                    conteo={c.conteo}
                  >
                    <ColorSwatch hex={c.hex ?? null} nombre={c.nombre} size="sm" />
                    {c.nombre}
                  </Chip>
                ))}
              </Grupo>
            )}

            {facetas.propiedades.length > 0 && (
              <Grupo titulo="Acabado y Textura">
                {facetas.propiedades.map((p) => (
                  <Chip
                    key={p.clave}
                    href={href("propiedades", p.clave)}
                    activo={filtros.propiedades.includes(p.clave as never)}
                    conteo={p.conteo}
                  >
                    {p.etiqueta}
                  </Chip>
                ))}
              </Grupo>
            )}

            {facetas.hayStock && (
              <Grupo titulo="Disponibilidad">
                <Chip
                  href={ruta({ ...filtros, soloDisponibles: !filtros.soloDisponibles })}
                  activo={filtros.soloDisponibles}
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Solo con existencia inmediata
                </Chip>
              </Grupo>
            )}
          </div>
        </details>
      )}

      {/* Resumen y Limpiar */}
      {activos > 0 && (
        <div className="mt-3 flex items-center gap-3 text-sm text-ink-soft">
          <span className="font-medium">
            {activos} {activos === 1 ? "filtro aplicado" : "filtros aplicados"}
          </span>
          <Link
            href={ruta({
              ...filtros,
              categorias: [],
              colores: [],
              propiedades: [],
              precioMax: null,
              soloDisponibles: false,
            })}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-amber transition-all hover:bg-surface-container-high active:scale-95"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpiar todo
          </Link>
        </div>
      )}
    </section>
  );
}

function ruta(f: EstadoFiltros): string {
  const qs = aQuerystring(f);
  return qs ? `/?${qs}` : "/";
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber">
        {titulo}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  href,
  activo,
  conteo,
  children,
}: {
  href: string;
  activo: boolean;
  conteo?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? "true" : undefined}
      className={`inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy ${
        activo
          ? "bg-heritage-navy text-white shadow-sm"
          : "border border-outline-variant/30 bg-surface-container text-ink-text hover:bg-surface-container-high hover:border-outline shadow-xs"
      }`}
    >
      {children}
      {conteo != null && (
        <span className={`text-xs ${activo ? "text-white/80" : "text-ink-soft"}`}>{conteo}</span>
      )}
    </Link>
  );
}

