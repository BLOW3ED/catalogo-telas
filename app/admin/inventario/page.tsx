import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, PackageOpen, TrendingDown } from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { registrarMovimiento } from "@/app/admin/actions";
import {
  ETIQUETA_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  umbralStockBajo,
  type TipoMovimiento,
} from "@/lib/inventario";
import type { CatalogoTela } from "@/lib/types";

export const metadata: Metadata = {
  title: "Inventario — Admin",
  robots: { index: false, follow: false },
};

type Movimiento = {
  id: string;
  variante_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stock_resultante: number | null;
  nota: string | null;
  usuario_email: string | null;
  created_at: string;
};

const inputClase =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber";

/** "Chifón Lunares · Azul · CHLU99" para selects y tablas. */
function etiquetaVariante(v: CatalogoTela): string {
  const partes = [v.tela_nombre, v.color_nombre ?? "sin color"];
  if (v.sku) partes.push(v.sku);
  return partes.join(" · ");
}

const formatoFecha = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Logística de inventario:
 * - Captura de movimientos (entrada / salida / merma / ajuste) → kardex.
 * - Resumen: sin existencia, stock bajo, sin conteo.
 * - Historial reciente de movimientos con quién y por qué.
 *
 * `variante.stock` es el estado actual; `movimiento_inventario` explica cómo
 * se llegó ahí. Requiere la sección 10 de catalogo_telas_supabase.sql.
 */
