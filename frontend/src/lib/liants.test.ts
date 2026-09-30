import { describe, expect, it } from "vitest";
import { nomLiant } from "./liants";
import type { GeneralInfo, LiantCatalogueItem } from "./store";

const CATALOGUE: LiantCatalogueItem[] = [
  { id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.1543 },
  { id: "liant_slag", code: "SLAG", nom: "Laitier de haut fourneau (GGBFS)", gs: 2.8426 },
];

describe("nomLiant", () => {
  it("lit le nom du catalogue par id, puis par code", () => {
    const g = { binders: [{ id: "liant_cp10", code: "CP10" }, { id: null, code: "SLAG" }] } as GeneralInfo;
    const nom = nomLiant(g, CATALOGUE);
    expect(nom(1)).toBe("Ciment Portland GU (anc. type 10)");
    expect(nom(2)).toBe("Laitier de haut fourneau (GGBFS)");
  });

  it("retombe sur le code, puis sur « Liant n »", () => {
    const g = { binders: [{ id: "inconnu", code: "HS" }, { id: null, code: null }] } as GeneralInfo;
    const nom = nomLiant(g, CATALOGUE);
    expect(nom(1)).toBe("HS");
    expect(nom(2)).toBe("Liant 2");
    expect(nom(5)).toBe("Liant 5");
  });

  it("lit aussi l'ancien schéma binder1/2/3", () => {
    const g = { binder_count: 2, binder1_type: "CP10", binder1_id: "liant_cp10", binder2_type: "SLAG", binder2_id: null } as GeneralInfo;
    const nom = nomLiant(g, CATALOGUE);
    expect(nom(1)).toBe("Ciment Portland GU (anc. type 10)");
    expect(nom(2)).toBe("Laitier de haut fourneau (GGBFS)");
  });

  it("sans catalogue (ancien résultat), le code suffit", () => {
    const g = { binders: [{ id: "liant_cp10", code: "CP10" }] } as GeneralInfo;
    expect(nomLiant(g)(1)).toBe("CP10");
  });
});
