// Petits éléments partagés du tableau de bord de l'enseignant (/classe).

import type React from "react";
import { Pastille as PastilleUi, type TonPastille } from "@/components/ui/Pastille";
import { TIRET } from "@/lib/format";

/** Une couleur par étudiant (figure, pastilles). */
export const COULEURS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#4d7c0f", "#0f766e", "#9333ea"];

export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return TIRET;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? TIRET : d.toLocaleDateString("fr-CA");
}

export function dateHeure(iso: string | null | undefined): string {
  if (!iso) return TIRET;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? TIRET : d.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

/** Nombre à la française (virgule), « — » si absent. */
export function nombre(v: number | null | undefined, decimales = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return TIRET;
  return v.toLocaleString("fr-CA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

const TONS: Record<"gris" | "ambre" | "rouge" | "bleu" | "vert" | "violet", TonPastille> = {
  gris: "neutre", ambre: "alerte", rouge: "danger", bleu: "accent", vert: "succes", violet: "violet",
};

/** Pastille du kit, avec les anciens noms de tons de la Classe. */
export function Pastille({ children, ton = "gris", title }: {
  children: React.ReactNode;
  ton?: keyof typeof TONS;
  title?: string;
}) {
  return <PastilleUi ton={TONS[ton]} title={title}>{children}</PastilleUi>;
}

export const th: React.CSSProperties = { padding: "0 10px 10px", textAlign: "left", color: "var(--texte-2)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" };
export const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--filet)", fontSize: 14, verticalAlign: "top" };
export const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/** Bouton-lien discret (ouvrir un document, etc.). */
export const lienBouton: React.CSSProperties = { background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14, padding: 0, fontWeight: 500, fontFamily: "inherit" };

/** Un document d'étudiant à ouvrir en entier. */
export interface RefDoc {
  etudiantId: string;
  kind: "resultat" | "gachee";
  id: string;
}
