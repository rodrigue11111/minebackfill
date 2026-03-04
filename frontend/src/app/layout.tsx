import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import NavBar from "@/components/NavBar";
import GlobalInputEnhancer from "@/components/GlobalInputEnhancer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MineBackfill — Outil de dimensionnement",
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
        <NavBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {children}
        </div>
        {/* ── Desktop status bar ── */}
        <footer className="status-bar">
          <span className="status-bar-dot" />
          <span>MineBackfill v1.0</span>
          <span className="status-bar-sep" />
          <span>Module 1 — Dimensionnement des melanges</span>
          <span style={{ marginLeft: "auto" }}>Desktop</span>
        </footer>
      </body>
    </html>
  );
}
