import { Suspense } from "react";
import { getCatalogo } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { Hint } from "@/components/Hint";
import { ShareCatalog } from "@/components/ShareCatalog";
import {
  AlertTriangle,
  Settings,
  SearchX,
  Search,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";

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

      {configurado && <IntroPasos />}

      {configurado && (
        <div className="mb-4 max-w-xl">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
        </div>
      )}

      {configurado && (
        <Hint id="home-buscar" className="mb-8 max-w-xl">
          Escribe aquí el nombre, el color o el tipo de tela que buscas. También
          puedes bajar y explorar todo el catálogo.
        </Hint>
      )}

      {!configurado && <SetupNotice />}

      {configurado && error && (
        <div className="flex items-start gap-3 rounded border border-amber/30 bg-amber/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <div>
            <p className="font-semibold">No se pudo leer el catálogo</p>
            <p className="text-ink/60">{error}</p>
          </div>
        </div>
      )}

      {configurado && !error && modelos.length === 0 && (
        termino ? <NoResults termino={termino} /> : <EmptyState />
      )}

      {modelos.length > 0 && (
        <>
          <Hint id="home-grid" arrow="down" className="mb-4 max-w-md">
            Toca una tela para verla en grande, elegir su color y ver el precio.
          </Hint>
          <section className="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
            {modelos.map((tela, i) => (
              <ProductCard key={tela.tela_id} tela={tela} priority={i < 4} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

/** Franja de 3 pasos: refuerza el "camino de venta" en la portada. */
function IntroPasos() {
  const pasos = [
    { icon: Search, titulo: "1. Explora", texto: "Busca o navega las telas." },
    {
      icon: ShoppingBag,
      titulo: "2. Arma tu pedido",
      texto: "Elige los metros y agrega.",
    },
    {
      icon: MessageCircle,
      titulo: "3. Envía",
      texto: "Mándalo por WhatsApp.",
    },
  ];

  return (
    <section className="mb-8 rounded border border-line-strong/30 bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-ink sm:text-2xl">
            Pide tus telas en 3 pasos
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Sin prisas y sin compromiso: arma tu pedido y te atendemos por WhatsApp.
          </p>
        </div>
        <ShareCatalog variant="secondary" size="md" label="Compartir catálogo" />
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {pasos.map(({ icon: Icon, titulo, texto }) => (
          <li
            key={titulo}
            className="flex items-start gap-3 rounded bg-bg/60 p-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-amber/10 text-amber">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold leading-tight text-ink">{titulo}</p>
              <p className="text-sm text-ink/60">{texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SetupNotice() {
  return (
    <div className="rounded border border-line-strong/30 bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-amber">
        <Settings className="h-5 w-5" aria-hidden />
        <h2 className="font-display text-xl">Falta conectar Supabase</h2>
      </div>
      <ol className="list-inside list-decimal space-y-1.5 text-sm text-ink/70">
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
      <SearchX className="mx-auto mb-3 h-8 w-8 text-ink/30" aria-hidden />
      <p className="font-display text-2xl text-ink/70">Sin resultados</p>
      <p className="mt-1 text-sm text-ink/50">
        No encontramos telas para “{termino}”. Prueba con otro nombre, color o SKU.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-dashed border-line-strong/40 bg-surface/60 p-10 text-center">
      <p className="font-display text-2xl text-ink/70">Aún no hay telas</p>
      <p className="mt-1 text-sm text-ink/50">
        Corre <code className="rounded bg-line/60 px-1">npm run ingest</code> y luego{" "}
        <code className="rounded bg-line/60 px-1">npm run ingest -- --upload</code> para poblar el catálogo.
      </p>
    </div>
  );
}
