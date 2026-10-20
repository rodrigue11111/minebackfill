import { describe, expect, it } from "vitest";
import { nomDejaPris, nomParDefautAvecHeure, homonyme } from "./nom-sauvegarde";

describe("noms des sauvegardes", () => {
  it("le nom proposé porte l'heure : deux sauvegardes du même jour se distinguent", () => {
    expect(nomParDefautAvecHeure("RPC Dosage selon Cw", new Date(2026, 9, 18, 14, 5))).toBe("RPC Dosage selon Cw du 2026-10-18 à 14 h 05");
    expect(nomParDefautAvecHeure("RRC", new Date(2026, 9, 18, 9, 30))).toBe("RRC du 2026-10-18 à 9 h 30");
  });

  it("doublon : espaces des bords et casse ignorées ; nom vide jamais pris", () => {
    expect(nomDejaPris("  Essai 65 ", ["essai 65"])).toBe(true);
    expect(nomDejaPris("Essai 66", ["Essai 65"])).toBe(false);
    expect(nomDejaPris(" ", [" "])).toBe(false);
  });
});

describe("homonyme : le résultat à remplacer", () => {
  it("le plus récent de même nom (liste du plus récent au plus ancien), casse et espaces ignorées", () => {
    const liste = [{ id: "b", label: "Essai 65" }, { id: "a", label: "essai 65 " }, { id: "c", label: "Autre" }];
    expect(homonyme(" ESSAI 65", liste)?.id).toBe("b");
    expect(homonyme("Essai 66", liste)).toBeUndefined();
    expect(homonyme("", liste)).toBeUndefined();
  });
});
