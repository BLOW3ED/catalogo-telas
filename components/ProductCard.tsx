import Link from "next/link";
import type { TelaAgrupada } from "@/lib/types";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AttributeBadges } from "@/components/AttributeBadges";
import { unidadDe } from "@/lib/unidades";

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/** Card de modelo: foto, nombre, swatches de todos sus colores, precio y badges. */
export function ProductCard({
  tela,
  priority = false,
}: {
  tela: TelaAgrupada;
  priority?: boolean;
}) {
  const principal = tela.variantes[0];
  const foto = publicImageUrl(principal?.foto_principal);

  // Swatches: colores únicos por hex
  const swatches = Array.from(
    new Map(
      tela.variantes
        .filter((v) => v.color_hex)
        .map((v) => [v.color_hex, v])
    ).values()
  );

  // Badges: unión de propiedades ópticas entre variantes
  const atributos = {
    es_bordado: tela.variantes.some((v) => v.es_bordado),
    es_brillante: tela.variantes.some((v) => v.es_brillante),
    es_traslucida: tela.variantes.some((v) => v.es_traslucida),
    es_tornasol: tela.variantes.some((v) => v.es_tornasol),
  };

  return (
    <Link
      href={`/tela/${tela.tela_slug}`}
      className="group flex flex-col gap-3.5 rounded-2xl border border-line/80 bg-surface p-2.5 sm:p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Imagen con aspect ratio cuadrado, esquinas suaves y zoom al hover */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface-container-low">
        <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105">
          <TelaImage
            src={foto}
            derivados={principal?.foto_principal_derivados}
            alt={principal?.color_nombre ? `${tela.tela_nombre} ${principal.color_nombre}` : tela.tela_nombre}
            priority={priority}
          />
        </div>
      </div>

      {/* Contenido descriptivo y precio */}
      <div className="flex flex-1 flex-col justify-between gap-2">
        <div className="flex flex-col gap-1">
          {(tela.categoria || tela.precio_desde_es_referencia) && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-container">
              {[
                tela.categoria,
                tela.precio_desde_es_referencia ? "precio de referencia" : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}

          <h3 className="font-display text-base font-medium leading-snug text-ink-deep transition-colors group-hover:text-primary sm:text-lg">
            {tela.tela_nombre}
          </h3>
        </div>

        <div className="flex flex-col gap-2 pt-1 border-t border-line/60">
          {tela.precio_desde != null ? (
            <p className="text-base font-bold text-amber">
              <span className="text-xs font-normal text-ink-soft">desde </span>
              {pesos.format(tela.precio_desde)}
              <span className="text-xs font-medium text-ink-soft ml-0.5">
                {unidadDe(tela.precio_desde_unidad).sufijoPrecio}
              </span>
            </p>
          ) : (
            <p className="text-sm font-medium text-ink-soft">a consultar</p>
          )}

          {swatches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {swatches.slice(0, 7).map((v) => (
                <ColorSwatch key={v.color_hex} hex={v.color_hex} nombre={v.color_nombre} size="sm" />
              ))}
              {swatches.length > 7 && (
                <span className="text-xs font-medium text-ink-soft/80">+{swatches.length - 7}</span>
              )}
            </div>
          )}

          <AttributeBadges atributos={atributos} />
        </div>
      </div>
    </Link>
  );
}
