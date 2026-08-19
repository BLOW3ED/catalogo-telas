"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import {
  Check,
  Crop,
  Grid3x3,
  ImagePlus,
  RotateCw,
  Trash2,
  TriangleAlert,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  dimensionesMostradas,
  encuadreDeVista,
  girarVista,
  rectDeVista,
  vistaLimitada,
  zoomEnPunto,
  zoomMaximo,
  LADO_COMODO,
  VISTA_INICIAL,
  type Vista,
} from "@/lib/images/encuadre";

/**
 * Curaduría visual de fotos para /admin.
 *
 * Reemplaza el `<input type="file">` a ciegas: al elegir una foto se abre un
 * visor a pantalla completa con el marco EXACTO de la vitrina (la card del
 * catálogo es cuadrada), donde se acerca, se arrastra y se gira hasta que el
 * producto quede como debe verse. Al confirmar NO se sube una imagen recortada
 * por el navegador: se suben los BYTES ORIGINALES más un rectángulo en
 * fracciones, y el corte lo hace sharp en el servidor sobre la foto a
 * resolución completa (`lib/images/aplicar-encuadre.ts`). Así el maestro
 * conserva el color y la textura que este catálogo cuida.
 *
 * El componente vive DENTRO del form del admin y aporta dos campos: el input
 * de archivos de siempre (`fotos`) y un campo oculto con los encuadres
 * (`recortes`), alineado por índice. Si un encuadre falta o llega corrupto, esa
 * foto sube entera: nunca bloquea la subida.
 */

type Foto = {
  id: string;
  archivo: File;
  url: string;
  /** Dimensiones naturales (con EXIF ya aplicado por el navegador). */
  natural: { ancho: number; alto: number } | null;
  vista: Vista;
  /** true = subir tal cual, sin recortar (foto ya horneada por `pnpm preparar`). */
  omitir: boolean;
};

const MB = 1024 * 1024;

const claseBotonSuave =
  "inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-40";
const claseBotonFuerte =
  "inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

/** Medidas de la foto tal como se está viendo (giro manual ya aplicado). */
function medidasDe(foto: Foto) {
  if (!foto.natural) return null;
  return dimensionesMostradas(foto.natural.ancho, foto.natural.alto, foto.vista.giro);
}

/** Lado del maestro que se va a generar, en píxeles del original. */
function ladoMaestro(foto: Foto): number | null {
  const m = medidasDe(foto);
  if (!m) return null;
  return Math.round(rectDeVista(foto.vista, m.ancho, m.alto).lado);
}

