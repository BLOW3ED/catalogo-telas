import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Image as ImageIcon,
  ImageOff,
  LogOut,
  Pencil,
  Search,
  ShieldAlert,
} from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "@/components/TelaImage";
import { ColorSwatch } from "@/components/ColorSwatch";
import { AdminNav } from "@/components/admin/AdminNav";
import { contarFotosPorVariante } from "@/lib/fotos";
import { logout } from "./actions";
import { agruparPorModelo, type CatalogoTela, type TelaAgrupada } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin — Telas La Jalisciense",
  robots: { index: false, follow: false },
};

/** Cuántos swatches caben antes de resumir el resto en un "+N". */
const MAX_SWATCHES = 12;

/**
 * Tope de productos por búsqueda. Acota la URL del `in(tela_id, …)` de la
 * segunda lectura; una búsqueda que devuelve más de esto hay que afinarla, no
 * recorrerla (el grid público pagina de 48 por lo mismo).
 */
const MAX_PRODUCTOS_BUSQUEDA = 48;

/**
 * Panel de administración: una tarjeta POR PRODUCTO (no por variante). La vista
 * trae una fila por color, así que un modelo de 8 colores llenaba ocho tarjetas
 * seguidas con el mismo nombre; `agruparPorModelo` —el mismo agrupador que usa
 * el grid público— las colapsa en una sola con sus colores como swatches.
 *
 * La CARD COMPLETA abre el editor (/admin/tela/[id]: valores, variantes, fotos)
 * y cada swatch abre ESE color dentro del editor. Precio y stock ya no se
 * capturan aquí: con ocho colores por tarjeta no cabe un formulario por color,
 * y el deep-link del swatch deja el campo a un toque de distancia.
 *
 * Lee la vista con el cliente service_role SIN caché: el admin siempre ve
 * la verdad de la BD (sin precios demo). Al guardar, `revalidateTag` refresca
 * el sitio público al instante.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, autorizado } = await getSesionAdmin();
  if (!user) redirect("/admin/login");
  if (!autorizado) return <NoAutorizado email={user.email ?? ""} />;

  const { q } = await searchParams;
  const termino = q?.trim() ?? "";

  const supabase = createAdminClient();

  // Buscar por PRODUCTO, no por fila. La vista da una fila por color, así que
  // filtrar por `color_nombre` traería solo los colores que casan: la tarjeta
  // agrupada saldría con 1 de 8 swatches y contando las fotos de ese color, y
  // un producto con 20 fotos diría "1 foto". Se resuelve como el catálogo
  // público (`paginaCatalogoCached`): una lectura barata para saber QUÉ
  // productos casan y otra para traer sus filas completas.
  //
  // El tope existe porque el segundo `in(...)` viaja en la URL y cientos de
  // UUIDs la revientan (mismo motivo por el que el grid público pagina de 48).
  let idsRecortados = false;
  let query = supabase.from("catalogo_telas").select("*");

  if (termino) {
    const patron = `%${termino.replace(/[,()"\\]/g, " ")}%`;
    const filtro = `tela_nombre.ilike.${patron},color_nombre.ilike.${patron},sku.ilike.${patron}`;

    const { data: coincidencias } = await supabase
      .from("catalogo_telas")
      .select("tela_id, tela_nombre")
      .or(filtro)
      .order("tela_nombre", { ascending: true });

    const ids = [...new Set((coincidencias ?? []).map((c) => c.tela_id as string))];
    idsRecortados = ids.length > MAX_PRODUCTOS_BUSQUEDA;
    query = query.in("tela_id", ids.slice(0, MAX_PRODUCTOS_BUSQUEDA));
  }

  query = query
    .order("tela_nombre", { ascending: true })
    .order("color_nombre", { ascending: true });

  // El conteo de fotos NO está en la vista (colapsa las N fotos de la variante
  // en `foto_principal`), así que va en una lectura aparte que se agrupa en
  // memoria. Se piden TODAS las filas, sin filtrar por las variantes visibles:
  // un `in(...)` con cientos de UUIDs revienta el largo de la URL de PostgREST.
  const [{ data, error }, { data: fotos }] = await Promise.all([
    query,
    supabase.from("foto").select("variante_id"),
  ]);
  const variantes = (data ?? []) as CatalogoTela[];
  const fotosPorVariante = contarFotosPorVariante(fotos ?? []);
  // La query ya viene ordenada por nombre de tela; el agrupador respeta ese
  // orden de llegada, así que la lista sale alfabética sin volver a ordenar.
  const productos = agruparPorModelo(variantes);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav titulo="Administración" email={user.email ?? ""} />

      {/* Búsqueda (GET → estado compartible en la URL, igual que el sitio público) */}
      <form method="get" className="mb-3 flex max-w-md gap-2" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={termino}
            placeholder="Buscar por tela, color o SKU…"
            aria-label="Buscar productos"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          Buscar
        </button>
      </form>

      <p className="mb-6 text-xs text-ink/50">
        <strong>Toca la tarjeta</strong> para abrir el editor completo (precio,
        stock, fotos, colores, categoría), o toca un <strong>color</strong> para
        ir directo a ese color dentro del editor.
        {productos.length > 0 && (
          <>
            {" "}
            <span className="text-ink/40">
              {productos.length}{" "}
              {productos.length === 1 ? "producto" : "productos"} ·{" "}
              {variantes.length} {variantes.length === 1 ? "color" : "colores"}
              {termino && " en esta búsqueda"}.
              {idsRecortados &&
                ` Hay más resultados: se muestran los primeros ${MAX_PRODUCTOS_BUSQUEDA}, afina la búsqueda para verlos.`}
            </span>
          </>
        )}
      </p>

      {error && (
        <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm text-ink/80">
          No se pudo leer el catálogo: {error.message}
        </div>
      )}

      {!error && productos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-10 text-center text-sm text-ink/50">
          {termino
            ? `Sin resultados para “${termino}”.`
            : "Aún no hay productos en el catálogo. Corre la ingesta (ver README)."}
        </div>
      )}

      <ul className="space-y-3">
        {productos.map((tela) => (
          <TarjetaProducto
            key={tela.tela_id}
            tela={tela}
            fotos={tela.variantes.reduce(
              (total, v) => total + (fotosPorVariante.get(v.variante_id) ?? 0),
              0
            )}
          />
        ))}
      </ul>
    </main>
  );
}

