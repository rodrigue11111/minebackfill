import type {
  GeneralInfo,
  ConstantesCalcul,
  LiantCatalogueItem,
  BinderPrice,
  IndustrieState,
} from "@/lib/store";
import { prixPourLiant } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import {
  construireSystemeLiant,
  construireGeneralPayload,
  construireConstantesPayload,
} from "@/lib/rpc_payload";

/**
 * Build a Cw% payload for a single Bw% level.
 * Works for both RPC and RPG catégories.
 */
export function buildCwPayload(
  bwPct: number,
  params: IndustrieState,
  general: GeneralInfo,
  catalogue: LiantCatalogueItem[],
  constantes: ConstantesCalcul,
) {
  const base = {
    category: params.category,
    general: construireGeneralPayload(general),
    constants: construireConstantesPayload(constantes),
    residue: {
      specific_gravity: params.residue_sg || 0,
      moisture_mass_pct: params.residue_w_pct || 0,
    },
    binder_system: construireSystemeLiant(general, catalogue),
    num_recipes: 1 as const,
    containers_per_recipe: params.desired_qty || 1,
    safety_factor: params.safety_factor || 1,
    saturation_pct: params.saturation_pct || 100,
    solids_mass_pct: params.solids_mass_pct || 78,
    binder_mass_pct_recipes: [bwPct],
  };

  if (params.category === "RPG") {
    return {
      ...base,
      aggregate_fraction_pct: params.aggregate_fraction_pct || 0,
      aggregate_specific_gravity: params.aggregate_sg || 0,
    };
  }

  return base;
}

/**
 * Compute total binder cost from a recipe result.
 */
export function computeBinderCost(
  recipe: Recipe,
  binderPrices: BinderPrice[],
  catalogue: LiantCatalogueItem[],
  general: GeneralInfo,
): number {
  if (!recipe?.components) return 0;

  let total = 0;
  const bcount = general.binder_count ?? 1;

  for (let i = 1; i <= bcount; i++) {
    const code = general[`binder${i}_type` as keyof GeneralInfo] as string | undefined;
    const massKey = `binder_c${i}_mass_kg` as keyof NonNullable<Recipe["components"]>;
    const mass = (recipe.components?.[massKey] as number | null | undefined) ?? 0;
    if (!code) continue;
    // Correspondance par id (résolu via le catalogue) puis repli par code.
    const id = catalogue.find((l) => l.code === code)?.id;
    total += mass * prixPourLiant(binderPrices, { id, code });
  }

  return total;
}

/**
 * Cost per cubic metre of backfill.
 */
export function computeCostPerM3(recipe: Recipe, binderCost: number): number {
  const vol = recipe?.total_backfill_volume_m3;
  if (!vol || vol <= 0) return 0;
  return binderCost / vol;
}

/**
 * Cost per tonne of backfill.
 */
export function computeCostPerTonne(recipe: Recipe, binderCost: number): number {
  const comp = recipe?.components;
  if (!comp) return 0;
  const totalMassKg =
    (comp.residue_dry_mass_kg ?? 0) +
    (comp.aggregate_dry_mass_kg ?? 0) +
    (comp.binder_total_mass_kg ?? 0) +
    (comp.water_total_mass_kg ?? 0);
  if (totalMassKg <= 0) return 0;
  return (binderCost / totalMassKg) * 1000; // per tonne
}

/* ══════════════════════════════════════════════════════════════════
   Calculs à l'usine de remblai — cours, Dias 72-83 (débits continus)
   ══════════════════════════════════════════════════════════════════ */

export interface UsineParams {
  /** Débit de résidus humides en entrée d'usine (t/h). */
  residus_humides_tph: number;
  /** % solide des résidus en entrée (0-100), ex. 80. */
  cw_residus_pct: number;
  /** % solide cible du remblai (0-100), ex. 78. */
  cw_remblai_pct: number;
  /** Taux de liant Bw (%) du mélange, ex. 5. */
  bw_pct: number;
}

export interface UsineResultat {
  residus_secs_tph: number;     // M_rs = M_rh * Cw_rés
  eau_residus_tph: number;      // eau contenue dans les résidus
  liant_tph: number;            // M_b = Bw * M_rs
  eau_a_ajouter_tph: number;    // M_w-aj (formule Dia 83) — négatif = à retirer
  remblai_total_tph: number;    // (M_rs + M_b) / Cw
  teneur_eau_remblai: number;   // w = (1-Cw)/Cw (fraction)
}

/**
 * Formule dérivée du cours (Dia 83) :
 *   M_w-aj = M_rs * [ (1+Bw)*(1-Cw)/Cw − (1−Cw_rés)/Cw_rés ]
 * Exemple du cours : M_rh = 70 t/h, Cw_rés = 0.80, Cw = 0.78, Bw = 0.05
 *   -> M_rs = 56 t/h et M_w-aj = 2.58 t/h.
 */
export function calculeUsine(p: UsineParams): UsineResultat {
  const cwRes = (p.cw_residus_pct || 0) / 100;
  const cw = (p.cw_remblai_pct || 0) / 100;
  const bw = (p.bw_pct || 0) / 100;
  const mrh = p.residus_humides_tph || 0;

  if (cwRes <= 0 || cw <= 0) {
    return { residus_secs_tph: 0, eau_residus_tph: 0, liant_tph: 0,
             eau_a_ajouter_tph: 0, remblai_total_tph: 0, teneur_eau_remblai: 0 };
  }

  const mrs = mrh * cwRes;
  const w = (1 - cw) / cw;
  const mwaj = mrs * ((1 + bw) * w - (1 - cwRes) / cwRes);   // [Dia 83]
  const mb = bw * mrs;
  const total = (mrs + mb) / cw;

  return {
    residus_secs_tph: mrs,
    eau_residus_tph: mrh - mrs,
    liant_tph: mb,
    eau_a_ajouter_tph: mwaj,
    remblai_total_tph: total,
    teneur_eau_remblai: w,
  };
}

/**
 * Facteurs de remplacement de Hassani & Bois (1992) — Dias 73-75 :
 *   N_R = 0.71 * rho_R / rho_0   (remblai rocheux)
 *   N_T = 0.64 * rho_T / rho_0   (remblai hydraulique / en pâte)
 * Masse de remblai nécessaire = M_minerai * N.
 */
export function facteurRemplacement(coeff: 0.71 | 0.64, rho_remblai: number, rho_minerai: number): number {
  if (!rho_minerai || rho_minerai <= 0) return 0;
  return coeff * rho_remblai / rho_minerai;
}
