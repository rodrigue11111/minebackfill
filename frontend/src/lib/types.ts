// Types partagés du résultat de calcul — miroir des modèles Pydantic du
// backend (backend/app/core/models.py : MixComponentMass, MixState,
// MixDesignResult). Un renommage de champ côté backend doit être répercuté
// ici : les quatre consommateurs (ResultsPanel, exports PDF/Excel,
// FormulaPopover, Historique) lisent ces champs par nom.
//
// Tous les champs sont optionnels : les résultats sauvegardés dans
// localStorage avant un ajout de champ n'ont pas les nouveaux champs.

export interface RecipeComponents {
  residue_dry_mass_kg?: number | null;
  residue_wet_mass_kg?: number | null;
  binder_total_mass_kg?: number | null;
  binder_c1_mass_kg?: number | null;
  binder_c2_mass_kg?: number | null;
  binder_c3_mass_kg?: number | null;
  water_total_mass_kg?: number | null;
  water_to_add_mass_kg?: number | null;
  aggregate_dry_mass_kg?: number | null;
  // Essai-erreur : masses supplémentaires (négatif = à retirer)
  binder_to_add_mass_kg?: number | null;
  binder_c1_to_add_mass_kg?: number | null;
  binder_c2_to_add_mass_kg?: number | null;
  binder_c3_to_add_mass_kg?: number | null;
}

export interface Recipe {
  // Densités (kg/m³)
  bulk_density_kg_m3?: number | null;
  dry_density_kg_m3?: number | null;
  // Ratios et pourcentages
  solids_mass_pct?: number | null;
  saturation_pct?: number | null;
  wc_ratio?: number | null;
  bw_mass_pct?: number | null;
  bv_vol_pct?: number | null;
  cv_vol_pct?: number | null;
  w_mass_pct?: number | null;
  void_ratio?: number | null;
  porosity?: number | null;
  theta_pct?: number | null;
  gs_binder?: number | null;
  gs_backfill?: number | null;
  bulk_unit_weight_kN_m3?: number | null;
  dry_unit_weight_kN_m3?: number | null;
  // Volumes (m³)
  container_volume_m3?: number | null;
  total_backfill_volume_m3?: number | null;
  residue_volume_m3?: number | null;
  binder_volume_m3?: number | null;
  water_volume_m3?: number | null;
  solid_volume_m3?: number | null;
  void_volume_m3?: number | null;
  aggregate_volume_m3?: number | null;
  // Granulat (RPG) — équivalents feuille Intra 2017 (D24/D25, D83-D85)
  aggregate_vol_pct_of_residue?: number | null;
  aggregate_vol_pct_of_backfill?: number | null;
  aggregate_mass_pct?: number | null;
  // Masses des composants
  components?: RecipeComponents | null;
}

export interface MixResult {
  category?: string;
  method?: string;
  general?: Record<string, unknown>;
  recipes: Recipe[];
}

// ── RRC / CRF (remblai rocheux cimenté) — miroir de RrcRecipeState ──

export interface RrcRecipe {
  bw_mass_pct?: number | null;
  wc_ratio?: number | null;
  w_mass_pct?: number | null;
  solids_mass_pct?: number | null;
  retarder_dosage_mass_pct?: number | null;
  total_mass_kg?: number | null;
  crf_volume_m3?: number | null;
  waste_rock_mass_kg?: number | null;
  cement_mass_kg?: number | null;
  fluid_mass_kg?: number | null;
  water_mass_kg?: number | null;
  retarder_mass_kg?: number | null;
  retarder_volume_l?: number | null;
  slurry_mass_kg?: number | null;
  slurry_volume_m3?: number | null;
}

export interface RrcResultat {
  category?: string;
  general?: Record<string, unknown>;
  recipes: RrcRecipe[];
}

/** Accès numérique sûr : null si absent/NaN. */
export const champ = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : v;
