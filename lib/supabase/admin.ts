import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE_ROLE: ignora RLS y puede escribir.
 * SOLO para route handlers / server actions del admin y el script de ingesta.
 *
 * `import "server-only"` hace que el build falle si esto se importa
 * accidentalmente desde código de cliente, protegiendo la llave maestra.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
