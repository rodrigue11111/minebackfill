// frontend/src/lib/conventions.ts
// Packs de conventions de calcul : des PRESETS nommés (constantes + drapeaux)
// que l'utilisateur applique dans Réglages. Le pack n'est PAS envoyé au
// backend — le payload porte toujours les drapeaux explicites (reproductibilité :
// un ancien résultat rejoué donne les mêmes nombres même si un pack évolue).
// Le snapshot `constantes` de chaque SavedResult capture tout le nécessaire.
//
// Cohérence avec le backend épinglée par tests des deux côtés : pytest affirme
// que SolverConstants().model_dump() == valeurs intra2017 ; vitest
// (conventions.test.ts) épingle le contenu de ces packs.

import type { ConstantesCalcul, ConventionPackId } from "./store";

export interface ConventionPack {
  id: Exclude<ConventionPackId, "personnalise">;
  label: string;
  /** Version du solveur estampillée sur les résultats produits sous ce pack. */
  solverVersion: string;
  constantes: ConstantesCalcul;
}

// Constantes physiques communes (identiques dans les deux feuilles du
// professeur ; seule la règle du liant en essai diffère — voir Issues.md #4).
const NOMBRES = {
  masse_volumique_eau_kg_m3: 1000.0,
  gravite_m_s2: 9.81,
  facteur_petit_cone_vers_grand_cone: 2.335,
  coefficient_modele_slump: 4.95e6,
  constante_modele_slump: 235.5122,
} as const;

export const CONVENTION_PACKS: ConventionPack[] = [
  {
    id: "intra2017",
    label: "Feuille tonne (Intra 2017)",
    solverVersion: "intra2017-1.0",
    constantes: {
      ...NOMBRES,
      essai_gs_convention: "base",
      essai_binder_rule: "solides_totaux",
      pack_id: "intra2017",
    },
  },
  {
    id: "gramme",
    label: "Feuille gramme (Belem 2016)",
    solverVersion: "gramme-1.0",
    constantes: {
      ...NOMBRES,
      essai_gs_convention: "base",
      essai_binder_rule: "residu_ajoute",
      pack_id: "gramme",
    },
  },
];

export function packById(id: ConventionPackId): ConventionPack | undefined {
  return CONVENTION_PACKS.find((p) => p.id === id);
}

/**
 * Version du solveur estampillée sur un résultat, selon le pack actif. En
 * « personnalise », le préfixe suit la FAMILLE de convention réellement active
 * (règle du liant) — pas systématiquement intra2017.
 */
export function solverVersionActive(constantes: ConstantesCalcul): string {
  const pack = packById(constantes.pack_id);
  if (pack) return pack.solverVersion;
  const famille = constantes.essai_binder_rule === "residu_ajoute" ? "gramme" : "intra2017";
  return `${packById(famille)!.solverVersion}-personnalise`;
}

/**
 * Vrai si cette version d'estampille correspond aux formules ACTUELLES : un
 * pack connu, ou sa variante « -personnalise ». Sert au badge « anciennes
 * formules » de l'Historique — un résultat gramme ou personnalisé fraîchement
 * calculé n'est PAS obsolète.
 */
export function estVersionCourante(version: string | undefined): boolean {
  if (!version) return false;
  const base = version.endsWith("-personnalise")
    ? version.slice(0, -"-personnalise".length)
    : version;
  return CONVENTION_PACKS.some((p) => p.solverVersion === base);
}
