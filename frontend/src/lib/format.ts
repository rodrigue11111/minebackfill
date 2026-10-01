// frontend/src/lib/format.ts
// Aides partagées : parsing d'entrée numérique, formatage d'affichage, et les
// deux marques typographiques de l'application (valeur absente, sans unité).
// Avant, `num` était copié ~11 fois et `fmt`/`fmtNum` ~5 fois (avec des
// défauts de décimales divergents, d'où le paramètre explicite conseillé).

/** Parse une saisie en nombre ; 0 si vide/invalide (contrat des formulaires). */
export const num = (v: string): number => {
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};

/**
 * Valeur absente (case de tableau, tuile, champ vide). C'est le SEUL tiret
 * cadratin permis dans les textes de l'application (garde typographie.test.ts) :
 * pour en changer, c'est ici, une ligne. Il doit rester dans la table WinAnsi
 * des PDF (lib/texte-pdf.ts).
 */
export const TIRET = "—";

/**
 * Unité d'une grandeur sans dimension (E/L, e, n, Gs). Marque interne, mais
 * lisible si elle s'affiche (titre d'axe, colonne d'unité).
 */
export const SANS_UNITE = "sans unité";

/** « Libellé (unité) », ou le libellé seul pour une grandeur sans unité. */
export const libelleAvecUnite = (libelle: string, unite: string): string =>
  unite === SANS_UNITE ? libelle : `${libelle} (${unite})`;

/**
 * « valeur unité » (espace insécable : l'unité ne passe pas seule à la ligne),
 * ou la valeur seule (sans unité, ou valeur absente).
 */
export const valeurAvecUnite = (texte: string, unite: string): string =>
  unite === SANS_UNITE || texte === TIRET ? texte : `${texte} ${unite}`;

/**
 * Formate un nombre pour l'affichage ; TIRET si absent/NaN. Passer `digits`
 * explicitement au site d'appel (les anciens défauts variaient : 2 ou 3).
 */
export const fmt = (v: number | null | undefined, digits = 3): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return TIRET;
  return v.toFixed(digits);
};
