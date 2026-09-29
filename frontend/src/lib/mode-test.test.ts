import { describe, expect, it } from "vitest";
import { lireModeTest } from "./mode-test";

// Le mode test protège la production tant que la synchronisation n'est pas
// prête : toute valeur autre que « false » doit le laisser ACTIF.
describe("mode test — lecture de la variable d'environnement", () => {
  it("variable absente ou vide : mode test actif (défaut sûr)", () => {
    expect(lireModeTest(undefined)).toBe(true);
    expect(lireModeTest("")).toBe(true);
  });

  it("« false » désactive, casse et espaces ignorés", () => {
    expect(lireModeTest("false")).toBe(false);
    expect(lireModeTest(" FALSE ")).toBe(false);
    expect(lireModeTest("False")).toBe(false);
  });

  it("toute autre valeur laisse le mode test actif", () => {
    for (const v of ["true", "0", "non", "no", "fasle", "off"]) {
      expect(lireModeTest(v)).toBe(true);
    }
  });
});
