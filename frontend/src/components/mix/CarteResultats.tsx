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
import { formulesDuRapport, formulesDuRapportRrc, lignesResume, nbLignesRapport, type ReportCtx } from "@/lib/report-schema";
import { fromStoreDensity, fromStoreMass } from "@/lib/units";
import { masseRemblaiTotaleKg } from "@/lib/derived";
import { FORMULA_MAP } from "@/lib/formulas-data";
import { fmt, fmtGroupe, TIRET } from "@/lib/format";
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
  return fmtGroupe(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
}

/**
 * Titre du groupe des masses. En essai-erreur, ces masses sont celles du
 * mélange ajusté refait d'un coup avec le résidu tel que stocké (à w₀), pas
 * une consigne pour la gâchée déjà faite : après un ajout de résidu sec,
 * « Eau à retirer » y signifiait « mélange plus sec que le résidu stocké » et
 * se lisait comme un ordre de retirer de l'eau du seau.
 */
export function titreMasses(ctx: ReportCtx): string {
  return ctx.isEssai ? "Pour refaire ce mélange depuis le début (résidu tel que stocké)" : "À préparer";
}

/**
 * Masses du groupe titré par `titreMasses` : ce que l'étudiant pèse pour la
 * recette (résidu humide tel que reçu, granulat en RPG, liant, eau à ajouter)
 * et la masse totale du remblai. Valeurs du calcul, sans formule nouvelle.
 */
export function chiffresRecette(r: Recipe | undefined, ctx: ReportCtx): Chiffre[] {
  const m = (kg: number | null | undefined) => chiffreMasse(fromStoreMass(kg, ctx.units.mass));
  const c = r?.components;
  const eau = c?.water_to_add_mass_kg;
  return [
    { libelle: "Résidu humide", valeur: m(c?.residue_wet_mass_kg), unite: ctx.massLabel },
    ...(ctx.isRpg ? [{ libelle: "Granulat sec", valeur: m(c?.aggregate_dry_mass_kg), unite: ctx.massLabel }] : []),
    { libelle: "Liant", valeur: m(c?.binder_total_mass_kg), unite: ctx.massLabel },
    { libelle: typeof eau === "number" && eau < 0 ? "Eau à retirer" : "Eau à ajouter", valeur: m(typeof eau === "number" ? Math.abs(eau) : eau), unite: ctx.massLabel },
    { libelle: "Total du remblai", valeur: m(r ? masseRemblaiTotaleKg(r) : undefined), unite: ctx.massLabel },
  ];
}

/** « Caractéristiques » de la recette : Cw, Bw, E/L, ρh, e, n (valeurs du calcul). */
export function chiffresCaracteristiques(r: Recipe | undefined, ctx: ReportCtx): Chiffre[] {
  return [
    { libelle: "Cw", valeur: fmt(r?.solids_mass_pct, 2), unite: "%" },
    { libelle: ctx.isEssai ? "Bw atteint" : "Bw", valeur: fmt(r?.bw_mass_pct, 2), unite: "%" },
    { libelle: "Rapport E/L", valeur: fmt(r?.wc_ratio, 2) },
    { libelle: "ρh", valeur: fmt(fromStoreDensity(r?.bulk_density_kg_m3, ctx.units.density), 3), unite: ctx.densLabel },
    { libelle: "Indice des vides e", valeur: fmt(r?.void_ratio, 3) },
    { libelle: "Porosité n", valeur: fmt(r?.porosity, 3) },
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

/**
 * « Formules utilisées pour ce résultat » : les formules du rapport, chacune
 * ouvrant sa fiche (la même fenêtre que les valeurs « fx »).
 */
function FormulesUtilisees({ ids, recipe, onFormulaClick }: {
  ids: string[];
  recipe: Recipe | undefined;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe | undefined, rect: DOMRect) => void;
}) {
  if (ids.length === 0) return null;
  return (
    <section className="mix-formules" aria-label="Formules utilisées pour ce résultat">
      <span className="mix-groupe-titre">Formules utilisées pour ce résultat</span>
      <span className="mix-formules-liste">
        {ids.map((id) => (onFormulaClick ? (
          <button key={id} type="button" className="mix-formule" title={FORMULA_MAP.get(id)?.title ?? id}
            onClick={(e) => onFormulaClick([id], recipe, e.currentTarget.getBoundingClientRect())}>{id}</button>
        ) : (
          <span key={id} className="mix-formule" title={FORMULA_MAP.get(id)?.title ?? id}>{id}</span>
        )))}
      </span>
    </section>
  );
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
        // Sous 720 px, « R1 » à « R4 » : les quatre tiennent à 320 px.
        libelleCourt: <><span className="mix-point-recette" style={{ background: RECIPE_COLORS[i] }} aria-hidden="true" />R{i + 1}</>,
      }))}
    />
  );
}

