import Link from "next/link";
import type { TelaAgrupada } from "@/lib/types";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AttributeBadges } from "@/components/AttributeBadges";

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
      className="group flex flex-col gap-3 rounded-lg bg-surface p-2 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-3"
    >
      {/* Foto enmarcada tipo muestra montada: marco blanco de 1px sobre borde
          suave, esquinas casi rectas; el texto vive fuera del marco. */}
      <div className="overflow-hidden rounded border border-line-strong/20 bg-white p-px">
        <div className="overflow-hidden">
          <div className="transition-transform duration-300 group-hover:scale-[1.03]">
            <TelaImage
              src={foto}
              derivados={principal?.foto_principal_derivados}
              alt={principal?.color_nombre ? `${tela.tela_nombre} ${principal.color_nombre}` : tela.tela_nombre}
              priority={priority}
            />
          </div>
        </div>
      </div>

      {/* Jerarquía: eyebrow → título grande → precio con peso. Cada dato en su
          renglón para que en mobile no compitan título y precio en la misma
          fila (la retícula de 2 columnas se leía densa y gris). */}
      <div className="flex flex-1 flex-col gap-1.5">
        {(tela.categoria || tela.precio_desde_es_referencia) && (
          <p className="text-label-caps text-sm text-ink-soft">
            {[
              tela.categoria,
              tela.precio_desde_es_referencia ? "precio de referencia" : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>
        )}

        <h3 className="font-display text-base leading-[1.25] text-ink transition-colors group-hover:text-primary sm:text-lg">
          {tela.tela_nombre}
        </h3>

        {tela.precio_desde != null ? (
          <p className="text-base font-semibold text-amber">
            <span className="text-sm font-normal text-ink-soft">desde </span>
            {pesos.format(tela.precio_desde)}/m
          </p>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">a consultar</p>
        )}

        {swatches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {swatches.slice(0, 8).map((v) => (
              <ColorSwatch key={v.color_hex} hex={v.color_hex} nombre={v.color_nombre} size="sm" />
            ))}
            {swatches.length > 8 && (
              <span className="text-sm text-ink-soft">+{swatches.length - 8}</span>
            )}
          </div>
        )}

        <AttributeBadges atributos={atributos} />
      </div>
    </Link>
  );
}
