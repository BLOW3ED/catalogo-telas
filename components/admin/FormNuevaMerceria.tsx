"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { crearMerceria } from "@/app/admin/actions";
import { categoriaDeCodigo, unidadDeCategoria } from "@/lib/ingesta/categorias";
import { UNIDADES_VENTA, unidadDe } from "@/lib/unidades";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CuradorFotos } from "@/components/admin/CuradorFotos";

type Opcion = { id: string; nombre: string };
type OpcionCategoria = Opcion & { slug: string };

const inputClase =
  "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber";
const etiquetaClase = "mb-1 block text-sm font-medium text-ink";
const ayudaClase = "mt-1 block text-xs text-ink/50";

/**
 * Alta de mercería en una sola pantalla.
 *
 * Es cliente por una sola razón: el CÓDIGO de la etiqueta manda. Su prefijo
 * dice qué es el producto ("BNK…" es una tira, "BO…" un botón) y eso decide la
 * categoría y, con ella, la unidad de venta. Resolverlo mientras se escribe
 * ahorra las dos decisiones que más se equivocan cuando se capturan cien
 * bolsitas seguidas — y usa `categoriaDeCodigo`, las MISMAS reglas de
 * `pnpm clasificar`, verificadas foto por foto.
 *
 * La sugerencia nunca pisa lo que la tienda ya eligió a mano, igual que la
 * fusión de la ingesta: lo capturado a mano gana.
 */
export function FormNuevaMerceria({
  categorias,
  colores,
}: {
  categorias: OpcionCategoria[];
  colores: Opcion[];
}) {
  const [codigo, setCodigo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  // La BD default'ea a `metro` (era todo tela); aquí no: un avío casi siempre
  // se vende por pieza y la tela ya tiene su propia alta.
  const [unidad, setUnidad] = useState("pieza");
  const [manual, setManual] = useState({ categoria: false, unidad: false });

  const detectada = categoriaDeCodigo(codigo);
  const unidadActual = unidadDe(unidad);

  function sugerirUnidad(slug: string | undefined) {
    if (manual.unidad || !slug) return;
    const sugerida = unidadDeCategoria(slug);
    if (sugerida) setUnidad(sugerida);
  }

  function alEscribirCodigo(valor: string) {
    setCodigo(valor);
    // La autoridad del código va en cadena: código → categoría → unidad. Si la
    // categoría ya se eligió a mano, el código deja de opinar sobre LAS DOS.
    // Si no, pasaba esto: la tienda corregía la categoría a "Botones", tecleaba
    // una letra más del código y la unidad se regresaba sola a "bolsa".
    if (manual.categoria) return;

    const cat = categoriaDeCodigo(valor);
    if (!cat) return;
    const fila = categorias.find((c) => c.slug === cat.slug);
    if (fila) setCategoriaId(fila.id);
    sugerirUnidad(cat.slug);
  }

  function alElegirCategoria(id: string) {
    setCategoriaId(id);
    setManual((m) => ({ ...m, categoria: true }));
    sugerirUnidad(categorias.find((c) => c.id === id)?.slug);
  }

  return (
    <form
      action={crearMerceria}
      className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm"
    >
      {/* ------------------------------------------------ Código de etiqueta */}
      <label className="block">
        <span className={etiquetaClase}>Código de la etiqueta *</span>
        <input
          type="text"
          name="codigo"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          value={codigo}
          onChange={(e) => alEscribirCodigo(e.target.value)}
          placeholder="Ej. BNK1041, BO12, HE020"
          className={inputClase}
        />
        {detectada ? (
          <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Reconocido: {detectada.nombre}
          </span>
        ) : (
          <span className={ayudaClase}>
            Tal cual viene escrito en la bolsita. Se guarda como SKU y sirve para
            proponer la categoría.
          </span>
        )}
      </label>

      {/* -------------------------------------------------------------- Nombre */}
      <label className="block">
        <span className={etiquetaClase}>Nombre</span>
        <input
          type="text"
          name="nombre"
          placeholder={codigo ? `Si lo dejas vacío: “${codigo}”` : "Si lo dejas vacío se usa el código"}
          className={inputClase}
        />
        <span className={ayudaClase}>
          Como lo busca la clienta (“Flor de organza”). La URL pública se genera
          de aquí.
        </span>
      </label>

      {/* ----------------------------------------------- Categoría y unidad */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiquetaClase}>Categoría</span>
          <select
            name="categoria_id"
            value={categoriaId}
            onChange={(e) => alElegirCategoria(e.target.value)}
            className={inputClase}
          >
            <option value="">— Sin categoría —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {detectada && !categorias.some((c) => c.slug === detectada.slug) && (
            <span className="mt-1 block text-xs text-amber">
              “{detectada.nombre}” aún no existe como categoría en la base.
            </span>
          )}
        </label>

        <label className="block">
          <span className={etiquetaClase}>Unidad de venta</span>
          <select
            name="unidad_venta"
            value={unidad}
            onChange={(e) => {
              setUnidad(e.target.value);
              setManual((m) => ({ ...m, unidad: true }));
            }}
            className={inputClase}
          >
            {UNIDADES_VENTA.map((u) => (
              <option key={u} value={u}>
                {unidadDe(u).singular}
              </option>
            ))}
          </select>
          <span className={ayudaClase}>Cómo se cobra y cómo se cuenta.</span>
        </label>
      </div>

      {/* Solo en unidades empaquetadas (bolsa, rollo, juego): "piezas por
          pieza" no significa nada y el metro no empaqueta. */}
      {unidadActual.empacada && (
        <label className="block">
          <span className={etiquetaClase}>Piezas por {unidadActual.singular}</span>
          <input
            type="number"
            name="piezas_por_unidad"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="Ej. 25"
            className={inputClase}
          />
          <span className={ayudaClase}>
            Déjalo vacío si se vende suelto. Sirve para que la cotización diga
            “2 {unidadActual.plural} (25 pz c/u)”.
          </span>
        </label>
      )}

      {/* ------------------------------------------------------ Precio y stock */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiquetaClase}>
            Precio <span className="text-ink/50">{unidadActual.sufijoPrecio}</span>
          </span>
          <input
            type="number"
            name="precio"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="a consultar"
            className={inputClase}
          />
          <span className={ayudaClase}>Vacío = “a consultar” (no es lo mismo que 0).</span>
        </label>

        <label className="block">
          <span className={etiquetaClase}>
            Stock <span className="text-ink/50">({unidadActual.abreviatura})</span>
          </span>
          <input
            type="number"
            name="stock"
            min="0"
            step={unidadActual.paso}
            inputMode="decimal"
            placeholder="—"
            className={inputClase}
          />
        </label>
      </div>

      {/* --------------------------------------------------------------- Color */}
      <label className="block">
        <span className={etiquetaClase}>Color</span>
        <select name="color_id" defaultValue="" className={inputClase}>
          <option value="">— Sin color —</option>
          {colores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <span className={ayudaClase}>
          Si el mismo producto viene en varios colores, agrega los demás en el
          editor: cada color es una variante con su propio precio y existencia.
        </span>
      </label>

      {/* --------------------------------------------------------------- Fotos */}
      <CuradorFotos
        etiqueta="Fotos"
        ayuda="JPG, PNG o WebP. Al elegirlas se abre el encuadre; la primera es la portada y las versiones optimizadas se generan solas."
      />

      <SubmitButton label="Crear producto" pendingLabel="Creando…" />
    </form>
  );
}
