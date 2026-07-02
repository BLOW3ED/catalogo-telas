"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionAdmin } from "@/lib/admin-auth";
import { STORAGE_BUCKET } from "@/lib/supabase/storage";
import { slugify } from "@/lib/slug";
import { aplicarMovimiento, esTipoMovimiento } from "@/lib/inventario";

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico a propósito: no revelar si el correo existe.
    redirect("/admin/login?error=1");
  }
  redirect("/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Helpers compartidos
// ---------------------------------------------------------------------------

/**
 * Re-verificar SIEMPRE en cada action: las server actions son endpoints
 * públicos; el middleware protege las páginas, no las actions.
 * Devuelve el email del admin (para el kardex de inventario).
 */
async function requireAdmin(): Promise<string> {
  const { user, autorizado } = await getSesionAdmin();
  if (!autorizado) redirect("/admin/login");
  return user?.email ?? "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(valor: FormDataEntryValue | null, campo: string): string {
  const id = String(valor ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Identificador inválido para ${campo}.`);
  return id;
}

/** UUID opcional: "" (opción "— sin —" de un <select>) ⇒ null. */
function uuidOpcional(valor: FormDataEntryValue | null, campo: string): string | null {
  const id = String(valor ?? "").trim();
  if (id === "") return null;
  if (!UUID_RE.test(id)) throw new Error(`Identificador inválido para ${campo}.`);
  return id;
}

/**
 * Campo numérico del formulario → valor para la BD.
 * - Vacío ⇒ null ("precio a consultar" / stock desconocido). NO es cero:
 *   cero significa "gratis" o "sin existencia" y se captura explícito.
 * - Acepta coma o punto decimal ("59,50" y "59.50").
 * - Negativos o no numéricos ⇒ error (la BD también los rechazaría por CHECK).
 */
function parseCampoNumerico(valor: FormDataEntryValue | null, campo: string): number | null {
  const texto = String(valor ?? "").trim();
  if (texto === "") return null;

  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Valor inválido para ${campo}: "${texto}". Usa un número mayor o igual a 0, o déjalo vacío.`);
  }
  return Math.round(n * 100) / 100; // 2 decimales, como numeric(10,2)
}

/** Entero ≥ 0 o null (gramaje). */
function parseEntero(valor: FormDataEntryValue | null, campo: string): number | null {
  const n = parseCampoNumerico(valor, campo);
  return n == null ? null : Math.round(n);
}

/** Texto opcional: recortado; vacío ⇒ null (ej. sku, descripción, alt). */
function textoOpcional(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto === "" ? null : texto;
}

/** El sitio público refleja el cambio al instante (sin esperar el caché de 60s). */
function refrescarCatalogo(telaId?: string) {
  revalidateTag("catalogo");
  revalidatePath("/admin");
  revalidatePath("/admin/inventario");
  if (telaId) revalidatePath(`/admin/tela/${telaId}`);
}

// ---------------------------------------------------------------------------
// Edición rápida de variantes (precio / stock, en /admin)
// ---------------------------------------------------------------------------

export async function actualizarVariante(formData: FormData) {
  const email = await requireAdmin();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");

  const precio_metro = parseCampoNumerico(formData.get("precio_metro"), "precio");
  const stock = parseCampoNumerico(formData.get("stock"), "stock");

  const supabase = createAdminClient();

  // Leer el stock anterior para dejar rastro en el kardex si cambió.
  const { data: antes } = await supabase
    .from("variante")
    .select("stock")
    .eq("id", varianteId)
    .single();

  const { error } = await supabase
    .from("variante")
    .update({ precio_metro, stock })
    .eq("id", varianteId);

  if (error) {
    throw new Error(`No se pudo guardar: ${error.message}`);
  }

  // La edición rápida de stock ES un ajuste: se registra en el kardex para que
  // el historial no tenga huecos. Best-effort: si la tabla aún no existe
  // (sección 10 del SQL sin correr), no rompemos la edición de precio/stock.
  if (antes && antes.stock !== stock && stock != null) {
    await supabase.from("movimiento_inventario").insert({
      variante_id: varianteId,
      tipo: "ajuste",
      cantidad: stock,
      stock_resultante: stock,
      nota: "Edición rápida en /admin",
      usuario_email: email,
    });
  }

  refrescarCatalogo();
}

// ---------------------------------------------------------------------------
// Telas (modelos): crear y editar valores
// ---------------------------------------------------------------------------

