import { describe, expect, it } from "vitest";
import { nomDejaPris, nomParDefautAvecHeure } from "./nom-sauvegarde";

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
