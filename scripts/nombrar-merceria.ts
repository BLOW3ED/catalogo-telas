#!/usr/bin/env tsx
/**
 * Quitar el código del proveedor de los nombres — Telas La Jalisciense
 * ===========================================================================
 * Punto 2: "que ya no aparezcan skus en los nombres". Los botones y el tul
 * bordado ya se resolvieron en `nombrar-botones-tul`; aquí va el resto de la
 * mercería: aplicaciones, tiras, cintillos, corchetes, flecos, hebilla, cinta
 * e hilos.
 *
 * A diferencia de `limpiar-duplicados.ts` —que solo anteponía el prefijo de
 * la categoría y dejaba el código pegado— aquí cada ficha lleva un nombre
 * DESCRIPTIVO escrito viendo su foto. El código no se conserva en el nombre:
 * la tienda lo tiene en la etiqueta física, y `variante.sku` es donde vive
 * cuando existe (nunca se inventa uno: hay fichas legítimamente sin SKU).
 *
 * El criterio para nombrar es el mismo que ya usa `lib/ingesta/categorias.ts`:
 * la FORMA del producto, porque es como se busca. Un cintillo, un fleco y una
 * tira son todos "pedrería" y se navegan distinto. Dentro de cada categoría,
 * el nombre dice qué distingue a esa pieza de sus hermanas: cuántas hileras,
 * si va sobre listón, si el remate es gota o navette. Nueve cintillos que se
 * llamen "Cintillo de pedrería" no le sirven a nadie.
 *
 * De paso se asigna color donde la foto lo deja claro (punto 4), porque abrir
 * la foto dos veces —una para nombrar y otra para el color— sería tirar el
 * trabajo. Lo que la foto NO deja claro se queda sin color y se reporta.
 *
 *   pnpm nombrar:merceria              → SIMULACRO
 *   pnpm nombrar:merceria --aplicar    → escribe
 *
 * `tela.slug` NO se toca. Idempotente.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

type Ficha = { nombre: string; color?: string; nota?: string };

/**
 * slug → nombre real (+ color cuando la foto lo deja claro).
 * Todo verificado abriendo la foto; nada sale del texto del código.
 */
