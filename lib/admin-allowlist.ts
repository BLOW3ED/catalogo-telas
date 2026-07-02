/**
 * Regla de negocio del allowlist de administradores, separada de `admin-auth.ts`
 * para poder probarla sin depender de Supabase/Next (cookies, sesión, etc.).
 *
 * Sin allowlist configurada (`allowlist` vacío/undefined), nadie está
 * autorizado — seguro por default.
 */
export function isAllowedAdminEmail(
  email: string | null | undefined,
  allowlist: string | undefined
): boolean {
  if (!email) return false;

  const emails = (allowlist ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return emails.includes(email.toLowerCase());
}
