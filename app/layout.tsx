import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { CartDrawer } from "@/components/CartDrawer";
import { TutorialModal } from "@/components/tutorial/TutorialModal";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import "./globals.css";

// Hanken Grotesk: fuente principal del sistema "Artisanal Modernity" de Stitch.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Telas La Jalisciense — Catálogo Textil",
  description:
    "Catálogo de telas finas, encajes y mercería de alta calidad en Fresnillo.",
  openGraph: {
    title: "Telas La Jalisciense — Catálogo",
    description:
      "Explora las telas, elige tus metros y manda tu pedido por WhatsApp. Chifón, tul, seda, lino y encajes en Fresnillo.",
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
      <body className="flex min-h-screen flex-col bg-sand-bg text-ink-text antialiased selection:bg-accent-copper/20 selection:text-heritage-navy pb-16 sm:pb-0">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <MobileBottomNav />
        <CartDrawer />
        <TutorialModal />
      </body>
    </html>
  );
}

