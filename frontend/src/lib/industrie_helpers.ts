import type {
  GeneralInfo,
  ConstantesCalcul,
  LiantCatalogueItem,
  BinderPrice,
  IndustrieState,
} from "@/lib/store";
import {
  construireSystemeLiant,
  construireGeneralPayload,
  construireConstantesPayload,
} from "@/lib/rpc_payload";

/**
 * Build a Cw% payload for a single Bw% level.
 * Works for both RPC and RPG categories.
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
    solids_mass_pct: 78, // placeholder — will be overridden by Bw%
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
  recipe: any,
  binderPrices: BinderPrice[],
  catalogue: LiantCatalogueItem[],
  general: GeneralInfo,
): number {
  if (!recipe?.components) return 0;

  const priceMap = new Map(binderPrices.map((p) => [p.code, p.price_per_kg]));
  let total = 0;
  const bcount = general.binder_count ?? 1;

  for (let i = 1; i <= bcount; i++) {
    const code = general[`binder${i}_type` as keyof GeneralInfo] as string | undefined;
    const massKey = `binder_c${i}_mass_kg` as string;
    const mass = recipe.components[massKey] ?? 0;
    const price = (code && priceMap.get(code)) || 0;
    total += mass * price;
  }

  return total;
}

/**
 * Cost per cubic metre of backfill.
 */
export function computeCostPerM3(recipe: any, binderCost: number): number {
  const vol = recipe?.total_backfill_volume_m3;
  if (!vol || vol <= 0) return 0;
  return binderCost / vol;
}

/**
 * Cost per tonne of backfill.
 */
export function computeCostPerTonne(recipe: any, binderCost: number): number {
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
