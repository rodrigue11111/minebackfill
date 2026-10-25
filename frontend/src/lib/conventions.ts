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
    label: "Feuille gramme (Belem 2016), Gs final recalculé",
    // 1.1 (2026-10-25) : Gs de la composition finale après les ajouts de
    // l'essai-erreur (Issues.md #6). En 1.0, le Gs de départ (feuille).
    solverVersion: "gramme-1.1",
    constantes: {
      ...NOMBRES,
      essai_gs_convention: "recalcule",
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
  const base = sansPersonnalise(version);
  if (!base) return false;
  return CONVENTION_PACKS.some((p) => p.solverVersion === base) || VERSIONS_GS_DEPART.includes(base);
}

const sansPersonnalise = (version: string | undefined): string | undefined =>
  version?.endsWith("-personnalise") ? version.slice(0, -"-personnalise".length) : version;

/**
 * Versions estampillées quand l'essai-erreur gardait le Gs de DÉPART après
 * les ajouts (comme la feuille, avant le 2026-10-25). Hors essai-erreur, leurs
 * chiffres sont ceux d'aujourd'hui : elles restent courantes.
 */
const VERSIONS_GS_DEPART = ["intra2017-1.0", "gramme-1.0"];

export type EtatVersion = "courante" | "convention_revisee" | "obsolete";

/**
 * État d'un résultat enregistré, pour sa pastille : « obsolete » (anciennes
 * formules), « convention_revisee » (essai-erreur calculé avec le Gs de
 * départ : masses justes, e, n, Sr et ρ à recalculer) ou « courante ».
 */
export function etatVersion(version: string | undefined, methode: string | undefined): EtatVersion {
  if (!estVersionCourante(version)) return "obsolete";
  const base = sansPersonnalise(version) as string;
  return methode === "essai" && VERSIONS_GS_DEPART.includes(base) ? "convention_revisee" : "courante";
}

/** Infobulle de la pastille « convention révisée ». */
export const AIDE_CONVENTION_REVISEE =
  "Essai-erreur calculé avec le Gs de départ, comme la feuille : masses justes, mais e, n, Sr et ρ ne suivent pas la composition finale. Rechargez-le et relancez le calcul.";

/**
 * Affaissement équivalent au cône d'Abrams (grand cône) : une lecture au petit
 * cône est multipliée par le facteur de conversion des constantes (Réglages),
 * comme le fait le calcul (backend/app/core/rpc_solver.py, modèle prédictif).
 * Aucune formule nouvelle : le même produit, montré à l'étudiant.
 */
export function slumpGrandConeMm(slumpMm: number | undefined, coneType: "mini" | "grand", facteur: number): number | undefined {
  if (slumpMm === undefined || !Number.isFinite(slumpMm)) return undefined;
  return coneType === "mini" ? slumpMm * facteur : slumpMm;
}
