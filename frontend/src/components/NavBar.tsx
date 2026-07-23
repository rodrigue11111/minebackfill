"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, PORTAIL_LABEL, PORTAIL_URL } from "@/lib/branding";
import { useStore } from "@/lib/store";
import { cloudConfigure } from "@/lib/supabase";
import { useHydrated } from "@/lib/use-hydrated";

const NAV_LINKS = [
  { href: "/", label: "Informations", step: "01" },
  { href: "/mix", label: "Calculs", step: "02" },
  { href: "/industrie", label: "Industrie", step: "03" },
  { href: "/analyse", label: "Analyse", step: null },
  { href: "/formulas", label: "Formules", step: null },
  { href: "/historique", label: "Historique", step: null },
  { href: "/guide", label: "Guide", step: null },
  { href: "/reglages", label: "Réglages", step: null },
];

export default function NavBar() {
  const pathname = usePathname();
  const session = useStore((s) => s.session);
  // Anti-mismatch d'hydratation : le lien Compte et l'indicateur ne sont rendus
  // qu'après l'hydratation client, et seulement si la synchronisation en ligne
  // est configurée.
  const afficherCompte = useHydrated() && cloudConfigure();

  return (
    <nav
      style={{
        background: "var(--navy)",
        height: "var(--nav-height)",
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 2px 12px rgba(12, 30, 66, 0.35)",
        flexShrink: 0,
        gap: 0,
      }}
    >
      {/* ── Brand ── */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          marginRight: 32,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {/* Icon mark */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {/* Simple mine/pillar SVG icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="9" width="2.5" height="6" rx="1" fill="white" opacity="0.9"/>
            <rect x="6.75" y="5" width="2.5" height="10" rx="1" fill="white"/>
            <rect x="10.5" y="7" width="2.5" height="8" rx="1" fill="white" opacity="0.9"/>
            <rect x="2" y="2" width="12" height="2" rx="1" fill="white" opacity="0.6"/>
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.01em",
              lineHeight: 1.1,
            }}
          >
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 500,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            Mix Design Tool
          </div>
        </div>
      </Link>

      {/* ── Navigation links ── */}
      <div className="nav-links" style={{ display: "flex", gap: 2, alignItems: "center", flex: 1 }}>
        {NAV_LINKS.map((link, idx) => {
          const active = pathname === link.href;
          const isWorkflow = link.step !== null;

          // Divider before utility links
          const prevIsWorkflow = idx > 0 && NAV_LINKS[idx - 1].step !== null;
          const showDivider = !isWorkflow && prevIsWorkflow;

          return (
            <div key={link.href} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {showDivider && (
                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: "rgba(255,255,255,0.15)",
                    margin: "0 8px",
                  }}
                />
              )}
              <Link
                href={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 13px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#fff" : "rgba(255,255,255,0.65)",
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  textDecoration: "none",
                  transition: "background 0.13s, color 0.13s",
                  border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.65)";
                  }
                }}
              >
                {link.step && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {link.step}
                  </span>
                )}
                {link.label}
              </Link>
            </div>
          );
        })}
      </div>

      {/* ── Bascule vers le portail des projets (CPB Cockpit, etc.) ── */}
      <a
        href={PORTAIL_URL}
        title="Portail des projets — basculer vers une autre application"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          borderRadius: 6,
          fontSize: 12.5,
          fontWeight: 600,
          color: "rgba(255,255,255,0.65)",
          textDecoration: "none",
          border: "1px solid rgba(255,255,255,0.18)",
          marginLeft: 12,
          flexShrink: 0,
          whiteSpace: "nowrap",
          transition: "background 0.13s, color 0.13s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.65)";
        }}
      >
        {/* Icône « grille d'applications » */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.9" />
          <rect x="7.1" y="0.5" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="0.5" y="7.1" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="7.1" y="7.1" width="4.4" height="4.4" rx="1" fill="currentColor" opacity="0.9" />
        </svg>
        {PORTAIL_LABEL}
      </a>

      {/* ── Version tag ── */}
      <div
        className="nav-version"
        style={{
          fontSize: 10.5,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.05em",
          fontWeight: 500,
          marginLeft: 12,
          flexShrink: 0,
        }}
      >
        MODULE 1
      </div>

      {/* ── Compte (si synchronisation configurée) ── */}
      {afficherCompte && (
        <Link
          href="/compte"
          title={session ? `${session.email} (${session.role === "prof" ? "Enseignant" : "Étudiant"})` : "Se connecter"}
          style={{
            display: "flex", alignItems: "center", gap: 7, marginLeft: 12,
            padding: "4px 10px 4px 6px", borderRadius: 999,
            border: `1px solid ${pathname === "/compte" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}`,
            background: pathname === "/compte" ? "rgba(255,255,255,0.12)" : "transparent",
            textDecoration: "none", flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: session ? (session.role === "prof" ? "#f59e0b" : "var(--primary)") : "rgba(255,255,255,0.2)",
              color: "#fff", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {session ? (session.email?.[0]?.toUpperCase() ?? "?") : "•"}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
            {session ? (session.role === "prof" ? "Prof" : "Compte") : "Compte"}
          </span>
        </Link>
      )}
    </nav>
  );
}
