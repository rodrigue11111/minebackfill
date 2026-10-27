// frontend/src/lib/parcours.ts
// Parcours d'un calcul, affiché en haut d'Informations et de Calculs : les
// grandes étapes du « Flux de travail » du Guide, pour que l'étudiant sache où
// il en est sans ouvrir le Guide. Module PUR.
// 2026-10-26 : « Type » et « Données » menaient au même endroit (la page
// Calculs, où catégorie, méthode et paramètres se choisissent ensemble) ; une
// seule étape « Données » les réunit.

export interface EtapeParcours {
  n: number;
  libelle: string;
  /** Page où l'étape se fait. */
  href: string;
  /** Ce qu'on y fait (infobulle et lecteur d'écran). */
  detail: string;
}

export const PARCOURS: EtapeParcours[] = [
  { n: 1, libelle: "Projet", href: "/", detail: "Informations : projet, dimensions des moules, agent liant" },
  { n: 2, libelle: "Données", href: "/mix", detail: "Calculs : catégorie de remblai, méthode et paramètres du mélange" },
  { n: 3, libelle: "Calculer", href: "/mix", detail: "Calculs : bouton Calculer" },
  { n: 4, libelle: "Sauvegarder / analyser", href: "/analyse", detail: "Résultats : sauvegarde, exports ; Analyse : courbes de réponse d'un calcul sauvegardé" },
];

/** Étape en cours sur la page Calculs : 4 dès qu'un résultat est affiché, sinon 2. */
export const etapeCalculs = (aUnResultat: boolean): number => (aUnResultat ? 4 : 2);
