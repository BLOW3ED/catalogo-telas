import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

/**
 * Autorización del admin: sesión de Supabase Auth + allowlist de correos
 * (ver `lib/admin-allowlist.ts`).
 *
 * La sesión sola NO basta: un proyecto de Supabase permite sign-up público
 * por default, así que cualquiera podría crearse una cuenta. `ADMIN_EMAILS`
 * (variable SOLO de servidor) define quién administra.
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

  return {
    user,
    autorizado: isAllowedAdminEmail(user?.email, process.env.ADMIN_EMAILS),
  };
}
