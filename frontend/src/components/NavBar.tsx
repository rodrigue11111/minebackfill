"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const workflowSteps = [
    { href: "/", label: "1. Informations" },
    { href: "/mix", label: "2. Calculs de mélange" },
  ];

  const utilityLinks = [
    { href: "/formulas", label: "📐 Formules" },
    { href: "/reglages", label: "Réglages" },
  ];

  return (
    <nav
      style={{
        background: "#fff",
        borderBottom: "1px solid var(--border)",
        height: "var(--nav-height)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          fontSize: 15,
          color: "var(--primary)",
          marginRight: "auto",
          userSelect: "none",
        }}
      >
        <span
          style={{
            background: "var(--primary)",
            color: "#fff",
            borderRadius: 6,
            padding: "3px 8px",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.05em",
          }}
        >
          MB
        </span>
        MineBackfill
      </div>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {/* Workflow steps */}
        {workflowSteps.map((step) => {
          const active = pathname === step.href;
          return active ? (
            <span
              key={step.href}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                background: "var(--primary-light)",
                color: "var(--primary)",
                cursor: "default",
              }}
            >
              {step.label}
            </span>
          ) : (
            <Link
              key={step.href}
              href={step.href}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "var(--muted-foreground)",
                textDecoration: "none",
                transition: "background 0.13s, color 0.13s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--muted)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)";
              }}
            >
              {step.label}
            </Link>
          );
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 6px" }} />

        {/* Utility links (Formules + Réglages) */}
        {utilityLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                color: active ? "var(--primary)" : "var(--muted-foreground)",
                background: active ? "var(--primary-light)" : "transparent",
                textDecoration: "none",
                transition: "background 0.13s, color 0.13s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--muted)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--foreground)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)";
                }
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