export default function CarteResultats({ sousTitre, actions, donnees, pleinEcran = false, onFormulaClick, avis }: {
  sousTitre: React.ReactNode;
  /** Avis affiché en tête de la carte (résultats périmés). */
  avis?: React.ReactNode;
  actions: React.ReactNode;
  /** null : aucun résultat encore (tuiles vides). */
  donnees: DonneesResultats | null;
  pleinEcran?: boolean;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe | undefined, rect: DOMRect) => void;
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
      {avis}
      {!donnees || n === 0 ? (
        <>
          <TuilesChiffres chiffres={["Résidu humide", "Liant", "Eau à ajouter", "Total du remblai"].map((libelle) => ({ libelle, valeur: TIRET }))} />
          <p className="mix-vide">Renseignez les paramètres, puis cliquez sur <strong>Calculer</strong> : les chiffres clés et le tableau résumé s&apos;affichent ici.</p>
        </>
      ) : donnees.genre === "rrc" ? (
        <>
          <ChoixRecette n={n} choisie={choisie} onChoisir={setChoix} />
          <TuilesChiffres ariaLabel={`Chiffres clés, recette ${choisie + 1}`} chiffres={chiffresRrc(donnees.recipes[choisie], donnees.massLabel, donnees.toMass)} />
          <TableauRrc recipes={donnees.recipes} massLabel={donnees.massLabel} toMass={donnees.toMass} choisie={n > 1 ? choisie : undefined} onFormulaClick={onFormulaClick} />
          <p className="mix-note">Bilan : MWR + Mc + M* = masse totale de RRC. Coulis de ciment = ciment + eau + retardateur de prise.</p>
          <FormulesUtilisees ids={formulesDuRapportRrc()} recipe={undefined} onFormulaClick={onFormulaClick} />
        </>
      ) : (
        <>
          <ChoixRecette n={n} choisie={choisie} onChoisir={setChoix} />
          <p className="mix-groupe-titre">{titreMasses(donnees.ctx)}</p>
          <TuilesChiffres ariaLabel={`${titreMasses(donnees.ctx)}, recette ${choisie + 1}`} chiffres={chiffresRecette(donnees.recipes[choisie], donnees.ctx)} />
          <BarresPhases recipes={[donnees.recipes[choisie]]} base="masse" compact />
          <p className="mix-groupe-titre">Caractéristiques</p>
          <TuilesChiffres ariaLabel={`Caractéristiques, recette ${choisie + 1}`} chiffres={chiffresCaracteristiques(donnees.recipes[choisie], donnees.ctx)} />
          {!rapport && (
            <TableauLignes lignes={lignesResume(donnees.ctx)} recipes={donnees.recipes} ctx={donnees.ctx} choisie={n > 1 ? choisie : undefined} onFormulaClick={onFormulaClick} />
          )}
          {!pleinEcran && (
            <button type="button" className="btn-discret mix-lien-rapport" aria-expanded={rapport} onClick={() => setRapportOuvert((v) => !v)}>
              {rapport ? "Revenir au résumé" : `Voir tous les paramètres (${nbLignesRapport(donnees.ctx)} lignes du rapport)`}
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
          <FormulesUtilisees ids={formulesDuRapport(donnees.ctx)} recipe={donnees.recipes[choisie]} onFormulaClick={onFormulaClick} />
        </>
      )}
    </Carte>
  );
}
