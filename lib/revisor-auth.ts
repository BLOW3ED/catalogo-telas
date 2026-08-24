import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdminEmail, isAllowedRevisorEmail } from "@/lib/admin-allowlist";

/**
 * Autorización del revisor: sesión de Supabase Auth + allowlist `REVISOR_EMAILS`
 * (ver `lib/admin-allowlist.ts`). Un admin también puede entrar a /revision —
 * es un superset de permisos — pero /admin sigue siendo 100% admin-only.
 */
export type SesionRevisor = {
  user: User | null;
  autorizado: boolean;
  esAdmin: boolean;
};

export async function getSesionRevisor(): Promise<SesionRevisor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esAdmin = isAllowedAdminEmail(user?.email, process.env.ADMIN_EMAILS);
  const esRevisor = isAllowedRevisorEmail(user?.email, process.env.REVISOR_EMAILS);

  return {
    user,
    autorizado: esAdmin || esRevisor,
    esAdmin,
  };
}
