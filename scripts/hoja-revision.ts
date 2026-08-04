#!/usr/bin/env tsx
/**
 * Hoja de revisión del manifest — Telas La Jalisciense
 * ===========================================================================
 * Genera un HTML autocontenido con una tarjeta por producto: sus fotos, lo que
 * ya está capturado y lo que falta, ordenado por "lo que más falta primero".
 *
 * Existe porque el CSV solo, con 115 códigos como `BNK2315`, no se puede
 * llenar: hay que VER la pieza para saber cómo se llama. Las miniaturas van
 * incrustadas en el HTML, así que el archivo se abre en cualquier lado sin
 * depender de la carpeta de fotos.
 *
 *   pnpm hoja
 *   pnpm hoja --out=/tmp/revision.html --dir=Fotos_Entrada_listas
 * ===========================================================================
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const argv = process.argv.slice(2);
const arg = (n: string) => {
  const hit = argv.find((a) => a.startsWith(`${n}=`));
  return hit ? hit.slice(n.length + 1) : undefined;
};
const flags = {
  csv: arg("--csv") ?? "catalog-manifest.csv",
  dir: arg("--dir") ?? "Fotos_Entrada_listas",
  out: arg("--out") ?? "revision-lote.html",
  /** Miniaturas por tarjeta; más de 4 engorda el archivo sin ayudar. */
  max: parseInt(arg("--fotos") ?? "4", 10),
};

type Fila = Record<string, string>;

