import { describe, expect, it } from "vitest";
import { corpsBalayage, empreinteBalayage, payloadBase, type EntreesBalayage } from "./analyse-corps";
import { packById } from "./conventions";
import type { GeneralInfo } from "./store";

// Base tirée d'un calcul sauvegardé (analyse-source.ts) : recette, matériaux,
// liants résolus, constantes du calcul et volume total de la recette.
const entrees = (p: Partial<EntreesBalayage> = {}): EntreesBalayage => ({
  categorie: "RPC",
  general: { operator_name: "Op", project_name: "Projet", container_type: "rayon_hauteur", container_radius: 5, container_height: 20 } as GeneralInfo,
  constantes: packById("gramme")!.constantes,
  liants: [
    { code: "GU", nom: "GU", gs: 3.15, fraction: 0.2, origine: "calcul" },
    { code: "Slag", nom: "Laitier", gs: 2.9, fraction: 0.8, origine: "calcul" },
  ],
  materiaux: { gsResidu: 3.05, w0Pct: 20 },
  recette: { cwPct: 75, srPct: 100, bwPct: 5, volumeM3: 0.0123 },
  cleSource: "sr_1#0",
  param: "binder_mass_pct", xMin: 1, xMax: 10, steps: 40,
  variantes: null,
  ...p,
});

describe("Analyse : corps des requêtes", () => {
  it("corps « or » RPC : une recette, contenant « volume » au volume total, κ = 1, liants résolus", () => {
    const b = payloadBase(entrees());
    expect(b).toMatchObject({
      category: "RPC",
      num_recipes: 1, containers_per_recipe: 1, safety_factor: 1,
      residue: { specific_gravity: 3.05, moisture_mass_pct: 20 },
      binder_system: { components: [
        { type: "GU", specific_gravity: 3.15, mass_fraction: 0.2 },
        { type: "Slag", specific_gravity: 2.9, mass_fraction: 0.8 },
      ] },
      solids_mass_pct: 75, saturation_pct: 100, binder_mass_pct_recipes: [5],
      constants: { water_density: 1000, gravity: 9.81 },
    });
    const g = b.general as Record<string, unknown>;
    expect(g).toMatchObject({ operator_name: "Op", project_name: "Projet", container_type: "volume", container_volume_m3: 0.0123 });
    // Les dimensions du moule d'origine ne sont pas envoyées : seul compte le volume analysé.
    expect(g.container_radius).toBeNull();
    expect(g.container_height).toBeNull();
    expect(b).not.toHaveProperty("aggregate_fraction_pct");
  });

  it("RPG : Am de la recette et Gs du granulat du calcul", () => {
    const rpg = entrees({ categorie: "RPG", materiaux: { gsResidu: 3.05, w0Pct: 20, gsGranulat: 2.65 }, recette: { cwPct: 78, srPct: 100, bwPct: 4, amPct: 30, volumeM3: 0.02 } });
    expect(corpsBalayage(rpg)[0].base_inputs_rpg).toMatchObject({ aggregate_fraction_pct: 30, aggregate_specific_gravity: 2.65 });
  });

  it("un corps par variante, chacune avec SA recette (Cw, Sr, Bw, Am, volume)", () => {
    const corps = corpsBalayage(entrees({ variantes: [
      { cwPct: 75, srPct: 100, bwPct: 5, volumeM3: 0.0123 },
      { cwPct: 76.1, srPct: 98, bwPct: 6, volumeM3: 0.0125 },
    ] }));
    expect(corps).toHaveLength(2);
    expect(corps[1]).toMatchObject({ category: "RPC", param: "binder_mass_pct", x_min: 1, x_max: 10, steps: 40 });
    expect(corps[1].base_inputs_rpc).toMatchObject({ solids_mass_pct: 76.1, saturation_pct: 98, binder_mass_pct_recipes: [6] });
    expect((corps[1].base_inputs_rpc as { general: { container_volume_m3: number } }).general.container_volume_m3).toBe(0.0125);
  });
});

describe("Analyse : empreinte de la figure", () => {
  it("mêmes entrées : même empreinte ; chaque entrée changée, ou un autre calcul : autre empreinte", () => {
    const e = empreinteBalayage(entrees());
    expect(empreinteBalayage(entrees())).toBe(e);
    const base = entrees();
    const changements: [string, Partial<EntreesBalayage>][] = [
      ["calcul ou recette", { cleSource: "sr_2#0" }],
      ["Cw", { recette: { ...base.recette, cwPct: 76 } }],
      ["volume", { recette: { ...base.recette, volumeM3: 0.013 } }],
      ["Gs du résidu", { materiaux: { ...base.materiaux, gsResidu: 3.1 } }],
      ["w₀", { materiaux: { ...base.materiaux, w0Pct: 21 } }],
      ["liant", { liants: base.liants.map((l, i) => (i === 0 ? { ...l, gs: 3.16 } : l)) }],
      ["constantes", { constantes: { ...base.constantes, gravite_m_s2: 9.8 } }],
      ["plage", { xMax: 12 }],
      ["points", { steps: 41 }],
      ["paramètre", { param: "saturation_pct" }],
    ];
    for (const [nom, p] of changements) expect([nom, empreinteBalayage(entrees(p)) !== e]).toEqual([nom, true]);
  });

  it("l'ordre des variantes compte", () => {
    const a = { cwPct: 75, srPct: 100, bwPct: 5, volumeM3: 0.0123 };
    const b = { cwPct: 75, srPct: 100, bwPct: 6, volumeM3: 0.0123 };
    expect(empreinteBalayage(entrees({ variantes: [a, b] }))).not.toBe(empreinteBalayage(entrees({ variantes: [b, a] })));
  });
});
