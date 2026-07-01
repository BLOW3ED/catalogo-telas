import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para lecturas PÚBLICAS del catálogo (llave anon, sin cookies).
 *
 * A diferencia de `server.ts` (que usa `cookies()` de Next para sesiones), este
 * cliente no toca estado por-request, lo que permite envolver las queries en
 * `unstable_cache` (ver lib/queries.ts) — dentro de una función cacheada no se
 * pueden leer cookies. El catálogo es lectura anónima: no pierde nada.
 *
 * `server.ts` queda reservado para cuando exista el admin con Auth (fase 6).
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
