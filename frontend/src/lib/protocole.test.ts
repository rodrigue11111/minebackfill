import { describe, it, expect } from "vitest";
import { PROTOCOLES_DEFAUT, protocolesDefaut, snapshotProtocoles, type Protocole } from "./protocole";

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
  it("les défauts sont gelés (protège le singleton partagé)", () => {
    expect(Object.isFrozen(PROTOCOLES_DEFAUT)).toBe(true);
    expect(Object.isFrozen(PROTOCOLES_DEFAUT[0])).toBe(true);
  });
});

describe("protocolesDefaut", () => {
  it("renvoie une copie fraîche, modifiable et découplée du singleton", () => {
    const a = protocolesDefaut();
    const b = protocolesDefaut();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(PROTOCOLES_DEFAUT[0]);
    a[0].titre = "Modifié";
    expect(PROTOCOLES_DEFAUT[0].titre).not.toBe("Modifié"); // le défaut reste intact
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
