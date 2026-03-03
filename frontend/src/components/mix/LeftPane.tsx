// src/components/mix/LeftPane.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useStore, type Category, type RpcMethod } from "@/lib/store";

const CATEGORIES: { id: Category; label: string; desc: string; disabled?: boolean }[] = [
  { id: "RPC", label: "RPC", desc: "Remblai en pâte cimenté" },
  { id: "RPG", label: "RPG", desc: "Remblai pâte granulaires" },
  { id: "RRC", label: "RRC", desc: "À venir", disabled: true },
];

const METHODS: { id: RpcMethod; label: string; desc: string; rpcOnly?: boolean }[] = [
  { id: "dosage_cw", label: "Dosage Cw (%)", desc: "% solide massique fixe" },
  { id: "wb", label: "Rapport E/C", desc: "Rapport eau / ciment" },
  { id: "slump", label: "Ajust. slump", desc: "Ajustement par affaissement", rpcOnly: true },
  { id: "essai", label: "Essai-erreur", desc: "Ajustements manuels" },
];

export default function LeftPane() {
  const { category, setCategory, method, setMethod, loadGeneral, general } = useStore();

  useEffect(() => {
    loadGeneral();
  }, [loadGeneral]);

  const handleCategoryClick = (c: Category) => {
    setCategory(c);
    if (c === "RPG") setMethod("dosage_cw");
  };

  const availableMethods =
    category === "RPG"
      ? METHODS.filter((m) => !m.rpcOnly)
      : METHODS;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "20px 16px",
        gap: 0,
      }}
    >
      {/* ── Category ── */}
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
            marginBottom: 8,
          }}
        >
          Catégorie
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "9px 12px",
                  borderRadius: 7,
                  border: active ? "1.5px solid var(--primary)" : "1.5px solid transparent",
                  background: active ? "var(--primary-light)" : "transparent",
                  cursor: cat.disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: cat.disabled ? 0.45 : 1,
                  transition: "all 0.13s",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!active && !cat.disabled) {
                    (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: active ? "var(--primary)" : "#374151",
                  }}
                >
                  {cat.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {cat.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Method ── */}
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
            marginBottom: 8,
          }}
        >
          Méthode de calcul
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {availableMethods.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "9px 12px",
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
                    (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--primary)" : "#374151",
                  }}
                >
                  {m.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                  {m.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Project Info ── */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 16,
          borderTop: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted-foreground)",
            marginBottom: 8,
          }}
        >
          Projet
        </p>
        {general?.operator_name || general?.project_name || general?.residue_id ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {general.operator_name && (
              <div style={{ fontSize: 11.5, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Opérateur : </span>
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
                <span style={{ color: "var(--muted-foreground)" }}>Résidu : </span>
                {general.residue_id}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
            Aucune information chargée.
          </p>
        )}
        <Link
          href="/"
          style={{
            display: "block",
            marginTop: 10,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "#374151",
            textDecoration: "none",
            textAlign: "center",
            background: "#f8fafc",
          }}
        >
          Modifier les informations
        </Link>
        <Link
          href="/reglages"
          style={{
            display: "block",
            marginTop: 8,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "#374151",
            textDecoration: "none",
            textAlign: "center",
            background: "#fff",
          }}
        >
          Réglages des constantes
        </Link>
      </div>
    </div>
  );
}
