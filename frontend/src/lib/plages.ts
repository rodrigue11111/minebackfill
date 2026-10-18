// frontend/src/lib/plages.ts
// Plages usuelles des paramètres des formulaires. SOURCE UNIQUE : le tableau
// « Paramètres et unités » du Guide les affiche, les formulaires de Calculs
// les rappellent sous chaque champ. Aucune valeur nouvelle : ce sont celles
// que le Guide donnait déjà.
//
// Une valeur hors plage n'est JAMAIS refusée : un avis doux invite à la
// vérifier (un résidu peut sortir des valeurs usuelles).

export type ClePlage = "gs" | "w0" | "cw" | "bw" | "sr" | "el" | "gsLiant" | "am" | "gsGranulat" | "slump" | "kappa";

export interface Plage {
  min: number;
  max: number;
  /** Texte affiché (Guide et formulaires), unité comprise. */
  texte: string;
}

export const PLAGES: Record<ClePlage, Plage> = {
  gs: { min: 2.6, max: 4.0, texte: "2,6 à 4,0" },
  w0: { min: 0, max: 35, texte: "0 à 35 %" },
  cw: { min: 65, max: 85, texte: "65 à 85 %" },
  bw: { min: 3, max: 12, texte: "3 à 12 %" },
  sr: { min: 80, max: 100, texte: "80 à 100 %" },
  el: { min: 3, max: 10, texte: "3 à 10" },
  gsLiant: { min: 2.6, max: 3.2, texte: "2,6 à 3,2" },
  am: { min: 10, max: 60, texte: "10 à 60 %" },
  gsGranulat: { min: 2.5, max: 2.8, texte: "2,50 à 2,80" },
  slump: { min: 150, max: 250, texte: "150 à 250 mm" },
  kappa: { min: 1.0, max: 1.25, texte: "1,0 à 1,25" },
};

/** Rappel sous un champ : « Plage usuelle : 65 à 85 %. » */
export const rappelPlage = (cle: ClePlage): string => `Plage usuelle : ${PLAGES[cle].texte}.`;

/**
 * Avis doux pour une valeur hors de la plage usuelle, ou null. Une case
 * vide (ou 0 non saisi) ne déclenche rien : le calcul dira ce qui manque.
 */
export function avisHorsPlage(cle: ClePlage, valeur: number | null | undefined): string | null {
  if (typeof valeur !== "number" || !Number.isFinite(valeur) || valeur === 0) return null;
  const p = PLAGES[cle];
  if (valeur >= p.min && valeur <= p.max) return null;
  return `Hors de la plage usuelle (${p.texte}) : vérifiez la valeur. Elle reste acceptée.`;
}
