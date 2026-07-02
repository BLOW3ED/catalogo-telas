"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSesionAdmin } from "@/lib/admin-auth";

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
// Edición de variantes (precio / stock)
// ---------------------------------------------------------------------------

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

export async function actualizarVariante(formData: FormData) {
  // Re-verificar SIEMPRE aquí: las server actions son endpoints públicos;
  // el middleware protege las páginas, no las actions.
  const { autorizado } = await getSesionAdmin();
  if (!autorizado) redirect("/admin/login");

  const varianteId = String(formData.get("variante_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(varianteId)) {
    throw new Error("Identificador de variante inválido.");
  }

  const precio_metro = parseCampoNumerico(formData.get("precio_metro"), "precio");
  const stock = parseCampoNumerico(formData.get("stock"), "stock");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("variante")
    .update({ precio_metro, stock })
    .eq("id", varianteId);

  if (error) {
    throw new Error(`No se pudo guardar: ${error.message}`);
  }

  // El sitio público refleja el cambio al instante (sin esperar los 60s del
  // caché) y el admin re-renderiza con los valores recién guardados.
  revalidateTag("catalogo");
  revalidatePath("/admin");
}
