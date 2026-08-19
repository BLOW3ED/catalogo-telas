import Image from "next/image";
import Link from "next/link";
import { getCatalogo, getFacetas, MODELOS_POR_PAGINA } from "@/lib/queries";
import { agruparPorModelo } from "@/lib/types";
import { leerFiltros, cuentaFiltros, aQuerystring } from "@/lib/filtros";
import { ProductCard } from "@/components/ProductCard";
import { CatalogToolbar } from "@/components/CatalogToolbar";
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
      {/* 1. Hero Editorial / Bienvenida con Tutorial Llamativo */}
      {!tieneFiltrosOBusqueda && (
        /* Hero en dos piezas: BANDA de foto a color pleno arriba y el texto
            abajo sobre arena sólida. Antes iba todo superpuesto, pero el bloque
            de texto (eyebrow + título + párrafo + banner del tutorial) llena el
            hero casi entero, así que hacía falta un velo del 68% en TODA la
            superficie para que el titular pasara AA — y eso dejaba los encajes
            irreconocibles. Separándolos, la foto va sin velo y el texto recupera
            el contraste normal del sitio.

            El `-mt-16` mete la banda DEBAJO del header (que mide h-16 y es
            sticky), para que la foto se vea a través del blanco translúcido. */
        <section className="relative w-full overflow-hidden border-b border-line/60 bg-sand-bg -mt-16">
          {/* Banda de foto. Se le suma el alto del header para que lo que queda
              a la vista bajo la barra siga siendo una franja con cuerpo. */}
          <div className="relative h-[264px] sm:h-[344px] lg:h-[404px] w-full">
            {/* Foto real del mostrador (encajes bordados). Sustituye al stock de
                Stitch que venía hotlinkeado desde googleusercontent: una URL
                ajena que podía morir sin aviso y que no era mercancía nuestra.
                El activo se generó con la MISMA cadena que
                `lib/images/derivados.ts` (sRGB forzado, sharpen σ 0.6, WebP 82)
                — sin tocar brillo ni saturación: aquí se ve tela de verdad. */}
            <Image
              src="/hero-encajes.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* Único remate: funde el borde inferior con el arena de la página.
                No vela la banda, solo evita el corte seco. */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sand-bg to-transparent" />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
            <div className="relative z-10 max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-0.5 w-6 bg-accent-copper" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-copper">
                  TIENDA TEXTIL & MERCERÍA
                </span>
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-heritage-navy sm:text-5xl sm:leading-tight">
                Bienvenid@ a Telas La Jalisciense
              </h1>
              <p className="mt-3 text-base text-ink-text/80 sm:text-lg">
                La mejor selección de telas, encajes, bordados y mercería en Fresnillo.
              </p>

              {/* Banner llamativo y destacado del Tutorial */}
              <TutorialTrigger variant="hero-banner" className="mt-6 sm:mt-8" />
            </div>
          </div>
        </section>
      )}

      {/* 2. Barra de Búsqueda, Categorías y Filtros Sticky (Accesible en todo momento) */}
      {configurado && (
        <CatalogToolbar filtros={filtros} facetas={facetas} />
      )}

      {/* 3. Contenedor de Productos del Catálogo */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Encabezado de sección cuando se está buscando o filtrando */}
        {tieneFiltrosOBusqueda && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold text-heritage-navy sm:text-3xl">
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

      {/* Botón flotante del tutorial (siempre accesible desde cualquier parte de la página) */}
      <TutorialTrigger variant="floating" />
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
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {conFiltros && (
          <Link
            href={soloBusqueda ? `/?${soloBusqueda}` : "/"}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-heritage-navy shadow-xs transition-all hover:bg-surface-container active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            Quitar los filtros
          </Link>
        )}
      </div>
    </div>
  );
}
