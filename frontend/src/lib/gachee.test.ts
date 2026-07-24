import { describe, it, expect } from "vitest";
import {
  ecart, horsTolerance, nbHorsTolerance, genererCode, composantsDepuisRecette, parametresDepuisRecette,
  type Gachee, type ComposantPese,
} from "./gachee";
import type { Recipe } from "./types";

function gachee(p: Partial<Gachee>): Gachee {
  return {
    id: "g1", code: "G-20260724-01", creeLe: "2026-07-24T00:00:00Z", statut: "brouillon",
    formulationLabel: "Test", categorie: "RPG", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [], eprouvettes: [], ...p,
  };
}

describe("ecart", () => {
  it("kg et % pesée − cible", () => {
    const e = ecart({ cle: "l", label: "L", cibleKg: 100, peseeKg: 103 })!;
    expect(e.kg).toBeCloseTo(3, 10);
    expect(e.pct).toBeCloseTo(3, 10);
  });
  it("rien de pesé -> null", () => {
    expect(ecart({ cle: "l", label: "L", cibleKg: 100 })).toBeNull();
  });
  it("cible nulle -> % = 0 (pas de division par zéro)", () => {
    expect(ecart({ cle: "l", label: "L", cibleKg: 0, peseeKg: 5 })!.pct).toBe(0);
  });
});

describe("horsTolerance / nbHorsTolerance", () => {
  it("dépasse la tolérance en valeur absolue", () => {
    const c: ComposantPese = { cle: "l", label: "L", cibleKg: 100, peseeKg: 97 };
    expect(horsTolerance(c, 2)).toBe(true); // -3 % > 2 %
    expect(horsTolerance(c, 5)).toBe(false);
  });
  it("compte les composants hors tolérance", () => {
    const g = gachee({ composants: [
      { cle: "a", label: "A", cibleKg: 100, peseeKg: 100.5 }, // 0,5 %
      { cle: "b", label: "B", cibleKg: 100, peseeKg: 110 },   // 10 %
      { cle: "c", label: "C", cibleKg: 100 },                 // non pesé
    ] });
    expect(nbHorsTolerance(g)).toBe(1);
  });
});

describe("genererCode", () => {
  it("incrémente NN parmi les gâchées du même jour", () => {
    const d = new Date("2026-07-24T10:00:00Z");
    expect(genererCode([], d)).toBe("G-20260724-01");
    const existantes = [gachee({ code: "G-20260724-01" }), gachee({ code: "G-20260724-02" })];
    expect(genererCode(existantes, d)).toBe("G-20260724-03");
  });
  it("repart à 01 un autre jour", () => {
    const existantes = [gachee({ code: "G-20260723-05" })];
    expect(genererCode(existantes, new Date("2026-07-24T00:00:00Z"))).toBe("G-20260724-01");
  });
});

describe("composantsDepuisRecette", () => {
  const nom = (i: number) => `Ciment ${i}`;
  it("résidu humide + granulat + liant total + eau (liant simple)", () => {
    const r = { components: {
      residue_wet_mass_kg: 12000, aggregate_dry_mass_kg: 2800,
      binder_total_mass_kg: 1500, water_to_add_mass_kg: 900, binder_masses_kg: [1500],
    } } as Recipe;
    const cs = composantsDepuisRecette(r, nom);
    expect(cs.map((c) => c.cle)).toEqual(["residu", "granulat", "liant", "eau"]);
    expect(cs.find((c) => c.cle === "residu")!.cibleKg).toBe(12000);
  });
  it("détaille les liants quand il y en a plusieurs", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 100, water_to_add_mass_kg: 200,
      binder_masses_kg: [20, 80],
    } } as Recipe;
    const cs = composantsDepuisRecette(r, nom);
    expect(cs.filter((c) => c.cle.startsWith("liant:")).length).toBe(2);
    expect(cs.find((c) => c.cle === "liant:1")!.cibleKg).toBe(80);
  });
  it("omet les composants nuls (RPC sans granulat)", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, aggregate_dry_mass_kg: 0,
      binder_total_mass_kg: 50, water_to_add_mass_kg: 100, binder_masses_kg: [50],
    } } as Recipe;
    expect(composantsDepuisRecette(r, nom).some((c) => c.cle === "granulat")).toBe(false);
  });
  it("omet l'eau quand elle est négative (eau à retirer, non pesable)", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 50,
      water_to_add_mass_kg: -30, binder_masses_kg: [50],
    } } as Recipe;
    expect(composantsDepuisRecette(r, nom).some((c) => c.cle === "eau")).toBe(false);
  });
  it("garde l'indice réel du liant quand une masse intermédiaire est nulle", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 100,
      water_to_add_mass_kg: 200, binder_masses_kg: [20, 0, 80],
    } } as Recipe;
    const cles = composantsDepuisRecette(r, nom).filter((c) => c.cle.startsWith("liant:")).map((c) => c.cle);
    expect(cles).toEqual(["liant:0", "liant:2"]);
  });
});

describe("parametresDepuisRecette", () => {
  it("capture Cw, W/C, Bw, w depuis la recette", () => {
    const r = { solids_mass_pct: 78, wc_ratio: 7.2, bw_mass_pct: 4.5, w_mass_pct: 28 } as Recipe;
    expect(parametresDepuisRecette(r)).toEqual({ cwPct: 78, wcRatio: 7.2, bwPct: 4.5, wPct: 28 });
  });
  it("omet les valeurs absentes ou non finies (undefined)", () => {
    const r = { solids_mass_pct: 78, wc_ratio: null } as unknown as Recipe;
    const p = parametresDepuisRecette(r);
    expect(p.cwPct).toBe(78);
    expect(p.wcRatio).toBeUndefined();
    expect(p.bwPct).toBeUndefined();
  });
});
