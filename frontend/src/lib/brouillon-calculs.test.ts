import { describe, expect, it } from "vitest";
import { brouillonModifie, extraireBrouillon, migrerBrouillon, patchDepuisBrouillon } from "./brouillon-calculs";

const etat = () => ({
  category: "RPC" as const, method: "dosage_cw",
  cw: { residue_sg: 0, solid_mass_pct: 0, nouveau_champ: 7 }, wb: { residue_sg: 0 }, slump: {}, essai: { base_method: "dosage_cw", ajustements: [] },
  rpgCw: {}, rpgWb: {}, rpgEssai: { base_method: "dosage_cw", ajustements: [] }, rrc: { volume_m3: 1000 },
});

describe("brouillon des formulaires de Calculs", () => {
  it("aller-retour : catégorie, méthode et formulaires ; un champ ajouté depuis garde son défaut", () => {
    const a = { ...etat(), category: "RPG" as const, method: "wb", cw: { residue_sg: 3.4, solid_mass_pct: 78 } };
    const b = JSON.parse(JSON.stringify(extraireBrouillon(a as never)));
    const p = patchDepuisBrouillon(etat() as never, b);
    expect(p).toMatchObject({ category: "RPG", method: "wb", cw: { residue_sg: 3.4, solid_mass_pct: 78, nouveau_champ: 7 } });
  });

  it("illisible, catégorie ou méthode inconnues : ignorées", () => {
    expect(patchDepuisBrouillon(etat() as never, "pas un objet")).toEqual({});
    expect(patchDepuisBrouillon(etat() as never, { category: "XYZ", method: "wb" })).toEqual({});
    expect(patchDepuisBrouillon(etat() as never, { category: "RPG", method: "slump" })).toEqual({ category: "RPG" }); // pas de prédictif en RPG
    expect(patchDepuisBrouillon(etat() as never, { etats: { cw: [1, 2], wb: { residue_sg: 2.7 } } })).toEqual({ wb: { residue_sg: 2.7 } });
  });

  it("modifié seulement si une tranche gardée change", () => {
    const a = etat();
    expect(brouillonModifie(a as never, { ...a } as never)).toBe(false);
    expect(brouillonModifie(a as never, { ...a, cw: { ...a.cw } } as never)).toBe(true);
    expect(brouillonModifie(a as never, { ...a, method: "wb" } as never)).toBe(true);
  });
});

describe("brouillon : version 2, vide distinct de zéro", () => {
  it("v1 -> v2 : les 0 des champs saisis et des tableaux deviennent vides ; compteurs et autres valeurs gardés", () => {
    const v1 = { category: "RPC", method: "dosage_cw", etats: {
      cw: { solid_mass_pct: 0, saturation_pct: 100, residue_sg: 0, residue_w_pct: 0, num_recipes: 2, desired_qty: 3, safety_factor: 1, binder_pct: [0, 4.5, 0, 0] },
      rrc: { retarder_d0: 0, cement_sg: 0, binder_pct: [5, 0, 6, 7] },
      essai: { base_method: "wb", ajustements: [{ ajout_eau: 0 }] },
    } };
    const v2 = migrerBrouillon(v1, 1) as { etats: Record<string, Record<string, unknown>> };
    expect(v2.etats.cw).toEqual({ saturation_pct: 100, num_recipes: 2, desired_qty: 3, safety_factor: 1, binder_pct: [null, 4.5, null, null] });
    expect(v2.etats.rrc).toEqual({ retarder_d0: 0, binder_pct: [5, null, 6, 7] }); // D0 = 0 : aucun retardateur, valeur réelle
    expect(v2.etats.essai).toEqual(v1.etats.essai);
    // Relu : null redevient vide, fusionné sur les défauts.
    const p = patchDepuisBrouillon({ ...etat(), cw: { residue_sg: undefined, binder_pct: [undefined, undefined, undefined, undefined] } } as never, v2) as { cw: Record<string, unknown> };
    expect(p.cw.binder_pct).toEqual([undefined, 4.5, undefined, undefined]);
    expect(p.cw.residue_sg).toBeUndefined();
    expect(p.cw.saturation_pct).toBe(100);
  });

  it("v2 relu tel quel ; illisible rendu tel quel", () => {
    const v2 = { etats: { cw: { residue_w_pct: 0 } } };
    expect(migrerBrouillon(v2, 2)).toBe(v2);
    expect(migrerBrouillon("{pas du json", 1)).toBe("{pas du json");
  });
});
