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
      {configurado && (
        <>
          <div className="mb-4 max-w-xl">
            <Suspense fallback={null}>
              <SearchBar />
            </Suspense>
            <TutorialTrigger className="mt-3" />
          </div>
          <Filtros filtros={filtros} facetas={facetas} />
        </>
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
        <SinResultados filtros={filtros} />
      )}

      {modelos.length > 0 && (
        <>
          {/* El conteo le dice a quien filtró que la lista corta es a propósito.
              Cuando hay más de una página, dice cuántos se ven DE cuántos, en
              vez de dar un número que no cuadra con la suma de los chips. */}
          <p className="mb-4 text-sm text-ink-soft" aria-live="polite">
            {faltan > 0
              ? `${modelos.length} de ${totalModelos} productos`
              : `${totalModelos} ${totalModelos === 1 ? "producto" : "productos"}`}
          </p>
          <section className="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
            {modelos.map((tela, i) => (
              <ProductCard key={tela.tela_id} tela={tela} priority={i < 4} />
            ))}
          </section>

          {faltan > 0 && (
            <div className="mt-10 flex justify-center">
              {/* `scroll={false}`: el grid crece hacia abajo y quien picó "Ver
                  más" se queda donde estaba, no de vuelta hasta arriba. */}
              <Link
                href={hrefConVer(filtros, hasta + MODELOS_POR_PAGINA)}
                scroll={false}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong/30 bg-chip px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Ver {Math.min(faltan, MODELOS_POR_PAGINA)} más
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

/**
 * Un solo vacío que se explica distinto según por qué quedó vacío: buscar algo
 * que no existe, filtrar de más, o un catálogo que aún no se ha poblado. Sin
 * esa distinción, quien combinó tres chips cree que el catálogo se rompió.
 */
function SinResultados({ filtros }: { filtros: ReturnType<typeof leerFiltros> }) {
  const conFiltros = cuentaFiltros(filtros) > 0;
  const conBusqueda = filtros.q.length > 0;

  if (!conFiltros && !conBusqueda) {
    return (
      <div className="rounded border border-dashed border-line-strong/40 bg-surface/60 p-10 text-center">
        <p className="font-display text-2xl text-ink-soft">Aún no hay telas</p>
        <p className="mt-1 text-sm text-ink-soft">
          Corre <code className="rounded bg-line/60 px-1">pnpm ingest</code> y luego{" "}
          <code className="rounded bg-line/60 px-1">pnpm ingest --upload</code> para poblar el catálogo.
        </p>
      </div>
    );
  }

  // Con búsqueda Y filtros, lo más probable es que sobren los filtros: se
  // ofrece quitarlos sin perder lo que la persona escribió.
  const soloBusqueda = aQuerystring({ ...filtros, categorias: [], colores: [], propiedades: [], precioMax: null, soloDisponibles: false });

  return (
    <div className="rounded border border-dashed border-line-strong/40 bg-surface/60 p-10 text-center">
      {conBusqueda ? (
        <SearchX className="mx-auto mb-3 h-8 w-8 text-ink-soft" aria-hidden />
      ) : (
        <FilterX className="mx-auto mb-3 h-8 w-8 text-ink-soft" aria-hidden />
      )}
      <p className="font-display text-2xl text-ink-soft">Sin resultados</p>
      <p className="mt-1 text-sm text-ink-soft">
        {conBusqueda && conFiltros
          ? `No hay nada para “${filtros.q}” con esos filtros.`
          : conBusqueda
            ? `No encontramos nada para “${filtros.q}”. Prueba con otro nombre, color o SKU.`
            : "Ningún producto cumple con todos los filtros."}
      </p>
      {conFiltros && (
        <Link
          href={soloBusqueda ? `/?${soloBusqueda}` : "/"}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line-strong/30 bg-chip px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <FilterX className="h-4 w-4" aria-hidden />
          Quitar los filtros
        </Link>
      )}
    </div>
  );
}
