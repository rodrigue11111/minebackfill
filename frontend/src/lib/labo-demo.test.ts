import { describe, expect, it } from "vitest";
import { laboDemo, MENTION_DEMO_LABO } from "./labo-demo";
import { contrainteKpa } from "./eprouvette";
import { etatGachee } from "./gachee";

describe("démonstration du Labo (/labo?demo=1, 2026-10-30)", () => {
  const d = laboDemo(new Date(2026, 9, 30, 9));

  it("des gâchées aux codes uniques, chaque éprouvette sous le code de sa gâchée", () => {
    const codes = d.gachees.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(d.gachees.length).toBeGreaterThanOrEqual(10);
    for (const g of d.gachees) for (const e of g.eprouvettes) expect(e.code.startsWith(`${g.code}-E`), e.code).toBe(true);
  });

  it("chaque gâchée renvoie à une formulation de la démonstration, une par libellé", () => {
    const ids = new Set(d.formulations.map((f) => f.id));
    for (const g of d.gachees) expect(ids.has(g.formulationId!), g.code).toBe(true);
    const libelles = d.formulations.map((f) => f.label);
    expect(new Set(libelles).size).toBe(libelles.length);
  });

  it("de quoi voir les Résultats UCS : des essais écrasés et des éprouvettes encore en cure", () => {
    const essais = d.gachees.flatMap((g) => g.eprouvettes).filter((e) => e.statut === "ecrase" && contrainteKpa(e.essai) !== null);
    expect(essais.length).toBeGreaterThan(20);
    expect(d.gachees.some((g) => etatGachee(g).etat === "en_cure")).toBe(true);
  });

  it("déterministe pour une date donnée, et la mention dit que rien n'est enregistré", () => {
    expect(laboDemo(new Date(2026, 9, 30, 9))).toEqual(d);
    expect(MENTION_DEMO_LABO).toContain("Rien n'est enregistré");
  });
});
