import { Suspense } from "react";
import { getCatalogo } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { TutorialTrigger } from "@/components/tutorial/TutorialTrigger";
import { AlertTriangle, Settings, SearchX } from "lucide-react";

// La página es dinámica (lee `searchParams`), pero las lecturas del catálogo
// se cachean 60s en lib/queries.ts (unstable_cache).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termino = q?.trim() ?? "";
  const { data, error, configurado } = await getCatalogo({ q: termino });
  const modelos = agruparPorModelo(data);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {configurado && (
        <div className="mb-8 max-w-xl">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
          <TutorialTrigger className="mt-3" />
        </div>
      )}

      {!configurado && <SetupNotice />}

      {configurado && error && (
        <div className="flex items-start gap-3 rounded border border-amber/30 bg-amber/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <div>
            <p className="font-semibold">No se pudo leer el catálogo</p>
            <p className="text-ink-soft">{error}</p>
          </div>
        </div>
      )}

      {configurado && !error && modelos.length === 0 && (
        termino ? <NoResults termino={termino} /> : <EmptyState />
      )}

      {modelos.length > 0 && (
        <section className="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
          {modelos.map((tela, i) => (
            <ProductCard key={tela.tela_id} tela={tela} priority={i < 4} />
          ))}
        </section>
      )}
    </main>
  );
}

function SetupNotice() {
  return (
    <div className="rounded border border-line-strong/30 bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-amber">
        <Settings className="h-5 w-5" aria-hidden />
        <h2 className="font-display text-xl">Falta conectar Supabase</h2>
      </div>
      <ol className="list-inside list-decimal space-y-1.5 text-sm text-ink-soft">
        <li>Crea un proyecto en Supabase y corre <code className="rounded bg-line/60 px-1">catalogo_telas_supabase.sql</code>.</li>
        <li>Crea el bucket público <code className="rounded bg-line/60 px-1">telas</code> en Storage.</li>
        <li>Copia <code className="rounded bg-line/60 px-1">.env.example</code> a <code className="rounded bg-line/60 px-1">.env.local</code> y llena las llaves.</li>
        <li>Reinicia <code className="rounded bg-line/60 px-1">npm run dev</code>.</li>
      </ol>
    </div>
  );
}

function NoResults({ termino }: { termino: string }) {
  return (
    <div className="rounded border border-dashed border-line-strong/40 bg-surface/60 p-10 text-center">
      <SearchX className="mx-auto mb-3 h-8 w-8 text-ink-soft" aria-hidden />
      <p className="font-display text-2xl text-ink-soft">Sin resultados</p>
      <p className="mt-1 text-sm text-ink-soft">
        No encontramos telas para “{termino}”. Prueba con otro nombre, color o SKU.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-dashed border-line-strong/40 bg-surface/60 p-10 text-center">
      <p className="font-display text-2xl text-ink-soft">Aún no hay telas</p>
      <p className="mt-1 text-sm text-ink-soft">
        Corre <code className="rounded bg-line/60 px-1">npm run ingest</code> y luego{" "}
        <code className="rounded bg-line/60 px-1">npm run ingest -- --upload</code> para poblar el catálogo.
      </p>
    </div>
  );
}
