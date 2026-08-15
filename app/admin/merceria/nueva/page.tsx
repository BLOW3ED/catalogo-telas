import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { FormNuevaMerceria } from "@/components/admin/FormNuevaMerceria";

export const metadata: Metadata = {
  title: "Nueva mercería — Admin",
  robots: { index: false, follow: false },
};

/**
 * Alta de mercería/avíos (pedrería, flores, copas, botones, cinta).
 *
 * Va aparte del alta de telas porque la captura es al revés. Una tela se crea
 * vacía y se llena de colores en el editor; un avío llega en una bolsita con
 * UN código, un precio y una foto, y se captura completo de una sentada —
 * incluida la unidad de venta, que en mercería casi nunca es el metro y que
 * el alta de telas ni pregunta.
 *
 * Los errores de captura (código repetido, URL ocupada) vuelven por
 * querystring, como en /admin/inventario: son flujo normal, no una falla.
 */
export default async function NuevaMerceriaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; existe?: string }>;
}) {
  const { user, autorizado } = await getSesionAdmin();
  if (!user) redirect("/admin/login");
  if (!autorizado) redirect("/admin");

  const { error, existe } = await searchParams;

  const supabase = createAdminClient();
  const [{ data: categorias }, { data: colores }] = await Promise.all([
    supabase.from("categoria").select("id, nombre, slug").order("nombre"),
    supabase.from("color").select("id, nombre").order("nombre"),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav titulo="Nueva mercería" email={user.email ?? ""} />

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/5 p-4 text-sm text-ink/80"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
          <div>
            <p>{error}</p>
            {/* Un código repetido casi siempre significa "ya lo capturé":
                el atajo útil no es reintentar, es ir a editar el que existe. */}
            {existe && (
              <Link
                href={`/admin/tela/${existe}`}
                className="mt-1 inline-block font-medium text-amber underline underline-offset-2"
              >
                Abrir el producto que ya existe
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="mb-5 text-xs text-ink/50">
        Para pedrería, flores, copas, botones y cinta. Las telas se dan de alta
        en <Link href="/admin/tela/nueva" className="text-amber underline underline-offset-2">Nueva tela</Link>.
        Al guardar se abre el editor para agregar más colores o fotos.
      </p>

      <FormNuevaMerceria categorias={categorias ?? []} colores={colores ?? []} />
    </main>
  );
}
