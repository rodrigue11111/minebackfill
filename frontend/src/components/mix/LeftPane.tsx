// src/components/mix/LeftPane.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore, type Category, type RpcMethod } from "@/lib/store";

const CATEGORIES: { id: Category; label: string; desc: string; disabled?: boolean }[] = [
  { id: "RPC", label: "RPC", desc: "Remblai en pate cimente" },
  { id: "RPG", label: "RPG", desc: "Remblai pate granulaire" },
  { id: "RRC", label: "RRC", desc: "A venir", disabled: true },
];

const METHODS: { id: RpcMethod; label: string; desc: string; rpcOnly?: boolean }[] = [
  { id: "dosage_cw", label: "Dosage Cw (%)", desc: "% solide massique fixe" },
  { id: "wb", label: "Rapport E/C", desc: "Rapport eau / ciment" },
  { id: "slump", label: "Ajustement slump", desc: "Correction par affaissement", rpcOnly: true },
  { id: "essai", label: "Essai-erreur", desc: "Ajustements manuels" },
];

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--primary)",
  marginBottom: 8,
  paddingLeft: 2,
};

export default function LeftPane() {
  const { category, setCategory, method, setMethod, loadGeneral, general, fillTestData } = useStore() as any;
  const [testLoaded, setTestLoaded] = useState(false);

  useEffect(() => {
    loadGeneral();
  }, [loadGeneral]);

  const handleCategoryClick = (c: Category) => {
    setCategory(c);
    if (c === "RPG") setMethod("dosage_cw");
  };

  const availableMethods =
    category === "RPG" ? METHODS.filter((m) => !m.rpcOnly) : METHODS;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
      }}
    >
      {/* ── Top accent bar ── */}
      <div style={{ height: 3, background: "var(--primary)", flexShrink: 0 }} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 14px" }}>

        {/* ── Category ── */}
        <div style={{ marginBottom: 22 }}>
          <p style={SECTION_LABEL}>Categorie</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={cat.disabled}
                  onClick={() => !cat.disabled && handleCategoryClick(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 11px",
                    borderRadius: 7,
                    border: active ? "1.5px solid var(--primary)" : "1.5px solid transparent",
                    background: active ? "var(--primary-light)" : "transparent",
                    cursor: cat.disabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    opacity: cat.disabled ? 0.4 : 1,
                    transition: "all 0.13s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !cat.disabled)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-light)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: active ? "var(--primary)" : "#cbd5e1",
                      flexShrink: 0,
                      transition: "background 0.13s",
                    }}
                  />
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: active ? 700 : 600,
                        color: active ? "var(--primary)" : "#374151",
                      }}
                    >
                      {cat.label}
                    </span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>
                      {cat.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />

        {/* ── Methods ── */}
        <div style={{ marginBottom: 12 }}>
          <p style={SECTION_LABEL}>Methode de calcul</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {availableMethods.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 11px",
                    borderRadius: 7,
                    border: active ? "1.5px solid var(--primary)" : "1.5px solid transparent",
                    background: active ? "var(--primary-light)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.13s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-light)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: active ? "var(--primary)" : "#cbd5e1",
                      flexShrink: 0,
                      transition: "background 0.13s",
                    }}
                  />
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        color: active ? "var(--primary)" : "#374151",
                      }}
                    >
                      {m.label}
                    </span>
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>
                      {m.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Project info footer ── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "14px",
          background: "var(--primary-light)",
          flexShrink: 0,
        }}
      >
        <p style={SECTION_LABEL}>Projet</p>
        {general?.operator_name || general?.project_name || general?.residue_id ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
            {general.operator_name && (
              <div style={{ fontSize: 11.5, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Operateur : </span>
                {general.operator_name}
              </div>
            )}
            {general.project_name && (
              <div style={{ fontSize: 11.5, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Projet : </span>
                {general.project_name}
              </div>
            )}
            {general.residue_id && (
              <div style={{ fontSize: 11.5, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Residu : </span>
                {general.residue_id}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 10 }}>
            Aucune information renseignee.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              try {
                fillTestData();
                setTestLoaded(true);
                setTimeout(() => setTestLoaded(false), 2000);
              } catch (err) {
                console.error("[fillTestData] error:", err);
              }
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "6px 12px",
              borderRadius: 6,
              border: testLoaded ? "1px solid #22c55e" : "1px dashed var(--border)",
              fontSize: 12,
              color: testLoaded ? "#16a34a" : "var(--muted-foreground)",
              background: testLoaded ? "#f0fdf4" : "#f8fafc",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            {testLoaded ? "Valeurs chargees !" : "Valeurs de test"}
          </button>
          <Link
            href="/"
            style={{
              display: "block",
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--primary-mid)",
              fontSize: 12,
              color: "var(--primary)",
              textDecoration: "none",
              textAlign: "center",
              background: "#fff",
              fontWeight: 500,
            }}
          >
            Modifier les informations
          </Link>
          <Link
            href="/reglages"
            style={{
              display: "block",
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--muted-foreground)",
              textDecoration: "none",
              textAlign: "center",
              background: "#fff",
            }}
          >
            Reglages
          </Link>
        </div>
      </div>
    </div>
  );
}
