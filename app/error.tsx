"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Error boundary del catálogo: sustituye la pantalla de error default de Next
 * (en inglés, sin marca) por una en el tono del sitio, con reintento.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle técnico va al log, no al cliente final.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-amber">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="font-display text-3xl text-ink">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        No pudimos cargar esta parte del catálogo. Suele resolverse
        reintentando; si sigue fallando, vuelve a intentarlo en un momento.
      </p>
      <Button variant="primary" size="md" className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Reintentar
      </Button>
    </main>
  );
}
