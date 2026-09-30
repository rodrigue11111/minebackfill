// frontend/src/lib/bande-tolerance.ts
// Pesée sur « bande de tolérance » (Labo, maquette A améliorée) : une piste,
// la cible au milieu, la bande claire de ± tolérance autour, et un point à la
// masse réellement pesée. La bande occupe 20 % de la piste (± tolérance =
// ± 10 %) : la piste entière couvre donc ± 5 fois la tolérance ; au-delà, le
// point reste au bord et la pesée est dite « hors échelle ». Module pur, qui
// réutilise ecart() et horsTolerance() de gachee.ts.

import { ecart, horsTolerance, type ComposantPese } from "./gachee";

/** Demi-largeur de la bande de tolérance, en fraction de la piste. */
export const DEMI_BANDE = 0.1;
const BORD = 0.02;

export interface GeometrieBande {
  /** Début et largeur de la bande claire (fractions de la piste). */
  bande: { debut: number; largeur: number };
  /** Position du point (0..1) ; null si le composant n'est pas encore pesé. */
  position: number | null;
  ecart: { kg: number; pct: number } | null;
  horsTolerance: boolean;
  /** L'écart dépasse la piste : le point est collé au bord. */
  horsEchelle: boolean;
}

export function geometrieBande(c: ComposantPese, tolerancePct: number): GeometrieBande {
  const e = ecart(c);
  const tol = tolerancePct > 0 ? tolerancePct : 1;
  const bande = { debut: 0.5 - DEMI_BANDE, largeur: 2 * DEMI_BANDE };
  if (e === null) return { bande, position: null, ecart: null, horsTolerance: false, horsEchelle: false };
  const brute = 0.5 + (e.pct / tol) * DEMI_BANDE;
  const position = Math.min(1 - BORD, Math.max(BORD, brute));
  return { bande, position, ecart: e, horsTolerance: horsTolerance(c, tolerancePct), horsEchelle: brute !== position };
}

/** « +8,0 %, hors tolérance » : l'écart en toutes lettres pour la ligne de pesée. */
export function libelleEcart(g: GeometrieBande): string {
  if (!g.ecart) return "pas encore pesé";
  const pct = `${g.ecart.pct >= 0 ? "+" : "−"}${Math.abs(g.ecart.pct).toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  return g.horsTolerance ? `${pct}, hors tolérance` : pct;
}
