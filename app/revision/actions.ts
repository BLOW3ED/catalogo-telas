"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionRevisor } from "@/lib/revisor-auth";
import { slugify } from "@/lib/slug";

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------
// Duplicados de app/admin/actions.ts (no compartidos): esos redirigen a
// /admin hardcodeado. Mismo patrón, distinto destino.

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/revision/login?error=1");
  }
  redirect("/revision");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/revision/login");
}

/**
 * Re-verificar SIEMPRE en cada action: las server actions son endpoints
 * públicos; el middleware protege las páginas, no las actions (mismo
 * comentario que `requireAdmin` en app/admin/actions.ts).
 */
async function requireRevisor(): Promise<void> {
  const { autorizado } = await getSesionRevisor();
  if (!autorizado) redirect("/revision/login");
}

// ---------------------------------------------------------------------------
// Helpers de parseo — duplicados mínimos de app/admin/actions.ts: esos son
// privados a un módulo "use server" (todo export ahí debe ser una action
// async), así que no se pueden importar. Son puro parseo, sin lógica de
// negocio, y son ~10 líneas: no vale la pena un módulo compartido por esto.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;

function requireUuid(valor: FormDataEntryValue | null, campo: string): string {
  const id = String(valor ?? "");
  if (!UUID_RE.test(id)) throw new Error(`Identificador inválido para ${campo}.`);
  return id;
}

function uuidOpcional(valor: FormDataEntryValue | null, campo: string): string | null {
  const id = String(valor ?? "").trim();
  if (id === "") return null;
  if (!UUID_RE.test(id)) throw new Error(`Identificador inválido para ${campo}.`);
  return id;
}

/** Texto opcional: recortado; vacío ⇒ null. */
function textoOpcional(valor: FormDataEntryValue | null): string | null {
  const texto = String(valor ?? "").trim();
  return texto === "" ? null : texto;
}

function parseCampoNumerico(valor: FormDataEntryValue | null, campo: string): number | null {
  const texto = String(valor ?? "").trim();
  if (texto === "") return null;

  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Valor inválido para ${campo}: "${texto}". Usa un número mayor o igual a 0, o déjalo vacío.`);
  }
  return Math.round(n * 100) / 100;
}

/**
 * El sitio público, /admin y /revision reflejan el cambio al instante —un
 * cambio del revisor se ve igual de inmediato que uno del admin, mismos
 * paths que `refrescarCatalogo` en app/admin/actions.ts más los de /revision.
 */
function refrescarRevision(telaId?: string) {
  revalidateTag("catalogo");
  revalidatePath("/admin");
  revalidatePath("/revision");
  if (telaId) {
    revalidatePath(`/admin/tela/${telaId}`);
    revalidatePath(`/revision/producto/${telaId}`);
  }
}

// ---------------------------------------------------------------------------
// Acciones — cada una actualiza SOLO las columnas permitidas al revisor,
// nunca reusa leerCamposVariante/actualizarVarianteDetalle de /admin (esas
// también tocan stock, acabado_id y propiedades ópticas).
// ---------------------------------------------------------------------------

export async function actualizarNombreProducto(formData: FormData) {
  await requireRevisor();
  const telaId = requireUuid(formData.get("tela_id"), "tela");
  const nombre = textoOpcional(formData.get("nombre"));
  if (!nombre) throw new Error("El nombre del producto no puede quedar vacío.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("tela").update({ nombre }).eq("id", telaId);
  if (error) throw new Error(`No se pudo guardar el nombre: ${error.message}.`);

  refrescarRevision(telaId);
}

export async function actualizarVarianteRevision(formData: FormData) {
  await requireRevisor();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");

  const cambios = {
    sku: textoOpcional(formData.get("sku")),
    color_id: uuidOpcional(formData.get("color_id"), "color"),
    precio: parseCampoNumerico(formData.get("precio"), "precio"),
    medida: textoOpcional(formData.get("medida")),
    nota: textoOpcional(formData.get("nota")),
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from("variante").update(cambios).eq("id", varianteId);

  if (error) {
    const detalle = error.code === "23505" ? "ese SKU ya existe en otra variante" : error.message;
    throw new Error(`No se pudo guardar la variante: ${detalle}.`);
  }

  refrescarRevision(telaId);
}

export async function marcarRevisado(formData: FormData) {
  await requireRevisor();
  const varianteId = requireUuid(formData.get("variante_id"), "variante");
  const telaId = requireUuid(formData.get("tela_id"), "tela");
  const revisado = formData.get("revisado") === "on";

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("variante")
    .update({ revisado_en: revisado ? new Date().toISOString() : null })
    .eq("id", varianteId);

  if (error) throw new Error(`No se pudo actualizar el estado de revisión: ${error.message}.`);

  refrescarRevision(telaId);
}

/**
 * Alta de color desde /revision cuando el que hace falta no está en la lista.
 * NO renombra colores existentes (compartidos entre variantes) — eso queda
 * fuera de alcance a propósito, ver CLAUDE.md.
 */
export async function crearColor(formData: FormData) {
  await requireRevisor();
  const nombre = textoOpcional(formData.get("nombre"));
  const hex = String(formData.get("hex") ?? "").trim();

  if (!nombre) throw new Error("El nombre del color no puede quedar vacío.");
  if (!HEX_RE.test(hex)) throw new Error(`Color inválido: "${hex}". Usa el selector de tono.`);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("color")
    .insert({ nombre, slug: slugify(nombre), hex: hex.toLowerCase() })
    .select("id, nombre, slug, hex")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Ya existe un color llamado "${nombre}" — selecciónalo de la lista.`);
    }
    throw new Error(`No se pudo crear el color: ${error.message}.`);
  }

  revalidatePath("/revision", "layout");
  return data;
}