export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, autorizado } = await getSesionAdmin();
  if (!user) redirect("/admin/login");
  if (!autorizado) redirect("/admin");

  const { error: errorCaptura, ok } = await searchParams;
  const umbral = umbralStockBajo();

  const supabase = createAdminClient();
  const [{ data: catalogoData, error: errorCatalogo }, { data: movimientosData, error: errorKardex }] =
    await Promise.all([
      supabase
        .from("catalogo_telas")
        .select("*")
        .order("tela_nombre", { ascending: true })
        .order("color_nombre", { ascending: true }),
      supabase
        .from("movimiento_inventario")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const variantes = (catalogoData ?? []) as CatalogoTela[];
  const movimientos = (movimientosData ?? []) as Movimiento[];
  const kardexDisponible = !errorKardex;

  const porId = new Map(variantes.map((v) => [v.variante_id, v]));
  const sinExistencia = variantes.filter((v) => v.stock === 0);
  const stockBajo = variantes
    .filter((v) => v.stock != null && v.stock > 0 && v.stock <= umbral)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  const sinConteo = variantes.filter((v) => v.stock == null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminNav titulo="Inventario" email={user.email ?? ""} />

      {errorCatalogo && (
        <div className="mb-6 rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm text-ink/80">
          No se pudo leer el catálogo: {errorCatalogo.message}
        </div>
      )}

      {errorCaptura && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{errorCaptura}</p>
        </div>
      )}
      {ok && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-ink/80"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
          <p>Movimiento registrado. El stock ya está actualizado en el catálogo.</p>
        </div>
      )}

      {/* --------------------------------------------------------- Resumen */}
      <section aria-label="Resumen de inventario" className="mb-8 grid gap-3 sm:grid-cols-3">
        <ResumenTile
          titulo="Sin existencia"
          valor={sinExistencia.length}
          detalle="variantes con 0 m"
        />
        <ResumenTile
          titulo={`Stock bajo (≤ ${umbral} m)`}
          valor={stockBajo.length}
          detalle="conviene resurtir"
        />
        <ResumenTile
          titulo="Sin conteo"
          valor={sinConteo.length}
          detalle="stock desconocido: registra un ajuste"
        />
      </section>

      {/* ----------------------------------------------- Capturar movimiento */}
      <section aria-labelledby="capturar" className="mb-10">
        <h2 id="capturar" className="mb-3 font-display text-xl text-ink">
          Registrar movimiento
        </h2>
        {!kardexDisponible ? (
          <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5 text-sm text-ink/80">
            <p className="font-medium text-ink">
              Falta crear la tabla del kardex para capturar movimientos.
            </p>
            <p className="mt-1">
              Corre la sección 10 de{" "}
              <code className="rounded bg-line/60 px-1">catalogo_telas_supabase.sql</code> en el
              editor SQL de Supabase Studio (el archivo es idempotente: puedes correrlo completo).
              Mientras tanto el stock se puede editar desde el catálogo.
            </p>
          </div>
        ) : (
        <form
          action={registrarMovimiento}
          className="grid gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:grid-cols-2"
        >
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink">Variante *</span>
            <select name="variante_id" required defaultValue="" className={inputClase}>
              <option value="" disabled>
                Elige tela · color · SKU…
              </option>
              {variantes.map((v) => (
                <option key={v.variante_id} value={v.variante_id}>
                  {etiquetaVariante(v)}
                  {v.stock != null ? ` (${v.stock} m)` : " (sin conteo)"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Tipo *</span>
            <select name="tipo" required defaultValue="entrada" className={inputClase}>
              {TIPOS_MOVIMIENTO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_MOVIMIENTO[t]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink/50">
              En “ajuste”, la cantidad es el stock TOTAL contado, no la diferencia.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Cantidad (m) *</span>
            <input
              type="number"
              name="cantidad"
              required
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Ej. 12.5"
              className={inputClase}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-ink">Nota</span>
            <input
              type="text"
              name="nota"
              placeholder="Ej. pedido proveedor GDL, venta mostrador, rollo dañado…"
              className={inputClase}
            />
          </label>

          <div className="sm:col-span-2">
            <SubmitButton label="Registrar movimiento" pendingLabel="Registrando…" size="sm" />
          </div>
        </form>
        )}
      </section>

      {/* ---------------------------------------------------- Alertas stock */}
      <section aria-labelledby="alertas" className="mb-10">
        <h2 id="alertas" className="mb-3 flex items-center gap-2 font-display text-xl text-ink">
          <TrendingDown className="h-5 w-5 text-amber" aria-hidden />
          Por resurtir
        </h2>
        {sinExistencia.length + stockBajo.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-sm text-ink/50">
            Nada urgente: ninguna variante contada está en cero ni bajo el umbral de {umbral} m.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {[...sinExistencia, ...stockBajo].map((v) => (
              <li key={v.variante_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={`/admin/tela/${v.tela_id}`}
                  className="min-w-0 truncate text-sm font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                >
                  {etiquetaVariante(v)}
                </Link>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                    v.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber/10 text-amber"
                  }`}
                >
                  {v.stock} m
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------- Historial */}
      <section aria-labelledby="historial">
        <h2 id="historial" className="mb-3 flex items-center gap-2 font-display text-xl text-ink">
          <PackageOpen className="h-5 w-5 text-amber" aria-hidden />
          Últimos movimientos
        </h2>

        {!kardexDisponible ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-sm text-ink/50">
            El historial aparecerá aquí cuando la tabla del kardex exista (ver arriba).
          </p>
        ) : movimientos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-sm text-ink/50">
            Todavía no hay movimientos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink/50">
                  <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-3 font-medium">Variante</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Cantidad</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Quedó</th>
                  <th scope="col" className="px-4 py-3 font-medium">Nota / quién</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {movimientos.map((m) => {
                  const v = porId.get(m.variante_id);
                  return (
                    <tr key={m.id} className="text-ink/80">
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatoFecha.format(new Date(m.created_at))}
                      </td>
                      <td className="px-4 py-3">
                        {v ? etiquetaVariante(v) : "Variante eliminada"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 capitalize">{m.tipo}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{m.cantidad} m</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {m.stock_resultante != null ? `${m.stock_resultante} m` : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {[m.nota, m.usuario_email].filter(Boolean).join(" — ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ResumenTile({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number;
  detalle: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-sm font-medium text-ink/60">{titulo}</p>
      <p className="mt-1 font-display text-3xl text-ink">{valor}</p>
      <p className="mt-1 text-xs text-ink/50">{detalle}</p>
    </div>
  );
}
