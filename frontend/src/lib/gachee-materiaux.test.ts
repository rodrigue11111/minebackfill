import { describe, expect, it } from "vitest";
import { materiauxDepuisFormulation } from "./gachee-materiaux";
import type { GeneralInfo, LiantCatalogueItem, SavedResult } from "./store";
import type { GranulatItem, ResiduItem } from "./materials";

const CATALOGUE: LiantCatalogueItem[] = [
  { id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.1543 },
  { id: "liant_slag", code: "SLAG", nom: "Laitier de haut fourneau (GGBFS)", gs: 2.8426 },
];
const RESIDUS: ResiduItem[] = [
  { id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, provenance: "LaRonde", origine: "officiel" },
];
const GRANULATS: GranulatItem[] = [
  { id: "gra_laronde", nom: "Concassé LaRonde", gs: 2.8, humidite_pct: 0, provenance: "LaRonde", origine: "officiel" },
];
const BIB = { residus: RESIDUS, granulats: GRANULATS };

type Form = Pick<SavedResult, "category" | "general" | "catalogue_liants" | "selectedMaterials" | "inputs">;
const form = (p: Partial<Form>): Form => ({
  category: "RPC",
  general: { binders: [{ id: "liant_cp10", code: "CP10", fraction_pct: 80 }, { id: "liant_slag", code: "SLAG", fraction_pct: 20 }] } as GeneralInfo,
  catalogue_liants: CATALOGUE,
  ...p,
});

describe("materiauxDepuisFormulation", () => {
  it("liants : nom du catalogue figé, Gs et fraction de chaque composant", () => {
    const m = materiauxDepuisFormulation(form({}), BIB);
    expect(m.liants).toEqual([
      { id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.1543, fractionPct: 80 },
      { id: "liant_slag", code: "SLAG", nom: "Laitier de haut fourneau (GGBFS)", gs: 2.8426, fractionPct: 20 },
    ]);
  });

  it("liants : lit aussi l'ancien schéma binder1/2/3", () => {
    const general = { binder_count: 1, binder1_id: null, binder1_type: "CP10", binder1_fraction_pct: 100 } as unknown as GeneralInfo;
    const m = materiauxDepuisFormulation(form({ general }), BIB);
    expect(m.liants).toEqual([{ id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.1543, fractionPct: 100 }]);
  });

  it("résidu de la bibliothèque quand la formulation le référence", () => {
    const m = materiauxDepuisFormulation(form({ selectedMaterials: { residueId: "res_laronde" } }), BIB);
    expect(m.residu).toEqual({ id: "res_laronde", nom: "Résidus LaRonde", provenance: "LaRonde", gs: 3.1, w0Pct: 25, catalogue: "officiel" });
  });

  it("sinon, repli sur l'identification du résidu et les valeurs du calcul (méthode de base de l'essai-erreur comprise)", () => {
    const general = { binders: [], residue_id: "R-2026-A" } as unknown as GeneralInfo;
    const m = materiauxDepuisFormulation(form({ general, inputs: { base_method: "dosage_cw", base_cw: { residue_sg: 3.4, residue_w_pct: 23.8 } } }), BIB);
    expect(m.residu).toEqual({ nom: "R-2026-A", gs: 3.4, w0Pct: 23.8 });
    expect(m.liants).toBeUndefined();
  });

  it("granulat seulement en RPG, depuis la bibliothèque ou le calcul", () => {
    expect(materiauxDepuisFormulation(form({ selectedMaterials: { aggregateId: "gra_laronde" } }), BIB).granulat).toBeUndefined();
    const rpg = materiauxDepuisFormulation(form({ category: "RPG", selectedMaterials: { aggregateId: "gra_laronde" } }), BIB);
    expect(rpg.granulat).toEqual({ id: "gra_laronde", nom: "Concassé LaRonde", provenance: "LaRonde", gs: 2.8, humiditePct: 0 });
    const rpg2 = materiauxDepuisFormulation(form({ category: "RPG", inputs: { aggregate_sg: 2.65 } }), BIB);
    expect(rpg2.granulat).toEqual({ gs: 2.65 });
  });

  it("formulation sans information : instantané vide, sans clé undefined", () => {
    const general = { binders: [] } as unknown as GeneralInfo;
    const m = materiauxDepuisFormulation({ category: "RPC", general }, BIB);
    expect(m).toEqual({});
    expect(JSON.stringify(m)).toBe("{}");
  });
});