const FICHAS: Record<string, Ficha> = {
  // ── Aplicación de pedrería: pieza suelta, se cose donde se quiere el brillo
  bcp115: { nombre: "Aplicación de copo de navette", color: "Plata" },
  d440: { nombre: "Aplicación de rombo de piedra", color: "Oro" },
  d466: { nombre: "Aplicación de barra con racimo", color: "Oro" },
  db16: { nombre: "Aplicación de rosetón chico", color: "Plata" },
  fp1523: { nombre: "Aplicación de flor de metal calado", color: "Oro" },
  jf001: { nombre: "Aplicación de flor de navettes", color: "Plata" },
  mc45: { nombre: "Aplicación de mariposa dorada", color: "Oro" },

  // ── Corchetes: los tres son de gancho, cambia la forma de la placa
  "corchete-enganchable-jr1103": { nombre: "Corchete de óvalos de piedra", color: "Plata" },
  "corchete-enganchable-jr1130": { nombre: "Corchete de ojal de piedra", color: "Plata" },
  "corchete-enganchable-jr1133": { nombre: "Corchete de gota de piedra", color: "Plata" },

  // ── Flecos: cuelgan de una cinta; lo que cambia es cuántas hileras
  b198: { nombre: "Fleco de cadena de piedra", color: "Plata" },
  b269: { nombre: "Fleco de piedra de varias hileras", color: "Plata" },

  // ── Cintillos: cinta angosta de piedra; varios van montados sobre listón
  bt1171: { nombre: "Cintillo de hoja de piedra con listón", color: "Plata" },
  bt279: { nombre: "Cintillo de perla con listón", color: "Plata" },
  ct279: { nombre: "Cintillo fino de piedra con listón", color: "Plata" },
  t22970: { nombre: "Cintillo de flor y estrella", color: "Plata" },
  t269: { nombre: "Cintillo dorado fino", color: "Oro" },
  t26923: { nombre: "Cintillo de perla alternada", color: "Oro" },
  t339: { nombre: "Cintillo de hoja de navette", color: "Plata" },
  tc199: { nombre: "Cintillo de flor con cuenta", color: "Plata" },

  // ── Hebilla
  he020: { nombre: "Hebilla cuadrada de piedra", color: "Oro" },

  // ── Cinta: "Yuli" es la marca, no el producto
  "yuli-cinta-bies16mm": { nombre: "Cinta bies metálica · 16 mm", color: "Oro" },


  // ── Tira de pedrería: se corta por metro; el nombre dice cómo está armada
  bnk1041: { nombre: "Tira de dos hileras de piedra" },
  bnk1060: { nombre: "Tira trenzada en rombo", color: "Oro" },
  bnk1070: { nombre: "Tira fina de piedra con racimo", color: "Tornasol" },
  bnk2000: { nombre: "Tira de navette en abanico" },
  bnk2195: { nombre: "Tira de flor de cuatro pétalos", color: "Oro Rosa" },
  bnk2263: { nombre: "Tira de flor con navette", color: "Oro" },
  bnk2284: { nombre: "Tira angosta de rombo" },
  bnk337: { nombre: "Tira de navette alternada", color: "Plata" },
  bnk621: { nombre: "Tira de espiga de navette", color: "Tornasol" },
  bnk691: { nombre: "Tira de flor con óvalo", color: "Plata" },
  kp151: { nombre: "Tira de malla con piedra ahumada", color: "Humo" },
  kp152: { nombre: "Tira ancha de piedra en varias hileras", color: "Plata" },
  kp159: { nombre: "Tira de pico sobre strass" },
  kp1601: { nombre: "Tira de un hilo de piedra chica", color: "Tornasol" },
  kp162: { nombre: "Tira de un hilo de piedra grande" },
  kp164: { nombre: "Tira trenzada ondulada", color: "Plata" },
  kp165: { nombre: "Tira de espiga", color: "Plata" },
  kp178: { nombre: "Tira de pico dorado" },
  tdc11923: { nombre: "Tira de flor en dos hileras", color: "Oro" },
  tdc68: { nombre: "Tira de dos hileras con piedra AB", color: "Tornasol" },
  t4l: { nombre: "Tira de malla ancha de strass", color: "Plata" },

  // ── Aplicación de pedrería: las que llegaron de "Tira de pedrería" en la
  //    fase 2 y se quedaron con el prefijo corregido pero el código pegado.
  //    Ocho son broches de BARRA y por eso el nombre tiene que decir qué
  //    lleva cada uno al centro.
  bnk2033: { nombre: "Broche de barra con rombo" },
  bnk203823: { nombre: "Broche de barra con margarita" },
  bnk203868: { nombre: "Broche de barra con flor abierta" },
  bnk203869: { nombre: "Broche de barra con óvalo", color: "Plata" },
  bnk624: { nombre: "Broche de barra de navettes" },
  // La M y la S del código son TAMAÑO (confirmado con la tienda), no color:
  // los dos vienen en oro, plata y tornasol.
  bnk709m: { nombre: "Broche de barra de florecitas · mediano" },
  bnk709s: { nombre: "Broche de barra de florecitas · chico" },
  bnk724: { nombre: "Broche de barra de flor grande", color: "Oro" },
  bnk1049: { nombre: "Aplicación de rosetón de flor" },
  bnk1082: { nombre: "Aplicación de medallón oval calado" },
  bnk2315: { nombre: "Aplicación de mariposa de piedra" },
  bnk3109: { nombre: "Aplicación de corona con gota", color: "Oro" },
  bnk3110: { nombre: "Aplicación de mariposa de navette" },
  bnk3111: { nombre: "Aplicación de estrella de piedra" },
  bnk3115: { nombre: "Aplicación de corona alta con gota" },
  bnk5061: { nombre: "Aplicación de corona con óvalo y gota" },
  bnk5062: { nombre: "Aplicación de corona de punta con gota" },
  bnk5201: { nombre: "Aplicación de rosetón de navette", color: "Oro" },

  // ── Hilos: el 00013 es el número de toma de la cámara; el color 82 sí es dato.
  //    A resolución `md` el hilo del cono se ve rosa bajo la etiqueta.
  "hilo-duralon00013color-82": { nombre: "Hilo Duralon · color 82", color: "Rosado" },
};

/**
 * Fichas a las que SOLO se les pone color: el nombre se queda como está.
 *
 * Piedra suelta es el caso que obliga a esta distinción. Sus nombres traen el
 * código de la bolsa ("Piedra 1404 · 25 pz · C") y a primera vista parecen el
 * mismo problema que el resto — pero NO lo son:
 *
 *   · Ese código no es un SKU olvidado: es lo que la tienda escribe A MANO en
 *     la etiqueta, y ya está documentado que repite el mismo `#1404` en bolsas
 *     de contenido distinto. Meterlo en `variante.sku` colapsaría ~20
 *     productos en uno (por eso solo 4 de 46 variantes tienen sku).
 *   · Las fotos son de la BOLSA CERRADA. No alcanzan para nombrar la piedra
 *     por su forma o su medida, que es lo que haría falta para distinguir
 *     veinte bolsas de piedra transparente.
 *
 * Quitarles el código las dejaría indistinguibles entre sí y sin manera de
 * amarrarlas a la etiqueta física. Se quedan con su nombre; lo que sí se
 * puede leer de la foto —el color de la piedra— sí se captura.
 */