/**
 * Un producto en la lista: portada, nombre, sus dos datos de catalogación
 * —categoría y cuántas fotos tiene EN TOTAL— y la fila de colores.
 *
 * La card entera es un enlace al editor MENOS los swatches, que apuntan cada
 * uno a su propia variante. Se pinta un swatch por VARIANTE y no por color
 * único (como sí hace `ProductCard` en la vitrina): aquí el punto no es
 * decorativo sino un destino, y deduplicar dejaría sin enlace a dos SKUs que
 * comparten color y sin ningún punto a las variantes sin color —justo las de
 * mercería—.
 */
function TarjetaProducto({ tela, fotos }: { tela: TelaAgrupada; fotos: number }) {
  const portada = tela.variantes[0];
  const unicaVariante = tela.variantes.length === 1 ? portada : null;
  const visibles = tela.variantes.slice(0, MAX_SWATCHES);
  const ocultos = tela.variantes.length - visibles.length;

  return (
    <li
      /* `relative` ancla el stretched link del nombre (su ::after cubre
         toda la card). `group` deja que el lápiz decorativo reaccione al
         hover de la card completa, no solo al del enlace. */
      className="group relative flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-amber/40 hover:bg-surface-high"
    >
      <div className="w-14 shrink-0 overflow-hidden rounded-lg border border-line">
        <TelaImage
          src={publicImageUrl(portada?.foto_principal)}
          derivados={portada?.foto_principal_derivados}
          sizes="56px"
          alt={
            portada?.color_nombre
              ? `${tela.tela_nombre} ${portada.color_nombre}`
              : tela.tela_nombre
          }
          aspecto="cuadrado"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-semibold leading-tight text-ink">
          {/* Stretched link: enlace REAL sobre el nombre (así tiene texto
              accesible y se puede abrir en otra pestaña) cuyo ::after se
              estira sobre la card entera. */}
          <Link
            href={`/admin/tela/${tela.tela_id}`}
            title="Editar producto (precio, stock, colores y fotos)"
            className="truncate rounded after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            {tela.tela_nombre}
          </Link>
          <Pencil
            className="h-3.5 w-3.5 shrink-0 text-ink/30 transition-colors group-hover:text-amber"
            aria-hidden
          />
        </p>

        {/* Con un solo color la fila de swatches no dice nada que el nombre no
            diga ya; en su lugar se muestra el color y el SKU, que es lo que
            identifica una bolsita de mercería. */}
        {unicaVariante && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink/60">
            {unicaVariante.color_hex && (
              <ColorSwatch
                hex={unicaVariante.color_hex}
                nombre={unicaVariante.color_nombre}
                size="sm"
              />
            )}
            <span className="truncate">
              {unicaVariante.color_nombre ?? "Sin color"}
              {unicaVariante.sku && ` · ${unicaVariante.sku}`}
            </span>
          </p>
        )}

        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={
              tela.categoria
                ? "rounded-full border border-line bg-bg px-2 py-0.5 text-ink/70"
                : "rounded-full border border-dashed border-line px-2 py-0.5 text-ink/40"
            }
          >
            {tela.categoria ?? "Sin categoría"}
          </span>
          {/* Cero fotos se marca en ámbar: es un producto invisible
              en el catálogo, no un dato de menos. */}
          <span
            className={
              fotos === 0
                ? "inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 font-medium text-amber"
                : "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-ink/50"
            }
          >
            {fotos === 0 ? (
              <ImageOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            )}
            {fotos === 0 ? "Sin fotos" : `${fotos} ${fotos === 1 ? "foto" : "fotos"}`}
          </span>
          {!unicaVariante && (
            <span className="rounded-full px-2 py-0.5 text-ink/50">
              {tela.variantes.length} colores
            </span>
          )}
        </p>

        {/* z-10 levanta los swatches por encima del ::after del enlace: sin
            esto, tocar un color abriría el editor en la primera variante. */}
        {!unicaVariante && (
          <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5">
            {visibles.map((v) => {
              const etiqueta =
                v.color_nombre ?? (v.sku ? `SKU ${v.sku}` : "Sin color");
              return (
                <Link
                  key={v.variante_id}
                  href={`/admin/tela/${tela.tela_id}#variante-${v.variante_id}`}
                  title={`Editar ${etiqueta}`}
                  aria-label={`Editar ${etiqueta}`}
                  className="rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <ColorSwatch hex={v.color_hex} nombre={etiqueta} size="sm" />
                </Link>
              );
            })}
            {ocultos > 0 && (
              <Link
                href={`/admin/tela/${tela.tela_id}`}
                className="rounded px-1 text-xs font-semibold text-ink/50 hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                +{ocultos}
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Sesión válida pero correo fuera de ADMIN_EMAILS. */
function NoAutorizado({ email }: { email: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-amber">
        <ShieldAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl text-ink">Cuenta sin permisos</h1>
      <p className="mt-2 text-sm text-ink/60">
        La cuenta <strong>{email}</strong> no está en la lista de
        administradores (<code className="rounded bg-line/60 px-1">ADMIN_EMAILS</code>).
      </p>
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