export async function crearTela(formData: FormData) {
  await requireAdmin();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre de la tela es obligatorio.");

  const slug = slugify(nombre);
  if (!slug) throw new Error("El nombre debe incluir letras o números para generar su URL.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tela")
    .insert({
      nombre,
      slug,
      descripcion: textoOpcional(formData.get("descripcion")),
      categoria_id: uuidOpcional(formData.get("categoria_id"), "categoría"),
    })
    .select("id")
    .single();

  if (error) {
    const detalle = error.code === "23505" ? `ya existe una tela con la URL "${slug}"` : error.message;
    throw new Error(`No se pudo crear la tela: ${detalle}.`);
  }

  refrescarCatalogo(data.id);
  redirect(`/admin/tela/${data.id}`);
}

export async function actualizarTela(formData: FormData) {
  await requireAdmin();
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre de la tela es obligatorio.");

  const slug = slugify(String(formData.get("slug") ?? "")) || slugify(nombre);
  if (!slug) throw new Error("La URL (slug) no puede quedar vacía.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tela")
    .update({
      nombre,
      slug,
      descripcion: textoOpcional(formData.get("descripcion")),
      categoria_id: uuidOpcional(formData.get("categoria_id"), "categoría"),
    })
    .eq("id", telaId);

  if (error) {
    const detalle = error.code === "23505" ? `ya existe una tela con la URL "${slug}"` : error.message;
    throw new Error(`No se pudo guardar la tela: ${detalle}.`);
  }

  // N:N — reemplazo completo: lo marcado en el formulario es la verdad.
  const casos = formData.getAll("casos_uso").map((v) => requireUuid(v, "caso de uso"));
  const oportunidades = formData.getAll("oportunidades").map((v) => requireUuid(v, "oportunidad"));

  await supabase.from("tela_caso_uso").delete().eq("tela_id", telaId);
  if (casos.length) {
    const { error: e } = await supabase
      .from("tela_caso_uso")
      .insert(casos.map((caso_uso_id) => ({ tela_id: telaId, caso_uso_id })));
    if (e) throw new Error(`No se pudieron guardar los casos de uso: ${e.message}`);
  }

  await supabase.from("tela_oportunidad").delete().eq("tela_id", telaId);
  if (oportunidades.length) {
    const { error: e } = await supabase
      .from("tela_oportunidad")
      .insert(oportunidades.map((oportunidad_id) => ({ tela_id: telaId, oportunidad_id })));
    if (e) throw new Error(`No se pudieron guardar las oportunidades: ${e.message}`);
  }

  refrescarCatalogo(telaId);
}

// ---------------------------------------------------------------------------
// Variantes (SKU/color): alta, edición completa y baja
// ---------------------------------------------------------------------------

/** Campos de variante compartidos entre alta y edición. */
function leerCamposVariante(formData: FormData) {
  return {
    // NUNCA inventar SKU: solo se guarda lo que la tienda capture.
    sku: textoOpcional(formData.get("sku")),
    color_id: uuidOpcional(formData.get("color_id"), "color"),
    acabado_id: uuidOpcional(formData.get("acabado_id"), "acabado"),
    precio_metro: parseCampoNumerico(formData.get("precio_metro"), "precio"),
    gramaje: parseEntero(formData.get("gramaje"), "gramaje"),
    stock: parseCampoNumerico(formData.get("stock"), "stock"),
    es_bordado: formData.get("es_bordado") === "on",
    es_brillante: formData.get("es_brillante") === "on",
    es_traslucida: formData.get("es_traslucida") === "on",
    es_tornasol: formData.get("es_tornasol") === "on",
  };
}

export async function crearVariante(formData: FormData) {
  await requireAdmin();
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("variante")
    .insert({ tela_id: telaId, ...leerCamposVariante(formData) });

  if (error) {
    const detalle = error.code === "23505" ? "ese SKU ya existe en otra variante" : error.message;
    throw new Error(`No se pudo crear la variante: ${detalle}.`);
  }

  refrescarCatalogo(telaId);
}

export async function actualizarVarianteDetalle(formData: FormData) {
  await requireAdmin();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("variante")
    .update(leerCamposVariante(formData))
    .eq("id", varianteId);

  if (error) {
    const detalle = error.code === "23505" ? "ese SKU ya existe en otra variante" : error.message;
    throw new Error(`No se pudo guardar la variante: ${detalle}.`);
  }

  refrescarCatalogo(telaId);
}

