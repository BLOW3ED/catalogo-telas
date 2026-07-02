import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { CartDrawer } from "@/components/CartDrawer";
import { WelcomeGuide } from "@/components/WelcomeGuide";
import "./globals.css";

// Fraunces: serif editorial variable — display/headlines ("The Atelier").
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

// Karla: sans variable — cuerpo, labels y UI.
const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Telas La Jalisciense — Catálogo",
  description:
    "Catálogo de telas al menudeo en Fresnillo. Chifón, tul, encaje y más.",
  // Preview al compartir la portada por WhatsApp (el "camino de venta").
  openGraph: {
    title: "Telas La Jalisciense — Catálogo",
    description:
      "Explora las telas, elige tus metros y manda tu pedido por WhatsApp. Chifón, tul, encaje y más en Fresnillo.",
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
    <html lang="es" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <CartDrawer />
        <WelcomeGuide />
      </body>
    </html>
  );
}
