"use client";

// Vue « Composition » de l'onglet Analyse : réunit les barres de phases, le
// diagramme ternaire et l'échantillon cylindrique pour une série de recettes
// déjà calculées. Purement présentationnel (reçoit recipes, ne calcule rien).

import React, { useState } from "react";
import type { Recipe } from "@/lib/types";
import type { BasePhases, BaseTernaire } from "@/lib/composition";
import BarresPhases from "./BarresPhases";
import DiagrammeTernaire from "./DiagrammeTernaire";
import EchantillonCylindre from "./EchantillonCylindre";
import { RECIPE_COLORS } from "@/lib/recipe-theme";

function Bascule<T extends string>({ valeur, options, onChange }: {
  valeur: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const actif = valeur === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${actif ? "#2563eb" : "#e2e8f0"}`, background: actif ? "#2563eb" : "#fff", color: actif ? "#fff" : "#64748b" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Sous({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{titre}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function CompositionVue({ recipes }: { recipes: Recipe[] }) {
  const [baseBarres, setBaseBarres] = useState<BasePhases>("volume");
  const [baseTern, setBaseTern] = useState<BaseTernaire>("phases");
  const [sel, setSel] = useState(0);

  if (recipes.length === 0) return null;
  const iSel = Math.min(sel, recipes.length - 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Sous
        titre={`Barres de phases (${recipes.length} recette${recipes.length > 1 ? "s" : ""})`}
        extra={<Bascule valeur={baseBarres} options={[{ v: "volume", label: "Volume" }, { v: "masse", label: "Masse" }]} onChange={setBaseBarres} />}
      >
        <BarresPhases recipes={recipes} base={baseBarres} />
      </Sous>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Sous
          titre="Diagramme ternaire"
          extra={<Bascule valeur={baseTern} options={[{ v: "phases", label: "Solides/Eau/Air" }, { v: "solides", label: "Résidu/Granulat/Liant" }]} onChange={setBaseTern} />}
        >
          <DiagrammeTernaire recipes={recipes} base={baseTern} />
        </Sous>

        <Sous
          titre="Schéma volumique illustratif"
          extra={recipes.length > 1 ? (
            <div style={{ display: "flex", gap: 6 }}>
              {recipes.map((_, i) => {
                const actif = i === iSel;
                return (
                  <button key={i} type="button" onClick={() => setSel(i)}
                    style={{ width: 30, height: 28, borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: `1.5px solid ${actif ? (RECIPE_COLORS[i] ?? "#2563eb") : "#e2e8f0"}`,
                      background: actif ? (RECIPE_COLORS[i] ?? "#2563eb") : "#fff", color: actif ? "#fff" : "#64748b" }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          ) : undefined}
        >
          <EchantillonCylindre recipe={recipes[iSel]} />
        </Sous>
      </div>
    </div>
  );
}