export async function eliminarVariante(formData: FormData) {
  await requireAdmin();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const supabase = createAdminClient();

  // Primero las imágenes del bucket (el DELETE en cascada solo borra las
  // filas de `foto`, no los archivos de Storage).
  const { data: fotos } = await supabase
    .from("foto")
    .select("ruta")
    .eq("variante_id", varianteId);

  const rutas = (fotos ?? []).map((f) => f.ruta);
  if (rutas.length) {
    await supabase.storage.from(STORAGE_BUCKET).remove(rutas);
  }

  const { error } = await supabase.from("variante").delete().eq("id", varianteId);
  if (error) throw new Error(`No se pudo eliminar la variante: ${error.message}`);

  refrescarCatalogo(telaId);
}

/**
 * Guarda el orden manual de los colores de una tela: recibe TODOS los ids de
 * variante en el orden deseado (viene del drag & drop del editor). Se llama
 * desde un componente cliente, así que los errores esperables regresan como
 * valor (no throw) para mostrarse sin tirar la página.
 */
export async function reordenarVariantes(
  telaId: string,
  ids: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  if (!UUID_RE.test(telaId)) return { error: "Identificador de tela inválido." };
  if (!ids.length || ids.some((id) => !UUID_RE.test(id))) {
    return { error: "Lista de variantes inválida." };
  }

  const supabase = createAdminClient();

  // El orden solo vale si cubre exactamente las variantes actuales de la tela
  // (evita pisar una variante recién creada en otra pestaña).
  const { data: actuales, error: errorLectura } = await supabase
    .from("variante")
    .select("id")
    .eq("tela_id", telaId);
  if (errorLectura) return { error: `No se pudieron leer las variantes: ${errorLectura.message}` };

  const actualesSet = new Set((actuales ?? []).map((v) => v.id));
  if (actualesSet.size !== ids.length || ids.some((id) => !actualesSet.has(id))) {
    return { error: "La lista de colores cambió. Recarga la página e intenta de nuevo." };
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from("variante").update({ orden: i }).eq("id", ids[i]);
    if (error) {
      const detalle =
        error.code === "42703"
          ? "falta la columna `orden`. Corre la sección 11 de catalogo_telas_supabase.sql en Supabase Studio"
          : error.message;
      return { error: `No se pudo guardar el orden: ${detalle}.` };
    }
  }

  refrescarCatalogo(telaId);
  return {};
}

// ---------------------------------------------------------------------------
// Fotos: subir, eliminar, reordenar
// ---------------------------------------------------------------------------

