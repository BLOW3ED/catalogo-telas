import type { CatalogoTela, DerivadosFoto } from "@/lib/types";

/**
 * Una fila de la tabla `foto`. NO viene de la vista `catalogo_telas`: la vista
 * colapsa las N fotos de una variante en un solo `foto_principal` (la de menor
 * orden), así que las demás solo se pueden leer de la tabla.
 */
export type FotoVariante = {
  id: string;
  variante_id: string;
  ruta: string;
  orden: number;
  alt: string | null;
  /** Opcional: la columna solo existe tras la sección 12 del SQL. */
  derivados?: DerivadosFoto | null;
};

/**
 * Cuántas fotos tiene cada variante, indexado por `variante_id`.
 *
 * Existe porque la vista NO lo puede decir: colapsa las N fotos en
 * `foto_principal`, así que en el admin una variante con una foto y otra con
 * ocho se ven idénticas. Se resuelve con una lectura extra a `foto` —
 * proyectando solo `variante_id`, que es lo único que se necesita para contar—
 * y agrupando aquí en vez de en Postgres: PostgREST no expone `group by`, y
 * pedir el conteo variante por variante serían cientos de peticiones.
 *
 * Una variante ausente del mapa tiene CERO fotos, que en un catálogo es un
 * problema visible (producto invisible), no un detalle: por eso el admin lo
 * pinta distinto en vez de omitirlo.
 */
export function contarFotosPorVariante(
  fotos: { variante_id: string }[]
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const { variante_id } of fotos) {
    conteo.set(variante_id, (conteo.get(variante_id) ?? 0) + 1);
  }
  return conteo;
}

/** Una foto del carrusel, ya resuelta a la variante (color) a la que pertenece. */
export type SlideFoto = {
  /** id de la foto: key estable aunque dos variantes compartan color. */
  id: string;
  ruta: string;
  derivados: DerivadosFoto | null;
  /** Alt capturado en /admin; si es null el componente compone uno. */
  alt: string | null;
  /**
   * Valor de `?color=` al que pertenece este slide. `null` cuando la tela no
   * se navega por color (una sola variante direccionable): deslizar entonces
   * solo cambia de foto y NO toca la URL.
   */
  colorSlug: string | null;
  colorNombre: string | null;
};

/**
 * Aplana las fotos de una tela en la lista de slides del carrusel.
 *
 * INVARIANTE: la foto en pantalla siempre pertenece a la variante cuyo
 * precio/SKU/stock está mostrando la ficha. Como la única dirección que tiene
 * la página es `?color=`, un slide solo es seguro si su variante es
 * DIRECCIONABLE — de ahí las dos ramas:
 *
 *  - ≥2 colores con foto → el carrusel recorre esos colores completos (todas
 *    las fotos de cada uno). Al cruzar de color, el componente reescribe
 *    `?color=` y el server re-renderiza precio/SKU, igual que un click en el
 *    swatch. Se deduplica por `color_slug` porque dos SKUs pueden compartir
 *    color y `?color=` resolvería siempre al primero (el carrusel rebotaría).
 *  - si no → todas las fotos de la variante SELECCIONADA, sin tocar la URL.
 *
 * Una variante sin fotos no aporta slides. Si la seleccionada no tiene ninguna
 * pero una hermana sí, se cae a esa: mostrar la foto que existe es mejor que
 * el marcador gris (pasa cuando quedó una variante vacía capturada de más).
 */
export function construirSlides({
  variantes,
  fotos,
  seleccionada,
}: {
  variantes: CatalogoTela[];
  fotos: FotoVariante[];
  seleccionada: CatalogoTela | undefined;
}): SlideFoto[] {
  const porVariante = new Map<string, FotoVariante[]>();
  for (const f of fotos) {
    const lista = porVariante.get(f.variante_id) ?? [];
    lista.push(f);
    porVariante.set(f.variante_id, lista);
  }
  // `orden` es el que se arrastra en /admin; `id` solo desempata para que el
  // resultado no dependa del orden en que llegó la respuesta.
  for (const lista of porVariante.values()) {
    lista.sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
  }

  const conFotos = variantes.filter((v) => porVariante.has(v.variante_id));
  if (conFotos.length === 0) return [];

  const direcciones = new Set(
    conFotos.map((v) => v.color_slug).filter((s): s is string => Boolean(s))
  );

  let elegidas: CatalogoTela[];
  if (direcciones.size >= 2) {
    // Solo variantes con color: una sin `color_slug` no se puede seleccionar
    // por URL, así que su foto quedaría mostrando el precio de otra.
    //
    // Se queda la PRIMERA de cada color, no la última: la página resuelve
    // `?color=` con `variantes.find(...)`, así que quedarse con otra pintaría
    // la foto de una variante distinta a la del precio/SKU de la ficha.
    const vistos = new Set<string>();
    elegidas = conFotos.filter((v) => {
      if (!v.color_slug || vistos.has(v.color_slug)) return false;
      vistos.add(v.color_slug);
      return true;
    });
  } else {
    const propia =
      seleccionada && porVariante.has(seleccionada.variante_id)
        ? seleccionada
        : conFotos[0];
    elegidas = [propia];
  }

  // `colorSlug` solo se propaga cuando hay navegación por color: con una sola
  // variante direccionable, deslizar no debe reescribir la URL.
  const navegaPorColor = direcciones.size >= 2;

  return elegidas.flatMap((v) =>
    (porVariante.get(v.variante_id) ?? []).map((f) => ({
      id: f.id,
      ruta: f.ruta,
      derivados: f.derivados ?? null,
      alt: f.alt,
      colorSlug: navegaPorColor ? v.color_slug : null,
      colorNombre: v.color_nombre,
    }))
  );
}
