// frontend/src/lib/format.ts
// Deux aides partagées : parsing d'entrée numérique et formatage d'affichage.
// Avant, `num` était copié ~11 fois et `fmt`/`fmtNum` ~5 fois (avec des
// défauts de décimales divergents — d'où le paramètre explicite conseillé).

/** Parse une saisie en nombre ; 0 si vide/invalide (contrat des formulaires). */
export const num = (v: string): number => {
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};

/** Tiret cadratin affiché pour une valeur absente. */
export const TIRET = "—";

/**
 * Formate un nombre pour l'affichage ; « — » si absent/NaN. Passer `digits`
 * explicitement au site d'appel (les anciens défauts variaient : 2 ou 3).
 */
export const fmt = (v: number | null | undefined, digits = 3): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return TIRET;
  return v.toFixed(digits);
};
