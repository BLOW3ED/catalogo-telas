#!/usr/bin/env tsx
/**
 * Afinar nombres y limpiar sobrantes — Telas La Jalisciense
 * ===========================================================================
 * Segunda pasada de la curaduría, después de `pnpm limpiar`. Aquí va lo que
 * NO se puede deducir de una regla: hubo que abrir la foto de cada producto
 * para saber qué es. Por eso los renombres son una tabla explícita y no un
 * patrón — un regex que "arregle" nombres sin ver la pieza es justo como se
 * llegó a tener productos llamados `butterfly` y `florescentral`.
 *
 *   1. NOMBRES DE ARCHIVO — solo los VERIFICADOS contra su foto, y solo
 *      cuando el arreglo es ortográfico o de traducción evidente. Lo que
 *      exige criterio de la tienda (qué significa el 5 de "florecitas5", si
 *      `map4` es la misma familia que `butterfly`) se LISTA como pendiente y
 *      no se toca.
 *
 *   2. HUÉRFANO — "Carlo Daniel" es un nombre de persona en la ficha de una
 *      organza, con 0 variantes. La vista `catalogo_telas` exige variante,
 *      así que ningún cliente la ve, pero ahí está la única descripción de
 *      organza que hay escrita. Se le pone el nombre correcto y se conserva.
 *
 *   3. CATEGORÍAS VACÍAS — sinónimos de las que sí se usan ("Cintas" vs
 *      "Cinta", "Encaje" vs "Galón de encaje") más "Pedrería", que quedó sin
 *      productos al borrar los duplicados. No se ven en los filtros —las
 *      facetas solo pintan lo que algún producto tiene— pero ensucian el
 *      selector de /admin, que es donde se captura.
 *
 *   pnpm afinar              → SIMULACRO: dice qué haría y no escribe nada
 *   pnpm afinar --aplicar    → escribe los cambios
 *
 * Idempotente. Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * ===========================================================================
 */
import { config as loadEnv } from "dotenv";
import { slugify } from "../lib/slug";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/**
 * Renombres verificados abriendo la foto de cada producto. El slug NO se toca
 * (igual que en `limpiar`): el nombre es lo que lee el cliente, el slug es la
 * dirección, y romper la dirección tira los enlaces ya mandados por WhatsApp.
 */
const RENOMBRES: { de: string; a: string; porque: string }[] = [
  { de: "Chifon Lunares", a: "Chifón Lunares", porque: "faltaba el acento" },
  { de: "cierre", a: "Cierre", porque: "venía en minúscula del nombre de archivo" },
  { de: "cierreoculto", a: "Cierre oculto", porque: "dos palabras pegadas" },
  { de: "Cop NU Grande", a: "Copa NU Grande", porque: "'Cop' truncado" },
  { de: "Cop NUXL", a: "Copa NU XL", porque: "truncado y pegado" },
  { de: "Cop Tirante", a: "Copa con tirante", porque: "truncado" },
  { de: "guipiur", a: "Guipiur", porque: "minúscula" },
  { de: "motivos", a: "Motivos", porque: "minúscula" },
  { de: "florecitas", a: "Florecitas", porque: "minúscula" },
  { de: "flores", a: "Flores", porque: "minúscula" },
  { de: "florescentral", a: "Flores con piedra central", porque: "pegado; la foto muestra flor con piedra al centro" },
  { de: "butterfly", a: "Mariposa", porque: "la foto es una aplicación de mariposa; el catálogo es en español" },
  // "Carlo Daniel" es nombre de persona en una ficha de organza. Aquí SÍ se
  // cambia el slug: la ficha no tiene variantes, así que /tela/carlo-daniel
  // ya devuelve 404 y no hay enlace vivo que romper.
  { de: "florecitas5", a: "Florecitas 5 cm", porque: "el número es el diámetro en cm (confirmado por la tienda)" },
  { de: "florecitas7", a: "Florecitas 7 cm", porque: "ídem" },
  { de: "Carlo Daniel", a: "Organza", porque: "nombre de persona en la ficha; la descripción es de organza" },
];

/** Cambian de dirección además de nombre (ver comentario de arriba). */
const TAMBIEN_SLUG = new Set(["Carlo Daniel"]);

/**
 * Lo que NO se toca porque necesita criterio de la tienda, con lo que vi en
 * la foto para que la decisión se pueda tomar sin volver a abrirlas.
 */
