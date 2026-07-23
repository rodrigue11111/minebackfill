"use client";

// Barres de phases empilées : une barre horizontale par recette, découpée en
// segments colorés proportionnels aux fractions (résidu/granulat/liant/eau/air).
// Base volume ou masse. HTML/flex (responsive), légende partagée. Utilisée en
// version compacte dans les résultats et détaillée dans l'onglet Analyse.

import React from "react";
import type { Recipe } from "@/lib/types";
import { phases, fractions, type BasePhases } from "@/lib/composition";
import { RECIPE_COLORS } from "@/lib/recipe-theme";

function fmtPct(f: number): string {
  return (f * 100).toLocaleString("fr-CA", { maximumFractionDigits: 1 }) + " %";
}
function fmtVal(v: number, base: BasePhases): string {
  return base === "masse"
    ? v.toLocaleString("fr-CA", { maximumFractionDigits: 0 }) + " kg"
    : v.toLocaleString("fr-CA", { maximumFractionDigits: 3 }) + " m³";
}

export default function BarresPhases({
  recipes,
  base,
  compact = false,
  titres,
}: {
  recipes: Recipe[];
  base: BasePhases;
  compact?: boolean;
  /** Libellés de recettes (défaut « Recette N »). */
  titres?: string[];
}) {
  if (recipes.length === 0) return null;

  // Légende : union des phases présentes dans au moins une recette (ordre stable).
  const ordre = ["residu", "granulat", "liant", "eau", "air"];
  const presentes = new Map<string, { label: string; couleur: string }>();
  for (const r of recipes) {
    for (const p of phases(r, base)) {
      if (!presentes.has(p.cle)) presentes.set(p.cle, { label: p.label, couleur: p.couleur });
    }
  }
  const legende = ordre.filter((k) => presentes.has(k)).map((k) => ({ cle: k, ...presentes.get(k)! }));

  const hauteur = compact ? 16 : 26;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 12 }}>
      {/* Légende */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {legende.map((p) => (
          <span key={p.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#374151" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: p.couleur, border: "1px solid rgba(0,0,0,0.08)" }} />
            {p.label}
          </span>
        ))}
      </div>

      {/* Une barre par recette */}
      {recipes.map((r, i) => {
        const fr = fractions(phases(r, base));
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: compact ? 52 : 74, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: RECIPE_COLORS[i] ?? "#374151" }}>
              {titres?.[i] ?? `Recette ${i + 1}`}
            </span>
            <div style={{ flex: 1, display: "flex", height: hauteur, borderRadius: 5, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
              {fr.map((p) => (
                <div
                  key={p.cle}
                  title={`${p.label} : ${fmtPct(p.frac)} (${fmtVal(p.valeur, base)})`}
                  style={{
                    width: `${p.frac * 100}%`, background: p.couleur, display: "flex",
                    alignItems: "center", justifyContent: "center", overflow: "hidden",
                    color: p.cle === "air" ? "#475569" : "#fff", fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap",
                  }}
                >
                  {!compact && p.frac >= 0.08 ? fmtPct(p.frac) : ""}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
