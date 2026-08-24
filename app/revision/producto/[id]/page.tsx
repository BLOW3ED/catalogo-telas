import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSesionRevisor } from "@/lib/revisor-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { placeholderMedidaDeCategoria } from "@/lib/ingesta/categorias";
import {
  VarianteRevisionCard,
  type ColorLookup,
  type VarianteRevision,
} from "@/components/revision/VarianteRevisionCard";
import { CategoriaProductoForm, type CategoriaLookup } from "@/components/revision/CategoriaProductoForm";
import { NombreProductoForm } from "@/components/revision/NombreProductoForm";

export const metadata: Metadata = {
  title: "Revisar producto — Revisión de catálogo",
  robots: { index: false, follow: false },
};

/**
 * Detalle de revisión de UN producto: nombre editable y una tarjeta por
 * variante. A diferencia de `/admin/tela/[id]`, la vista `catalogo_telas` no
 * trae `color_id` (solo el nombre/hex resueltos), así que aquí se consulta
 * `variante` directo, con `service_role` — mismo patrón que `getVariantes`
 * en `app/admin/tela/[id]/page.tsx`.
 */
export default async function RevisionProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, autorizado } = await getSesionRevisor();
  if (!user) redirect("/revision/login");
  if (!autorizado) redirect("/revision");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createAdminClient();

  const [{ data: tela }, { data: colores }, { data: categorias }, { data: variantesRaw }] = await Promise.all([
    supabase
      .from("tela")
      .select("id, nombre, categoria_id, categoria(slug, nombre)")
      .eq("id", id)
      .single(),
    supabase.from("color").select("id, nombre, hex").order("nombre"),
    supabase.from("categoria").select("id, nombre").order("nombre"),
    supabase
      .from("variante")
      .select(
        "id, sku, color_id, precio, unidad_venta, medida, nota, revisado_en, color(nombre, hex), foto(ruta, orden, created_at, derivados)"
      )
      .eq("tela_id", id)
      .order("orden"),
  ]);

  if (!tela) notFound();

  const categoria = tela.categoria as unknown as { slug: string; nombre: string } | null;
  const placeholderMedida = placeholderMedidaDeCategoria(categoria?.slug ?? null);
  const coloresLista = (colores ?? []) as ColorLookup[];
  const categoriasLista = (categorias ?? []) as CategoriaLookup[];
  const variantes = (variantesRaw ?? []) as unknown as VarianteRevision[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        href="/revision"
        className="-ml-2 mb-4 inline-flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink-display transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la cola
      </Link>

      <div className="mb-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6">
        <NombreProductoForm telaId={tela.id} nombre={tela.nombre} />
        <CategoriaProductoForm
          telaId={tela.id}
          categoriaId={tela.categoria_id}
          categorias={categoriasLista}
        />
      </div>

      <div className="space-y-4">
        {variantes.map((v) => (
          <VarianteRevisionCard
            key={v.id}
            telaId={tela.id}
            variante={v}
            colores={coloresLista}
            placeholderMedida={placeholderMedida}
          />
        ))}
      </div>

      {variantes.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center text-sm text-ink/50">
          Este producto no tiene variantes todavía.
        </p>
      )}
    </main>
  );
}
