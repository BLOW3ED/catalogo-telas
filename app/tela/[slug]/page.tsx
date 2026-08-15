import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTelaPorSlug, getFotosDeVariantes } from "@/lib/queries";
import { publicImageUrl } from "@/lib/supabase/storage";
import { construirSlides } from "@/lib/fotos";
import { TelaImage } from "@/components/TelaImage";
import { TelaImageCarousel } from "@/components/TelaImageCarousel";
import { ColorSelector } from "@/components/ColorSelector";
import { AttributeBadges } from "@/components/AttributeBadges";
import { AddToCart } from "@/components/AddToCart";
import { unidadDe } from "@/lib/unidades";

// Página dinámica (lee `searchParams`); la lectura de la tela se cachea 60s
// en lib/queries.ts (unstable_cache), igual que el listado del inicio.
const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/**
 * Metadatos OpenGraph por tela: el catálogo se comparte por WhatsApp, y sin
 * esto el preview del enlace sale genérico. Con foto + nombre + colores, cada
 * enlace compartido es un mini-anuncio.
 *
 * A propósito SIN precio: WhatsApp cachea los previews por mucho tiempo y un
 * precio embebido quedaría publicado aunque cambie en la BD (o sea uno demo).
 *
 * La lectura cae en el mismo `unstable_cache` que usa la página: no duplica
 * queries a Supabase.
 */
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
  // notFound() aquí (y no solo en la página): generateMetadata se resuelve
  // ANTES de que empiece el streaming del loading.tsx, así el status HTTP
  // sí llega como 404 y no como 200 con UI de "no encontrado".
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

  // Variante seleccionada por ?color=; si no, la primera.
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

  // Slides del carrusel. La vista `catalogo_telas` solo trae `foto_principal`
  // (la de menor orden de cada variante), así que las demás fotos se leen de
  // la tabla `foto`: son ~100 de las 259 del catálogo, invisibles hasta ahora
  // para el cliente aunque en /admin sí se vieran.
  const fotos = await getFotosDeVariantes(variantes.map((v) => v.variante_id));
  const slides = construirSlides({ variantes, fotos, seleccionada });

  // Con una sola foto no hay nada que recorrer: se pinta la imagen suelta.
  const usarCarrusel = slides.length > 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-soft shadow-xs transition-all hover:bg-surface-container hover:text-ink active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Imagen y Disclaimer */}
        <div className="flex flex-col gap-5">
          {usarCarrusel ? (
            <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
              <TelaImageCarousel
                slides={slides}
                selectedColorSlug={seleccionada.color_slug}
                telaNombre={nombre}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-line bg-surface p-2 shadow-sm">
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
          <div className="rounded-2xl border border-line bg-surface/60 p-4 text-center">
            <p className="text-xs sm:text-sm text-ink-soft">
              📸 <strong>Nota:</strong> Fotografías tomadas bajo luz natural del sol. Los tonos reales pueden variar ligeramente según tu pantalla.
            </p>
          </div>
        </div>

        {/* Información */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {seleccionada.categoria && (
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {seleccionada.categoria}
              </span>
            )}
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl font-semibold text-ink-deep sm:text-4xl">
                {nombre}
              </h1>
              {seleccionada.precio_metro != null ? (
                <div className="shrink-0 text-right">
                  <p className="text-2xl sm:text-3xl font-bold text-amber">
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
              <p className="text-xs text-amber-soft font-medium">
                * Precio de referencia · confirmamos disponibilidad por WhatsApp
              </p>
            )}
          </div>

          {/* Descripción técnica/sensorial */}
          {seleccionada.descripcion && (
            <div className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-2xs">
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

          <div className="hidden lg:block">
            <ColorSelector
              variantes={variantes}
              selectedSlug={seleccionada.color_slug}
            />
          </div>

          <AttributeBadges atributos={atributos} />

          {/* Ficha técnica en cuadrícula tipo bento */}
          {(seleccionada.sku || seleccionada.stock != null) && (
            <dl className="grid grid-cols-2 gap-3.5">
              {seleccionada.sku && (
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">SKU</dt>
                  <dd className="mt-1 text-base font-semibold text-ink-deep font-mono">
                    {seleccionada.sku}
                  </dd>
                </div>
              )}
              {seleccionada.stock != null && (
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    Disponibilidad
                  </dt>
                  {seleccionada.stock > 0 ? (
                    <dd className="mt-1 text-base font-bold text-success">
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

          {/* Tags de uso / ocasión */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-deep">
                Ideal para
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium capitalize text-ink-soft shadow-2xs"
                  >
                    {t.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Agregar al Carrito */}
          <AddToCart variante={seleccionada} />
        </div>
      </div>
    </main>
  );
}
