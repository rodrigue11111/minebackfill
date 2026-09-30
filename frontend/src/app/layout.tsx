import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import BarreHaut from "@/components/ui/BarreHaut";
import BarreOnglets from "@/components/ui/BarreOnglets";
import GlobalInputEnhancer from "@/components/GlobalInputEnhancer";
import StoreHydrator from "@/components/StoreHydrator";
import CloudSync from "@/components/CloudSync";
import AlerteStockage from "@/components/AlerteStockage";
import BandeauSynchro from "@/components/BandeauSynchro";
import { APP_NAME } from "@/lib/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Calcul des remblais miniers cimentés`,
  description: "Calcul des mélanges de remblais miniers cimentés (RPC, RPG, RRC) et suivi du laboratoire",
};

// Téléphone : le contenu va jusqu'aux bords (encoche, barre du bas) et la
// barre d'onglets réserve la zone de sécurité (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFBFD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <GlobalInputEnhancer />
        <StoreHydrator />
        <CloudSync />
        <BarreHaut />
        <AlerteStockage />
        <BandeauSynchro />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {children}
        </div>
        <BarreOnglets />
      </body>
    </html>
  );
}
