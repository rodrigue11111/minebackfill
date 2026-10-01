"use client";

// Carte « Résultats » de la page Calculs (maquette A) : sélecteur de recette,
// quatre chiffres clés, tableau résumé à filets, puis le rapport complet sur
// demande. Pilotée par ses propriétés (le magasin est lu par ResultsPanel) :
// testable sans navigateur.

import { useState } from "react";
import { Carte } from "@/components/ui/Carte";
import Segmente from "@/components/ui/Segmente";
import { TuilesChiffres, type Chiffre } from "@/components/ui/Chiffres";
import BarresPhases from "@/components/analyse/BarresPhases";
import { SectionsRapport, TableauLignes, TableauRrc, SectionHeader } from "@/components/mix/SectionsRapport";
import { lignesResume, nbLignesRapport, type ReportCtx } from "@/lib/report-schema";
import { fromStoreMass } from "@/lib/units";
import { fmt, TIRET } from "@/lib/format";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import type { Recipe, RrcRecipe } from "@/lib/types";

/**
 * Décimales adaptées à la grandeur (0,123 kg comme 1 380 kg restent lisibles),
 * milliers séparés par une espace fine insécable. Point décimal, comme les
 * tableaux de résultats.
 */
export function chiffreMasse(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return TIRET;
  const a = Math.abs(v);
  const [ent, dec] = fmt(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3).split(".");
  const groupe = ent.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return dec ? `${groupe}.${dec}` : groupe;
}

/** Les quatre chiffres clés d'une recette RPC/RPG. */
export function chiffresRecette(r: Recipe | undefined, ctx: ReportCtx): Chiffre[] {
  const m = (kg: number | null | undefined) => chiffreMasse(fromStoreMass(kg, ctx.units.mass));
  const c = r?.components;
  return [
    { libelle: "Liant", valeur: m(c?.binder_total_mass_kg), unite: ctx.massLabel },
    { libelle: "Eau totale", valeur: m(c?.water_total_mass_kg), unite: ctx.massLabel },
    { libelle: "Résidu sec", valeur: m(c?.residue_dry_mass_kg), unite: ctx.massLabel },
    { libelle: "Rapport E/L", valeur: fmt(r?.wc_ratio, 2) },
  ];
}

/** Les quatre chiffres clés d'une recette RRC. */
export function chiffresRrc(r: RrcRecipe | undefined, massLabel: string, toMass: (kg: number | null | undefined) => number | null): Chiffre[] {
  return [
    { libelle: "Ciment", valeur: chiffreMasse(toMass(r?.cement_mass_kg)), unite: massLabel },
    { libelle: "Eau", valeur: chiffreMasse(toMass(r?.water_mass_kg)), unite: massLabel },
    { libelle: "Roches stériles", valeur: chiffreMasse(toMass(r?.waste_rock_mass_kg)), unite: massLabel },
    { libelle: "E/L du coulis", valeur: fmt(r?.wc_ratio, 2) },
  ];
}

export type DonneesResultats =
  | { genre: "rpc"; recipes: Recipe[]; ctx: ReportCtx }
  | { genre: "rrc"; recipes: RrcRecipe[]; massLabel: string; toMass: (kg: number | null | undefined) => number | null };

/** Choix de la recette dont on lit les chiffres clés (dès 2 recettes). */
function ChoixRecette({ n, choisie, onChoisir }: { n: number; choisie: number; onChoisir: (i: number) => void }) {
  if (n < 2) return null;
  return (
    <Segmente
      ariaLabel="Recette affichée"
      taille="compact"
      valeur={String(choisie)}
      onChange={(v) => onChoisir(Number(v))}
      options={Array.from({ length: n }, (_, i) => ({
        valeur: String(i),
        libelle: <><span className="mix-point-recette" style={{ background: RECIPE_COLORS[i] }} aria-hidden="true" />Recette {i + 1}</>,
      }))}
    />
  );
}

export default function CarteResultats({ sousTitre, actions, donnees, pleinEcran = false, onFormulaClick }: {
  sousTitre: React.ReactNode;
  actions: React.ReactNode;
  /** null : aucun résultat encore (tuiles vides). */
  donnees: DonneesResultats | null;
  pleinEcran?: boolean;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
}) {
  const [choix, setChoix] = useState(0);
  const [rapportOuvert, setRapportOuvert] = useState(false);
  const n = donnees?.recipes.length ?? 0;
  // État dérivé : un nombre de recettes réduit ramène le choix dans la plage.
  const choisie = Math.min(choix, Math.max(0, n - 1));
  const rapport = rapportOuvert || pleinEcran;

  return (
    <Carte
      className="mix-carte-resultats"
      aria-label="Résultats"
      titre={<span className="mix-titre-resultats">Résultats<span className="mix-sous-titre-resultats">{sousTitre}</span></span>}
      actions={<div className="mix-actions-resultats">{actions}</div>}
    >
      {!donnees || n === 0 ? (
        <>
          <TuilesChiffres chiffres={["Liant", "Eau totale", "Résidu sec", "Rapport E/L"].map((libelle) => ({ libelle, valeur: TIRET }))} />
          <p className="mix-vide">Renseignez les paramètres, puis cliquez sur <strong>Calculer</strong> : les chiffres clés et le tableau résumé s&apos;affichent ici.</p>
        </>
      ) : donnees.genre === "rrc" ? (
        <>
          <ChoixRecette n={n} choisie={choisie} onChoisir={setChoix} />
          <TuilesChiffres ariaLabel={`Chiffres clés, recette ${choisie + 1}`} chiffres={chiffresRrc(donnees.recipes[choisie], donnees.massLabel, donnees.toMass)} />
          <TableauRrc recipes={donnees.recipes} massLabel={donnees.massLabel} toMass={donnees.toMass} choisie={n > 1 ? choisie : undefined} />
          <p className="mix-note">Bilan : MWR + Mc + M* = masse totale de RRC. Coulis de ciment = ciment + eau + retardateur de prise.</p>
        </>
      ) : (
        <>
          <ChoixRecette n={n} choisie={choisie} onChoisir={setChoix} />
          <TuilesChiffres ariaLabel={`Chiffres clés, recette ${choisie + 1}`} chiffres={chiffresRecette(donnees.recipes[choisie], donnees.ctx)} />
          {!rapport && (
            <TableauLignes lignes={lignesResume(donnees.ctx)} recipes={donnees.recipes} ctx={donnees.ctx} choisie={n > 1 ? choisie : undefined} onFormulaClick={onFormulaClick} />
          )}
          {!pleinEcran && (
            <button type="button" className="btn-discret mix-lien-rapport" aria-expanded={rapport} onClick={() => setRapportOuvert((v) => !v)}>
              {rapport ? "Revenir au résumé" : `Voir les ${nbLignesRapport(donnees.ctx)} lignes du rapport complet`}
            </button>
          )}
          {rapport && (
            <>
              <SectionsRapport recipes={donnees.recipes} ctx={donnees.ctx} grille={pleinEcran} onFormulaClick={onFormulaClick} choisie={n > 1 ? choisie : undefined} />
              <section className="mix-rapport-section">
                <SectionHeader title="Composition des phases" sub="Répartition volumique par recette ; vue détaillée dans la page Analyse" />
                <BarresPhases recipes={donnees.recipes} base="volume" compact />
              </section>
            </>
          )}
        </>
      )}
    </Carte>
  );
}
