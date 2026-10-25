// frontend/src/lib/parcours.ts
// Parcours d'un calcul, affiché en haut d'Informations et de Calculs : les
// étapes 1 à 5 du Guide (« Démarrage rapide »), pour que l'étudiant sache où
// il en est sans ouvrir le Guide. Module PUR.

export interface EtapeParcours {
  n: number;
  libelle: string;
  /** Page où l'étape se fait. */
  href: string;
  /** Ce qu'on y fait (infobulle et lecteur d'écran). */
  detail: string;
}

export const PARCOURS: EtapeParcours[] = [
  { n: 1, libelle: "Projet", href: "/", detail: "Informations : projet, contenant de moulage, agent liant" },
  { n: 2, libelle: "Type", href: "/mix", detail: "Calculs : catégorie de remblai et méthode" },
  { n: 3, libelle: "Données", href: "/mix", detail: "Calculs : paramètres du résidu et du mélange" },
  { n: 4, libelle: "Calculer", href: "/mix", detail: "Calculs : bouton Calculer" },
  { n: 5, libelle: "Sauvegarder / analyser", href: "/analyse", detail: "Résultats : sauvegarde, exports ; Analyse : courbes de réponse d'un calcul sauvegardé" },
];

/** Étape en cours sur la page Calculs : 5 dès qu'un résultat est affiché, sinon 3. */
export const etapeCalculs = (aUnResultat: boolean): number => (aUnResultat ? 5 : 3);
