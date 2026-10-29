// frontend/src/lib/placer-popover.ts
// Position de la fiche d'une formule (FormulaPopover), PURE et testable.
//
// Pourquoi (2026-10-26) : la fiche s'ouvrait toujours SOUS la valeur cliquée,
// avec un haut borné à « hauteur − 200 px » et une hauteur jusqu'à 70 % de
// l'écran : ouverte en bas de page, elle sortait de l'écran. Et comme la page
// défile dans `.ui-page` (le document, lui, ne défile pas), faire défiler ne
// la ramenait jamais en vue. Ici :
//   - la fiche s'ouvre sous la valeur s'il y a la place, sinon au-dessus (du
//     côté où il y a le plus d'espace) ;
//   - sa hauteur maximale est la place disponible de ce côté : elle tient
//     toujours entière à l'écran, et son contenu défile à l'intérieur ;
//   - au-dessus, elle est accrochée par le BAS (`bottom`) : sa hauteur réelle,
//     connue seulement après le rendu des formules, n'a pas d'importance.

export interface RectAncre { top: number; bottom: number; left: number }
export interface Vue { largeur: number; hauteur: number }

export interface PlacementPopover {
  left: number;
  width: number;
  /** Distance au haut de l'écran (fiche sous la valeur). */
  top?: number;
  /** Distance au bas de l'écran (fiche au-dessus de la valeur). */
  bottom?: number;
  maxHeight: number;
  cote: "dessous" | "dessus";
}

const LARGEUR_MAX = 420;
const MARGE = 8;
const ECART = 6;
/** Sous cette place, on préfère l'autre côté s'il en offre davantage. */
const HAUTEUR_CONFORT = 260;
/** Hauteur minimale gardée, même quand la valeur sort de l'écran. */
const HAUTEUR_MIN = 120;

const borne = (x: number, min: number, max: number) => Math.min(Math.max(x, min), Math.max(min, max));

export function placerPopover(ancre: RectAncre, vue: Vue): PlacementPopover {
  const width = Math.max(0, Math.min(LARGEUR_MAX, vue.largeur - 3 * MARGE));
  const left = borne(ancre.left, MARGE, vue.largeur - width - MARGE);
  const placeDessous = vue.hauteur - ancre.bottom - ECART - MARGE;
  const placeDessus = ancre.top - ECART - MARGE;
  const dessous = placeDessous >= HAUTEUR_CONFORT || placeDessous >= placeDessus;
  if (dessous) {
    const top = borne(ancre.bottom + ECART, MARGE, vue.hauteur - MARGE - HAUTEUR_MIN);
    return { left, width, top, maxHeight: Math.max(0, vue.hauteur - MARGE - top), cote: "dessous" };
  }
  const bottom = borne(vue.hauteur - ancre.top + ECART, MARGE, vue.hauteur - MARGE - HAUTEUR_MIN);
  return { left, width, bottom, maxHeight: Math.max(0, vue.hauteur - MARGE - bottom), cote: "dessus" };
}