export function CuradorFotos({
  nombre = "fotos",
  campoEncuadres = "recortes",
  etiqueta = "Fotos",
  ayuda,
  requerido = false,
  limiteMb = 10,
}: {
  /** `name` del input de archivos (el que lee la server action). */
  nombre?: string;
  /** `name` del campo oculto con los encuadres. */
  campoEncuadres?: string;
  etiqueta?: string;
  ayuda?: string;
  requerido?: boolean;
  /** Tope de `serverActions.bodySizeLimit`; solo para avisar antes de fallar. */
  limiteMb?: number;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  const idAyuda = useId();

  // ------------------------------------------------------------- selección
  /**
   * El `<input type="file">` real se conserva en el DOM y es el que viaja en el
   * FormData: no se re-empaqueta el archivo en ningún momento, así los bytes
   * que llegan al servidor son idénticos a los del disco.
   */
  const sincronizarArchivos = useCallback((lista: Foto[]) => {
    const input = entrada.current;
    if (!input) return;
    const dt = new DataTransfer();
    for (const f of lista) dt.items.add(f.archivo);
    input.files = dt.files;
  }, []);

  function alElegir(archivos: FileList | null) {
    const nuevas: Foto[] = Array.from(archivos ?? []).map((archivo) => ({
      id: `${archivo.name}-${archivo.size}-${archivo.lastModified}-${Math.random()}`,
      archivo,
      url: URL.createObjectURL(archivo),
      natural: null,
      vista: VISTA_INICIAL,
      omitir: false,
    }));
    if (!nuevas.length) return;

    setFotos((previas) => {
      previas.forEach((f) => URL.revokeObjectURL(f.url));
      return nuevas;
    });
    setEditando(0);
  }

  const limpiar = useCallback(() => {
    setFotos((previas) => {
      previas.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
    setEditando(null);
    if (entrada.current) entrada.current.value = "";
  }, []);

  function quitar(indice: number) {
    setFotos((previas) => {
      const resto = previas.filter((_, i) => i !== indice);
      URL.revokeObjectURL(previas[indice].url);
      sincronizarArchivos(resto);
      if (!resto.length && entrada.current) entrada.current.value = "";
      return resto;
    });
    setEditando(null);
  }

  /**
   * El cambio se expresa como FUNCIÓN de la foto vigente, no como un objeto ya
   * calculado. Varios eventos de rueda o de pellizco caen en el mismo lote de
   * React; calculando sobre las props del render, todos parten del mismo estado
   * y el último gana — el acercamiento avanzaba un solo paso por ráfaga, que es
   * justo el gesto normal en trackpad y en tablet.
   */
  function actualizar(indice: number, cambio: (foto: Foto) => Partial<Foto>) {
    setFotos((previas) =>
      previas.map((f, i) => (i === indice ? { ...f, ...cambio(f) } : f))
    );
  }

  // Dimensiones naturales: hacen falta para toda la geometría, y solo se saben
  // cuando el navegador decodifica la imagen.
  useEffect(() => {
    let vigente = true;
    for (const [i, foto] of fotos.entries()) {
      if (foto.natural) continue;
      const img = new Image();
      img.onload = () => {
        if (!vigente) return;
        setFotos((previas) =>
          previas.map((f, j) =>
            j === i && f.id === foto.id
              ? { ...f, natural: { ancho: img.naturalWidth, alto: img.naturalHeight } }
              : f
          )
        );
      };
      img.src = foto.url;
    }
    return () => {
      vigente = false;
    };
  }, [fotos]);

  // Al terminar la subida el form se queda montado (la página revalida sola),
  // así que la tira de miniaturas hay que vaciarla a mano o quedan fantasmas de
  // fotos que ya están arriba.
  const subiendoAntes = useRef(pending);
  useEffect(() => {
    if (subiendoAntes.current && !pending) limpiar();
    subiendoAntes.current = pending;
  }, [pending, limpiar]);

  // Los object URL vivos se llevan en un ref para poder liberarlos AL DESMONTAR
  // sin que el efecto se re-suscriba en cada cambio (que los revocaría en pleno
  // uso y dejaría las miniaturas en blanco).
  const urlsVivas = useRef<string[]>([]);
  urlsVivas.current = fotos.map((f) => f.url);
  useEffect(() => () => urlsVivas.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // --------------------------------------------------------------- salidas
  const encuadres = fotos.map((foto) => {
    const m = medidasDe(foto);
    if (foto.omitir || !m) return null;
    return encuadreDeVista(foto.vista, m.ancho, m.alto);
  });

  const pesoTotal = fotos.reduce((suma, f) => suma + f.archivo.size, 0);
  const excedePeso = pesoTotal > limiteMb * MB;

  return (
    <div className="space-y-3">
      <input type="hidden" name={campoEncuadres} value={JSON.stringify(encuadres)} />

      <div>
        <span className="mb-1 block text-sm font-medium text-ink">{etiqueta}</span>
        <input
          ref={entrada}
          type="file"
          name={nombre}
          accept="image/jpeg,image/png,image/webp"
          multiple
          required={requerido && fotos.length === 0}
          onChange={(e) => alElegir(e.target.files)}
          className="sr-only"
          aria-describedby={idAyuda}
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          className={claseBotonSuave}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          {fotos.length ? "Elegir otras fotos" : "Elegir fotos"}
        </button>
        <span id={idAyuda} className="mt-1 block text-xs text-ink/50">
          {ayuda ??
            "JPG, PNG o WebP. Al elegirlas se abre el encuadre: acercas, mueves y confirmas cómo se verá en el catálogo."}
        </span>
      </div>

      {excedePeso && (
        <p className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-ink">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
          <span>
            Las {fotos.length} fotos suman {(pesoTotal / MB).toFixed(1)} MB y el máximo por
            envío es {limiteMb} MB. Súbelas en dos tandas o la subida va a fallar.
          </span>
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto, i) => (
            <li key={foto.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setEditando(i)}
                className="group relative block w-full overflow-hidden rounded-xl border border-line bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                aria-label={`Encuadrar ${foto.archivo.name}`}
              >
                <Vitrina foto={foto} />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-ink/70 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Crop className="h-3.5 w-3.5" aria-hidden /> Encuadrar
                </span>
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-lg bg-amber px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Portada
                  </span>
                )}
              </button>
              <div className="flex items-center justify-between gap-1">
                <EstadoFoto foto={foto} />
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="rounded-lg p-1 text-ink/50 transition-colors hover:bg-line/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                  aria-label={`Quitar ${foto.archivo.name}`}
                  title="Quitar de esta subida"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando !== null && fotos[editando] && (
        <Editor
          foto={fotos[editando]}
          indice={editando}
          total={fotos.length}
          onCambio={(cambio) => actualizar(editando, cambio)}
          onIr={(i) => setEditando(i)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/** Resolución del maestro + aviso cuando el acercamiento se pasó de la raya. */
function EstadoFoto({ foto }: { foto: Foto }) {
  if (foto.omitir) {
    return <span className="truncate text-[11px] text-ink/50">Sin recortar</span>;
  }
  const lado = ladoMaestro(foto);
  if (lado === null) {
    return <span className="truncate text-[11px] text-ink/40">Leyendo…</span>;
  }
  const corta = lado < LADO_COMODO;
  return (
    <span
      className={`truncate text-[11px] ${corta ? "font-medium text-amber" : "text-ink/50"}`}
      title={
        corta
          ? `El maestro quedaría en ${lado} px; la ficha de producto usa 1600 px. Aleja un poco para no perder nitidez.`
          : undefined
      }
    >
      {corta && "⚠ "}
      {lado} × {lado} px
    </span>
  );
}

/**
 * La foto pintada dentro de un marco cuadrado, según la vista.
 *
 * Todo va en PORCENTAJES del lado del marco, no en píxeles: así el mismo
 * cálculo sirve para el visor grande y para la miniatura de vitrina sin medir
 * el contenedor ni escuchar resizes. El contenedor tiene que ser cuadrado y
 * `relative overflow-hidden`.
 */
function Lienzo({ foto }: { foto: Foto }) {
  const m = medidasDe(foto);
  if (!m || !foto.natural) return null;

  const { left, top, lado } = rectDeVista(foto.vista, m.ancho, m.alto);
  const pct = (v: number) => `${(v / lado) * 100}%`;

  return (
    <div
      className="absolute"
      style={{ width: pct(m.ancho), height: pct(m.alto), left: pct(-left), top: pct(-top) }}
    >
      {/* La imagen gira sobre su propio centro dentro de la caja "ya girada":
          un rectángulo W×H rotado un cuarto de vuelta ocupa H×W con el mismo
          centro, así que basta con centrarla y rotarla. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- blob local del archivo elegido: no pasa por el optimizador */}
      <img
        src={foto.url}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${(foto.natural.ancho / m.ancho) * 100}%`,
          height: `${(foto.natural.alto / m.alto) * 100}%`,
          // El preflight de Tailwind pone `img { max-width: 100% }`, que topa la
          // imagen al ancho de su caja. Con la foto girada un cuarto de vuelta
          // el ancho pedido pasa de 100% (150% en una 3:2) y el tope la
          // aplastaba: el producto salía ovalado en el visor y en la vitrina,
          // pero el recorte del servidor era correcto — o sea, una mentira
          // visual justo en la pantalla que existe para no mentir.
          maxWidth: "none",
          maxHeight: "none",
          transform: `translate(-50%, -50%) rotate(${foto.vista.giro}deg)`,
        }}
      />
    </div>
  );
}

/** Miniatura con el aspecto real de la card del catálogo. */
function Vitrina({ foto }: { foto: Foto }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-surface-container-low">
      <Lienzo foto={foto} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visor a pantalla completa
// ---------------------------------------------------------------------------

const PASO_TECLADO = 0.02; // fracción de la ventana por pulsación de flecha
const FACTOR_TECLADO = 1.15;

function Editor({
  foto,
  indice,
  total,
  onCambio,
  onIr,
  onCerrar,
}: {
  foto: Foto;
  indice: number;
  total: number;
  onCambio: (cambio: (foto: Foto) => Partial<Foto>) => void;
  onIr: (indice: number) => void;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [grilla, setGrilla] = useState(true);
  const marco = useRef<HTMLDivElement>(null);
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const distanciaPrevia = useRef<number | null>(null);

  useEffect(() => setMontado(true), []);

  // Bloquear el scroll de fondo: en tablet, arrastrar dentro del marco no debe
  // arrastrar la página del admin.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  useEffect(() => {
    marco.current?.focus();
  }, [indice]);

  const m = medidasDe(foto);

  /**
   * Única puerta de entrada a la vista: recibe cómo calcularla a partir de la
   * foto VIGENTE y de sus medidas, nunca de las de este render. Encuadrar es
   * una ráfaga de eventos pequeños y todos tienen que componerse.
   */
  const cambiarVista = useCallback(
    (calcular: (foto: Foto, medidas: { ancho: number; alto: number }) => Vista) => {
      onCambio((actual) => {
        const med = medidasDe(actual);
        return med ? { vista: calcular(actual, med), omitir: false } : {};
      });
    },
    [onCambio]
  );

  const acercar = useCallback(
    (factor: number, fx = 0.5, fy = 0.5) =>
      cambiarVista((f, med) => zoomEnPunto(f.vista, med.ancho, med.alto, fx, fy, factor)),
    [cambiarVista]
  );

  /** Desplaza la ventana `dx`/`dy` píxeles de PANTALLA. */
  const desplazar = useCallback(
    (dx: number, dy: number, anchoMarco: number) =>
      cambiarVista((f, med) => {
        const { lado } = rectDeVista(f.vista, med.ancho, med.alto);
        const escala = lado / anchoMarco;
        return vistaLimitada(
          {
            ...f.vista,
            cx: f.vista.cx - (dx * escala) / med.ancho,
            cy: f.vista.cy - (dy * escala) / med.alto,
          },
          med.ancho,
          med.alto
        );
      }),
    [cambiarVista]
  );

  function fraccionEnMarco(clienteX: number, clienteY: number) {
    const caja = marco.current?.getBoundingClientRect();
    if (!caja || !caja.width) return { fx: 0.5, fy: 0.5 };
    return {
      fx: (clienteX - caja.left) / caja.width,
      fy: (clienteY - caja.top) / caja.height,
    };
  }

  // ------------------------------------------------------------- punteros
  function alBajarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    // Capturar el puntero mantiene vivo el arrastre aunque el dedo salga del
    // marco. Va en try porque lanza NotFoundError si el puntero ya se soltó
    // (una pulsación muy corta alcanza a colar el pointerup antes), y perder la
    // captura no debe costar el arrastre entero.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 2) distanciaPrevia.current = distanciaEntrePunteros();
  }

  function distanciaEntrePunteros(): number | null {
    const [a, b] = Array.from(punteros.current.values());
    if (!a || !b) return null;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function alMoverPuntero(e: React.PointerEvent<HTMLDivElement>) {
    const previo = punteros.current.get(e.pointerId);
    if (!previo) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size >= 2) {
      // Pellizco: la razón entre distancias ES el factor de zoom, y el ancla es
      // el punto medio entre los dedos.
      const distancia = distanciaEntrePunteros();
      const anterior = distanciaPrevia.current;
      distanciaPrevia.current = distancia;
      if (!distancia || !anterior) return;
      const puntos = Array.from(punteros.current.values());
      const { fx, fy } = fraccionEnMarco(
        (puntos[0].x + puntos[1].x) / 2,
        (puntos[0].y + puntos[1].y) / 2
      );
      acercar(distancia / anterior, fx, fy);
      return;
    }

    // Arrastre: el desplazamiento del dedo en px de pantalla se traduce a px de
    // la imagen con la escala vigente, y la ventana se mueve al revés que la
    // foto (arrastrar la foto a la derecha descubre lo que hay a la izquierda).
    const caja = marco.current?.getBoundingClientRect();
    if (!caja?.width) return;
    desplazar(e.clientX - previo.x, e.clientY - previo.y, caja.width);
  }

  function alSoltarPuntero(e: React.PointerEvent<HTMLDivElement>) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) distanciaPrevia.current = null;
  }

  function alRodar(e: React.WheelEvent<HTMLDivElement>) {
    const { fx, fy } = fraccionEnMarco(e.clientX, e.clientY);
    // deltaY negativo = rueda hacia adelante = acercar.
    acercar(Math.exp(-e.deltaY * 0.0015), fx, fy);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>) {
    const anchoMarco = marco.current?.getBoundingClientRect().width ?? 0;
    // Una flecha mueve PASO_TECLADO de la ventana: en px de pantalla eso es esa
    // misma fracción del marco, sin importar el acercamiento.
    const mover = (dx: number, dy: number) =>
      desplazar(-dx * anchoMarco * PASO_TECLADO, -dy * anchoMarco * PASO_TECLADO, anchoMarco);

    switch (e.key) {
      case "ArrowLeft": mover(-1, 0); break;
      case "ArrowRight": mover(1, 0); break;
      case "ArrowUp": mover(0, -1); break;
      case "ArrowDown": mover(0, 1); break;
      case "+": case "=": acercar(FACTOR_TECLADO); break;
      case "-": case "_": acercar(1 / FACTOR_TECLADO); break;
      case "r": case "R": girar(); break;
      default: return;
    }
    e.preventDefault();
  }

  function girar() {
    cambiarVista((f, med) => girarVista(f.vista, med.ancho, med.alto));
  }

  function centrar() {
    cambiarVista((f) => ({ ...VISTA_INICIAL, giro: f.vista.giro }));
  }

  const ultima = indice === total - 1;
  const lado = ladoMaestro(foto);
  const corta = lado !== null && lado < LADO_COMODO;
  const zoomTope = m ? zoomMaximo(m.ancho, m.alto) : 1;

  const contenido = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Encuadrar foto ${indice + 1} de ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-ink/85 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onCerrar(); }
      }}
    >
      {/* ------------------------------------------------------ encabezado */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Encuadre {indice + 1} de {total}
          </p>
          <p className="truncate text-xs text-white/60">{foto.archivo.name}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Cerrar el encuadre"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* ----------------------------------------------- lienzo + vitrina */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8 sm:px-6">
        <div className="w-full max-w-[min(70vh,32rem)] shrink-0">
          <div
            ref={marco}
            tabIndex={0}
            role="application"
            aria-label="Área de encuadre: arrastra para mover, rueda o pellizca para acercar, R para girar"
            onPointerDown={alBajarPuntero}
            onPointerMove={alMoverPuntero}
            onPointerUp={alSoltarPuntero}
            onPointerCancel={alSoltarPuntero}
            onWheel={alRodar}
            onKeyDown={alTeclear}
            className="relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber active:cursor-grabbing"
          >
            <Lienzo foto={foto} />
            {grilla && <Grilla />}
          </div>
          <p className="mt-2 text-center text-xs text-white/50">
            Arrastra para mover · rueda o pellizca para acercar · flechas y +/− desde el teclado
          </p>
        </div>

        {/* Espejo de vitrina: la card del catálogo, en chiquito y en vivo. */}
        <aside className="flex w-full max-w-xs shrink-0 flex-col items-center gap-2 sm:w-44">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Así se verá
          </p>
          <div className="w-32 overflow-hidden rounded-xl bg-surface-container-lowest p-2 shadow-lg sm:w-full">
            <div className="overflow-hidden rounded-lg">
              <Vitrina foto={foto} />
            </div>
            <p className="mt-2 truncate text-[11px] font-medium text-ink">
              {foto.archivo.name.replace(/\.[^.]+$/, "")}
            </p>
          </div>
          <p className={`text-center text-[11px] ${corta ? "text-amber" : "text-white/50"}`}>
            {lado === null ? "Leyendo la foto…" : `Maestro ${lado} × ${lado} px`}
          </p>
          {corta && (
            <p className="text-center text-[11px] leading-snug text-amber">
              Por debajo de {LADO_COMODO} px la ficha de producto pierde nitidez.
            </p>
          )}
        </aside>
      </div>

      {/* ------------------------------------------------------ controles */}
      <div className="border-t border-white/10 bg-ink/60 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => acercar(1 / FACTOR_TECLADO)}
              className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Alejar"
            >
              <ZoomOut className="h-5 w-5" aria-hidden />
            </button>
            <input
              type="range"
              min={1}
              max={Math.max(1.01, zoomTope)}
              step={0.01}
              value={foto.vista.zoom}
              onChange={(e) => {
                const zoom = Number(e.target.value);
                cambiarVista((f, med) =>
                  vistaLimitada({ ...f.vista, zoom }, med.ancho, med.alto)
                );
              }}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Acercamiento"
            />
            <button
              type="button"
              onClick={() => acercar(FACTOR_TECLADO)}
              className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Acercar"
            >
              <ZoomIn className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BotonVisor onClick={girar} icono={<RotateCw className="h-4 w-4" aria-hidden />}>
                Girar 90°
              </BotonVisor>
              <BotonVisor
                onClick={() => setGrilla((g) => !g)}
                icono={<Grid3x3 className="h-4 w-4" aria-hidden />}
                activo={grilla}
              >
                Guías
              </BotonVisor>
              <BotonVisor onClick={centrar}>Centrar</BotonVisor>
              <BotonVisor
                onClick={() => onCambio((f) => ({ omitir: !f.omitir }))}
                activo={foto.omitir}
              >
                {foto.omitir ? "Se subirá sin recortar" : "Subir sin recortar"}
              </BotonVisor>
            </div>

            <div className="flex items-center gap-2">
              {indice > 0 && (
                <button type="button" onClick={() => onIr(indice - 1)} className={claseBotonSuave}>
                  Anterior
                </button>
              )}
              <button
                type="button"
                onClick={() => (ultima ? onCerrar() : onIr(indice + 1))}
                className={claseBotonFuerte}
              >
                <Check className="h-4 w-4" aria-hidden />
                {ultima ? "Listo" : "Siguiente foto"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Portal a <body>: el curador vive dentro de un <form> con server action y un
  // modal ahí adentro hereda su contexto de apilamiento (y el riesgo de que un
  // botón dispare la subida). Fuera del form, ninguna de las dos cosas pasa.
  return montado ? createPortal(contenido, document.body) : null;
}

function BotonVisor({
  children,
  onClick,
  icono,
  activo = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icono?: React.ReactNode;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        activo
          ? "bg-amber text-white hover:bg-amber-soft"
          : "bg-white/10 text-white/85 hover:bg-white/20"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}

/** Regla de tercios: nivelar una tira o centrar una flor sin ojo de tipógrafo. */
function Grilla() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
    </div>
  );
}
