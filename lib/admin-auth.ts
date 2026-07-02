import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Autorización del admin: sesión de Supabase Auth + allowlist de correos.
 *
 * La sesión sola NO basta: un proyecto de Supabase permite sign-up público
 * por default, así que cualquiera podría crearse una cuenta. `ADMIN_EMAILS`
 * (variable SOLO de servidor, separada por comas) define quién administra.
 * Sin allowlist configurada, nadie está autorizado — seguro por default.
 */
export type SesionAdmin = {
  user: User | null;
  autorizado: boolean;
};

export async function getSesionAdmin(): Promise<SesionAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { user: null, autorizado: false };

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    user,
    autorizado: allowlist.includes(user.email.toLowerCase()),
  };
}
