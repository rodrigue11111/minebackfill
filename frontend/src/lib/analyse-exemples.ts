// frontend/src/lib/analyse-exemples.ts
// Trois questions toutes prêtes pour la page Analyse : un clic règle le
// paramètre, sa plage (plages usuelles du Guide) et les grandeurs tracées ;
// l'étudiant n'a plus qu'à tracer. Le texte dit QUOI regarder, sans affirmer
// le résultat : c'est la courbe qui répond.

import { PLAGES } from "./plages";

export interface ExempleAnalyse {
  question: string;
  param: string;
  min: number;
  max: number;
  sorties: string[];
  aRegarder: string;
}

export const EXEMPLES_ANALYSE: ExempleAnalyse[] = [
  {
    question: "Que se passe-t-il si j'augmente Bw ?",
    param: "binder_mass_pct", min: PLAGES.bw.min, max: PLAGES.bw.max,
    sorties: ["wc_ratio", "binder_total_mass_kg"],
    aRegarder: "Observez comment le rapport E/L et la masse de liant suivent Bw, Cw restant celui de votre recette.",
  },
  {
    question: "Et si je vise un Cw plus élevé ?",
    param: "solids_mass_pct", min: PLAGES.cw.min, max: PLAGES.cw.max,
    sorties: ["wc_ratio", "water_total_mass_kg"],
    aRegarder: "Observez l'eau totale et le rapport E/L quand la pâte devient plus épaisse.",
  },
  {
    question: "Et si la pâte n'est pas saturée ?",
    param: "saturation_pct", min: PLAGES.sr.min, max: PLAGES.sr.max,
    sorties: ["void_ratio", "bulk_density_kg_m3"],
    aRegarder: "Observez l'indice des vides e et la masse volumique humide ρh selon le degré de saturation Sr.",
  },
];
