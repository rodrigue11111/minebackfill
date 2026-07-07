// Grandeurs dérivées côté client — calculées à partir d'une recette (Recipe)
// renvoyée par l'API. Utilisées par le panneau de résultats, l'export Excel
// et le PDF (une seule implémentation pour les trois).
//
// Ces fonctions sont pures et testées (derived.test.ts) contre le cas
// « Mélange 1 » du classeur Intra 2017.

import type { Recipe } from "@/lib/types";

/** Valeur numérique sûre : fallback si absente ou NaN. */
export const val = (x: number | null | undefined, fallback = 0) =>
  x === undefined || x === null || Number.isNaN(x) ? fallback : x;

/** Masse de rejets secs totale = résidu sec + granulat sec (kg). */
export const masseRejetSecTotaleKg = (r: Recipe) =>
  val(r?.components?.residue_dry_mass_kg) + val(r?.components?.aggregate_dry_mass_kg);

/** Masse de solides totale = rejets secs + liant (kg). */
export const masseSolidesTotaleKg = (r: Recipe) =>
  masseRejetSecTotaleKg(r) + val(r?.components?.binder_total_mass_kg);

/** Masse totale du remblai = solides + eau (kg). */
export const masseRemblaiTotaleKg = (r: Recipe) =>
  masseSolidesTotaleKg(r) + val(r?.components?.water_total_mass_kg);

/** Eau contenue dans les résidus humides (kg). */
export const masseEauDansResidusKg = (r: Recipe) =>
  val(r?.components?.residue_wet_mass_kg) - val(r?.components?.residue_dry_mass_kg);

/** Volume d'air = vides − eau (m³). Nul à saturation. */
export const volumeAirM3 = (r: Recipe) =>
  val(r?.void_volume_m3) - val(r?.water_volume_m3);

/** Cw recalculé depuis les masses (%) — contrôle de cohérence. */
export const cwCalculePct = (r: Recipe): number | null => {
  const ms = masseSolidesTotaleKg(r);
  const mw = val(r?.components?.water_total_mass_kg);
  const mt = ms + mw;
  if (mt <= 0) return null;
  return (ms / mt) * 100;
};

/** Cv recalculé depuis les volumes (%) — contrôle de cohérence. */
export const cvCalculePct = (r: Recipe): number | null => {
  const vs = val(r?.solid_volume_m3);
  const vt = val(r?.total_backfill_volume_m3);
  if (vt <= 0) return null;
  return (vs / vt) * 100;
};

/**
 * Masse volumique des grains solides rho_s = rho_d x (1 + e) (kg/m³).
 * Équivaut à Gs x rho_eau quelle que soit la constante rho_eau utilisée.
 */
export const rhoSolideKgM3 = (r: Recipe) =>
  (r.dry_density_kg_m3 ?? 0) * (1 + (r.void_ratio ?? 0));

/**
 * Poids volumique des grains solides gamma_s (kN/m³).
 * g est déduit de la recette (gamma_h/rho_h) pour rester cohérent même si
 * la gravité a été modifiée dans Réglages.
 */
export const gammaSolideKNM3 = (r: Recipe): number | null =>
  r.bulk_density_kg_m3
    ? rhoSolideKgM3(r) * ((r.bulk_unit_weight_kN_m3 ?? 0) / r.bulk_density_kg_m3)
    : null;
