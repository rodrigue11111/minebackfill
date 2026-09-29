// Petits éléments partagés du tableau de bord de l'enseignant (/classe).

import type React from "react";

/** Une couleur par étudiant (figure, pastilles). */
export const COULEURS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f", "#0f766e", "#9333ea"];

export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-CA");
}

export function dateHeure(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

/** Nombre à la française (virgule), « — » si absent. */
export function nombre(v: number | null | undefined, decimales = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-CA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function Pastille({ children, ton = "gris", title }: {
  children: React.ReactNode;
  ton?: "gris" | "ambre" | "rouge" | "bleu" | "vert" | "violet";
  title?: string;
}) {
  const t = {
    gris: ["#f1f5f9", "#e2e8f0", "#475569"],
    ambre: ["#fffbeb", "#fde68a", "#92400e"],
    rouge: ["#fef2f2", "#fecaca", "#991b1b"],
    bleu: ["#eff6ff", "#bfdbfe", "#1e40af"],
    vert: ["#f0fdf4", "#bbf7d0", "#166534"],
    violet: ["#eef2ff", "#c7d2fe", "#3730a3"],
  }[ton];
  return (
    <span title={title} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, background: t[0], border: `1px solid ${t[1]}`, color: t[2], borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export const th: React.CSSProperties = { padding: "8px 10px", borderBottom: "2px solid var(--border)", textAlign: "left", color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
export const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5, verticalAlign: "top" };
export const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/** Bouton-lien discret (ouvrir un document, etc.). */
export const lienBouton: React.CSSProperties = { background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 12.5, padding: 0, fontWeight: 600 };

/** Un document d'étudiant à ouvrir en entier. */
export interface RefDoc {
  etudiantId: string;
  kind: "resultat" | "gachee";
  id: string;
}