const EXTENSIONES_IMAGEN: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function subirFotos(formData: FormData) {
  await requireAdmin();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const archivos = formData
    .getAll("fotos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!archivos.length) throw new Error("Selecciona al menos una imagen (JPG, PNG o WebP).");

  const supabase = createAdminClient();

  // Contexto para nombrar el archivo igual que la ingesta: "slug-tela/color-n.ext"
  const { data: contexto } = await supabase
    .from("catalogo_telas")
    .select("tela_slug, color_slug")
    .eq("variante_id", varianteId)
    .single();
  const carpeta = contexto?.tela_slug ?? "sin-modelo";
  const base = contexto?.color_slug ?? "variante";

  const { data: existentes } = await supabase
    .from("foto")
    .select("orden")
    .eq("variante_id", varianteId)
    .order("orden", { ascending: false })
    .limit(1);
  let orden = (existentes?.[0]?.orden ?? -1) + 1;

  for (const archivo of archivos) {
    const ext = EXTENSIONES_IMAGEN[archivo.type];
    if (!ext) {
      throw new Error(`"${archivo.name}" no es JPG, PNG ni WebP. Convierte la imagen e inténtalo de nuevo.`);
    }

    // Timestamp en el nombre → nunca pisa una foto existente en el bucket.
    const ruta = `${carpeta}/${base}-${Date.now()}-${orden}.${ext}`;
    const { error: errorSubida } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (errorSubida) throw new Error(`No se pudo subir "${archivo.name}": ${errorSubida.message}`);

    const { error: errorFila } = await supabase.from("foto").insert({
      variante_id: varianteId,
      ruta,
      orden,
      alt: textoOpcional(formData.get("alt")),
    });
    if (errorFila) {
      // No dejar archivos huérfanos si la fila no se pudo registrar.
      await supabase.storage.from(STORAGE_BUCKET).remove([ruta]);
      throw new Error(`La imagen subió pero no se pudo registrar: ${errorFila.message}`);
    }
    orden += 1;
  }

  refrescarCatalogo(telaId);
}

export async function eliminarFoto(formData: FormData) {
  await requireAdmin();
  const fotoId = requireUuid(formData.get("foto_id"), "foto");
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const supabase = createAdminClient();
  const { data: foto } = await supabase.from("foto").select("ruta").eq("id", fotoId).single();

  const { error } = await supabase.from("foto").delete().eq("id", fotoId);
  if (error) throw new Error(`No se pudo eliminar la foto: ${error.message}`);

  if (foto?.ruta) {
    await supabase.storage.from(STORAGE_BUCKET).remove([foto.ruta]);
  }

  refrescarCatalogo(telaId);
}

/**
 * Mueve una foto un lugar hacia el inicio ("subir") o el final ("bajar") y
 * normaliza `orden` a 0..n-1. La foto con orden 0 es la principal en el
 * catálogo (la vista toma la de menor orden).
 */
export async function moverFoto(formData: FormData) {
  await requireAdmin();
  const fotoId = requireUuid(formData.get("foto_id"), "foto");
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");
  const direccion = String(formData.get("direccion") ?? "");
  if (direccion !== "subir" && direccion !== "bajar") throw new Error("Dirección inválida.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("foto")
    .select("id, orden")
    .eq("variante_id", varianteId)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No se pudo leer el orden de fotos: ${error.message}`);

  const fotos = data ?? [];
  const i = fotos.findIndex((f) => f.id === fotoId);
  if (i === -1) throw new Error("La foto ya no existe.");

  const j = direccion === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= fotos.length) return; // ya está en el extremo: nada que hacer

  [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
  for (let k = 0; k < fotos.length; k++) {
    if (fotos[k].orden === k) continue;
    const { error: e } = await supabase.from("foto").update({ orden: k }).eq("id", fotos[k].id);
    if (e) throw new Error(`No se pudo reordenar: ${e.message}`);
  }

  refrescarCatalogo(telaId);
}

// ---------------------------------------------------------------------------
// Inventario: kardex de movimientos
// ---------------------------------------------------------------------------

/**
 * Registra un movimiento (entrada/salida/merma/ajuste) y actualiza el stock
 * de la variante. Los errores esperables (stock insuficiente, cantidad
 * inválida) regresan por querystring: son flujo normal de captura, no un
 * fallo del sistema.
 */
export async function registrarMovimiento(formData: FormData) {
  const email = await requireAdmin();

  const errorCaptura = (mensaje: string): never =>
    redirect(`/admin/inventario?error=${encodeURIComponent(mensaje)}`);

  const varianteId = String(formData.get("variante_id") ?? "");
  if (!UUID_RE.test(varianteId)) errorCaptura("Selecciona una variante.");

  const tipo = String(formData.get("tipo") ?? "");
  if (!esTipoMovimiento(tipo)) errorCaptura("Selecciona el tipo de movimiento.");
  if (!esTipoMovimiento(tipo)) return; // narrowing para TS; errorCaptura ya redirigió

  const textoCantidad = String(formData.get("cantidad") ?? "").trim();
  const cantidad = Number(textoCantidad.replace(",", "."));
  if (textoCantidad === "" || !Number.isFinite(cantidad) || cantidad < 0) {
    errorCaptura(`Cantidad inválida: "${textoCantidad}". Usa un número mayor o igual a 0.`);
  }

  const supabase = createAdminClient();
  const { data: variante, error: errorLectura } = await supabase
    .from("variante")
    .select("stock")
    .eq("id", varianteId)
    .single();
  if (errorLectura || !variante) errorCaptura("La variante ya no existe.");

  let stockResultante: number;
  try {
    stockResultante = aplicarMovimiento(variante!.stock, tipo, cantidad);
  } catch (e) {
    errorCaptura(e instanceof Error ? e.message : String(e));
    return;
  }

  const { error: errorStock } = await supabase
    .from("variante")
    .update({ stock: stockResultante })
    .eq("id", varianteId);
  if (errorStock) throw new Error(`No se pudo actualizar el stock: ${errorStock.message}`);

  const { error: errorKardex } = await supabase.from("movimiento_inventario").insert({
    variante_id: varianteId,
    tipo,
    cantidad: Math.round(cantidad * 100) / 100,
    stock_resultante: stockResultante,
    nota: textoOpcional(formData.get("nota")),
    usuario_email: email,
  });
  if (errorKardex) {
    throw new Error(
      `El stock se actualizó, pero el movimiento no quedó en el historial: ${errorKardex.message}. ` +
        `¿Ya corriste la sección 10 de catalogo_telas_supabase.sql en Supabase Studio?`
    );
  }

  refrescarCatalogo();
  redirect("/admin/inventario?ok=1");
}
