import { describe, it, expect } from "vitest";
import { lignesResume, lignesMetaCsv, type InstantaneAnalyse } from "./analyse-instantane";

const INST: InstantaneAnalyse = {
  date: "2026-07-24T12:00:00.000Z",
  categorie: "RPG",
  methode: "Cw%",
  parametre: { label: "Taux massique de liant Bw (%)", min: 1, max: 10, points: 40 },
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
    expect(texte).toContain("Taux massique de liant Bw");
    expect(texte).toContain("Gs granulat 2,8"); // décimale française
    expect(texte).toContain("CP10");
  });
  it("omet Am/Gs granulat en RPC (non fournis)", () => {
    const rpc: InstantaneAnalyse = { ...INST, categorie: "RPC", recette: { ...INST.recette, amPct: undefined, gsAgregat: undefined } };
    const t = lignesResume(rpc).join("\n");
    expect(t).not.toContain("Am ");
    expect(t).not.toContain("Gs granulat");
  });
});

describe("lignesMetaCsv", () => {
  it("préfixe chaque ligne par « # »", () => {
    for (const l of lignesMetaCsv(INST)) expect(l.startsWith("# ")).toBe(true);
  });
});

describe("analyse-instantane — champs ajoutés (contenant, sorties)", () => {
  // Tous ces champs sont OPTIONNELS : un instantané d'avant 2026-09-27 doit
  // rester lisible, et lignesResume doit simplement les omettre.
  function base(): InstantaneAnalyse {
    return {
      date: "2026-09-27T12:00:00.000Z", categorie: "RPC", methode: "Cw%",
      recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5 },
      liants: [], versionSolveur: "intra2017-1",
      constantes: {
        packLabel: "Intra 2017", masseVolEau: 1000, gravite: 9.81,
        facteurCone: 2.335, coeffSlump: 4950000, constSlump: 235.5122,
        conventionGs: "base", regleLiant: "solides_totaux",
      },
    };
  }

  it("un instantané sans les nouveaux champs reste lisible", () => {
    const t = lignesResume(base()).join("\n");
    expect(t).toContain("Version du solveur");
    expect(t).not.toContain("Contenant :");
    expect(t).not.toContain("Grandeurs tracées");
  });

  it("le contenant, son nombre et le facteur de sécurité sont imprimés", () => {
    const t = lignesResume({
      ...base(), contenant: { type: "rayon_hauteur" }, contenants: 3, facteurSecurite: 1.1,
    }).join("\n");
    expect(t).toContain("rayon_hauteur");
    expect(t).toContain("3 contenant(s)");
    expect(t).toContain("facteur de perte κ");
  });

  it("les grandeurs tracées sont imprimées", () => {
    const t = lignesResume({ ...base(), sorties: ["Rapport eau/liant E/L", "Masse de liant"] }).join("\n");
    expect(t).toContain("Masse de liant");
  });

  it("un balayage annonce que l'export est en valeurs absolues", () => {
    // Le sous-mode « écart % » est choisi APRÈS le calcul : il n'a pas sa place
    // dans l'instantané, mais ce que contient l'export peut être affirmé.
    const avec = lignesResume({
      ...base(), parametre: { label: "Bw", min: 2, max: 10, points: 40 },
    }).join("\n");
    expect(avec).toContain("valeurs absolues");
    // En composition (pas de paramètre), la mention n'a aucun sens.
    expect(lignesResume(base()).join("\n")).not.toContain("valeurs absolues");
  });
});