const PENDIENTES: { nombre: string; hallazgo: string }[] = [
  { nombre: "map4", hallazgo: "también son mariposas — ¿es la misma familia que 'butterfly'/'Mariposa'?" },
  { nombre: "florecitas5", hallazgo: "flor de gasa; el 5 parece el diámetro — ¿en cm? ¿'Florecitas 5 cm'?" },
  { nombre: "florecitas7", hallazgo: "igual que florecitas5, con 7" },
  { nombre: "Cop NU Chica Mediana34 B", hallazgo: "copa negra; '34 B' es talla — ¿'Copa NU Chica/Mediana 34B'?" },
  { nombre: "Hilo Duralon903", hallazgo: "mismo cono rosa que 'Hilo Duralon00013color 82' — ¿un solo producto con dos colores?" },
  { nombre: "Hilo Duralon00013color 82", hallazgo: "ídem; el nombre trae pegado el número de toma" },
  { nombre: "350 Tira Orilla Piedra150mm", hallazgo: "la foto es encaje bordado sobre tul, casi idéntico a '351 Tira Tul Bordado150mm' — categoría equivocada (está en Tira de pedrería) y posible duplicado" },
  { nombre: "359 Tira Tul Bordado105mm", hallazgo: "mismo diseño que el de 115mm, en otro color — ¿un modelo con dos colores?" },
  { nombre: "359 Tira Tul Bordado115mm", hallazgo: "ídem" },
  { nombre: "Flores", hallazgo: "mezcla DOS productos: aplicación de rosas y galón de rosas. Hay que partirlo, no renombrarlo" },
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

  const [telasR, catsR] = await Promise.all([
    supabase.from("tela").select("id, slug, nombre, categoria_id"),
    supabase.from("categoria").select("id, nombre, slug"),
  ]);
  for (const r of [telasR, catsR]) {
    if (r.error) { console.error("✖ No se pudo leer la BD:", r.error.message); process.exit(1); }
  }
  const telas = telasR.data ?? [];
  const categorias = catsR.data ?? [];

  console.log(
    `\n${APLICAR ? "APLICANDO" : "SIMULACRO (usa --aplicar para escribir)"} · ${telas.length} telas\n`
  );

  // -------------------------------------------------------------------------
  // 1) Renombres verificados contra la foto
  // -------------------------------------------------------------------------
  console.log("── 1. Nombres verificados contra su foto ──");
  const porNombre = new Map(telas.map((t) => [t.nombre, t]));
  let hechos = 0, yaEstaban = 0;
  for (const r of RENOMBRES) {
    const tela = porNombre.get(r.de);
    if (!tela) {
      // Ya renombrada en una corrida anterior, o el nombre cambió a mano.
      if (porNombre.has(r.a)) yaEstaban++;
      // Puede haber desaparecido por renombre a mano, por `pnpm fusionar` o por
      // `pnpm partir`, que la absorbe en varios modelos. No se adivina cuál.
      else console.log(`   · "${r.de}" ya no existe en el catálogo`);
      continue;
    }
    const cambios: Record<string, string> = { nombre: r.a };
    if (TAMBIEN_SLUG.has(r.de)) cambios.slug = slugify(r.a);
    console.log(`   ${r.de}`);
    console.log(`     → ${r.a}   (${r.porque})${cambios.slug ? `   [slug → ${cambios.slug}]` : ""}`);
    hechos++;
    if (!APLICAR) continue;
    const { error } = await supabase.from("tela").update(cambios).eq("id", tela.id);
    if (error) console.error(`   ✖ ${r.de}: ${error.message}`);
  }
  console.log(`   ${hechos} por renombrar${yaEstaban ? ` · ${yaEstaban} ya estaban hechos` : ""}`);

  // -------------------------------------------------------------------------
  // 2) El ancho de la tira, pegado al final del nombre
  // -------------------------------------------------------------------------
  // La tienda confirmó que un número seguido de "mm" al final del nombre es el
  // ANCHO de la tira ("359 Tira Tul Bordado105mm" = 105 mm de ancho). Venía
  // pegado del nombre de archivo, que no admite espacios; separarlo lo vuelve
  // legible y deja el dato explícito para quien cotiza.
  //
  // Idempotente por construcción: una vez separado el nombre termina en
  // " 105 mm", que ya no case con /(\d+)mm$/.
  // -------------------------------------------------------------------------
  console.log("\n── 2. Ancho de la tira en el nombre ──");
  const RE_ANCHO = /(\d+)mm$/;
  const anchos = telas
    .filter((t) => RE_ANCHO.test(t.nombre.trim()))
    .map((t) => ({ tela: t, nuevo: t.nombre.trim().replace(RE_ANCHO, (_m: string, n: string) => ` ${n} mm`).replace(/\s+/g, " ") }))
    .filter((x) => x.nuevo !== x.tela.nombre)
    .sort((a, b) => a.nuevo.localeCompare(b.nuevo));
  anchos.forEach((x) => console.log(`   ${x.tela.nombre.padEnd(32)} → ${x.nuevo}`));
  console.log(`   ${anchos.length} por separar · el slug no cambia`);
  if (APLICAR) {
    for (const x of anchos) {
      const { error } = await supabase.from("tela").update({ nombre: x.nuevo }).eq("id", x.tela.id);
      if (error) console.error(`   ✖ ${x.tela.nombre}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3) Categorías vacías
  // -------------------------------------------------------------------------
  console.log("\n── 3. Categorías vacías ──");
  const usadas = new Set(telas.map((t) => t.categoria_id).filter(Boolean));
  const vacias = categorias.filter((c) => !usadas.has(c.id));
  vacias.forEach((c) => console.log(`   ✂ ${c.nombre}  (${c.slug})`));
  console.log(`   ${vacias.length} por borrar · quedan ${categorias.length - vacias.length} en uso`);
  if (APLICAR && vacias.length) {
    const { error } = await supabase.from("categoria").delete().in("id", vacias.map((c) => c.id));
    if (error) console.error(`   ✖ borrando categorías: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // 4) El alt de las fotos, que se quedó con el nombre viejo
  // -------------------------------------------------------------------------
  // `foto.alt` se escribe UNA vez, al subir, y nunca se vuelve a tocar: es una
  // copia congelada del nombre del producto. Después de renombrar las fichas,
  // 220 fotos describían algo que ya no se llama así ("BNK5061" para lo que
  // hoy es "Tira de pedrería BNK5061").
  //
  // Se regenera con la misma convención que usa el detalle para su título
  // (`nombre · color`). Ninguno de los 187 valores distintos que había estaba
  // escrito a mano —todos eran nombres o códigos puestos por la ingesta— así
  // que no se pisa trabajo de nadie.
  //
  // El único consumidor en el sitio es `TelaImageCarousel`, que ya tiene un
  // fallback mejor: calcula `nombre color — foto i de N` al renderizar, y por
  // eso nunca envejece. El campo se conserva poblado por si lo lee el agente
  // de WhatsApp desde la BD; si se confirma que no, lo correcto es ponerlo en
  // NULL y dejar que mande el fallback.
  // -------------------------------------------------------------------------
  console.log("\n── 4. Alt de las fotos ──");
  const { data: fotosAlt, error: eAlt } = await supabase
    .from("foto")
    .select("id, alt, variante:variante_id(color:color_id(nombre), tela:tela_id(nombre))");
  if (eAlt) { console.error("   ✖ leyendo fotos:", eAlt.message); process.exit(1); }

  type FilaFoto = {
    id: string; alt: string | null;
    variante: { color: { nombre: string } | null; tela: { nombre: string } | null } | null;
  };
  const desfasadas: { id: string; de: string; a: string }[] = [];
  for (const f of (fotosAlt ?? []) as unknown as FilaFoto[]) {
    const nombreTela = f.variante?.tela?.nombre;
    if (!nombreTela) continue;
    const color = f.variante?.color?.nombre;
    const debe = color ? `${nombreTela} · ${color}` : nombreTela;
    if ((f.alt ?? "") === debe) continue;
    desfasadas.push({ id: f.id, de: f.alt ?? "(vacío)", a: debe });
  }
  // Agrupado: 200 líneas casi iguales no se leen.
  const porCambio = new Map<string, number>();
  for (const d of desfasadas) {
    const k = `${d.de}  →  ${d.a}`;
    porCambio.set(k, (porCambio.get(k) ?? 0) + 1);
  }
  [...porCambio.entries()].slice(0, 10).forEach(([k, n]) => console.log(`   ${n > 1 ? `${n}×` : "  "} ${k}`));
  if (porCambio.size > 10) console.log(`   … y ${porCambio.size - 10} cambios distintos más`);
  console.log(`   ${desfasadas.length} fotos por corregir (de ${(fotosAlt ?? []).length})`);
  if (APLICAR) {
    for (const d of desfasadas) {
      const { error } = await supabase.from("foto").update({ alt: d.a }).eq("id", d.id);
      if (error) console.error(`   ✖ foto ${d.id}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // 5) Lo que necesita decisión de la tienda
  // -------------------------------------------------------------------------
  console.log("\n── 5. Pendientes (necesitan criterio, NO se tocan) ──");
  for (const p of PENDIENTES) {
    const sigue = telas.some((t) => t.nombre === p.nombre);
    console.log(`   ${sigue ? "·" : "✓"} ${p.nombre}`);
    console.log(`     ${p.hallazgo}`);
  }

  console.log(`\n${APLICAR ? "Listo." : "Nada de esto se escribió."} Resumen: ${hechos + anchos.length} nombres · ${vacias.length} categorías · ${desfasadas.length} alt\n`);
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
