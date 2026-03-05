"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Informations", step: "01" },
  { href: "/mix", label: "Calculs", step: "02" },
  { href: "/industrie", label: "Industrie", step: "03" },
  { href: "/formulas", label: "Formules", step: null },
  { href: "/historique", label: "Historique", step: null },
  { href: "/guide", label: "Guide", step: null },
  { href: "/reglages", label: "Réglages", step: null },
];

export default function NavBar() {
  const pathname = usePathname();

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
            MineBackfill
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
      <div style={{ display: "flex", gap: 2, alignItems: "center", flex: 1 }}>
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

      {/* ── Version tag ── */}
      <div
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
    </nav>
  );
}
