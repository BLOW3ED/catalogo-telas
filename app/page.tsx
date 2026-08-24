import Link from "next/link";
import { getCatalogo, getFacetas, MODELOS_POR_PAGINA } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { leerFiltros, cuentaFiltros, aQuerystring } from "@/lib/filtros";
import { ProductCard } from "@/components/ProductCard";
import { CatalogToolbar } from "@/components/CatalogToolbar";
import { TutorialTrigger } from "@/components/tutorial/TutorialTrigger";
import { VerMasButton } from "@/components/VerMasButton";
import { HeroSection } from "@/components/HeroSection";

const VER_MAXIMO = 1000;

function leerHasta(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  if (!Number.isFinite(n) || n <= 0) return MODELOS_POR_PAGINA;
  return Math.min(Math.ceil(n / MODELOS_POR_PAGINA) * MODELOS_POR_PAGINA, VER_MAXIMO);
}

function hrefConVer(filtros: ReturnType<typeof leerFiltros>, ver: number): string {
  const qs = aQuerystring(filtros);
  return `/?${qs ? `${qs}&` : ""}ver=${ver}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = leerFiltros(sp);
  const hasta = leerHasta(sp.ver);

  const [{ data, error, configurado, totalModelos }, facetas] = await Promise.all([
    getCatalogo({ filtros, hasta }),
    getFacetas(),
  ]);
  const modelos = agruparPorModelo(data);
  const faltan = totalModelos - modelos.length;
  const tieneFiltrosOBusqueda = cuentaFiltros(filtros) > 0 || filtros.q.length > 0;

  return (
    <main className="min-h-screen bg-sand-bg text-ink-text">
      {/* 1. Hero Editorial / Bienvenida con Showcase de Telas e Identidad */}
      {!tieneFiltrosOBusqueda && (
        <HeroSection totalModelos={totalModelos} />
      )}

      {/* 2. Barra de Búsqueda, Categorías y Filtros Sticky (Accesible en todo momento).
          El id="catalogo-seccion" (destino del botón "Explorar Catálogo" del Hero)
          vive en el propio div sticky de CatalogToolbar, NO en un wrapper: un wrapper
          que solo contuviera la barra tendría exactamente su misma altura, sin margen
          para que el sticky "recorra" nada — se despega en el primer pixel de scroll.
          El sticky necesita que su padre (aquí <main>, con el hero y el grid debajo)
          sea más alto que el elemento pegado. */}
      {!configurado && <div id="catalogo-seccion" />}
      {configurado && (
        <CatalogToolbar filtros={filtros} facetas={facetas} />
      )}

      {/* 3. Contenedor de Productos del Catálogo */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Encabezado de sección cuando se está buscando o filtrando */}
        {tieneFiltrosOBusqueda && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink-display sm:text-3xl">
                {filtros.q ? `Resultados para “${filtros.q}”` : "Catálogo de Telas"}
              </h1>
              <p className="text-sm text-ink-soft">
                Explora y filtra entre nuestra colección disponible.
              </p>
            </div>
          </div>
        )}

        {!configurado && <SetupNotice />}

        {configurado && error && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber/30 bg-surface-container p-5 text-sm shadow-xs">
            <span className="material-symbols-outlined text-[24px] text-amber">warning</span>
            <div>
              <p className="font-semibold text-ink-display">No se pudo leer el catálogo</p>
              <p className="text-ink-soft">{error}</p>
            </div>
          </div>
        )}

        {configurado && !error && modelos.length === 0 && (
          <SinResultados filtros={filtros} />
        )}

        {modelos.length > 0 && (
          <>
            {/* Conteo de productos */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs sm:text-sm font-semibold text-ink-soft" aria-live="polite">
                {faltan > 0
                  ? `Mostrando ${modelos.length} de ${totalModelos} telas y artículos`
                  : `${totalModelos} ${totalModelos === 1 ? "artículo disponible" : "artículos disponibles"}`}
              </p>
            </div>

            {/* Grid de Productos */}
            <section className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {modelos.map((tela, i) => (
                <ProductCard key={tela.tela_id} tela={tela} priority={i < 4} />
              ))}
            </section>

            {/* Ver más */}
            {faltan > 0 && (
              <div className="mt-12 flex justify-center pb-12">
                <VerMasButton
                  href={hrefConVer(filtros, hasta + MODELOS_POR_PAGINA)}
                  etiqueta={`Ver ${Math.min(faltan, MODELOS_POR_PAGINA)} productos más`}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Botón flotante del tutorial (siempre accesible desde cualquier parte de la página) */}
      <TutorialTrigger variant="floating" />
    </main>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-line bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-amber">
        <span className="material-symbols-outlined text-[24px]">settings</span>
        <h2 className="font-display text-xl font-bold">Falta conectar Supabase</h2>
      </div>
      <ol className="list-inside list-decimal space-y-1.5 text-sm text-ink-soft">
        <li>Crea un proyecto en Supabase y corre <code className="rounded bg-surface-container px-1">catalogo_telas_supabase.sql</code>.</li>
        <li>Crea el bucket público <code className="rounded bg-surface-container px-1">telas</code> en Storage.</li>
        <li>Copia <code className="rounded bg-surface-container px-1">.env.example</code> a <code className="rounded bg-surface-container px-1">.env.local</code> y llena las llaves.</li>
        <li>Reinicia <code className="rounded bg-surface-container px-1">pnpm dev</code>.</li>
      </ol>
    </div>
  );
}

function SinResultados({ filtros }: { filtros: ReturnType<typeof leerFiltros> }) {
  const conFiltros = cuentaFiltros(filtros) > 0;
  const conBusqueda = filtros.q.length > 0;

  if (!conFiltros && !conBusqueda) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest/80 p-12 text-center shadow-xs">
        <p className="font-display text-2xl text-ink-soft">Aún no hay telas cargadas</p>
        <p className="mt-2 text-sm text-ink-soft">
          Corre <code className="rounded bg-surface-container px-1">pnpm ingest</code> y luego{" "}
          <code className="rounded bg-surface-container px-1">pnpm ingest --upload</code> para poblar el catálogo.
        </p>
      </div>
    );
  }

  const soloBusqueda = aQuerystring({
    ...filtros,
    categorias: [],
    colores: [],
    propiedades: [],
    precioMax: null,
    soloDisponibles: false,
  });

  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest/80 p-12 text-center shadow-xs">
      <span className="material-symbols-outlined mx-auto mb-3 text-[48px] text-amber block">
        search_off
      </span>
      <p className="font-display text-2xl font-bold text-ink-display">Sin resultados</p>
      <p className="mt-2 text-sm text-ink-soft max-w-md mx-auto">
        {conBusqueda && conFiltros
          ? `No encontramos productos para “${filtros.q}” con los filtros seleccionados.`
          : conBusqueda
            ? `No encontramos nada para “${filtros.q}”. Intenta con otro término o SKU.`
            : "Ningún producto cumple con todos los filtros activos."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {conFiltros && (
          <Link
            href={soloBusqueda ? `/?${soloBusqueda}` : "/"}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-ink-display shadow-xs transition-all hover:bg-surface-container active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            Quitar los filtros
          </Link>
        )}
      </div>
    </div>
  );
}
