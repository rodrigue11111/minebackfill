import { describe, expect, it } from "vitest";
import {
  val, masseRejetSecTotaleKg, masseSolidesTotaleKg, masseRemblaiTotaleKg,
  masseEauDansResidusKg, volumeAirM3, cwCalculePct, cvCalculePct,
  rhoSolideKgM3, gammaSolideKNM3,
} from "./derived";
import type { Recipe } from "./types";

// Fixture : la réponse de l'API pour le « Mélange 1 » du classeur Intra 2017
// (Cw 70 %, Bw 4.5 %, Gs 3.05, GU20/Slag80, VT = 11 000 m³, Sr = 100 %).
// Les valeurs sont celles épinglées par les 339 tests d'or du backend.
const E = 1.3051740368548632;
const GS = 3.0454060859946805;
const VT = 11000;
const VS = VT / (1 + E);
const MELANGE1: Recipe = {
  bulk_density_kg_m3: 1887.310915919127,
  dry_density_kg_m3: 1321.117641143389,
  void_ratio: E,
  gs_backfill: GS,
  bulk_unit_weight_kN_m3: 1887.310915919127 * 9.81 / 1000,
  total_backfill_volume_m3: VT,
  solid_volume_m3: VS,
  void_volume_m3: VT - VS,
  water_volume_m3: 6228.126022533119,
  components: {
    residue_dry_mass_kg: 13906501.485719882,
    residue_wet_mass_kg: 18298028.27068406,
    aggregate_dry_mass_kg: 0,
    binder_total_mass_kg: 625792.5668573947,
    water_total_mass_kg: 6228126.022533119,
  },
};

describe("grandeurs dérivées — Mélange 1 (Intra 2017)", () => {
  it("masse de solides totale = Md du classeur (D39)", () => {
    expect(masseSolidesTotaleKg(MELANGE1)).toBeCloseTo(14532294.052577276, 3);
  });
  it("masse du remblai totale = tonnage du classeur (D46)", () => {
    expect(masseRemblaiTotaleKg(MELANGE1)).toBeCloseTo(20760420.075110396, 3);
  });
  it("eau dans les résidus (D45)", () => {
    expect(masseEauDansResidusKg(MELANGE1)).toBeCloseTo(4391526.784964175, 3);
  });
  it("rejets secs totaux = résidu seul (pas de granulat)", () => {
    expect(masseRejetSecTotaleKg(MELANGE1)).toBeCloseTo(13906501.485719882, 3);
  });
  it("Cw recalculé depuis les masses = 70 %", () => {
    expect(cwCalculePct(MELANGE1)).toBeCloseTo(70.0, 9);
  });
  it("Cv recalculé depuis les volumes = 1/(1+e)", () => {
    expect(cvCalculePct(MELANGE1)).toBeCloseTo(100 / (1 + E), 9);
  });
  it("volume d'air nul à saturation", () => {
    expect(Math.abs(volumeAirM3(MELANGE1))).toBeLessThan(0.01);
  });
  it("rho_s = rho_d(1+e) = Gs x 1000 (D95)", () => {
    expect(rhoSolideKgM3(MELANGE1)).toBeCloseTo(GS * 1000, 6);
  });
  it("gamma_s = rho_s x g/1000 = 29.875 kN/m³ (D96)", () => {
    expect(gammaSolideKNM3(MELANGE1)).toBeCloseTo(29.87543370360782, 6);
  });
});

describe("robustesse", () => {
  it("recette vide -> zéros et nulls, pas de NaN", () => {
    const vide: Recipe = {};
    expect(masseSolidesTotaleKg(vide)).toBe(0);
    expect(cwCalculePct(vide)).toBeNull();
    expect(cvCalculePct(vide)).toBeNull();
    expect(gammaSolideKNM3(vide)).toBeNull();
    expect(rhoSolideKgM3(vide)).toBe(0);
  });
  it("val: NaN et null -> fallback", () => {
    expect(val(NaN, 7)).toBe(7);
    expect(val(null)).toBe(0);
    expect(val(3.5)).toBe(3.5);
  });
});
