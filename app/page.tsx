import { Suspense } from "react";
import Link from "next/link";
import { getCatalogo, getFacetas, MODELOS_POR_PAGINA } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { leerFiltros, cuentaFiltros, aQuerystring } from "@/lib/filtros";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { Filtros } from "@/components/Filtros";
import { TutorialTrigger } from "@/components/tutorial/TutorialTrigger";
import { Plus } from "lucide-react";

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
      {/* 1. Hero Editorial / Bienvenida (Solo visible cuando no hay filtros activos de búsqueda) */}
      {!tieneFiltrosOBusqueda && (
        <section className="relative w-full overflow-hidden border-b border-line/60 bg-surface-container-low">
          <div className="relative mx-auto flex min-h-[360px] sm:min-h-[440px] max-w-7xl flex-col justify-end px-4 pb-12 pt-16 sm:px-6 lg:px-8">
            <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply">
              <div
                className="h-full w-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuARc_jBlq3eaVT-nzPAr-UoG2Iy6xCi3yWN8i3Ndsmp3FmDDFDeO2iT9bwQO5XUTDc7SXJbs5QwhNBq92izOmaUSky-mSNPrmjEnVgnnecYBEpHQqo0IGwivb6CTSHTzGtXU1J2nHH9mNPTfIi1D0TQOWzoo5H30toOcdjvdUYsiNrysngO4-D_4TL7Xn4MLb1iv9h8QBZGyXfDj-Ck-O0kBzK0pzh_rJaUK_Jg0wHFTv6yudgijl12')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sand-bg via-sand-bg/60 to-transparent" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-0.5 w-6 bg-accent-copper" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-copper">
                  Atelier Textil & Mercería Fina
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-heritage-navy sm:text-5xl sm:leading-tight">
                Bienvenidos a Telas La Jalisciense
              </h1>
              <p className="mt-3 text-base text-ink-text/80 sm:text-lg">
                La mayor selección de sedas, linos, encajes bordados y mercería de alta calidad para tus confecciones en Fresnillo.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 2. Área Principal de Catálogo */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Encabezado de sección cuando se está buscando */}
        {tieneFiltrosOBusqueda && (
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-heritage-navy sm:text-3xl">
              Catálogo de Telas
            </h1>
            <p className="text-sm text-ink-soft">
              Explora y filtra entre nuestra colección disponible.
            </p>
          </div>
        )}

        {configurado && (
          <div className="mb-6 flex flex-col gap-4">
            <div className="max-w-xl">
              <Suspense fallback={null}>
                <SearchBar />
              </Suspense>
              <TutorialTrigger className="mt-3" />
            </div>
            <Filtros filtros={filtros} facetas={facetas} />
          </div>
        )}

        {!configurado && <SetupNotice />}

        {configurado && error && (
          <div className="flex items-start gap-3 rounded-2xl border border-accent-copper/30 bg-surface-container p-5 text-sm shadow-xs">
            <span className="material-symbols-outlined text-[24px] text-accent-copper">warning</span>
            <div>
              <p className="font-semibold text-heritage-navy">No se pudo leer el catálogo</p>
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
                <Link
                  href={hrefConVer(filtros, hasta + MODELOS_POR_PAGINA)}
                  scroll={false}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-8 py-3.5 text-sm font-bold text-heritage-navy shadow-sm transition-all hover:bg-surface-container hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
                >
                  <Plus className="h-4 w-4 text-heritage-navy" aria-hidden />
                  Ver {Math.min(faltan, MODELOS_POR_PAGINA)} productos más
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-line bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-accent-copper">
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

  const soloBusqueda = aQuerystring({ ...filtros, categorias: [], colores: [], propiedades: [], precioMax: null, soloDisponibles: false });

  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest/80 p-12 text-center shadow-xs">
      <span className="material-symbols-outlined mx-auto mb-3 text-[48px] text-accent-copper block">
        search_off
      </span>
      <p className="font-display text-2xl font-bold text-heritage-navy">Sin resultados</p>
      <p className="mt-2 text-sm text-ink-soft max-w-md mx-auto">
        {conBusqueda && conFiltros
          ? `No encontramos productos para “${filtros.q}” con los filtros seleccionados.`
          : conBusqueda
            ? `No encontramos nada para “${filtros.q}”. Intenta con otro término o SKU.`
            : "Ningún producto cumple con todos los filtros activos."}
      </p>
      {conFiltros && (
        <Link
          href={soloBusqueda ? `/?${soloBusqueda}` : "/"}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-heritage-navy shadow-xs transition-all hover:bg-surface-container active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
          Quitar los filtros
        </Link>
      )}
    </div>
  );
}

