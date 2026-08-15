import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import {
  type Filtros as EstadoFiltros,
  type FacetaLista,
  alternar,
  aQuerystring,
  cuentaFiltros,
} from "@/lib/filtros";
import type { Facetas } from "@/lib/queries";

/**
 * Chips de filtro de la portada.
 *
 * Son LINKS, no botones con estado de React: el filtro ya vive en la URL, así
 * que cada chip solo necesita apuntar a "la URL que resultaría de prenderme o
 * apagarme". Eso lo hace funcionar sin JavaScript, deja que el botón atrás
 * recorra los filtros, y hace que copiar la barra de direcciones comparta
 * exactamente lo que la vendedora tiene en pantalla.
 *
 * Los chips secundarios (color, propiedades, disponibilidad) viven en un
 * `<details>` nativo: se pliega solo, es navegable por teclado y no cuesta un
 * kilobyte de JS. Se abre ya desplegado si alguno de esos filtros está puesto,
 * para que un link compartido no esconda por qué la lista se ve corta.
 */
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

  // Sin categorías no hay nada que filtrar: el catálogo aún no se ha clasificado.
  if (facetas.categorias.length === 0 && !hayAvanzados) return null;

  /** URL con un valor de faceta prendido/apagado, conservando lo demás. */
  const href = (faceta: FacetaLista, valor: string) => ruta(alternar(filtros, faceta, valor));

  return (
    <section aria-label="Filtros del catálogo" className="mb-6">
      {facetas.categorias.length > 0 && (
        <>
          <h2 className="sr-only">Categorías</h2>
          {/* En celular la fila se desliza en horizontal (los 15 rubros no
              caben); a partir de sm se acomoda en varios renglones. Los
              márgenes negativos dejan que el scroll llegue al borde de la
              pantalla en vez de cortarse dentro del padding de la página. */}
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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
        </>
      )}

      {hayAvanzados && (
        <details open={avanzadosPuestos} className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-1 py-1 text-sm font-medium text-primary hover:text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Más filtros
            <span className="text-ink-soft group-open:hidden">
              {avanzadosPuestos ? `(${filtros.colores.length + filtros.propiedades.length + (filtros.soloDisponibles ? 1 : 0)})` : ""}
            </span>
          </summary>

          <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
            {facetas.colores.length > 0 && (
              <Grupo titulo="Color">
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
              <Grupo titulo="Acabado">
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

            {/* Solo si alguien capturó existencias: si no, el chip dejaría el
                catálogo en cero y parecería que se rompió. */}
            {facetas.hayStock && (
              <Grupo titulo="Disponibilidad">
                <Chip
                  href={ruta({ ...filtros, soloDisponibles: !filtros.soloDisponibles })}
                  activo={filtros.soloDisponibles}
                >
                  Solo con existencia
                </Chip>
              </Grupo>
            )}
          </div>
        </details>
      )}

      {activos > 0 && (
        <p className="mt-3 flex items-center gap-3 text-sm text-ink-soft">
          <span>
            {activos} {activos === 1 ? "filtro puesto" : "filtros puestos"}
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
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-primary hover:text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpiar
          </Link>
        </p>
      )}
    </section>
  );
}

/** Conserva la búsqueda de texto: limpiar los chips no borra lo que escribieron. */
function ruta(f: EstadoFiltros): string {
  const qs = aQuerystring(f);
  return qs ? `/?${qs}` : "/";
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-label-caps mb-2 text-sm text-ink-soft">{titulo}</h3>
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
      className={`inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        activo
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-container hover:text-ink shadow-xs"
      }`}
    >
      {children}
      {conteo != null && (
        <span className={`text-xs ${activo ? "text-white/80" : "text-ink-soft/70"}`}>{conteo}</span>
      )}
    </Link>
  );
}
