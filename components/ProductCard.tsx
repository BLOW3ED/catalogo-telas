import Link from "next/link";
import type { TelaAgrupada } from "@/lib/types";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AttributeBadges } from "@/components/AttributeBadges";
import { demoPricesEnabled } from "@/lib/demo-prices";

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
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1"
    >
      <div className="overflow-hidden">
        <div className="transition-transform duration-300 group-hover:scale-[1.03]">
          <TelaImage
            src={foto}
            alt={principal?.color_nombre ? `${tela.tela_nombre} ${principal.color_nombre}` : tela.tela_nombre}
            priority={priority}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {tela.categoria && (
          <span className="text-xs uppercase tracking-wide text-amber-soft">
            {tela.categoria}
          </span>
        )}
        <h3 className="font-display text-lg leading-tight">{tela.tela_nombre}</h3>

        {swatches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {swatches.slice(0, 8).map((v) => (
              <ColorSwatch key={v.color_hex} hex={v.color_hex} nombre={v.color_nombre} size="sm" />
            ))}
            {swatches.length > 8 && (
              <span className="text-xs text-ink/50">+{swatches.length - 8}</span>
            )}
          </div>
        )}

        <AttributeBadges atributos={atributos} />

        <div className="mt-auto pt-1">
          {tela.precio_desde != null ? (
            <>
              <p className="text-sm">
                <span className="text-ink/50">desde </span>
                <span className="font-semibold text-amber">
                  {pesos.format(tela.precio_desde)}
                </span>
                <span className="text-ink/50"> /metro</span>
              </p>
              {demoPricesEnabled() && (
                <p className="text-[10px] uppercase tracking-wide text-ink/40">
                  precio de referencia
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink/40">Precio a consultar</p>
          )}
        </div>
      </div>
    </Link>
  );
}
