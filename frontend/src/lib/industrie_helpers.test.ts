import { describe, expect, it } from "vitest";
import { calculeUsine, facteurRemplacement, computeBinderCost, computeCostPerM3, computeCostPerTonne } from "./industrie_helpers";

describe("calculeUsine — exemple du cours (Dia 83)", () => {
  // M_rh = 70 t/h, Cw_rés = 0.80, Cw = 0.78, Bw = 0.05
  // -> M_rs = 56 t/h, w = 0.282, M_w-aj = 2.58 t/h
  const r = calculeUsine({
    residus_humides_tph: 70,
    cw_residus_pct: 80,
    cw_remblai_pct: 78,
    bw_pct: 5,
  });

  it("résidus secs M_rs = 56 t/h", () => {
    expect(r.residus_secs_tph).toBeCloseTo(56, 9);
  });
  it("teneur en eau du remblai w = 0.2821", () => {
    expect(r.teneur_eau_remblai).toBeCloseTo((1 - 0.78) / 0.78, 9);
  });
  it("eau à ajouter M_w-aj = 2.58 t/h (valeur du cours)", () => {
    expect(r.eau_a_ajouter_tph).toBeCloseTo(2.5846, 3);
  });
  it("liant M_b = 2.8 t/h", () => {
    expect(r.liant_tph).toBeCloseTo(2.8, 9);
  });
  it("bilan de masse : résidus humides + liant + eau ajoutée = remblai total", () => {
    expect(70 + r.liant_tph + r.eau_a_ajouter_tph).toBeCloseTo(r.remblai_total_tph, 9);
  });
});

describe("calculeUsine — cas limites", () => {
  it("Cw résidus <= 0 -> tous les débits à zéro", () => {
    const r = calculeUsine({ residus_humides_tph: 70, cw_residus_pct: 0, cw_remblai_pct: 78, bw_pct: 5 });
    expect(r.residus_secs_tph).toBe(0);
    expect(r.remblai_total_tph).toBe(0);
  });
  it("remblai plus sec que les résidus -> eau à retirer (négatif)", () => {
    const r = calculeUsine({ residus_humides_tph: 70, cw_residus_pct: 70, cw_remblai_pct: 85, bw_pct: 0 });
    expect(r.eau_a_ajouter_tph).toBeLessThan(0);
  });
});

describe("facteurRemplacement (Hassani & Bois 1992)", () => {
  it("N_R = 0.71 * rho_R/rho_0", () => {
    expect(facteurRemplacement(0.71, 2.2, 3.2)).toBeCloseTo(0.71 * 2.2 / 3.2, 12);
  });
  it("N_T = 0.64 * rho_T/rho_0", () => {
    expect(facteurRemplacement(0.64, 1.9, 3.2)).toBeCloseTo(0.64 * 1.9 / 3.2, 12);
  });
  it("rho_0 nul -> 0 (pas de division par zéro)", () => {
    expect(facteurRemplacement(0.71, 2.2, 0)).toBe(0);
  });
});

describe("coûts industrie", () => {
  const recipe = {
    total_backfill_volume_m3: 10,
    components: {
      residue_dry_mass_kg: 8000,
      binder_total_mass_kg: 400,
      binder_c1_mass_kg: 100,
      binder_c2_mass_kg: 300,
      water_total_mass_kg: 2000,
    },
  };
  const general = { binder_count: 2 as const, binder1_type: "GU", binder2_type: "GGBFS" };
  const prices = [
    { code: "GU", price_per_kg: 0.2 },
    { code: "GGBFS", price_per_kg: 0.1 },
  ];

  it("computeBinderCost = somme des masses x prix par ciment", () => {
    expect(computeBinderCost(recipe, prices, [], general)).toBeCloseTo(100 * 0.2 + 300 * 0.1, 9);
  });
  it("prix manquant -> composant compté à zéro (pas de NaN)", () => {
    expect(computeBinderCost(recipe, [prices[0]], [], general)).toBeCloseTo(100 * 0.2, 9);
  });
  it("N liants (5 composants) : TOUS comptés via binders[] + binder_masses_kg", () => {
    // Régression revue P3-P5 : l'ancien trio figé ignorait les composants 4+.
    const recette5 = {
      total_backfill_volume_m3: 10,
      components: {
        binder_total_mass_kg: 500,
        // legacy c1..c3 présents mais la liste N-aire fait foi
        binder_c1_mass_kg: 100, binder_c2_mass_kg: 100, binder_c3_mass_kg: 100,
        binder_masses_kg: [100, 100, 100, 100, 100],
      },
    };
    const general5 = {
      binder_count: 5,
      binders: [
        { code: "A", fraction_pct: 20 }, { code: "B", fraction_pct: 20 },
        { code: "C", fraction_pct: 20 }, { code: "D", fraction_pct: 20 },
        { code: "E", fraction_pct: 20 },
      ],
    };
    const prix5 = [
      { code: "A", price_per_kg: 0.1 }, { code: "B", price_per_kg: 0.1 },
      { code: "C", price_per_kg: 0.1 }, { code: "D", price_per_kg: 0.1 },
      { code: "E", price_per_kg: 0.1 },
    ];
    // 5 x 100 kg x 0.1 $/kg = 50 $ (le trio legacy n'en donnait que 30).
    expect(computeBinderCost(recette5, prix5, [], general5)).toBeCloseTo(50, 9);
  });
  it("vieux résultat sans liste N-aire : repli sur les champs legacy c1..c3", () => {
    const general3 = {
      binder_count: 2,
      binders: [{ code: "GU", fraction_pct: 25 }, { code: "GGBFS", fraction_pct: 75 }],
    };
    expect(computeBinderCost(recipe, prices, [], general3)).toBeCloseTo(100 * 0.2 + 300 * 0.1, 9);
  });
  it("computeCostPerM3", () => {
    expect(computeCostPerM3(recipe, 50)).toBeCloseTo(5, 9);
  });
  it("computeCostPerTonne (masse totale = 10.4 t)", () => {
    expect(computeCostPerTonne(recipe, 50)).toBeCloseTo(50 / 10400 * 1000, 9);
  });
  it("volume nul -> 0", () => {
    expect(computeCostPerM3({ total_backfill_volume_m3: 0 }, 50)).toBe(0);
  });
});
