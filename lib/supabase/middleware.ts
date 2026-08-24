import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refresca la sesión de Supabase en cada request a /admin o /revision y
 * redirige a SU PROPIO login si no hay usuario. Patrón estándar de
 * @supabase/ssr: el middleware es el único lugar donde SIEMPRE se pueden
 * escribir cookies, así que aquí se renueva el token antes de que caduque.
 *
 * Solo corre bajo /admin y /revision (ver matcher en middleware.ts): el
 * catálogo público no paga este costo.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No usar getSession() aquí: getUser() valida el token contra Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Dos zonas protegidas con logins DISTINTOS (/admin y /revision comparten
  // el mismo backend de Auth, pero cada una redirige a su propia pantalla).
  const esRevision = request.nextUrl.pathname.startsWith("/revision");
  const esLogin = esRevision
    ? request.nextUrl.pathname.startsWith("/revision/login")
    : request.nextUrl.pathname.startsWith("/admin/login");

  if (!user && !esLogin) {
    const url = request.nextUrl.clone();
    url.pathname = esRevision ? "/revision/login" : "/admin/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
