import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTelaPorSlug } from "@/lib/queries";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
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
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <TelaImage
              src={foto}
              alt={
                seleccionada.color_nombre
                  ? `${nombre} ${seleccionada.color_nombre}`
                  : nombre
              }
              priority
            />
          </div>
          <p className="px-4 text-center text-sm text-ink/60">
            📸 <strong>Nota:</strong> Las fotografías fueron tomadas bajo luz natural del sol. Los tonos reales pueden variar ligeramente dependiendo de tu pantalla.
          </p>
        </div>

        {/* Información */}
        <div className="flex flex-col gap-5">
          <div>
            {seleccionada.categoria && (
              <span className="text-label-caps text-xs text-amber-soft">
                {seleccionada.categoria}
              </span>
            )}
            <h1 className="font-display text-3xl text-ink sm:text-4xl">
              {nombre}
            </h1>
          </div>

          <ColorSelector
            variantes={variantes}
            selectedSlug={seleccionada.color_slug}
          />

          {variantes.length > 1 && (
            <Hint id="detalle-color" arrow="up">
              Puedes cambiar el color picando estos botones. La foto y el precio
              se actualizan solos.
            </Hint>
          )}

          <AttributeBadges atributos={atributos} />

          {/* Precio */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            {seleccionada.precio_metro != null ? (
              <>
                <p className="text-2xl font-semibold text-amber">
                  {pesos.format(seleccionada.precio_metro)}
                  <span className="text-base font-normal text-ink/50">
                    {" "}
                    / metro
                  </span>
                </p>
                {seleccionada.precio_es_referencia && (
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-ink/40">
                    precio de referencia · confirmamos por WhatsApp
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg text-ink/50">Precio a consultar</p>
            )}

            <dl className="mt-3 space-y-1 text-sm text-ink/70">
              {seleccionada.sku && (
                <div className="flex gap-2">
                  <dt className="text-ink/50">SKU:</dt>
                  <dd>{seleccionada.sku}</dd>
                </div>
              )}
              {seleccionada.stock != null && (
                <div className="flex gap-2">
                  <dt className="text-ink/50">Disponibilidad:</dt>
                  <dd>
                    {seleccionada.stock > 0
                      ? `${seleccionada.stock} m en existencia`
                      : "Sin existencia"}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tags de uso / ocasión */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-surface/60 px-2.5 py-0.5 text-xs capitalize text-ink/60"
                >
                  {t.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* Agregar al Carrito */}
          <AddToCart variante={seleccionada} />
        </div>
      </div>
    </main>
  );
}
