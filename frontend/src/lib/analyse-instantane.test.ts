import { describe, it, expect } from "vitest";
import { lignesResume, lignesMetaCsv, type InstantaneAnalyse } from "./analyse-instantane";

const INST: InstantaneAnalyse = {
  date: "2026-07-24T12:00:00.000Z",
  categorie: "RPG",
  methode: "Cw%",
  parametre: { label: "Bw — dosage de liant (%)", min: 1, max: 10, points: 40 },
  recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5, amPct: 30, gsAgregat: 2.8 },
  liants: [{ code: "CP10", gs: 3.15, fractionPct: 100 }],
  constantes: {
    packLabel: "Intra 2017", masseVolEau: 1000, gravite: 9.81, facteurCone: 2.335,
    coeffSlump: 4950000, constSlump: 235.5122, conventionGs: "base", regleLiant: "solides_totaux",
  },
  versionSolveur: "intra2017-1.0",
};

describe("lignesResume", () => {
  const L = lignesResume(INST);
  const texte = L.join("\n");
  it("contient la provenance essentielle", () => {
    expect(texte).toContain("Catégorie : RPG");
    expect(texte).toContain("Version du solveur : intra2017-1.0");
    expect(texte).toContain("Pack de conventions : Intra 2017");
    expect(texte).toContain("Bw — dosage de liant");
    expect(texte).toContain("Gs agrégat 2,8"); // décimale française
    expect(texte).toContain("CP10");
  });
  it("omet Am/Gs agrégat en RPC (non fournis)", () => {
    const rpc: InstantaneAnalyse = { ...INST, categorie: "RPC", recette: { ...INST.recette, amPct: undefined, gsAgregat: undefined } };
    const t = lignesResume(rpc).join("\n");
    expect(t).not.toContain("Am ");
    expect(t).not.toContain("Gs agrégat");
  });
});

describe("lignesMetaCsv", () => {
  it("préfixe chaque ligne par « # »", () => {
    for (const l of lignesMetaCsv(INST)) expect(l.startsWith("# ")).toBe(true);
  });
});
