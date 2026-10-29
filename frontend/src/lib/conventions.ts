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

import type { ConstantesCalcul, ConventionPackId, EssaiBinderRule, EssaiGsConvention } from "./store";

// Convention de calcul : la feuille « gramme » (Belem 2016), et elle seule :
// décision de l'utilisateur, 2026-09-29. Elle ne diffère de la feuille tonne
// (Intra 2017) qu'en essai-erreur : un ajout de granulat n'ajoute pas de liant
// (Issues.md #4). Le choix a été retiré de l'interface ; la règle est imposée
// au chargement (store.tsx, completerConstantes) et à chaque modification.
export const REGLE_LIANT_ESSAI: EssaiBinderRule = "residu_ajoute";

// Gs après les ajouts de l'essai-erreur : celui de la composition FINALE
// (2026-10-25, Issues.md #6). Les feuilles gardent le Gs de départ pour e et Sr
// (D36) et se contredisent quand un ajout change la composition des grains ;
// le calculateur garde « base » par défaut pour ses tests d'or, le site envoie
// « recalcule ». Imposé comme la règle du liant ; un essai-erreur sauvegardé
// sous l'ancienne convention est restauré périmé, et l'Analyse le refuse.
export const CONVENTION_GS_ESSAI: EssaiGsConvention = "recalcule";

/**
 * Essai-erreur calculé sous d'autres conventions que celles imposées
 * aujourd'hui (Gs de départ, règle du liant « tonne »), lu sur l'instantané
 * BRUT des constantes (avant tout complément). Un essai sans instantané compte
 * comme révisé : rien ne dit sous quelle convention il a été calculé.
 */
export function essaiConventionRevisee(r: { method?: string; constantes?: Partial<ConstantesCalcul> | null }): boolean {
  return r.method === "essai"
    && (r.constantes?.essai_gs_convention !== CONVENTION_GS_ESSAI
      || r.constantes?.essai_binder_rule !== REGLE_LIANT_ESSAI);
}

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
    // Feuille tonne du professeur (Intra 2017) : nom gardé ici, pas à l'écran.
    label: "Convention d'origine (Gs de départ, liant sur tous les solides)",
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
    // Feuille gramme (Belem 2016), Gs final recalculé : nom gardé ici, pas à l'écran.
    label: "Convention actuelle (Gs final recalculé, liant sur le résidu ajouté)",
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

/**
 * Version estampillée, lisible à l'écran : « 1.1, convention actuelle » au
 * lieu de « gramme-1.1 » (2026-10-26 : les noms des classeurs ne s'affichent
 * plus). L'identifiant brut reste dans les données et les exports lus par une
 * machine (JSON, jeu d'essais, diagnostic copié) : la traçabilité ne change pas.
 * Une version inconnue est rendue telle quelle.
 */
export function libelleVersion(version: string): string {
  const base = sansPersonnalise(version) ?? version;
  const m = /^(intra2017|gramme)-(\d+(?:\.\d+)*)$/.exec(base);
  if (!m) return version;
  const famille = m[1] === "intra2017" ? "convention d'origine" : "convention actuelle";
  return `${m[2]}, ${famille}${base !== version ? ", personnalisée" : ""}`;
}

/** Infobulle de la pastille « convention révisée ». */
export const AIDE_CONVENTION_REVISEE =
  "Essai-erreur calculé avec le Gs de départ : masses justes, mais e, n, Sr et ρ ne suivent pas la composition finale. Rechargez-le et relancez le calcul.";

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
