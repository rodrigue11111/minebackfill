import { describe, expect, it } from "vitest";
import { brouillonModifie, extraireBrouillon, patchDepuisBrouillon } from "./brouillon-calculs";

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
