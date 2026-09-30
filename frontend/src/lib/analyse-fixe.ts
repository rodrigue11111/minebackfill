// frontend/src/lib/analyse-fixe.ts
// Ce qu'un balayage TIENT FIXE. Transformations PURES, testables sans DOM.
//
// Motivation : la page ne disait nulle part que Cw, Sr, Bw et Am sont des
// ENTRÉES du dosage selon Cw. Le balayage ne remplace QUE le paramètre choisi
// (backend app/core/analyse.py, _PARAM_OVERRIDE) ; tous les autres gardent la
// valeur de la recette de base. D'où la question récurrente « si je fais
// varier Bw, est-ce que Cw change ? » — non, et l'outil doit le dire seul.
//
// Tout est lu depuis l'INSTANTANÉ figé au calcul, jamais depuis le store
// vivant : celui-ci peut avoir dérivé depuis le tracé, et c'est déjà ce que
// signale le bandeau « Paramètres modifiés ».

import type { InstantaneAnalyse } from "./analyse-instantane";

/** Paramètres balayables. Miroir exact de BalayageParam côté backend. */
export type ParamCle =
  | "binder_mass_pct"
  | "solids_mass_pct"
  | "saturation_pct"
  | "aggregate_fraction_pct";

const PARAM_CLES: readonly string[] = [
  "binder_mass_pct", "solids_mass_pct", "saturation_pct", "aggregate_fraction_pct",
];

export function estParamCle(cle: string): cle is ParamCle {
  return PARAM_CLES.includes(cle);
}

/**
 * Valeur du paramètre balayé POUR la recette de base — le point de référence
 * du graphique.
 *
 * Remplace une chaîne de ternaires codée en dur dans la page, qui lisait le
 * store VIVANT : modifier la recette dans Calculs déplaçait le trait de
 * référence sans redessiner la courbe. Ici la valeur vient de l'instantané,
 * donc elle correspond toujours à la courbe affichée.
 *
 * Le `switch` est exhaustif : ajouter un membre à ParamCle sans l'y brancher
 * est une ERREUR DE COMPILATION (voir le garde `never` en fin de fonction).
 */
export function valeurReference(
  param: ParamCle,
  recette: InstantaneAnalyse["recette"],
): number | null {
  switch (param) {
    case "binder_mass_pct": return recette.bwPct ?? null;
    case "solids_mass_pct": return recette.cwPct ?? null;
    case "saturation_pct": return recette.srPct ?? null;
    case "aggregate_fraction_pct": return recette.amPct ?? null;
  }
  const jamais: never = param;
  return jamais;
}

export interface LigneFixe {
  label: string;
  valeur: string;
}

function f(n: number, dec = 3): string {
  return n.toLocaleString("fr-CA", { maximumFractionDigits: dec });
}

/**
 * Ce que le balayage tient constant, dans l'ordre de lecture. Le paramètre
 * balayé en est RETIRÉ : il est étiqueté « balayé » ailleurs dans l'écran.
 */
export function tenuFixe(inst: InstantaneAnalyse, param: ParamCle): LigneFixe[] {
  const r = inst.recette;
  const l: LigneFixe[] = [];
  const sauf = (p: ParamCle) => param !== p;

  l.push({ label: "Gs du résidu", valeur: f(r.gsResidu) });
  l.push({ label: "w₀ — teneur en eau massique du résidu", valeur: `${f(r.w0Pct, 1)} %` });
  if (sauf("solids_mass_pct")) l.push({ label: "Cw — pourcentage solide massique", valeur: `${f(r.cwPct, 2)} %` });
  if (sauf("saturation_pct")) l.push({ label: "Sr — degré de saturation", valeur: `${f(r.srPct, 1)} %` });
  if (sauf("binder_mass_pct")) l.push({ label: "Bw — taux massique de liant", valeur: `${f(r.bwPct, 2)} %` });
  if (r.amPct !== undefined && sauf("aggregate_fraction_pct")) {
    l.push({ label: "Am — fraction massique de granulat", valeur: `${f(r.amPct, 1)} %` });
  }
  if (r.gsAgregat !== undefined) l.push({ label: "Gs du granulat", valeur: f(r.gsAgregat) });

  l.push({
    label: "Agent liant",
    valeur: inst.liants.length
      ? inst.liants.map((b) => `${b.code || "?"} ${f(b.fractionPct, 0)} %`).join(" · ")
      : "aucun",
  });

  if (inst.contenant) l.push({ label: "Contenant", valeur: inst.contenant.type });
  if (inst.contenants !== undefined) l.push({ label: "Nombre de contenants", valeur: f(inst.contenants, 0) });
  if (inst.facteurSecurite !== undefined) l.push({ label: "Facteur de perte κ", valeur: f(inst.facteurSecurite) });

  // Comportement non évident et jamais affiché jusqu'ici : le balayage réduit
  // la base à UNE seule recette et reprend le premier dosage de liant. Une
  // personne ayant saisi trois recettes dans Calculs doit le savoir.
  l.push({ label: "Recettes", valeur: "1 (la première de la base)" });

  l.push({ label: "Pack de conventions", valeur: inst.constantes.packLabel });
  l.push({ label: "Version du solveur", valeur: inst.versionSolveur });
  return l;
}