function parseCsv(t: string): Fila[] {
  const filas: string[][] = [];
  let campo = "", fila: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"') q = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); if (fila.some((x) => x !== "")) filas.push(fila); }
  const [head, ...resto] = filas;
  return resto.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Paleta y tipografía de "The Atelier" (ver app/globals.css). */
const CSS = `
:root{--bg:#f8f7f2;--surface:#f1f0ea;--surface-high:#e7e6df;--ink:#1b1e26;--ink-soft:#474a52;
 --primary:#3730a3;--amber:#a84d08;--success:#157a3a;--line:#e9e8e1;--line-strong:#c9c8c0;
 --serif:Georgia,"Iowan Old Style","Times New Roman",serif;
 --sans:ui-sans-serif,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#14161d;--surface:#1c1f28;--surface-high:#262a35;
 --ink:#eceae3;--ink-soft:#a4a7af;--primary:#a9b3f7;--amber:#e79a5c;--success:#63c98c;
 --line:#2a2e39;--line-strong:#3b4150}}
:root[data-theme="dark"]{--bg:#14161d;--surface:#1c1f28;--surface-high:#262a35;--ink:#eceae3;
 --ink-soft:#a4a7af;--primary:#a9b3f7;--amber:#e79a5c;--success:#63c98c;--line:#2a2e39;--line-strong:#3b4150}
:root[data-theme="light"]{--bg:#f8f7f2;--surface:#f1f0ea;--surface-high:#e7e6df;--ink:#1b1e26;
 --ink-soft:#474a52;--primary:#3730a3;--amber:#a84d08;--success:#157a3a;--line:#e9e8e1;--line-strong:#c9c8c0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;
 line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:44px 22px 72px;display:flex;flex-direction:column;gap:34px}
.intro{display:flex;flex-direction:column;gap:12px;max-width:64ch}
.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);font-weight:700}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(28px,4.4vw,42px);line-height:1.1;margin:0;
 text-wrap:balance;letter-spacing:-.01em}
.sub{margin:0;color:var(--ink-soft)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:1px;
 background:var(--line-strong);border:1px solid var(--line-strong);border-radius:2px;overflow:hidden}
.stat{background:var(--surface);padding:16px 18px}
.stat-n{font-family:var(--serif);font-size:30px;line-height:1;font-variant-numeric:tabular-nums}
.stat-l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-top:7px}
.stat.alerta .stat-n{color:var(--amber)} .stat.bien .stat-n{color:var(--success)}
.barra{display:flex;gap:8px;flex-wrap:wrap}
.f{font:inherit;font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;
 background:var(--surface);color:var(--ink-soft);border:1px solid var(--line-strong);
 border-radius:2px;padding:7px 13px}
.f:hover{background:var(--surface-high);color:var(--ink)}
.f[aria-pressed="true"]{background:var(--primary);border-color:var(--primary);color:var(--bg);font-weight:600}
.f:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--line-strong);border-radius:2px;
 padding:0 0 14px;display:flex;flex-direction:column;gap:11px;overflow:hidden}
.card.vacio{border-left:3px solid var(--amber)} .card.parcial{border-left:3px solid var(--line-strong)}
.card.ok{border-left:3px solid var(--success)} .card[hidden]{display:none}
.tiras{display:flex;gap:1px;background:#101014}
.tiras img{flex:1;min-width:0;aspect-ratio:1;object-fit:cover;display:block}
.cab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 14px}
.cab h2{font-family:var(--serif);font-weight:400;font-size:19px;margin:0;word-break:break-all;letter-spacing:-.01em}
.n{font-size:12px;font-variant-numeric:tabular-nums;color:var(--ink-soft);background:var(--surface-high);
 border-radius:2px;padding:2px 7px;flex:none}
.chips{display:flex;flex-wrap:wrap;gap:5px;padding:0 14px}
.chip{font-size:11px;letter-spacing:.05em;text-transform:uppercase;border-radius:2px;
 padding:3px 7px;border:1px solid transparent}
.chip.falta{color:var(--amber);border-color:var(--amber)}
.chip.ok{color:var(--success);border-color:var(--success)}
.chip.neutro{color:var(--ink-soft);border-color:var(--line-strong)}
.chip.cat{color:var(--primary);border-color:var(--primary)}
.datos{margin:0;padding:0 14px;display:flex;flex-direction:column;gap:4px}
.d{display:flex;gap:9px;font-size:13px}
.d dt{flex:none;width:52px;color:var(--ink-soft);font-size:11px;letter-spacing:.06em;
 text-transform:uppercase;padding-top:2px}
.d dd{margin:0;font-variant-numeric:tabular-nums}
.nota{margin:0;padding:10px 14px 0;font-size:12px;line-height:1.45;color:var(--ink-soft);
 border-top:1px solid var(--line)}
footer{color:var(--ink-soft);font-size:13px;border-top:1px solid var(--line-strong);padding-top:18px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;
 background:var(--surface-high);padding:1px 5px;border-radius:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;

async function main() {
  const filas = parseCsv(await fs.readFile(flags.csv, "utf8"));
  const grupos = new Map<string, Fila[]>();
  for (const f of filas) {
    if (!grupos.has(f.grupo)) grupos.set(f.grupo, []);
    grupos.get(f.grupo)!.push(f);
  }

  // La fila del CSV va anidada y no esparcida: `Fila` es Record<string,string>
  // y su índice choca con `n: number` si se mezclan al mismo nivel.
  type Tarjeta = { grupo: string; n: number; thumbs: string[]; notas: string; csv: Fila };

  const tarjetas: Tarjeta[] = await Promise.all([...grupos.entries()].map(async ([grupo, fs_]) => {
    const thumbs = await Promise.all(fs_.slice(0, flags.max).map(async (f) => {
      const buf = await sharp(path.join(flags.dir, f.archivo))
        .resize(190, 190, { fit: "cover" }).webp({ quality: 70 }).toBuffer();
      return `data:image/webp;base64,${buf.toString("base64")}`;
    }));
    const p = fs_[0];
    // Las notas [auto] las regenera la ingesta en cada corrida y solo ayudan
    // dentro del CSV; aquí estorban, así que se muestran únicamente las que
    // escribió alguien.
    const notas = p.notas.split(";").map((s) => s.trim())
      .filter((s) => s && !s.startsWith("[auto]")).join("; ");
    return { grupo, n: fs_.length, thumbs, notas, csv: p };
  }));

  const falta = (x: Tarjeta) => {
    const f: string[] = [];
    if (!x.csv.modelo) f.push("nombre");
    if (!x.csv.precio) f.push("precio");
    return f;
  };
  // Triage: primero lo que más falta. Ordenar por código dejaría lo pendiente
  // salpicado entre lo ya resuelto.
  const orden = [...tarjetas].sort((a, b) =>
    falta(b).length - falta(a).length || b.n - a.n || a.grupo.localeCompare(b.grupo));

  const sinNombre = tarjetas.filter((x) => !x.csv.modelo).length;
  const sinPrecio = tarjetas.filter((x) => !x.csv.precio).length;
  const listos = tarjetas.filter((x) => falta(x).length === 0).length;
  const fotos = tarjetas.reduce((s, x) => s + x.n, 0);
  const stat = (n: number, l: string, c = "") =>
    `<div class="stat ${c}"><div class="stat-n">${n}</div><div class="stat-l">${l}</div></div>`;

  const cards = orden.map((x) => {
    const f = falta(x);
    const cls = f.length === 0 ? "ok" : f.length === 2 ? "vacio" : "parcial";
    const chips = [
      ...f.map((k) => `<span class="chip falta">falta ${k}</span>`),
      x.csv.categoria ? `<span class="chip cat">${esc(x.csv.categoria)}</span>` : "",
      x.csv.sku ? "" : `<span class="chip neutro">sin SKU</span>`,
      f.length === 0 ? `<span class="chip ok">listo</span>` : "",
    ].filter(Boolean).join("");

    const ds: [string, string][] = [];
    if (x.csv.modelo) ds.push(["nombre", esc(x.csv.modelo)]);
    if (x.csv.sku) ds.push(["sku", esc(x.csv.sku)]);
    if (x.csv.color) ds.push(["color", esc(x.csv.color)]);
    if (x.csv.precio) {
      ds.push(["precio", `$${esc(x.csv.precio)}` +
        (x.csv.unidad_venta ? ` / ${esc(x.csv.unidad_venta)}` : "") +
        (x.csv.piezas_por_unidad ? ` · ${esc(x.csv.piezas_por_unidad)} pz` : "")]);
    }
    const datos = ds.map(([k, v]) => `<div class="d"><dt>${k}</dt><dd>${v}</dd></div>`).join("");

    return `<article class="card ${cls}" data-estado="${cls}">
  <div class="tiras">${x.thumbs.map((s) => `<img src="${s}" alt="" loading="lazy">`).join("")}</div>
  <header class="cab"><h2>${esc(x.grupo)}</h2><span class="n">${x.n}</span></header>
  <div class="chips">${chips}</div>
  ${datos ? `<dl class="datos">${datos}</dl>` : ""}
  ${x.notas ? `<p class="nota">${esc(x.notas)}</p>` : ""}
</article>`;
  }).join("\n");

  const html = `<title>Lote de mercería — revisión de ingesta</title>
<style>${CSS}</style>
<div class="wrap">
  <div class="intro">
    <div class="eyebrow">Lote de ingesta · exposición 200%</div>
    <h1>Mercería: ${sinNombre} productos por nombrar</h1>
    <p class="sub">Las ${fotos} fotos se revelaron de RAW con la exposición al 200%, se
    recortaron al producto y se agruparon en <code>${esc(flags.csv)}</code>. Las flores
    quedan agrupadas por diámetro como <code>Flor con Piedra N</code>, y los códigos
    <code>BO</code> y <code>JR</code> reconocidos como botones y corchetes. Falta lo que
    solo sabe la tienda: cómo se llama cada código y a qué precio se vende.</p>
  </div>
  <div class="stats">
    ${stat(fotos, "fotos")}${stat(tarjetas.length, "grupos")}
    ${stat(sinNombre, "sin nombre", "alerta")}${stat(sinPrecio, "sin precio", "alerta")}
    ${stat(listos, "listos", "bien")}
  </div>
  <div class="barra" role="group" aria-label="Filtrar grupos">
    <button class="f" data-f="todos" aria-pressed="true">Todos</button>
    <button class="f" data-f="vacio" aria-pressed="false">Sin nombre ni precio</button>
    <button class="f" data-f="parcial" aria-pressed="false">A medias</button>
    <button class="f" data-f="ok" aria-pressed="false">Listos</button>
  </div>
  <div class="rejilla">
${cards}
  </div>
  <footer>Orden: primero lo que más falta. El número junto al código es cuántas fotos
  tiene el grupo; se muestran hasta ${flags.max}. Escribir en el CSV es seguro: volver a
  correr <code>pnpm ingest</code> fusiona y no borra lo capturado. Al terminar,
  <code>pnpm ingest --upload</code>.</footer>
</div>
<script>
const bs=[...document.querySelectorAll(".f")],cs=[...document.querySelectorAll(".card")];
bs.forEach(b=>b.addEventListener("click",()=>{
  bs.forEach(o=>o.setAttribute("aria-pressed",String(o===b)));
  const f=b.dataset.f;
  cs.forEach(c=>{c.hidden=f!=="todos"&&c.dataset.estado!==f});
}));
</script>`;

  await fs.writeFile(flags.out, html, "utf8");
  console.log(`\n📄 Hoja de revisión: ${path.resolve(flags.out)}`);
  console.log(`   ${tarjetas.length} grupos · ${sinNombre} sin nombre · ${sinPrecio} sin precio · ${listos} listos\n`);
}

main().catch((e) => { console.error("✖", e.message); process.exit(1); });
