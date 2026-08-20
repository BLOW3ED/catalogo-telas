import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTelaPorSlug, getFotosDeVariantes } from "@/lib/queries";
import { publicImageUrl } from "@/lib/supabase/storage";
import { construirSlides } from "@/lib/fotos";
import { TelaImage } from "@/components/TelaImage";
import { TelaImageCarousel } from "@/components/TelaImageCarousel";
import { ColorSelector } from "@/components/ColorSelector";
import { AttributeBadges } from "@/components/AttributeBadges";
import { AddToCart } from "@/components/AddToCart";
import { VolverAlCatalogo } from "@/components/VolverAlCatalogo";
import { unidadDe } from "@/lib/unidades";
import { sugerenciaMerceriaDeCategoria } from "@/lib/ingesta/categorias";

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { color } = await searchParams;

  const variantes = await getTelaPorSlug(slug);
  if (variantes.length === 0) notFound();

  const seleccionada =
    variantes.find((v) => v.color_slug === color) ?? variantes[0];

  const nombre = seleccionada.color_nombre
    ? `${seleccionada.tela_nombre} · ${seleccionada.color_nombre}`
    : seleccionada.tela_nombre;

  const totalColores = new Set(
    variantes.map((v) => v.color_slug ?? v.variante_id)
  ).size;

  const descripcion = [
    seleccionada.descripcion ?? seleccionada.categoria,
    totalColores > 1 ? `${totalColores} colores disponibles` : null,
    "Telas La Jalisciense · Fresnillo",
  ]
    .filter(Boolean)
    .join(" · ");

  const foto = publicImageUrl(seleccionada.foto_principal);

  return {
    title: `${nombre} — Telas La Jalisciense`,
    description: descripcion,
    openGraph: {
      title: nombre,
      description: descripcion,
      ...(foto ? { images: [{ url: foto, alt: nombre }] } : {}),
    },
  };
}

