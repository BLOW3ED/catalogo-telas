/**
 * Skeleton mientras el servidor arma la página (la primera visita tras
 * expirar el caché de 60s puede tardar ~2s). Replica la silueta del grid
 * del catálogo para que el cambio a contenido real no "brinque".
 */
export default function Loading() {
  return (
    <main
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
    >
      <span className="sr-only">Cargando el catálogo…</span>
      <div className="mb-8 h-32 animate-pulse rounded-2xl bg-line/50" />
      <div className="mb-8 h-12 max-w-xl animate-pulse rounded-xl bg-line/50" />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
          >
            <div className="aspect-[3/4] animate-pulse bg-line/50" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 animate-pulse rounded bg-line/50" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-line/50" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