const SOLO_COLOR: Record<string, string> = {
  // ── Piedra suelta
  "bolsa-de-piedras-25-pz": "Oro",
  "bolsa-de-piedras-a": "Oro",
  "bolsa-de-piedras-b": "Oro",
  "bolsa-de-piedras-c": "Tornasol",
  "bolsa-de-piedras-d": "Plata",
  "piedra-1404": "Cristal",
  "piedra-1404-15-pz": "Cristal",
  "piedra-1404-25-pz-a": "Cristal",
  "piedra-1404-25-pz-b": "Tornasol",
  "piedra-1404-25-pz-c": "Tornasol",
  "piedra-1404-25-pz-d": "Cristal",
  "piedra-1404-25-pz-e": "Tornasol",
  "piedra-1404-25-pz-f": "Tornasol",
  "piedra-1404-25-pz-g": "Tornasol",
  "piedra-1404-25-pz-h": "Cristal",
  "piedra-1404-26-pz-a": "Oro",
  "piedra-1404-26-pz-b": "Cristal",
  "piedra-1404-30-pz": "Cristal",
  "piedra-1404-35-pz-a": "Tornasol",
  "piedra-1404-35-pz-b": "Cristal",
  "piedra-1404-35-pz-c": "Oro",
  "piedra-1404-35-pz-d": "Cristal",
  "piedra-1404-50-pz-a": "Tornasol",
  "piedra-1404-50-pz-b": "Cristal",
  "piedra-1404-50-pz-c": "Oro",
  "piedra-1404-50-pz-d": "Cristal",
  "piedra-1404-60-pz": "Cristal",
  "piedra-9301-12-pz": "Plata",
  "piedra-b1403-12-pz-a": "Tornasol",
  "piedra-b1403-12-pz-b": "Oro",
  "piedra-b8440-6-pz": "Café",
  "piedra-b9301-12-pz": "Oro",
  "piedra-bac1-6-pz": "Cristal",
  "piedra-bbe25-6-pz": "Oro",
  "piedra-bd12-12-pz": "Cristal",
  "piedra-bpl18c-12-pz": "Blanco",
  i1403: "Oro",
  i9301: "Plata",
  pcc120: "Oro",

  // ── Copas: "NU" viene de nude, pero el color real lo dice la foto
  "cop-nu-chica-mediana34-b": "Negro",
  "cop-nu-grande": "Champagne",
  "cop-nuxl": "Blanco",

  // ── Flores
  "flor-o4": "Champagne",
  florecitas7: "Palo de Rosa",

  // ── Hilos
  "hilo-duralon903": "Rosado",
};

