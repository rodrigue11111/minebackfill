import { describe, it, expect } from "vitest";
import { agesDisponibles, nuageUcs, lignesCsvNuage, lignesProvenanceLabo, AXES_FORMULATION } from "./ucs-formulation";
import { parametresEffectifs } from "./gachee";
import type { Gachee } from "./gachee";
import type { Eprouvette } from "./eprouvette";
import type { Recipe } from "./types";
import { SANS_UNITE, TIRET } from "./format";

function eprouvette(age: number, chargeKn?: number, exclu = false): Eprouvette {
  return {
    id: `e${age}-${chargeKn ?? "x"}-${exclu}`, code: `E-${age}`,
    couleLe: "2026-09-01T12:00:00.000Z", ageJours: age,
    statut: chargeKn === undefined ? "en_cure" : "ecrase",
    essai: chargeKn === undefined ? undefined
      : { date: "2026-09-29T12:00:00.000Z", chargeKn, diametreMm: 50, exclu },
  };
}

function gachee(id: string, eprouvettes: Eprouvette[], extra: Partial<Gachee> = {}): Gachee {
  return {
    id, code: `G-${id}`, creeLe: "2026-09-01T12:00:00.000Z", statut: "terminee",
    formulationLabel: "Mélange 1", categorie: "RPC", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [], eprouvettes,
    parametres: { cwPct: 75, wcRatio: 7.5, bwPct: 5, wPct: 33.3 },
    ...extra,
  };
}

describe("ucs-formulation — agesDisponibles", () => {
  it("ne rend que les âges réellement mesurés, triés et sans doublon", () => {
    // Le sélecteur ne doit jamais proposer un âge non mesuré : cela pousserait
    // à interpoler, c'est-à-dire à inventer une valeur.
    const g = [
      gachee("a", [eprouvette(28, 2.5), eprouvette(7, 1.2)]),
      gachee("b", [eprouvette(28, 3.0), eprouvette(56, 4.0)]),
    ];
    expect(agesDisponibles(g)).toEqual([7, 28, 56]);
  });

  it("ignore une éprouvette encore en cure", () => {
    expect(agesDisponibles([gachee("a", [eprouvette(91)])])).toEqual([]);
  });
});

describe("ucs-formulation — nuageUcs", () => {
  it("rend un point par gâchée, trié par abscisse croissante", () => {
    const g = [
      gachee("a", [eprouvette(28, 3.0)], { parametres: { wcRatio: 9 } }),
      gachee("b", [eprouvette(28, 2.0)], { parametres: { wcRatio: 5 } }),
    ];
    const n = nuageUcs(g, [], "wcRatio", 28);
    expect(n.points.map((p) => p.x)).toEqual([5, 9]);
    expect(n.ecartees).toHaveLength(0);
  });

  it("écarte une gâchée sans mesure à l'âge demandé, en le disant", () => {
    const n = nuageUcs([gachee("a", [eprouvette(7, 2.0)])], [], "wcRatio", 28);
    expect(n.points).toHaveLength(0);
    expect(n.ecartees[0].raison).toContain("28 j");
  });

  it("écarte une gâchée dont toutes les éprouvettes sont exclues, en le disant", () => {
    const n = nuageUcs([gachee("a", [eprouvette(28, 2.0, true)])], [], "wcRatio", 28);
    expect(n.points).toHaveLength(0);
    expect(n.ecartees[0].raison).toContain("exclues");
  });

  it("écarte une gâchée sans paramètre de formulation connu, en le disant", () => {
    const g = gachee("a", [eprouvette(28, 2.0)], { parametres: undefined });
    const n = nuageUcs([g], [], "wcRatio", 28);
    expect(n.points).toHaveLength(0);
    expect(n.ecartees[0].raison).toContain("aucun paramètre");
  });

  it("rattrape une gâchée ancienne via sa formulation d'origine", () => {
    // parametresEffectifs : résolution paresseuse par formulationId, sans
    // migration du localStorage.
    const recette = { wc_ratio: 6.25, solids_mass_pct: 78, bw_mass_pct: 4, w_mass_pct: 28 } as Recipe;
    const g = gachee("a", [eprouvette(28, 2.0)], { parametres: undefined, formulationId: "f1" });
    const n = nuageUcs([g], [{ id: "f1", recipes: [recette] }], "wcRatio", 28);
    expect(n.points).toHaveLength(1);
    expect(n.points[0].x).toBe(6.25);
    expect(n.ecartees).toHaveLength(0);
  });

  it("compte les exclusions sans les moyenner", () => {
    const n = nuageUcs(
      [gachee("a", [eprouvette(28, 2.0), eprouvette(28, 9.9, true)])], [], "wcRatio", 28,
    );
    expect(n.points[0].n).toBe(1);
    expect(n.points[0].nExclus).toBe(1);
  });

  it("chaque axe déclaré est exploitable", () => {
    for (const a of AXES_FORMULATION) {
      const n = nuageUcs([gachee("a", [eprouvette(28, 2.0)])], [], a.cle, 28);
      expect(n.points).toHaveLength(1);
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.unite.length).toBeGreaterThan(0);
      expect(a.unite).not.toBe(TIRET);
    }
  });

  it("l'en-tête CSV d'un axe sans unité n'ajoute pas de parenthèses", () => {
    const enTete = lignesCsvNuage(nuageUcs([], [], "wcRatio", 28), "wcRatio")[0];
    expect(enTete[1]).toBe(AXES_FORMULATION.find((a) => a.cle === "wcRatio")?.label);
    expect(AXES_FORMULATION.find((a) => a.cle === "wcRatio")?.unite).toBe(SANS_UNITE);
  });
});

