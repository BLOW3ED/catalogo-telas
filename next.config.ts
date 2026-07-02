import type { NextConfig } from "next";

// La URL del proyecto Supabase se usa para autorizar el dominio de Storage
// en next/image. Derivamos el hostname del .env si está disponible.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  // Las fotos del admin llegan como FormData a server actions; el default de
  // 1 MB se queda corto para fotos de celular.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
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
