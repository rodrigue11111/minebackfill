// frontend/src/lib/ucs-formulation.ts
// UCS MESURÉE en fonction d'un paramètre de formulation CALCULÉ.
// Transformations PURES, testables sans DOM.
//
// C'est la boucle qui manquait : les étudiants fabriquent des mélanges, les
// écrasent, et la relation entre le dosage et la résistance n'apparaissait
// nulle part. Elle est pourtant déjà à portée — la table « Détail des
// mesures » croise depuis toujours Cw, W/C et Bw avec l'UCS moyenne ; seul le
// graphique manquait.
//
// AUCUNE FORMULE NOUVELLE. On croise deux choses déjà présentes : des mesures
// (agregerParAge) et l'instantané de formulation figé sur la gâchée. Ce qui
// est explicitement REFUSÉ ici, et pourquoi :
//   - droite d'ajustement, R², coefficient de corrélation : ce serait un
//     modèle, et le programme n'en a pas de validé ;
//   - interpolation de l'UCS à un âge non mesuré : voir agesDisponibles, qui
//     ne propose que des âges réels ;
//   - moyenne inter-gâchées à Cw égal : agréger des lots, des opérateurs et
//     des protocoles différents sous une seule moyenne. Un point par gâchée ;
//   - normalisation par une valeur de référence.

import type { Gachee, ParametresFormulation } from "./gachee";
import { parametresEffectifs } from "./gachee";
import { agregerParAge } from "./eprouvette";
import type { Recipe } from "./types";

/** Paramètre porté en abscisse. Clés de ParametresFormulation. */
export type AxeFormulation = "cwPct" | "wcRatio" | "bwPct" | "wPct";

export interface AxeMeta {
  cle: AxeFormulation;
  label: string;
  /** Unité affichée ; "—" pour un ratio sans unité. */
  unite: string;
}

export const AXES_FORMULATION: AxeMeta[] = [
  { cle: "wcRatio", label: "W/C — rapport eau/liant", unite: "—" },
  { cle: "bwPct", label: "Bw — dosage de liant", unite: "%" },
  { cle: "cwPct", label: "Cw — solides massiques", unite: "%" },
  { cle: "wPct", label: "w — teneur en eau", unite: "%" },
];

export const axeMeta = (cle: string) => AXES_FORMULATION.find((a) => a.cle === cle);

export interface PointNuage {
  /** Identifiant de la gâchée (clé React et couleur). */
  id: string;
  code: string;
  /** Valeur du paramètre de formulation. */
  x: number;
  /** UCS moyenne mesurée (kPa) à l'âge choisi. */
  moyenneKpa: number;
  ecartTypeKpa: number | null;
  n: number;
  nExclus: number;
}

export interface GacheeEcartee {
  code: string;
  raison: string;
}

export interface Nuage {
  points: PointNuage[];
  /**
   * Gâchées volontairement absentes de la figure, AVEC leur raison. C'est ce
   * qui sépare une figure défendable d'un graphe trompeur : le lecteur doit
   * savoir ce qui n'y est pas.
   */
  ecartees: GacheeEcartee[];
}

type Formulations = { id: string; recipes: Recipe[] }[];

function valeurAxe(p: ParametresFormulation | undefined, axe: AxeFormulation): number | null {
  const v = p?.[axe];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Âges de cure RÉELLEMENT mesurés, triés. Le sélecteur ne doit proposer que
 * ceux-là : offrir « 28 j » quand on n'a mesuré qu'à 14 et 56 pousserait à
 * interpoler, c'est-à-dire à inventer une valeur.
 */
export function agesDisponibles(gachees: Gachee[]): number[] {
  const s = new Set<number>();
  for (const g of gachees) {
    for (const a of agregerParAge(g.eprouvettes ?? [])) {
      if (a.moyenneKpa !== null) s.add(a.ageJours);
    }
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Un point par gâchée : le paramètre de formulation en x, l'UCS moyenne
 * mesurée à `ageJours` en y.
 */
export function nuageUcs(
  gachees: Gachee[],
  formulations: Formulations,
  axe: AxeFormulation,
  ageJours: number,
): Nuage {
  const points: PointNuage[] = [];
  const ecartees: GacheeEcartee[] = [];

  for (const g of gachees) {
    const ages = agregerParAge(g.eprouvettes ?? []);
    const a = ages.find((x) => x.ageJours === ageJours);

    if (!a) {
      ecartees.push({ code: g.code, raison: `aucune éprouvette à ${ageJours} j` });
      continue;
    }
    if (a.moyenneKpa === null) {
      ecartees.push({
        code: g.code,
        raison: a.nExclus > 0
          ? `à ${ageJours} j, toutes les éprouvettes sont exclues`
          : `à ${ageJours} j, aucune mesure exploitable (charge ou diamètre manquant)`,
      });
      continue;
    }
    const x = valeurAxe(parametresEffectifs(g, formulations), axe);
    if (x === null) {
      ecartees.push({
        code: g.code,
        raison: "aucun paramètre de formulation connu (gâchée ancienne, formulation supprimée)",
      });
      continue;
    }
    points.push({
      id: g.id, code: g.code, x,
      moyenneKpa: a.moyenneKpa, ecartTypeKpa: a.ecartTypeKpa, n: a.n, nExclus: a.nExclus,
    });
  }

  points.sort((p, q) => p.x - q.x);
  return { points, ecartees };
}

/**
 * Provenance de MESURE — délibérément distincte de InstantaneAnalyse.
 * Celui-ci porte versionSolveur, pack de conventions et constantes, qui n'ont
 * produit aucune de ces valeurs : le réutiliser ici afficherait une provenance
 * mensongère sur une figure expérimentale.
 */
export function lignesProvenanceLabo(
  gachees: Gachee[], axe: AxeFormulation, ageJours: number,
): string[] {
  const meta = axeMeta(axe);
  const l = [
    "MineBackfill — Laboratoire (mesures)",
    `Date d'export : ${new Date().toISOString()}`,
    `Abscisse : ${meta?.label ?? axe} · âge de cure : ${ageJours} j`,
    "Valeurs MESURÉES ; aucun modèle, aucune interpolation, aucun ajustement.",
  ];
  for (const g of gachees) {
    const lots = [g.lotResidu, g.lotGranulat, g.lotLiant].filter(Boolean).join(" / ");
    const bits = [
      `${g.code}`,
      g.formulationLabel,
      g.categorie,
      g.solverVersion ? `solveur ${g.solverVersion}` : null,
      lots ? `lots ${lots}` : null,
      `tolérance ${g.tolerancePct} %`,
      g.protocolesSnapshot?.length ? `protocoles : ${g.protocolesSnapshot.map((p) => p.titre).join(", ")}` : null,
    ].filter(Boolean);
    l.push(`  ${bits.join(" · ")}`);
  }
  return l;
}

/** Lignes d'un CSV de nuage (en-tête compris), prêtes pour versCsv. */
export function lignesCsvNuage(nuage: Nuage, axe: AxeFormulation): (string | number | null)[][] {
  const meta = axeMeta(axe);
  const enTete = [
    "Gâchée",
    `${meta?.label ?? axe}${meta && meta.unite !== "—" ? ` (${meta.unite})` : ""}`,
    "UCS moyenne (kPa)", "Écart-type (kPa)", "n", "Exclues",
  ];
  return [enTete, ...nuage.points.map((p) => [
    p.code, p.x, p.moyenneKpa, p.ecartTypeKpa, p.n, p.nExclus,
  ])];
}
