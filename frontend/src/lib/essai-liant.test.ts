import { describe, expect, it } from "vitest";
import { optionsRegleLiant, regleLiantAffichee } from "./essai-liant";

describe("essai-erreur : liant pendant les ajouts (choix par recette)", () => {
  it("RPG : trois choix ; RPC : deux (sans granulat, « résidu seulement » = « garder le Bw »)", () => {
    expect(optionsRegleLiant(true).map((o) => o.valeur)).toEqual(["solides_totaux", "residu_ajoute", "aucun"]);
    expect(optionsRegleLiant(false).map((o) => o.valeur)).toEqual(["solides_totaux", "aucun"]);
  });

  it("sans choix : la règle de la convention ; avec choix : le choix", () => {
    expect(regleLiantAffichee(undefined, "solides_totaux", true)).toBe("solides_totaux");
    expect(regleLiantAffichee(undefined, "residu_ajoute", true)).toBe("residu_ajoute");
    expect(regleLiantAffichee("aucun", "solides_totaux", true)).toBe("aucun");
    // RPC : la règle « gramme » s'affiche « garder le Bw » (même calcul sans granulat).
    expect(regleLiantAffichee(undefined, "residu_ajoute", false)).toBe("solides_totaux");
    expect(regleLiantAffichee("aucun", "residu_ajoute", false)).toBe("aucun");
  });
});
