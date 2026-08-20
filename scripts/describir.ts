#!/usr/bin/env tsx
/**
 * Descripciones por familia — Telas La Jalisciense
 * ===========================================================================
 * 175 de 180 fichas no tenían descripción. Las 5 que sí la tenían están muy
 * bien escritas —prosa sensorial, mirando la tela— y son el molde de voz:
 * concretas, sin promesas que la foto no sostenga, dos párrafos cortos.
 *
 * Escribir 175 así, una por una, exigiría saber de cada pieza cosas que la
 * base NO sabe: gramaje, composición, aleación. Inventarlas sería peor que
 * dejar el campo vacío, porque una descripción falsa se cobra en devoluciones.
 *
 * Entonces: una BASE por familia (lo que sí es cierto de todo el tipo de
 * producto) más una línea armada con los DATOS REALES de esa ficha — cuántos
 * colores tiene, si se corta a la medida, su ancho, cuántas piezas trae la
 * bolsa. Nada de esa línea se inventa: sale de `variante` y del nombre.
 *
 * Las familias grandes llevan varias bases y se reparten de forma ESTABLE
 * (por el slug), para que 42 tiras de pedrería no digan las 42 lo mismo y
 * para que dos corridas den siempre el mismo texto.
 *
 *   pnpm describir              → SIMULACRO
 *   pnpm describir --aplicar    → escribe
 *   pnpm describir --forzar     → también reescribe las que ya tienen texto
 *
 * Por default NO pisa una descripción existente: las 5 que hay las escribió
 * una persona y valen más que cualquier plantilla.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");
const FORZAR = process.argv.includes("--forzar");

/** Varias bases por familia; se reparten por slug para no repetir en bloque. */
const BASES: Record<string, string[]> = {
  "Tira de pedrería": [
    "Tira de pedrería montada sobre una base flexible, lista para coserse de corrido. Las piedras van fijas y alineadas, así que la tira mantiene el dibujo al curvarla sobre un escote o una cintura.\n\nCon luz directa devuelve destellos puntuales; de lejos se lee como una línea continua de brillo. Se corta a la medida, de modo que el remate cae justo donde termina la costura.",
    "Tira de pedrería de paso regular, pensada para recorrer una orilla completa sin interrupciones.\n\nEl brillo cambia con el ángulo: de frente se ve parejo y en movimiento se enciende por tramos. Al ir sobre cinta se cose por el centro o por la orilla, según se quiera que asiente.",
    "Tira de pedrería con las piedras engarzadas una junto a otra sobre una banda que cede al curvarse.\n\nSirve para marcar una línea —talle, hombro, puño— donde se busca que la vista siga el recorrido. Se corta a la medida y no necesita dobladillo.",
  ],
  "Piedra suelta": [
    "Piedras sueltas para aplicar una por una, decidiendo la densidad: sembradas para un brillo discreto o juntas para cubrir una zona entera.\n\nEl reverso es plano, así que asientan bien al pegarlas o coserlas sobre la tela. Vienen en bolsa, que es como se surten para trabajar por tandas.",
    "Piedra a granel, para bordar o pegar donde haga falta. Al no venir montada, el dibujo lo decide quien la aplica.\n\nEl frente es facetado y devuelve luz desde varios ángulos; el reverso plano hace que no se levante sobre la tela. Se surte en bolsa.",
    "Piedras sueltas de un mismo tono, para componer un degradado o rellenar un motivo ya trazado.\n\nSe aplican de una en una, lo que permite ajustar la densidad conforme avanza el trabajo. Vienen en bolsa para ir tomando de ahí sin desperdiciar.",
  ],
  "Tul Bordado": [
    "Tira de tul con bordado en relieve sobre la malla. El hilo dibuja el motivo y le da cuerpo sin quitarle ligereza al fondo.\n\nConserva la transparencia del tul, así que a contraluz el bordado flota sobre el aire. Se corta a la medida y la orilla del motivo sirve de remate.",
    "Tul de malla fina con el motivo bordado encima, de modo que el dibujo se sostiene solo y el fondo casi desaparece.\n\nEs ligero y flexible: acompaña la caída de la prenda en vez de endurecerla. Al trasluz se ve el calado entre hilo e hilo.",
  ],
  "Aplicación de pedrería": [
    "Aplicación de una sola pieza, para colocarse donde se quiere que la vista se detenga: un hombro, un escote, la cintura.\n\nTrae el motivo ya armado y montado, así que se cose o se fija completo, sin componer el dibujo piedra por piedra.",
    "Aplicación con el motivo terminado, lista para asentarse sobre la tela y coserse por la orilla.\n\nFunciona como pieza única: una sola basta para dar el punto de brillo, y repetida arma una simetría a los dos lados.",
  ],
  Flores: [
    "Flor de tela armada por capas, con cuerpo suficiente para sostener la forma y quedarse abierta.\n\nSe aplica de una pieza sobre el talle, el hombro o un tocado; varias juntas arman un racimo sin aplastarse entre sí.",
  ],
  "Flores metro": [
    "Galón de flores unidas sobre una cinta continua, listo para coserse de corrido.\n\nVan montadas a distancia pareja, así que la tira se puede curvar sobre un escote o un ruedo sin que el ritmo del dibujo se pierda.",
  ],
  Botones: [
    "Botón para cerrar o para adornar, según dónde se ponga. El frente lleva el acabado a la vista y el reverso el sistema de sujeción.\n\nAl ser pieza suelta se calcula justo lo que lleva la prenda, y permite repetir el mismo botón en puño y delantero.",
  ],
  "Cintillo de pedrería": [
    "Cintillo con las piedras montadas sobre un cuerpo que conserva su curva.\n\nFunciona como pieza central: se coloca uno solo, en el punto donde se quiere concentrar el brillo, y el resto de la prenda lo acompaña.",
  ],
  Guipiur: [
    "Guipiur con el motivo tejido de corrido y las orillas ya rematadas, así que no necesita dobladillo.\n\nTiene cuerpo propio: apoyado sobre la tela dibuja su relieve, y a contraluz deja ver el calado. Se corta a la medida.",
  ],
  Copas: [
    "Copa preformada para dar estructura al busto sin varillas ni costuras a la vista.\n\nSe surte en par, que es como se usa. Va entre la tela y el forro, y la forma la sostiene la copa, no la costura.",
  ],
  Hilos: [
    "Hilo de costura en carrete, para máquina o para mano.\n\nEl color se elige a tono con la tela: en costura vista el hilo es parte del acabado, y en costura oculta lo que importa es que el cambio de tono no se note.",
  ],
  Corchetes: [
    "Corchete de gancho para cerrar donde no se quiere ver el cierre: canesú, pretina, remate de espalda.\n\nCierra plano y queda escondido bajo la tela, así que el acabado se ve limpio por fuera.",
  ],
  Cierres: [
    "Cierre para montar en costado, espalda o pretina.\n\nEl deslizador corre parejo sobre los dientes; puesto sobre una costura recta queda alineado y no jala la tela.",
  ],
  Cinta: [
    "Cinta para rematar orillas, dar cuerpo o sujetar sin abultar.\n\nSe corta a la medida y se cose de corrido; la orilla ya viene terminada, así que no necesita dobladillo.",
  ],
  "Fleco de pedrería": [
    "Fleco de pedrería colgante, cosido sobre una cinta continua.\n\nEl movimiento es la gracia: al caminar los hilos se separan y devuelven luz desde distintos ángulos. Se corta a la medida y se cose por la cinta de arriba.",
  ],
  Hebilla: [
    "Hebilla decorativa con la pedrería montada sobre el armazón.\n\nVa en cinturón, en el talle o como broche; el frente es lo que se ve y el reverso trae el paso para la cinta.",
  ],
};

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Reparto estable: el mismo slug elige siempre la misma base. */
function elegir(bases: string[], slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return bases[h % bases.length];
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("✖ Faltan llaves en .env.local"); process.exit(1); }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [telasR, varsR] = await Promise.all([
    supabase.from("tela").select("id, slug, nombre, descripcion, categoria(nombre)"),
    supabase.from("variante").select("tela_id, color_id, unidad_venta, piezas_por_unidad"),
  ]);
  for (const r of [telasR, varsR]) {
    if (r.error) { console.error("✖ leyendo BD:", r.error.message); process.exit(1); }
  }
  type T = { id: string; slug: string; nombre: string; descripcion: string | null; categoria: { nombre: string } | null };
  const telas = (telasR.data ?? []) as unknown as T[];
  const variantes = varsR.data ?? [];

  const porTela = new Map<string, typeof variantes>();
  for (const v of variantes) {
    if (!porTela.has(v.tela_id)) porTela.set(v.tela_id, []);
    porTela.get(v.tela_id)!.push(v);
  }

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · ${telas.length} fichas\n`);

  const porFamilia = new Map<string, number>();
  const sinBase: string[] = [];
  const muestras: string[] = [];
  const vistas = new Set<string>();
  let escritas = 0, respetadas = 0, sinVariante = 0;

  for (const t of telas) {
    if (t.descripcion?.trim() && !FORZAR) { respetadas++; continue; }
    const V = porTela.get(t.id) ?? [];
    if (!V.length) { sinVariante++; continue; }

    const categoria = t.categoria?.nombre ?? "";
    const unidad = V[0].unidad_venta;
    // Flores se vende por pieza (aplicación) y por metro (galón): son textos
    // distintos porque son productos distintos, aunque compartan categoría.
    const clave = categoria === "Flores" && unidad === "metro" ? "Flores metro" : categoria;
    const bases = BASES[clave];
    if (!bases) { sinBase.push(`${t.nombre} [${categoria || "sin categoría"}]`); continue; }

    // ---- la línea de datos: todo sale de la BD o del nombre, nada se inventa
    // Solo lo que es PROPIO de esta ficha. La unidad de venta no va aquí: ya
    // la dice la base con mejores palabras ("se corta a la medida"), y
    // repetirla dejaba el texto diciendo dos veces lo mismo.
    const datos: string[] = [];
    const colores = new Set(V.filter((v) => v.color_id).map((v) => v.color_id)).size;
    if (colores > 1) datos.push(`disponible en ${colores} colores`);
    const ancho = t.nombre.match(/(\d+)\s*mm$/);
    if (ancho) datos.push(`${ancho[1]} mm de ancho`);
    const piezas = V.find((v) => v.piezas_por_unidad)?.piezas_por_unidad;
    if (unidad === "bolsa" && piezas) datos.push(`bolsa de ${piezas} piezas`);

    const texto = datos.length
      ? `${elegir(bases, t.slug)}\n\n${mayuscula(datos.join(" · "))}.`
      : elegir(bases, t.slug);

    // En simulacro se enseñan unos cuantos textos completos: un resumen de
    // conteos no deja ver si la prosa quedó bien.
    if (!APLICAR && muestras.length < 4 && !vistas.has(clave)) {
      vistas.add(clave);
      muestras.push(`\n   ── ${t.nombre} [${clave}] ──\n${texto.split("\n").map((l) => "   " + l).join("\n")}`);
    }
    porFamilia.set(clave, (porFamilia.get(clave) ?? 0) + 1);
    escritas++;
    if (!APLICAR) continue;
    const { error } = await supabase.from("tela").update({ descripcion: texto }).eq("id", t.id);
    if (error) console.error(`   ✖ ${t.nombre}: ${error.message}`);
  }

  if (muestras.length) { console.log("── Muestra ──"); muestras.forEach((m) => console.log(m)); console.log(""); }
  console.log("── Por familia ──");
  [...porFamilia.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log(`   ${String(n).padStart(3)}  ${f}  (${BASES[f].length} base${BASES[f].length > 1 ? "s" : ""})`));
  console.log(`   ${escritas} descripciones`);
  if (respetadas) console.log(`\n   ${respetadas} ya tenían texto y NO se tocaron (usa --forzar para pisarlas)`);
  if (sinVariante) console.log(`   ${sinVariante} sin variante: no salen en el catálogo, se saltan`);
  if (sinBase.length) {
    console.log(`\n   ⚠ ${sinBase.length} sin base para su categoría, se quedan sin descripción:`);
    sinBase.forEach((x) => console.log(`     · ${x}`));
  }
  console.log(`\n${APLICAR ? "Listo." : "Nada de esto se escribió."}\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
