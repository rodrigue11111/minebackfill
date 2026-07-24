import { describe, it, expect } from "vitest";
import { PROTOCOLES_DEFAUT, snapshotProtocoles, type Protocole } from "./protocole";

describe("PROTOCOLES_DEFAUT", () => {
  it("fournit des procédures de départ avec id, titre et contenu", () => {
    expect(PROTOCOLES_DEFAUT.length).toBeGreaterThanOrEqual(3);
    for (const p of PROTOCOLES_DEFAUT) {
      expect(p.id).toBeTruthy();
      expect(p.titre.trim()).not.toBe("");
      expect(p.contenu.trim()).not.toBe("");
    }
  });
  it("a des identifiants uniques", () => {
    const ids = PROTOCOLES_DEFAUT.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("snapshotProtocoles", () => {
  it("ne garde que titre + contenu", () => {
    const ps: Protocole[] = [{ id: "a", titre: "T", contenu: "C", majLe: "2026-07-24T00:00:00Z" }];
    expect(snapshotProtocoles(ps)).toEqual([{ titre: "T", contenu: "C" }]);
  });
  it("écarte les protocoles entièrement vides", () => {
    const ps: Protocole[] = [
      { id: "a", titre: "Malaxage", contenu: "" },
      { id: "b", titre: "", contenu: "" },
      { id: "c", titre: "", contenu: "Étape" },
    ];
    expect(snapshotProtocoles(ps).map((p) => p.titre || p.contenu)).toEqual(["Malaxage", "Étape"]);
  });
});
