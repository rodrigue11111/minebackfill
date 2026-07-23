// frontend/src/lib/composition.ts
// Extraction PURE des phases d'une recette calculée (résidu, granulat, liant,
// eau, air) pour les visuels de composition (barres empilées, diagramme
// ternaire, échantillon). Lit uniquement le résultat DÉJÀ calculé (volumes et
// masses des composants) — aucun calcul physique ici, aucun appel réseau.

import type { Recipe } from "./types";

export type BasePhases = "volume" | "masse";

export interface Phase {
  cle: string;
  label: string;
  couleur: string;
  /** Volume (m³) ou masse (kg) selon la base demandée. */
  valeur: number;
}

// Palette des phases (stable, cohérente entre tous les visuels).
export const COULEURS_PHASE = {
  residu: "#a16207", // brun résidu
  granulat: "#78716c", // gris pierre
  liant: "#2563eb", // bleu liant
  eau: "#0ea5e9", // bleu eau
  air: "#cbd5e1", // gris clair (vides d'air)
} as const;

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Volume d'air (m³) = vides − eau (au moins 0). Nul à saturation (Sr=100 %). */
export function volumeAir(r: Recipe): number {
  return Math.max(0, n(r.void_volume_m3) - n(r.water_volume_m3));
}

/** Volume solide (m³) = résidu + granulat + liant — MÊME source pour TOUS les
 *  visuels (barres, ternaire, échantillon), pour ne jamais diverger même sur
 *  des données partielles d'anciennes sauvegardes. */
function volumeSolides(r: Recipe): number {
  return n(r.residue_volume_m3) + n(r.aggregate_volume_m3) + n(r.binder_volume_m3);
}

/** Volume d'eau affiché, borné aux vides : évite qu'un arrondi (eau ≈ vides à
 *  saturation) rende eau+air > vides et surévalue la part d'eau. */
function volumeEau(r: Recipe): number {
  return Math.min(n(r.water_volume_m3), n(r.void_volume_m3));
}

/** Les phases d'une recette, dans l'ordre d'empilement, valeurs > 0 seulement. */
export function phases(r: Recipe, base: BasePhases): Phase[] {
  if (base === "masse") {
    const c = r.components ?? {};
    return [
      { cle: "residu", label: "Résidu", couleur: COULEURS_PHASE.residu, valeur: n(c.residue_dry_mass_kg) },
      { cle: "granulat", label: "Granulat", couleur: COULEURS_PHASE.granulat, valeur: n(c.aggregate_dry_mass_kg) },
      { cle: "liant", label: "Liant", couleur: COULEURS_PHASE.liant, valeur: n(c.binder_total_mass_kg) },
      { cle: "eau", label: "Eau", couleur: COULEURS_PHASE.eau, valeur: n(c.water_total_mass_kg) },
      // l'air n'a pas de masse
    ].filter((p) => p.valeur > 0);
  }
  return [
    { cle: "residu", label: "Résidu", couleur: COULEURS_PHASE.residu, valeur: n(r.residue_volume_m3) },
    { cle: "granulat", label: "Granulat", couleur: COULEURS_PHASE.granulat, valeur: n(r.aggregate_volume_m3) },
    { cle: "liant", label: "Liant", couleur: COULEURS_PHASE.liant, valeur: n(r.binder_volume_m3) },
    { cle: "eau", label: "Eau", couleur: COULEURS_PHASE.eau, valeur: volumeEau(r) },
    { cle: "air", label: "Air", couleur: COULEURS_PHASE.air, valeur: volumeAir(r) },
  ].filter((p) => p.valeur > 0);
}

/** Fractions (0..1) de chaque phase ; somme = 1 (ou 0 si tout est nul). */
export function fractions(ph: Phase[]): (Phase & { frac: number })[] {
  const tot = ph.reduce((s, p) => s + p.valeur, 0);
  return ph.map((p) => ({ ...p, frac: tot > 0 ? p.valeur / tot : 0 }));
}

export type BaseTernaire = "phases" | "solides";

export interface PointTernaire {
  sommets: [string, string, string];
  couleurs: [string, string, string];
  /** Fractions barycentriques, somme = 1 (a=haut, b=bas-gauche, c=bas-droite). */
  a: number;
  b: number;
  c: number;
}

/**
 * Coordonnées ternaires d'une recette :
 *  - « phases »  : Solides / Eau / Air (par VOLUME) — l'état physique ;
 *  - « solides » : Résidu / Granulat / Liant (par MASSE) — le squelette solide.
 */
export function ternaire(r: Recipe, base: BaseTernaire): PointTernaire {
  // Total nul (recette vide/partielle) -> centre du triangle plutôt qu'un coin.
  const frac = (a: number, b: number, c: number): [number, number, number] => {
    const t = a + b + c;
    return t > 0 ? [a / t, b / t, c / t] : [1 / 3, 1 / 3, 1 / 3];
  };
  if (base === "phases") {
    // MÊME source de solides et d'eau que les barres/l'échantillon (cohérence).
    const [a, b, c] = frac(volumeSolides(r), volumeEau(r), volumeAir(r));
    return { sommets: ["Solides", "Eau", "Air"], couleurs: ["#a16207", COULEURS_PHASE.eau, "#94a3b8"], a, b, c };
  }
  const cp = r.components ?? {};
  const [a, b, c] = frac(n(cp.residue_dry_mass_kg), n(cp.aggregate_dry_mass_kg), n(cp.binder_total_mass_kg));
  return {
    sommets: ["Résidu", "Granulat", "Liant"],
    couleurs: [COULEURS_PHASE.residu, COULEURS_PHASE.granulat, COULEURS_PHASE.liant],
    a, b, c,
  };
}
