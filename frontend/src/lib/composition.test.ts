import { describe, it, expect } from "vitest";
import { phases, fractions, volumeAir, ternaire } from "./composition";
import type { Recipe } from "./types";

// Recette RPG saturée typique (Sr=100 % -> air ~ 0), volumes + masses cohérents.
const RPG: Recipe = {
  residue_volume_m3: 3, aggregate_volume_m3: 1, binder_volume_m3: 0.5,
  water_volume_m3: 2, solid_volume_m3: 4.5, void_volume_m3: 2,
  components: {
    residue_dry_mass_kg: 9000, aggregate_dry_mass_kg: 2800,
    binder_total_mass_kg: 1500, water_total_mass_kg: 2000,
  },
} as Recipe;

// Recette RPC non saturée (void > eau -> air présent), sans granulat.
const RPC_AIR: Recipe = {
  residue_volume_m3: 3, aggregate_volume_m3: 0, binder_volume_m3: 0.5,
  water_volume_m3: 1.5, solid_volume_m3: 3.5, void_volume_m3: 2,
  components: {
    residue_dry_mass_kg: 9000, aggregate_dry_mass_kg: 0,
    binder_total_mass_kg: 1500, water_total_mass_kg: 1500,
  },
} as Recipe;

describe("volumeAir", () => {
  it("air = vides − eau (au moins 0)", () => {
    expect(volumeAir(RPC_AIR)).toBeCloseTo(0.5, 10);
    expect(volumeAir(RPG)).toBeCloseTo(0, 10); // saturé
  });
  it("jamais négatif (eau > vides par arrondi)", () => {
    expect(volumeAir({ void_volume_m3: 1, water_volume_m3: 1.2 } as Recipe)).toBe(0);
  });
});

describe("phases — volume", () => {
  it("liste les 5 phases quand l'air est présent", () => {
    const ph = phases(RPC_AIR, "volume");
    expect(ph.map((p) => p.cle)).toEqual(["residu", "liant", "eau", "air"]); // granulat=0 filtré
  });
  it("filtre les phases nulles (granulat=0 en RPC)", () => {
    expect(phases(RPC_AIR, "volume").some((p) => p.cle === "granulat")).toBe(false);
  });
  it("fractions volumiques somment à 1", () => {
    const f = fractions(phases(RPG, "volume"));
    expect(f.reduce((s, p) => s + p.frac, 0)).toBeCloseTo(1, 10);
  });
});

describe("phases — masse", () => {
  it("l'air n'a pas de masse (jamais dans la base masse)", () => {
    expect(phases(RPG, "masse").some((p) => p.cle === "air")).toBe(false);
  });
  it("fractions massiques somment à 1", () => {
    const f = fractions(phases(RPG, "masse"));
    expect(f.reduce((s, p) => s + p.frac, 0)).toBeCloseTo(1, 10);
  });
});

describe("ternaire", () => {
  it("base phases : solides/eau/air, somme des fractions = 1", () => {
    const t = ternaire(RPC_AIR, "phases");
    expect(t.sommets).toEqual(["Solides", "Eau", "Air"]);
    expect(t.a + t.b + t.c).toBeCloseTo(1, 10);
  });
  it("base solides : résidu/granulat/liant, somme = 1", () => {
    const t = ternaire(RPG, "solides");
    expect(t.sommets).toEqual(["Résidu", "Granulat", "Liant"]);
    expect(t.a + t.b + t.c).toBeCloseTo(1, 10);
    // le résidu domine la masse solide
    expect(t.a).toBeGreaterThan(t.b);
    expect(t.a).toBeGreaterThan(t.c);
  });
  it("RPC (sans granulat) : point sur l'arête résidu–liant (b=0)", () => {
    expect(ternaire(RPC_AIR, "solides").b).toBe(0);
  });
  it("recette vide -> point au CENTRE (1/3,1/3,1/3), pas un coin", () => {
    const t = ternaire({} as Recipe, "phases");
    expect(t.a).toBeCloseTo(1 / 3, 10);
    expect(t.b).toBeCloseTo(1 / 3, 10);
    expect(t.c).toBeCloseTo(1 / 3, 10);
  });

  it("cohérence : solides du ternaire « phases » = somme Vr+Vg+Vb (comme les barres)", () => {
    const t = ternaire(RPG, "phases");
    const vsSomme = 3 + 1 + 0.5; // Vr+Vg+Vb du fixture
    const vEau = Math.min(2, 2); // eau bornée aux vides
    const total = vsSomme + vEau + 0; // air = 0 (saturé)
    expect(t.a).toBeCloseTo(vsSomme / total, 10);
  });
});

describe("phases — eau bornée aux vides (sur-saturation par arrondi)", () => {
  it("eau > vides (arrondi) -> eau ramenée aux vides, air = 0, somme cohérente", () => {
    const r = {
      residue_volume_m3: 4, aggregate_volume_m3: 0, binder_volume_m3: 0.5,
      water_volume_m3: 2.001, void_volume_m3: 2,
      components: { residue_dry_mass_kg: 1, binder_total_mass_kg: 1, water_total_mass_kg: 1 },
    } as Recipe;
    const ph = phases(r, "volume");
    const eau = ph.find((p) => p.cle === "eau")!;
    expect(eau.valeur).toBe(2); // bornée à void, pas 2.001
    expect(ph.some((p) => p.cle === "air")).toBe(false); // air = 0 -> filtré
  });
});