/** Lo que se deja sin color a propósito, con la razón. */
const SIN_COLOR = [
  "Piedra suelta KPA — la bolsa trae piedra de ocho colores distintos; " +
    "un solo swatch mentiría. Necesita separarse por color o venderse como surtido.",
];

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · nombrar-merceria\n`);

  const slugs = [...Object.keys(FICHAS), ...Object.keys(SOLO_COLOR)];
  const { data: telas, error: eT } = await supabase
    .from("tela").select("id, slug, nombre, categoria:categoria_id(nombre)").in("slug", slugs);
  if (eT) { console.error("✖", eT.message); process.exit(1); }
  const porSlug = new Map((telas ?? []).map((t) => [t.slug, t]));

  const noExisten = slugs.filter((s) => !porSlug.has(s));
  if (noExisten.length) {
    console.error(`✖ ABORTADO: slug(s) que no existen — revisar antes de escribir: ${noExisten.join(", ")}`);
    process.exit(1);
  }

  const colores = [...new Set([
    ...Object.values(FICHAS).map((f) => f.color).filter(Boolean) as string[],
    ...Object.values(SOLO_COLOR),
  ])];
  const { data: cs } = await supabase.from("color").select("id, nombre").in("nombre", colores);
  const colorId = new Map((cs ?? []).map((c) => [c.nombre, c.id]));
  const faltanColores = colores.filter((c) => !colorId.has(c));
  if (faltanColores.length) {
    console.error(`✖ ABORTADO: color(es) que no existen en la paleta: ${faltanColores.join(", ")}`);
    process.exit(1);
  }

  // ── reporte ──
  const porCategoria = new Map<string, string[]>();
  let porRenombrar = 0, porColorear = 0;
  const sinColor: string[] = [];
  for (const [slug, f] of Object.entries(FICHAS)) {
    const t = porSlug.get(slug)!;
    const cat = (t as any).categoria?.nombre ?? "—";
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    const cambia = t.nombre !== f.nombre;
    if (cambia) porRenombrar++;
    // solo se avisa de las que de verdad quedarían sin color: muchas ya lo
    // tienen de la fase 2 (varias variantes por acabado) y no necesitan uno aquí
    if (!f.color) {
      const { data: vs } = await supabase.from("variante").select("color_id").eq("tela_id", t.id);
      if ((vs ?? []).some((v) => !v.color_id)) sinColor.push(`${f.nombre}${f.nota ? ` (${f.nota})` : ""}`);
    }
    porCategoria.get(cat)!.push(
      `${cambia ? "·" : "✓"} "${t.nombre}"${cambia ? `  →  "${f.nombre}"` : ""}${f.color ? `   [${f.color}]` : "   [sin color]"}`
    );
  }
  for (const [cat, lineas] of porCategoria) {
    console.log(`── ${cat} (${lineas.length}) ──`);
    for (const l of lineas) console.log(`   ${l}`);
    console.log();
  }

  // cuántas variantes se van a colorear de verdad
  for (const [slug, f] of Object.entries(FICHAS)) {
    if (!f.color) continue;
    const t = porSlug.get(slug)!;
    const { data: vs } = await supabase.from("variante").select("id, color_id").eq("tela_id", t.id);
    porColorear += (vs ?? []).filter((v) => !v.color_id).length;
  }
  let soloColor = 0;
  for (const slug of Object.keys(SOLO_COLOR)) {
    const t = porSlug.get(slug)!;
    const { data: vs } = await supabase.from("variante").select("id, color_id").eq("tela_id", t.id);
    soloColor += (vs ?? []).filter((v) => !v.color_id).length;
  }
  console.log(`── solo color, el nombre se queda (${Object.keys(SOLO_COLOR).length} fichas) ──`);
  console.log(`   ${soloColor} variante(s) por colorear · ver la nota de SOLO_COLOR: el código de la bolsita NO es un sku`);

  console.log(`\n${porRenombrar} nombre(s) por cambiar · ${porColorear + soloColor} variante(s) por colorear`);
  for (const s of sinColor) console.log(`   ⚠ ${s}`);
  for (const s of SIN_COLOR) console.log(`   ⚠ ${s}`);

  if (!APLICAR) { console.log("\n   Nada de esto se escribió.\n"); return; }

  let renombradas = 0, coloreadas = 0;
  for (const [slug, f] of Object.entries(FICHAS)) {
    const t = porSlug.get(slug)!;
    if (t.nombre !== f.nombre) {
      const { error } = await supabase.from("tela").update({ nombre: f.nombre, descripcion: null }).eq("id", t.id);
      if (error) { console.error(`   ✖ renombrando ${slug}: ${error.message}`); process.exit(1); }
      renombradas++;
    }
    if (!f.color) continue;
    const { data: vs } = await supabase.from("variante").select("id, color_id").eq("tela_id", t.id).order("orden");
    for (const v of vs ?? []) {
      if (v.color_id) continue; // ya tiene color capturado: no se pisa
      const { error } = await supabase.from("variante").update({ color_id: colorId.get(f.color)! }).eq("id", v.id);
      if (error) { console.error(`   ✖ coloreando ${slug}: ${error.message}`); process.exit(1); }
      await supabase.from("foto").update({ alt: `${f.nombre} · ${f.color}` }).eq("variante_id", v.id);
      coloreadas++;
    }
  }

  for (const [slug, color] of Object.entries(SOLO_COLOR)) {
    const t = porSlug.get(slug)!;
    const { data: vs } = await supabase.from("variante").select("id, color_id").eq("tela_id", t.id);
    for (const v of vs ?? []) {
      if (v.color_id) continue;
      const { error } = await supabase.from("variante").update({ color_id: colorId.get(color)! }).eq("id", v.id);
      if (error) { console.error(`   ✖ coloreando ${slug}: ${error.message}`); process.exit(1); }
      await supabase.from("foto").update({ alt: `${t.nombre} · ${color}` }).eq("variante_id", v.id);
      coloreadas++;
    }
  }

  console.log(`\n   ✓ ${renombradas} ficha(s) renombrada(s), ${coloreadas} variante(s) con color`);
  console.log(`\nCorre "pnpm describir --aplicar" para regenerar las descripciones.\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
