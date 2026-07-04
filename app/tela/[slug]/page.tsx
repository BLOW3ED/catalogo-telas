import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTelaPorSlug } from "@/lib/queries";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { TelaImageCarousel, type SlideColor } from "@/components/TelaImageCarousel";
import { ColorSelector } from "@/components/ColorSelector";
import { AttributeBadges } from "@/components/AttributeBadges";
import { AddToCart } from "@/components/AddToCart";
import { Hint } from "@/components/Hint";

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

  // Slides del carrusel: una foto por color, mismo filtro y orden que los
  // swatches del ColorSelector (color real con hex) para que deslizar y picar
  // recorran la misma lista. Dedupe por slug: si dos SKUs comparten color,
  // `?color=` de todos modos resuelve al primero.
  const slides: SlideColor[] = Array.from(
    new Map(
      variantes
        .filter((v) => v.color_slug && v.color_hex)
        .map((v) => [v.color_slug!, v])
    ).values()
  ).map((v) => ({
    slug: v.color_slug!,
    src: publicImageUrl(v.foto_principal),
    derivados: v.foto_principal_derivados ?? null,
    colorNombre: v.color_nombre,
  }));

  // Solo hay swipe si hay ≥2 colores y la variante seleccionada es uno de
  // ellos (una variante sin color quedaría fuera del carrusel).
  const usarCarrusel =
    slides.length > 1 && slides.some((s) => s.slug === seleccionada.color_slug);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-amber"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Imagen y Disclaimer */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded border border-line-strong/20 bg-white p-px">
            {usarCarrusel ? (
              <TelaImageCarousel
                slides={slides}
                selectedSlug={seleccionada.color_slug!}
                telaNombre={nombre}
              />
            ) : (
              <TelaImage
                src={foto}
                derivados={seleccionada.foto_principal_derivados}
                sizes="(max-width: 1023px) 100vw, 50vw"
                alt={
                  seleccionada.color_nombre
                    ? `${nombre} ${seleccionada.color_nombre}`
                    : nombre
                }
                priority
              />
            )}
          </div>
          <p className="px-4 text-center text-sm text-ink-soft">
            📸 <strong>Nota:</strong> Las fotografías fueron tomadas bajo luz natural del sol. Los tonos reales pueden variar ligeramente dependiendo de tu pantalla.
          </p>
        </div>

        {/* Información */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {seleccionada.categoria && (
              <span className="text-label-caps text-xs text-ink-soft">
                {seleccionada.categoria}
              </span>
            )}
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl text-ink-deep sm:text-4xl">
                {nombre}
              </h1>
              {seleccionada.precio_metro != null ? (
                <p className="shrink-0 pt-1 text-lg leading-7 text-ink-deep">
                  {pesos.format(seleccionada.precio_metro)}/m
                </p>
              ) : (
                <p className="shrink-0 pt-1 text-sm leading-7 text-ink-soft">
                  Precio a consultar
                </p>
              )}
            </div>
            {seleccionada.precio_es_referencia && (
              <p className="text-label-caps text-[10px] text-ink-soft/70">
                precio de referencia · confirmamos por WhatsApp
              </p>
            )}
          </div>

          {/* Descripción técnica/sensorial en bloques cortos: los párrafos se
              separan con líneas en blanco en la BD (los casos de uso van
              aparte, como tags). */}
          {seleccionada.descripcion && (
            <div className="space-y-4">
              {seleccionada.descripcion
                .split(/\n\s*\n/)
                .filter((p) => p.trim())
                .map((parrafo, i) => (
                  <p key={i} className="text-base leading-6 text-ink-soft">
                    {parrafo.trim()}
                  </p>
                ))}
            </div>
          )}

          <ColorSelector
            variantes={variantes}
            selectedSlug={seleccionada.color_slug}
          />

          {variantes.length > 1 && (
            <Hint id="detalle-color" arrow="up">
              Puedes cambiar el color picando estos botones o deslizando la
              foto. El precio se actualiza solo.
            </Hint>
          )}

          <AttributeBadges atributos={atributos} />

          {/* Ficha técnica en cuadrícula tipo bento */}
          {(seleccionada.sku || seleccionada.stock != null) && (
            <dl className="grid grid-cols-2 gap-4">
              {seleccionada.sku && (
                <div className="rounded border border-line-strong/30 bg-surface p-4">
                  <dt className="text-label-caps text-xs text-ink-soft">SKU</dt>
                  <dd className="mt-1 text-base text-ink-deep">
                    {seleccionada.sku}
                  </dd>
                </div>
              )}
              {seleccionada.stock != null && (
                <div className="rounded border border-line-strong/30 bg-surface p-4">
                  <dt className="text-label-caps text-xs text-ink-soft">
                    Disponibilidad
                  </dt>
                  <dd className="mt-1 text-base text-ink-deep">
                    {seleccionada.stock > 0
                      ? `${seleccionada.stock} m en existencia`
                      : "Sin existencia"}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Tags de uso / ocasión */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="border-b border-line-strong/30 pb-2 text-label-caps text-xs text-ink-deep">
                Ideal para
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-line-strong/30 bg-chip px-2.5 py-0.5 text-xs capitalize text-ink-soft"
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
