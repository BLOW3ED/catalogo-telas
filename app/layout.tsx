import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { CartDrawer } from "@/components/CartDrawer";
import { WelcomeGuide } from "@/components/WelcomeGuide";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Telas La Jalisciense — Catálogo",
  description:
    "Catálogo de telas al menudeo en Fresnillo. Chifón, tul, encaje y más.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${anton.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <CartDrawer />
        <WelcomeGuide />
      </body>
    </html>
  );
}