export default async function TelaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const { slug } = await params;
  const { color } = await searchParams;

  const variantes = await getTelaPorSlug(slug);
  if (variantes.length === 0) notFound();

  const seleccionada =
    variantes.find((v) => v.color_slug === color) ?? variantes[0];

  const foto = publicImageUrl(seleccionada.foto_principal);
  const nombre = seleccionada.tela_nombre;

  const atributos = {
    es_bordado: seleccionada.es_bordado,
    es_brillante: seleccionada.es_brillante,
    es_traslucida: seleccionada.es_traslucida,
    es_tornasol: seleccionada.es_tornasol,
  };

  const tags = [...seleccionada.casos_uso, ...seleccionada.oportunidades];
  const sugerenciaMerceria = sugerenciaMerceriaDeCategoria(seleccionada.categoria_slug);

  const fotos = await getFotosDeVariantes(variantes.map((v) => v.variante_id));
  const slides = construirSlides({ variantes, fotos, seleccionada });
  const usarCarrusel = slides.length > 1;

  // pb extra en móvil: reserva espacio bajo el contenido para las DOS barras
  // fijas que se le encimaban (MobileBottomNav + AddToCart), que entre las
  // dos miden ~9.25rem + safe-area. En sm+ ninguna es fixed.
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-8 lg:px-8">
      <VolverAlCatalogo />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Columna Izquierda: Galería / Imagen & Swatches */}
        <div className="flex flex-col gap-6 min-w-0">
          {usarCarrusel ? (
            <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
              <TelaImageCarousel
                slides={slides}
                selectedColorSlug={seleccionada.color_slug}
                telaNombre={nombre}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-sm">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-container-low">
                <TelaImage
                  src={slides[0] ? publicImageUrl(slides[0].ruta) : foto}
                  derivados={
                    slides[0]?.derivados ?? seleccionada.foto_principal_derivados
                  }
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  alt={
                    seleccionada.color_nombre
                      ? `${nombre} ${seleccionada.color_nombre}`
                      : nombre
                  }
                  aspecto="cuadrado"
                  priority
                />
              </div>
            </div>
          )}

          {/* En mobile, "Tonos disponibles" va justo bajo la foto */}
          <div className="lg:hidden">
            <ColorSelector
              variantes={variantes}
              selectedSlug={seleccionada.color_slug}
            />
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/80 p-4 text-center shadow-2xs">
            <p className="text-xs sm:text-sm text-ink-soft">
              📸 <strong>Fotografía auténtica:</strong> Tomada bajo luz natural en nuestro estudio de Fresnillo.
            </p>
          </div>
        </div>

        {/* Columna Derecha: Información, Especificaciones y Cotización */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {seleccionada.categoria && (
              <span className="text-xs font-bold uppercase tracking-wider text-accent-copper">
                {seleccionada.categoria}
              </span>
            )}
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl font-bold text-heritage-navy sm:text-4xl">
                {nombre}
              </h1>
              {seleccionada.precio_metro != null ? (
                <div className="shrink-0 text-right">
                  <p className="text-2xl sm:text-3xl font-bold text-accent-copper">
                    {pesos.format(seleccionada.precio_metro)}
                  </p>
                  <p className="text-xs font-semibold text-ink-soft">
                    {unidadDe(seleccionada.unidad_venta).sufijoPrecio}
                  </p>
                </div>
              ) : (
                <p className="shrink-0 pt-1 text-sm font-medium text-ink-soft">
                  Precio a consultar
                </p>
              )}
            </div>
            {seleccionada.precio_es_referencia && (
              <p className="text-xs text-secondary font-medium">
                * Precio de referencia · confirmamos disponibilidad por WhatsApp
              </p>
            )}
          </div>

          {/* Chips de propiedades */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-surface-container px-3.5 py-1.5 text-xs font-bold text-heritage-navy border border-outline-variant/30">
              Ancho: 1.40m – 1.50m
            </span>
            <span className="rounded-full bg-surface-container px-3.5 py-1.5 text-xs font-bold text-heritage-navy border border-outline-variant/30">
              Venta por metro o pieza
            </span>
            <AttributeBadges atributos={atributos} />
          </div>

          {/* Descripción */}
          {seleccionada.descripcion && (
            <div className="space-y-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-2xs">
              {seleccionada.descripcion
                .split(/\n\s*\n/)
                .filter((p) => p.trim())
                .map((parrafo, i) => (
                  <p key={i} className="text-base sm:text-lg leading-relaxed text-ink-soft">
                    {parrafo.trim()}
                  </p>
                ))}
            </div>
          )}

          {/* Selector de color en Desktop */}
          <div className="hidden lg:block">
            <ColorSelector
              variantes={variantes}
              selectedSlug={seleccionada.color_slug}
            />
          </div>

          {/* Usos Recomendados (Stitch Style) */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-heritage-navy mb-3">
              Usos Recomendados para esta Tela
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-heritage-navy shadow-2xs">
                  <span className="material-symbols-outlined text-[26px]">checkroom</span>
                </div>
                <span className="text-[11px] font-semibold text-ink-soft text-center">Vestidos</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-heritage-navy shadow-2xs">
                  <span className="material-symbols-outlined text-[26px]">dry_cleaning</span>
                </div>
                <span className="text-[11px] font-semibold text-ink-soft text-center">Pañuelos</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-heritage-navy shadow-2xs">
                  <span className="material-symbols-outlined text-[26px]">styler</span>
                </div>
                <span className="text-[11px] font-semibold text-ink-soft text-center">Blusas</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-lowest text-heritage-navy shadow-2xs">
                  <span className="material-symbols-outlined text-[26px]">bed</span>
                </div>
                <span className="text-[11px] font-semibold text-ink-soft text-center">Decoración</span>
              </div>
            </div>
          </div>

          {/* Ficha técnica en cuadrícula */}
          {(seleccionada.sku || seleccionada.stock != null) && (
            <dl className="grid grid-cols-2 gap-3.5">
              {seleccionada.sku && (
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-2xs">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-accent-copper">SKU de Almacén</dt>
                  <dd className="mt-1 text-base font-bold text-heritage-navy font-mono">
                    {seleccionada.sku}
                  </dd>
                </div>
              )}
              {seleccionada.stock != null && (
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-2xs">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-accent-copper">
                    Existencia
                  </dt>
                  {seleccionada.stock > 0 ? (
                    <dd className="mt-1 text-base font-bold text-success flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {seleccionada.stock} {unidadDe(seleccionada.unidad_venta).plural} disponibles
                    </dd>
                  ) : (
                    <dd className="mt-1 text-base font-semibold text-ink-soft">
                      Sin existencia
                    </dd>
                  )}
                </div>
              )}
            </dl>
          )}

          {/* Tags de ocasión */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-heritage-navy">
                Ocasión & Estilo
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-1.5 text-xs font-medium capitalize text-ink-soft shadow-2xs"
                  >
                    {t.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mercería recomendada para esta tela. Se oculta por completo si
              la categoría no se cose con hilo (pedrería, cinta, el propio
              hilo…) — ver sugerenciaMerceriaDeCategoria en
              lib/ingesta/categorias.ts. */}
          {sugerenciaMerceria && (
            <div className="border-t border-line/60 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent-copper mb-3">
                Mercería sugerida para este producto
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {sugerenciaMerceria.map((s) => (
                  <Link
                    key={s.q}
                    href={`/?q=${s.q}`}
                    className="flex items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-2xs transition-all hover:bg-surface-container"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-heritage-navy">
                      <span className="material-symbols-outlined text-[20px]">{s.icono}</span>
                    </div>
                    <div className="overflow-hidden">
                      <p className="truncate text-xs font-bold text-heritage-navy">{s.titulo}</p>
                      <p className="text-[11px] text-ink-soft">{s.detalle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Agregar a la Cotización */}
          <AddToCart variante={seleccionada} />
        </div>
      </div>
    </main>
  );
}