describe("ucs-formulation — exports", () => {
  it("le CSV porte un en-tête et une ligne par point", () => {
    const n = nuageUcs([gachee("a", [eprouvette(28, 2.0)])], [], "bwPct", 28);
    const l = lignesCsvNuage(n, "bwPct");
    expect(l).toHaveLength(2);
    expect(l[0][0]).toBe("Gâchée");
    expect(String(l[0][1])).toContain("Bw");
    expect(l[1][0]).toBe("G-a");
  });

  it("la provenance est celle des MESURES, pas celle d'un solveur", () => {
    // InstantaneAnalyse porte versionSolveur, pack de conventions et
    // constantes, qui n'ont produit aucune de ces mesures.
    const g = gachee("a", [eprouvette(28, 2.0)], {
      lotResidu: "R-2026-04", protocolesSnapshot: [{ titre: "Malaxage", contenu: "…" }],
    });
    const t = lignesProvenanceLabo([g], "wcRatio", 28).join("\n");
    expect(t).toContain("MESURÉES");
    expect(t).toContain("R-2026-04");
    expect(t).toContain("Malaxage");
    expect(t).toContain("aucun modèle");
  });
});

describe("gachee — parametresEffectifs", () => {
  it("préfère l'instantané figé sur la gâchée", () => {
    const g = gachee("a", [], { parametres: { wcRatio: 1 }, formulationId: "f1" });
    const recette = { wc_ratio: 99 } as Recipe;
    expect(parametresEffectifs(g, [{ id: "f1", recipes: [recette] }])?.wcRatio).toBe(1);
  });

  it("borne recetteIndex quand la formulation a moins de recettes", () => {
    const g = gachee("a", [], { parametres: undefined, formulationId: "f1", recetteIndex: 7 });
    const recettes = [{ wc_ratio: 3 } as Recipe, { wc_ratio: 4 } as Recipe];
    expect(parametresEffectifs(g, [{ id: "f1", recipes: recettes }])?.wcRatio).toBe(4);
  });

  it("rend undefined quand la formulation n'existe plus", () => {
    const g = gachee("a", [], { parametres: undefined, formulationId: "disparue" });
    expect(parametresEffectifs(g, [])).toBeUndefined();
  });
});
