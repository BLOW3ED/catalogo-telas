import { Suspense } from "react";
import Link from "next/link";
import { getCatalogo, getFacetas, MODELOS_POR_PAGINA } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { leerFiltros, cuentaFiltros, aQuerystring } from "@/lib/filtros";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { Filtros } from "@/components/Filtros";
import { TutorialTrigger } from "@/components/tutorial/TutorialTrigger";
import { AlertTriangle, Settings, SearchX, FilterX, Plus } from "lucide-react";

/**
 * Cuántos modelos mostrar, leído de `?ver=`. Se acota por arriba para que
 * nadie pida `?ver=999999` y convierta la portada en una lectura sin fin, y
 * se redondea al tamaño de página para que el "Ver más" siga siendo parejo.
 */
const VER_MAXIMO = 1000;

function leerHasta(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  if (!Number.isFinite(n) || n <= 0) return MODELOS_POR_PAGINA;
  return Math.min(Math.ceil(n / MODELOS_POR_PAGINA) * MODELOS_POR_PAGINA, VER_MAXIMO);
}

/** URL de "Ver más": conserva búsqueda y filtros, solo mueve `ver`. */
function hrefConVer(filtros: ReturnType<typeof leerFiltros>, ver: number): string {
  const qs = aQuerystring(filtros);
  return `/?${qs ? `${qs}&` : ""}ver=${ver}`;
}

// La página es dinámica (lee `searchParams`), pero las lecturas del catálogo
// se cachean 60s en lib/queries.ts (unstable_cache).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = leerFiltros(sp);
  // `ver` = cuántos modelos mostrar. Vive en la URL como todo lo demás, así
  // que "atrás" regresa a la página corta y un link compartido abre con lo
  // mismo que veía quien lo mandó.
  const hasta = leerHasta(sp.ver);

  // Catálogo y facetas van en paralelo: son dos lecturas independientes y
  // encadenarlas sumaría sus latencias sin necesidad.
  const [{ data, error, configurado, totalModelos }, facetas] = await Promise.all([
    getCatalogo({ filtros, hasta }),
    getFacetas(),
  ]);
  const modelos = agruparPorModelo(data);
  const faltan = totalModelos - modelos.length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Intro hero editorial */}
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-ink-deep font-semibold tracking-tight mb-2">
          Catálogo Textil
        </h1>
        <p className="text-sm sm:text-base text-ink-soft max-w-2xl">
          Explora nuestra cuidada selección de telas, encajes, pedrería y mercería fina para tus proyectos de confección.
        </p>
      </div>

      {configurado && (
        <>
          <div className="mb-6 max-w-xl">
            <Suspense fallback={null}>
              <SearchBar />
            </Suspense>
            <TutorialTrigger className="mt-3.5" />
          </div>
          <Filtros filtros={filtros} facetas={facetas} />
        </>
      )}

      {!configurado && <SetupNotice />}

      {configurado && error && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
          <div>
            <p className="font-semibold text-ink">No se pudo leer el catálogo</p>
            <p className="text-ink-soft">{error}</p>
          </div>
        </div>
      )}

      {configurado && !error && modelos.length === 0 && (
        <SinResultados filtros={filtros} />
      )}

      {modelos.length > 0 && (
        <>
          {/* El conteo le dice a quien filtró que la lista corta es a propósito. */}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-xs sm:text-sm font-medium text-ink-soft" aria-live="polite">
              {faltan > 0
                ? `Mostrando ${modelos.length} de ${totalModelos} productos`
                : `${totalModelos} ${totalModelos === 1 ? "producto encontrado" : "productos encontrados"}`}
            </p>
          </div>

          <section className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {modelos.map((tela, i) => (
              <ProductCard key={tela.tela_id} tela={tela} priority={i < 4} />
            ))}
          </section>

          {faltan > 0 && (
            <div className="mt-12 flex justify-center pb-8">
              <Link
                href={hrefConVer(filtros, hasta + MODELOS_POR_PAGINA)}
                scroll={false}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-8 py-3.5 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-surface-container hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plus className="h-4 w-4 text-primary" aria-hidden />
                Ver {Math.min(faltan, MODELOS_POR_PAGINA)} productos más
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-amber">
        <Settings className="h-5 w-5" aria-hidden />
        <h2 className="font-display text-xl font-medium">Falta conectar Supabase</h2>
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

function SinResultados({ filtros }: { filtros: ReturnType<typeof leerFiltros> }) {
  const conFiltros = cuentaFiltros(filtros) > 0;
  const conBusqueda = filtros.q.length > 0;

  if (!conFiltros && !conBusqueda) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong/60 bg-surface/80 p-12 text-center shadow-sm">
        <p className="font-display text-2xl text-ink-soft">Aún no hay telas</p>
        <p className="mt-2 text-sm text-ink-soft">
          Corre <code className="rounded bg-line/60 px-1">pnpm ingest</code> y luego{" "}
          <code className="rounded bg-line/60 px-1">pnpm ingest --upload</code> para poblar el catálogo.
        </p>
      </div>
    );
  }

  const soloBusqueda = aQuerystring({ ...filtros, categorias: [], colores: [], propiedades: [], precioMax: null, soloDisponibles: false });

  return (
    <div className="rounded-2xl border border-dashed border-line-strong/60 bg-surface/80 p-12 text-center shadow-sm">
      {conBusqueda ? (
        <SearchX className="mx-auto mb-3 h-10 w-10 text-primary-container" aria-hidden />
      ) : (
        <FilterX className="mx-auto mb-3 h-10 w-10 text-primary-container" aria-hidden />
      )}
      <p className="font-display text-2xl font-medium text-ink-deep">Sin resultados</p>
      <p className="mt-2 text-sm text-ink-soft max-w-md mx-auto">
        {conBusqueda && conFiltros
          ? `No encontramos productos para “${filtros.q}” con los filtros seleccionados.`
          : conBusqueda
            ? `No encontramos nada para “${filtros.q}”. Intenta con otro término o código.`
            : "Ningún producto cumple con todos los filtros activos."}
      </p>
      {conFiltros && (
        <Link
          href={soloBusqueda ? `/?${soloBusqueda}` : "/"}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-surface-container active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <FilterX className="h-4 w-4" aria-hidden />
          Quitar los filtros
        </Link>
      )}
    </div>
  );
}
