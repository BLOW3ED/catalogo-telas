/**
 * Regla de negocio de los allowlists de acceso (`ADMIN_EMAILS`, `REVISOR_EMAILS`),
 * separada de `admin-auth.ts`/`revisor-auth.ts` para poder probarla sin
 * depender de Supabase/Next (cookies, sesión, etc.).
 *
 * Sin allowlist configurada (`allowlist` vacío/undefined), nadie está
 * autorizado — seguro por default.
 */
function isEmailInList(
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

export function isAllowedAdminEmail(
  email: string | null | undefined,
  allowlist: string | undefined
): boolean {
  return isEmailInList(email, allowlist);
}

/** Igual que `isAllowedAdminEmail`, contra el allowlist `REVISOR_EMAILS`. */
export function isAllowedRevisorEmail(
  email: string | null | undefined,
  allowlist: string | undefined
): boolean {
  return isEmailInList(email, allowlist);
}
