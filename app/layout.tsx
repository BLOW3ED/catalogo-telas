import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { CartDrawer } from "@/components/CartDrawer";
import { TutorialModal } from "@/components/tutorial/TutorialModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import "./globals.css";

// Tipografía del design system de Stitch "Artisanal Modernity": Hanken Grotesk
// en TODA la jerarquía (display, cuerpo y etiquetas), con los mismos pesos que
// carga Stitch (400/600/700). Los tokens --font-display/--font-body/--font-serif
// de globals.css se conservan y todos apuntan a esta familia.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "600", "700"],
});

// Base absoluta de los metadatos. `app/opengraph-image.png` se anuncia como
// URL COMPLETA: los scrapers de WhatsApp y Facebook no resuelven rutas
// relativas, así que sin esto la miniatura del enlace no carga.
// En producción hay que definir NEXT_PUBLIC_SITE_URL con el dominio real;
// en local cae al dev server. Si la variable trae basura, `new URL` truena
// en el build a propósito: es preferible a publicar enlaces sin miniatura.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Telas La Jalisciense — Catálogo Textil",
  description:
    "Catálogo de telas finas, encajes y mercería de alta calidad en Fresnillo.",
  openGraph: {
    title: "Telas La Jalisciense — Catálogo",
    description:
      "Explora las telas, elige tus metros y manda tu pedido por WhatsApp. Chifón, tul, seda, lino y encajes en Fresnillo.",
    siteName: "Telas La Jalisciense",
    url: siteUrl,
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={hankenGrotesk.variable}>
      <body className="flex min-h-screen flex-col bg-sand-bg text-ink-text font-sans antialiased selection:bg-amber/20 selection:text-ink-display pb-16 sm:pb-0">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <MobileBottomNav />
        <CartDrawer />
        <TutorialModal />
      </body>
    </html>
  );
}

