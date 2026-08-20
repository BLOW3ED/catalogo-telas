import type { NextConfig } from "next";

// La URL del proyecto Supabase se usa para autorizar el dominio de Storage
// en next/image. Derivamos el hostname del .env si está disponible.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  experimental: {
    // Las fotos del admin llegan como FormData a server actions; el default
    // de 1 MB se queda corto para fotos de celular.
    serverActions: { bodySizeLimit: "10mb" },
    // Next 15 pone en 0 el staleTime del Router Cache para páginas dinámicas
    // (como "/", que depende de searchParams): cada "volver" dispara un
    // fetch nuevo y de paso enseña el esqueleto corto de loading.tsx, que
    // colapsa el alto de la página justo cuando el navegador intenta
    // restaurar el scroll. Con esto el cache del router reutiliza la página
    // ya renderizada al volver (alineado al revalidate:60 de
    // paginaCatalogoCached en lib/queries.ts) y el scroll se restaura de
    // verdad.
    staleTimes: { dynamic: 120 },
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
