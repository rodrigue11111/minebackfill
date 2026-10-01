import { describe, it, expect } from "vitest";
import { estParamCle, valeurReference, tenuFixe, type ParamCle } from "./analyse-fixe";
import { PARAMS } from "./analyse-series";
import type { InstantaneAnalyse } from "./analyse-instantane";
import { libelle } from "./glossaire";

function inst(extra: Partial<InstantaneAnalyse> = {}): InstantaneAnalyse {
  return {
    date: "2026-09-27T12:00:00.000Z", categorie: "RPC", methode: "Cw%",
    recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5 },
    liants: [{ code: "GU", gs: 3.15, fractionPct: 100 }],
    versionSolveur: "intra2017-1",
    constantes: {
      packLabel: "Intra 2017", masseVolEau: 1000, gravite: 9.81,
      facteurCone: 2.335, coeffSlump: 4950000, constSlump: 235.5122,
      conventionGs: "base", regleLiant: "solides_totaux",
    },
    ...extra,
  };
}

const instRpg = () => inst({
  categorie: "RPG",
  recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5, amPct: 20, gsAgregat: 2.7 },
});

describe("analyse-fixe — valeurReference", () => {
  it("rend la valeur de base de chacun des quatre paramètres", () => {
    const r = instRpg().recette;
    expect(valeurReference("binder_mass_pct", r)).toBe(5);
    expect(valeurReference("solids_mass_pct", r)).toBe(75);
    expect(valeurReference("saturation_pct", r)).toBe(100);
    expect(valeurReference("aggregate_fraction_pct", r)).toBe(20);
  });

  it("rend null pour Am quand la recette n'en porte pas (cas RPC)", () => {
    expect(valeurReference("aggregate_fraction_pct", inst().recette)).toBeNull();
  });

  it("couvre TOUS les paramètres déclarés dans PARAMS", () => {
    // Anti-dérive : un paramètre ajouté à PARAMS mais absent de ParamCle
    // n'aurait pas de référence, donc pas de trait orange et un écart % ancré
    // silencieusement sur le premier point.
    for (const p of PARAMS) {
      expect(estParamCle(p.cle)).toBe(true);
      expect(() => valeurReference(p.cle as ParamCle, instRpg().recette)).not.toThrow();
    }
  });
});

// Libellé de chaque paramètre balayable dans la liste « tenu fixe ».
const LIBELLE_FIXE: Record<ParamCle, string> = {
  binder_mass_pct: libelle("bw"),
  solids_mass_pct: libelle("cw"),
  saturation_pct: libelle("sr"),
  aggregate_fraction_pct: libelle("am"),
};
const CLES = Object.keys(LIBELLE_FIXE) as ParamCle[];

describe("analyse-fixe — tenuFixe", () => {
  it("retire le paramètre balayé de la liste et garde les trois autres", () => {
    for (const balaye of CLES) {
      const labels = tenuFixe(instRpg(), balaye).map((x) => x.label);
      expect(labels).not.toContain(LIBELLE_FIXE[balaye]);
      for (const autre of CLES.filter((c) => c !== balaye)) expect(labels).toContain(LIBELLE_FIXE[autre]);
    }
  });

  it("n'annonce Am et le Gs du granulat qu'en RPG", () => {
    const rpc = tenuFixe(inst(), "binder_mass_pct").map((x) => x.label);
    expect(rpc).not.toContain(LIBELLE_FIXE.aggregate_fraction_pct);
    expect(rpc).not.toContain("Gs du granulat");
    const rpg = tenuFixe(instRpg(), "binder_mass_pct").map((x) => x.label);
    expect(rpg).toContain(LIBELLE_FIXE.aggregate_fraction_pct);
    expect(rpg).toContain("Gs du granulat");
  });

  it("dit que le balayage réduit la base à une seule recette", () => {
    // Comportement non évident : _override force num_recipes = 1 et reprend le
    // premier dosage de liant. Une personne ayant saisi trois recettes doit
    // savoir que les deux autres sont ignorées.
    const t = tenuFixe(inst(), "solids_mass_pct");
    expect(t.find((x) => x.label === "Recettes")?.valeur).toContain("1");
  });

  it("omet le contenant quand l'instantané est ancien (champs absents)", () => {
    const labels = tenuFixe(inst(), "binder_mass_pct").map((x) => x.label);
    expect(labels).not.toContain("Contenant");
    expect(labels).not.toContain("Facteur de perte κ");
  });

  it("imprime le contenant et l'extensivité quand ils sont présents", () => {
    const t = tenuFixe(
      inst({ contenant: { type: "rayon_hauteur" }, contenants: 3, facteurSecurite: 1.1 }),
      "binder_mass_pct",
    );
    expect(t.find((x) => x.label === "Contenant")?.valeur).toBe("rayon_hauteur");
    expect(t.find((x) => x.label === "Nombre de contenants")?.valeur).toBe("3");
  });

  it("chaque ligne porte un libellé et une valeur non vides", () => {
    for (const l of tenuFixe(instRpg(), "binder_mass_pct")) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.valeur.length).toBeGreaterThan(0);
    }
  });
});
