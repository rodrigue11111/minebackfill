import { describe, expect, it } from "vitest";
import { corpsBalayage, empreinteBalayage, type EntreesBalayage } from "./analyse-corps";
import { defautsCw, defautsRpgCw, useStore } from "./store";

// Recette de base complète (les défauts du magasin, plus une recette Cw).
const entrees = (p: Partial<EntreesBalayage> = {}): EntreesBalayage => {
  const s = useStore.getState();
  return {
    categorie: "RPC",
    general: { ...s.general, container_type: "rayon_hauteur", container_radius: 5, container_height: 20 },
    constantes: s.constantes,
    catalogueLiants: s.catalogue_liants,
    base: { ...defautsCw(), residue_sg: 3.05, residue_w_pct: 20, solid_mass_pct: 75, saturation_pct: 100, binder_pct: [5, 6, undefined, undefined] },
    rpgCw: defautsRpgCw(),
    param: "binder_mass_pct", xMin: 1, xMax: 10, steps: 40,
    bws: [null],
    ...p,
  };
};

describe("Analyse : corps des requêtes et empreinte de la figure", () => {
  it("un corps par variante, avec le paramètre, la plage et la recette de base", () => {
    const corps = corpsBalayage(entrees({ bws: [5, 6] }));
    expect(corps).toHaveLength(2);
    expect(corps[1]).toMatchObject({ category: "RPC", param: "binder_mass_pct", x_min: 1, x_max: 10, steps: 40 });
    expect((corps[1].base_inputs_rpc as { binder_mass_pct_recipes: number[] }).binder_mass_pct_recipes).toEqual([6]);
    expect((corps[0].base_inputs_rpc as { solids_mass_pct: number }).solids_mass_pct).toBe(75);
  });

  it("mêmes entrées : même empreinte ; Cw, κ, moules, contenant, liant, constantes ou plage changés : autre empreinte", () => {
    const e = empreinteBalayage(entrees());
    expect(empreinteBalayage(entrees())).toBe(e);
    const base = entrees().base;
    const s = useStore.getState();
    const variantes: [string, Partial<EntreesBalayage>][] = [
      ["Cw", { base: { ...base, solid_mass_pct: 76 } }],
      ["κ", { base: { ...base, safety_factor: 1.1 } }],
      ["moules", { base: { ...base, desired_qty: 3 } }],
      ["contenant", { general: { ...entrees().general, container_radius: 6 } }],
      ["liant", { catalogueLiants: s.catalogue_liants.map((l, i) => (i === 0 ? { ...l, gs: l.gs + 0.01 } : l)) }],
      ["constantes", { constantes: { ...s.constantes, gravite_m_s2: 9.8 } }],
      ["plage", { xMax: 12 }],
      ["points", { steps: 41 }],
    ];
    for (const [nom, p] of variantes) expect([nom, empreinteBalayage(entrees(p)) !== e]).toEqual([nom, true]);
  });

  it("l'ordre des variantes compte ; RPG : le granulat entre dans la requête", () => {
    expect(empreinteBalayage(entrees({ bws: [5, 6] }))).not.toBe(empreinteBalayage(entrees({ bws: [6, 5] })));
    const rpg = entrees({ categorie: "RPG", rpgCw: { ...defautsRpgCw(), aggregate_fraction_pct: 30, aggregate_sg: 2.65 } });
    expect(corpsBalayage(rpg)[0].base_inputs_rpg).toMatchObject({ aggregate_fraction_pct: 30, aggregate_specific_gravity: 2.65 });
    expect(empreinteBalayage(rpg)).not.toBe(empreinteBalayage({ ...rpg, rpgCw: { ...rpg.rpgCw, aggregate_sg: 2.7 } }));
  });
});
