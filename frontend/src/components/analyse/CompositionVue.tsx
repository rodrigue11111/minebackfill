"use client";

// Vue « Composition » de l'onglet Analyse : réunit les barres de phases, le
// diagramme ternaire et l'échantillon cylindrique pour une série de recettes
// déjà calculées. Purement présentationnel (reçoit recipes, ne calcule rien).

import React, { useState } from "react";
import Segmente from "@/components/ui/Segmente";
import type { Recipe } from "@/lib/types";
import type { BasePhases, BaseTernaire } from "@/lib/composition";
import BarresPhases from "./BarresPhases";
import DiagrammeTernaire from "./DiagrammeTernaire";
import EchantillonCylindre from "./EchantillonCylindre";
import FigurePng from "./FigurePng";

function Bascule<T extends string>({ valeur, options, onChange, ariaLabel }: {
  valeur: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <Segmente
      ariaLabel={ariaLabel}
      taille="compact"
      valeur={valeur}
      onChange={onChange}
      options={options.map((o) => ({ valeur: o.v, libelle: o.label }))}
    />
  );
}

function Sous({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="analyse-figure">
      <div className="analyse-figure-tete">
        <span className="analyse-figure-titre">{titre}</span>
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
    <div className="analyse-pile">
      <Sous
        titre={`Barres de phases (${recipes.length} recette${recipes.length > 1 ? "s" : ""})`}
        extra={<Bascule ariaLabel="Base des barres de phases" valeur={baseBarres} options={[{ v: "volume", label: "Volume" }, { v: "masse", label: "Masse" }]} onChange={setBaseBarres} />}
      >
        <BarresPhases recipes={recipes} base={baseBarres} />
      </Sous>

      <div className="analyse-duo">
        <Sous
          titre="Diagramme ternaire"
          extra={<Bascule ariaLabel="Base du diagramme ternaire" valeur={baseTern} options={[{ v: "phases", label: "Solides/Eau/Air" }, { v: "solides", label: "Résidu/Granulat/Liant" }]} onChange={setBaseTern} />}
        >
          <FigurePng nom="composition-ternaire">
            <DiagrammeTernaire recipes={recipes} base={baseTern} />
          </FigurePng>
        </Sous>

        <Sous
          titre="Schéma volumique illustratif"
          extra={recipes.length > 1 ? (
            <Segmente
              ariaLabel="Recette illustrée"
              taille="compact"
              valeur={String(iSel)}
              onChange={(v) => setSel(Number(v))}
              options={recipes.map((_, i) => ({ valeur: String(i), libelle: `R${i + 1}` }))}
            />
          ) : undefined}
        >
          <FigurePng nom={`composition-echantillon-r${iSel + 1}`}>
            <EchantillonCylindre recipe={recipes[iSel]} />
          </FigurePng>
        </Sous>
      </div>
    </div>
  );
}
