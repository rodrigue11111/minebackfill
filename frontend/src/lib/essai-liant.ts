// frontend/src/lib/essai-liant.ts
// Essai-erreur : liant versé pendant les ajouts, choisi PAR RECETTE
// (2026-10-24). Le calculateur (mix_pipeline.apply_essai_adjustments) reçoit
// le choix dans `binder_rule` ; absent, il applique la règle de la convention
// (constantes.essai_binder_rule : Intra 2017 ou feuille en grammes).
//
// En RPC il n'y a pas de granulat : « liant pour le résidu seulement » donne
// exactement « garder le Bw ». Le formulaire RPC ne propose donc que deux
// choix.

export type RegleLiant = "solides_totaux" | "residu_ajoute" | "aucun";

export interface OptionRegleLiant {
  valeur: RegleLiant;
  libelle: string;
  detail: string;
}

export const OPTIONS_REGLE_LIANT: OptionRegleLiant[] = [
  {
    valeur: "solides_totaux",
    libelle: "Garder le Bw",
    detail: "Du liant est versé pour tous les grains ajoutés (résidu et granulat) : le Bw ne change pas.",
  },
  {
    valeur: "residu_ajoute",
    libelle: "Résidu seulement",
    detail: "Du liant est versé pour le résidu ajouté seulement : un ajout de granulat dilue le Bw.",
  },
  {
    valeur: "aucun",
    libelle: "Aucun liant",
    detail: "Aucun liant n'est versé : le Bw est dilué par tous les grains ajoutés. Les résultats donnent le Bw atteint.",
  },
];

/** Options proposées : sans granulat (RPC), « résidu seulement » ne diffère pas de « garder le Bw ». */
export function optionsRegleLiant(avecGranulat: boolean): OptionRegleLiant[] {
  return avecGranulat ? OPTIONS_REGLE_LIANT : OPTIONS_REGLE_LIANT.filter((o) => o.valeur !== "residu_ajoute");
}

/** Choix affiché : celui de la recette, sinon la règle de la convention (ramenée à « garder le Bw » sans granulat). */
export function regleLiantAffichee(choix: RegleLiant | undefined, convention: string | undefined, avecGranulat: boolean): RegleLiant {
  const r: RegleLiant = choix ?? (convention === "residu_ajoute" ? "residu_ajoute" : "solides_totaux");
  return !avecGranulat && r === "residu_ajoute" ? "solides_totaux" : r;
}
