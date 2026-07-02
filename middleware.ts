import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Solo el admin necesita sesión; el catálogo público queda fuera.
  matcher: ["/admin/:path*"],
};
