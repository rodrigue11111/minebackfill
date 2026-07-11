import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import NavBar from "@/components/NavBar";
import GlobalInputEnhancer from "@/components/GlobalInputEnhancer";
import StoreHydrator from "@/components/StoreHydrator";
import { APP_NAME, APP_NAME_VERSION, MODULE_ID, MODULE_LABEL } from "@/lib/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Outil de dimensionnement`,
  description: "Outil de calcul des mélanges de remblai cimenté en pâte",
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
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <GlobalInputEnhancer />
        <StoreHydrator />
        <NavBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {children}
        </div>
        {/* ── Desktop status bar ── */}
        <footer className="status-bar">
          <span className="status-bar-dot" />
          <span>{APP_NAME_VERSION}</span>
          <span className="status-bar-sep" />
          <span>{MODULE_ID} — {MODULE_LABEL}</span>
          <span style={{ marginLeft: "auto" }}>Desktop</span>
        </footer>
      </body>
    </html>
  );
}
