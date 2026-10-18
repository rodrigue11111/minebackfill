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
 * vide ne déclenche rien : le calcul dira ce qui manque. Un 0 TAPÉ est jugé
 * comme tout nombre (depuis 2026-10, le vide n'est plus stocké comme 0).
 */
export function avisHorsPlage(cle: ClePlage, valeur: number | null | undefined): string | null {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return null;
  const p = PLAGES[cle];
  if (valeur >= p.min && valeur <= p.max) return null;
  return `Hors de la plage usuelle (${p.texte}) : vérifiez la valeur. Elle reste acceptée.`;
}

/**
 * Bornes PHYSIQUES, distinctes des plages usuelles : au-delà, le calcul refuse
 * la valeur. Miroir des contraintes de l'API (backend/app/core/models.py :
 * confloat(gt=0, le=100) pour Cw et Sr, ge=0 et le=100 pour Bw, w₀ et Am,
 * gt=0 pour les Gs, E/L, l'affaissement et κ).
 */
interface Borne {
  /** Nom court dans le message (« Cw », « l'affaissement »). */
  nom: string;
  min: number;
  minInclus: boolean;
  max?: number;
}

export const BORNES: Record<ClePlage, Borne> = {
  cw: { nom: "Cw", min: 0, minInclus: false, max: 100 },
  sr: { nom: "Sr", min: 0, minInclus: false, max: 100 },
  bw: { nom: "Bw", min: 0, minInclus: true, max: 100 },
  w0: { nom: "w₀", min: 0, minInclus: true, max: 100 },
  am: { nom: "Am", min: 0, minInclus: true, max: 100 },
  gs: { nom: "Gs", min: 0, minInclus: false },
  gsLiant: { nom: "Gs", min: 0, minInclus: false },
  gsGranulat: { nom: "Gs", min: 0, minInclus: false },
  el: { nom: "E/L", min: 0, minInclus: false },
  slump: { nom: "l'affaissement", min: 0, minInclus: false },
  kappa: { nom: "κ", min: 0, minInclus: false },
};

/**
 * Message pour une valeur que le calcul refusera, ou null. Il remplace l'avis
 * de plage usuelle (le champ n'affiche jamais les deux).
 */
export function messageHorsBornes(cle: ClePlage, valeur: number | null | undefined): string | null {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return null;
  const b = BORNES[cle];
  const sousMin = b.minInclus ? valeur < b.min : valeur <= b.min;
  const surMax = b.max !== undefined && valeur > b.max;
  if (!sousMin && !surMax) return null;
  const condition = b.max === undefined
    ? "supérieur à 0"
    : b.minInclus ? "compris entre 0 et 100 %" : "supérieur à 0 et au plus 100 %";
  return `Valeur impossible : ${b.nom} doit être ${condition}. Le calcul la refusera.`;
}
