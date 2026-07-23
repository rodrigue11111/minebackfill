// frontend/src/lib/analyse-series.ts
// Métadonnées des courbes paramétriques (onglet Analyse) : libellés et unités
// FR des grandeurs de sortie, et des paramètres balayables. Les clés « cle »
// doivent correspondre EXACTEMENT à celles renvoyées par /analyse/balayage
// (backend app/core/analyse.py — _SERIES et BalayageParam).

export type CategorieAnalyse = "RPC" | "RPG";

export interface SortieMeta {
  /** Clé stable renvoyée par le backend. */
  cle: string;
  /** Libellé court affiché (français). */
  label: string;
  /** Unité affichée (« % », « kg/m³ », « — » pour un ratio sans unité). */
  unite: string;
  /** Catégories où la grandeur est pertinente. */
  categories: CategorieAnalyse[];
  couleur: string;
}

// Palette distincte et lisible (une couleur par grandeur).
export const SORTIES: SortieMeta[] = [
  { cle: "wc_ratio", label: "W/C — eau/liant", unite: "—", categories: ["RPC", "RPG"], couleur: "#2563eb" },
  { cle: "solids_mass_pct", label: "Cw — solides", unite: "%", categories: ["RPC", "RPG"], couleur: "#ea580c" },
  { cle: "void_ratio", label: "e — indice des vides", unite: "—", categories: ["RPC", "RPG"], couleur: "#16a34a" },
  { cle: "porosity", label: "n — porosité", unite: "—", categories: ["RPC", "RPG"], couleur: "#7c3aed" },
  { cle: "saturation_pct", label: "Sr — saturation", unite: "%", categories: ["RPC", "RPG"], couleur: "#0891b2" },
  { cle: "w_mass_pct", label: "w — teneur en eau", unite: "%", categories: ["RPC", "RPG"], couleur: "#db2777" },
  { cle: "bw_mass_pct", label: "Bw — liant massique", unite: "%", categories: ["RPC", "RPG"], couleur: "#d97706" },
  { cle: "bv_vol_pct", label: "Bv — liant volumique", unite: "%", categories: ["RPC", "RPG"], couleur: "#65a30d" },
  { cle: "dry_density_kg_m3", label: "ρd — densité sèche", unite: "kg/m³", categories: ["RPC", "RPG"], couleur: "#dc2626" },
  { cle: "bulk_density_kg_m3", label: "ρh — densité humide", unite: "kg/m³", categories: ["RPC", "RPG"], couleur: "#0d9488" },
  { cle: "aggregate_mass_pct", label: "Am — agrégat massique", unite: "%", categories: ["RPG"], couleur: "#9333ea" },
  { cle: "aggregate_vol_pct_of_residue", label: "Av — agrégat volumique", unite: "%", categories: ["RPG"], couleur: "#0284c7" },
];

export interface ParamMeta {
  /** Clé du paramètre balayé (= BalayageParam côté backend). */
  cle: string;
  /** Libellé de l'axe X (français, avec unité). */
  label: string;
  categories: CategorieAnalyse[];
  defautMin: number;
  defautMax: number;
}

export const PARAMS: ParamMeta[] = [
  { cle: "binder_mass_pct", label: "Bw — dosage de liant (%)", categories: ["RPC", "RPG"], defautMin: 1, defautMax: 10 },
  { cle: "solids_mass_pct", label: "Cw — solides massiques (%)", categories: ["RPC", "RPG"], defautMin: 65, defautMax: 85 },
  { cle: "saturation_pct", label: "Sr — saturation (%)", categories: ["RPC", "RPG"], defautMin: 70, defautMax: 100 },
  { cle: "aggregate_fraction_pct", label: "Am — fraction d'agrégat (%)", categories: ["RPG"], defautMin: 0, defautMax: 50 },
];

export const sortiesPour = (cat: CategorieAnalyse) => SORTIES.filter((s) => s.categories.includes(cat));
export const paramsPour = (cat: CategorieAnalyse) => PARAMS.filter((p) => p.categories.includes(cat));
export const paramMeta = (cle: string) => PARAMS.find((p) => p.cle === cle);
export const sortieMeta = (cle: string) => SORTIES.find((s) => s.cle === cle);
