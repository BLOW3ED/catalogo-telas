import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para componentes cliente ("use client").
 * Solo llave ANON pública. Nunca el service_role aquí.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
