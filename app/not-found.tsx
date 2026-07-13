import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * 404 con la marca: cubre tanto rutas inexistentes como telas que ya no
 * están en el catálogo (el detalle llama `notFound()` si el slug no existe).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="font-display text-7xl text-amber/30">404</p>
      <h1 className="mt-2 font-display text-3xl text-ink">
        No encontramos esa página
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        Puede que la tela ya no esté disponible o que el enlace esté
        incompleto. Todo el catálogo sigue aquí:
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al catálogo
      </Link>
    </main>
  );
}
