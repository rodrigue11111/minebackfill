import { describe, it, expect } from "vitest";
import {
  ecart, horsTolerance, nbHorsTolerance, genererCode, composantsDepuisRecette, parametresDepuisRecette, groupeSansVide, materiauxSansVide,
  cibleLisible, masseLisible, plageTolerance, etapesGachee, peseeVersSaisie, saisieVersPesee,
  type Gachee, type ComposantPese,
} from "./gachee";
import type { Recipe } from "./types";

function gachee(p: Partial<Gachee>): Gachee {
  return {
    id: "g1", code: "G-20260724-01", creeLe: "2026-07-24T00:00:00Z", statut: "brouillon",
    formulationLabel: "Test", categorie: "RPG", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [], eprouvettes: [], ...p,
  };
}

describe("ecart", () => {
  it("kg et % pesée − cible", () => {
    const e = ecart({ cle: "l", label: "L", cibleKg: 100, peseeKg: 103 })!;
    expect(e.kg).toBeCloseTo(3, 10);
    expect(e.pct).toBeCloseTo(3, 10);
  });
  it("rien de pesé -> null", () => {
    expect(ecart({ cle: "l", label: "L", cibleKg: 100 })).toBeNull();
  });
  it("cible nulle -> % = 0 (pas de division par zéro)", () => {
    expect(ecart({ cle: "l", label: "L", cibleKg: 0, peseeKg: 5 })!.pct).toBe(0);
  });
});

describe("horsTolerance / nbHorsTolerance", () => {
  it("dépasse la tolérance en valeur absolue", () => {
    const c: ComposantPese = { cle: "l", label: "L", cibleKg: 100, peseeKg: 97 };
    expect(horsTolerance(c, 2)).toBe(true); // -3 % > 2 %
    expect(horsTolerance(c, 5)).toBe(false);
  });
  it("compte les composants hors tolérance", () => {
    const g = gachee({ composants: [
      { cle: "a", label: "A", cibleKg: 100, peseeKg: 100.5 }, // 0,5 %
      { cle: "b", label: "B", cibleKg: 100, peseeKg: 110 },   // 10 %
      { cle: "c", label: "C", cibleKg: 100 },                 // non pesé
    ] });
    expect(nbHorsTolerance(g)).toBe(1);
  });
});

describe("genererCode", () => {
  it("incrémente NN parmi les gâchées du même jour", () => {
    const d = new Date(2026, 6, 24, 10, 0);
    expect(genererCode([], d)).toBe("G-20260724-01");
    const existantes = [gachee({ code: "G-20260724-01" }), gachee({ code: "G-20260724-02" })];
    expect(genererCode(existantes, d)).toBe("G-20260724-03");
  });
  it("repart à 01 un autre jour", () => {
    const existantes = [gachee({ code: "G-20260723-05" })];
    expect(genererCode(existantes, new Date(2026, 6, 24, 0, 0))).toBe("G-20260724-01");
  });
  it("date locale : le 29 octobre à 23 h 05 donne le code du 29 (2026-10-30)", () => {
    expect(genererCode([], new Date(2026, 9, 29, 23, 5))).toBe("G-20261029-01");
    expect(genererCode([], new Date(2026, 9, 30, 0, 10))).toBe("G-20261030-01");
  });
});

describe("composantsDepuisRecette", () => {
  const nom = (i: number) => `Ciment ${i}`;
  it("résidu humide + granulat + liant total + eau (liant simple)", () => {
    const r = { components: {
      residue_wet_mass_kg: 12000, aggregate_dry_mass_kg: 2800,
      binder_total_mass_kg: 1500, water_to_add_mass_kg: 900, binder_masses_kg: [1500],
    } } as Recipe;
    const cs = composantsDepuisRecette(r, nom);
    expect(cs.map((c) => c.cle)).toEqual(["residu", "granulat", "liant", "eau"]);
    expect(cs.find((c) => c.cle === "residu")!.cibleKg).toBe(12000);
  });
  it("détaille les liants quand il y en a plusieurs", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 100, water_to_add_mass_kg: 200,
      binder_masses_kg: [20, 80],
    } } as Recipe;
    const cs = composantsDepuisRecette(r, nom);
    expect(cs.filter((c) => c.cle.startsWith("liant:")).length).toBe(2);
    expect(cs.find((c) => c.cle === "liant:1")!.cibleKg).toBe(80);
  });
  it("omet les composants nuls (RPC sans granulat)", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, aggregate_dry_mass_kg: 0,
      binder_total_mass_kg: 50, water_to_add_mass_kg: 100, binder_masses_kg: [50],
    } } as Recipe;
    expect(composantsDepuisRecette(r, nom).some((c) => c.cle === "granulat")).toBe(false);
  });
  it("omet l'eau quand elle est négative (eau à retirer, non pesable)", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 50,
      water_to_add_mass_kg: -30, binder_masses_kg: [50],
    } } as Recipe;
    expect(composantsDepuisRecette(r, nom).some((c) => c.cle === "eau")).toBe(false);
  });
  it("garde l'indice réel du liant quand une masse intermédiaire est nulle", () => {
    const r = { components: {
      residue_wet_mass_kg: 1000, binder_total_mass_kg: 100,
      water_to_add_mass_kg: 200, binder_masses_kg: [20, 0, 80],
    } } as Recipe;
    const cles = composantsDepuisRecette(r, nom).filter((c) => c.cle.startsWith("liant:")).map((c) => c.cle);
    expect(cles).toEqual(["liant:0", "liant:2"]);
  });
});

describe("parametresDepuisRecette", () => {
  it("capture Cw, W/C, Bw, w depuis la recette", () => {
    const r = { solids_mass_pct: 78, wc_ratio: 7.2, bw_mass_pct: 4.5, w_mass_pct: 28 } as Recipe;
    expect(parametresDepuisRecette(r)).toEqual({ cwPct: 78, wcRatio: 7.2, bwPct: 4.5, wPct: 28 });
  });
  it("omet les valeurs absentes ou non finies (undefined)", () => {
    const r = { solids_mass_pct: 78, wc_ratio: null } as unknown as Recipe;
    const p = parametresDepuisRecette(r);
    expect(p.cwPct).toBe(78);
    expect(p.wcRatio).toBeUndefined();
    expect(p.bwPct).toBeUndefined();
  });
});

describe("fiche d'essai : groupes sans valeur vide", () => {
  it("effacer un champ redonne le groupe d'avant ; un groupe vide disparaît", () => {
    expect(groupeSansVide({ mode: "immersion" as const, temperatureC: undefined, note: "" })).toEqual({ mode: "immersion" });
    expect(groupeSansVide({ temperatureC: undefined })).toBeUndefined();
    expect(groupeSansVide(undefined)).toBeUndefined();
    const avant = { residu: { nom: "R1" } };
    expect(materiauxSansVide({ ...avant, eau: { type: undefined }, granulat: { nom: "" } })).toEqual(avant);
    expect(materiauxSansVide({ residu: { nom: "" } })).toBeUndefined();
  });

  it("adjuvant sans nom : ni dosage ni unité", () => {
    expect(materiauxSansVide({ adjuvant: { nom: " ", dosage: 2, dosageUnite: "% liant" } })).toEqual({ adjuvant: { nom: " " } });
    expect(materiauxSansVide({ adjuvant: { nom: "", dosage: 2, dosageUnite: "% liant" } })).toBeUndefined();
    expect(materiauxSansVide({ adjuvant: { nom: "SP-1", dosage: 2, dosageUnite: "% liant" } })).toEqual({ adjuvant: { nom: "SP-1", dosage: 2, dosageUnite: "% liant" } });
  });
});

describe("pesées : masses lisibles", () => {
  it("lecture : sous 1 kg en grammes, sinon kg à trois décimales", () => {
    expect(masseLisible(0.05)).toBe("50,0 g");
    expect(masseLisible(0.047)).not.toBe("0,0 kg");
  });

  it("cible et tolérance dans l'unité de saisie choisie (g ou kg)", () => {
    expect(cibleLisible(0.0543, "g")).toBe("54,3 g");
    expect(cibleLisible(0.05, "kg")).toBe("0,0500 kg (50,0 g)");
    expect(cibleLisible(1.5, "kg")).toBe("1,500 kg");
    expect(cibleLisible(1.5, "g").replace(/\s/g, " ")).toBe("1 500,0 g");
    expect(plageTolerance(0.05, 2, "g")).toBe("49,0 à 51,0 g");
    expect(plageTolerance(0.05, 2, "kg")).toBe("0,0490 à 0,0510 kg");
    expect(plageTolerance(1.5, 2, "kg")).toBe("1,470 à 1,530 kg");
  });

  it("saisie : la gâchée garde des kg ; « 54,3 » en g = 0,0543 kg, sans bruit d'arrondi à l'affichage", () => {
    expect(saisieVersPesee(54.3, "g")).toBeCloseTo(0.0543, 12);
    expect(saisieVersPesee(0.0543, "kg")).toBe(0.0543);
    expect(peseeVersSaisie(0.0543, "g")).toBe(54.3);
    expect(peseeVersSaisie(saisieVersPesee(54.3, "g"), "g")).toBe(54.3);
    expect(peseeVersSaisie(0.0543, "kg")).toBe(0.0543);
    expect(peseeVersSaisie(undefined, "g")).toBeUndefined();
  });
});

describe("fil d'une gâchée", () => {
  const ep = (statut: "en_cure" | "ecrase", mesure = false) => ({ id: "e", code: "E", couleLe: "x", ageJours: 7, statut, ...(mesure ? { essai: { contrainteKpaSaisie: 300 } } : {}) });
  const fil = (composants: { peseeKg?: number }[], eprouvettes: ReturnType<typeof ep>[]) =>
    etapesGachee({ composants, eprouvettes } as never, (e) => !!e.essai?.contrainteKpaSaisie).map((x) => x.etat);
  it("se déduit de ce qui est saisi ; la première étape pas faite est en cours", () => {
    expect(fil([{}], [])).toEqual(["en_cours", "a_venir", "a_venir", "a_venir", "a_venir"]);
    expect(fil([{ peseeKg: 1 }], [])).toEqual(["faite", "en_cours", "a_venir", "a_venir", "a_venir"]);
    expect(fil([{ peseeKg: 1 }], [ep("en_cure")])).toEqual(["faite", "faite", "en_cours", "a_venir", "a_venir"]);
    // 7 j écrasée et mesurée, 28 j encore en cure.
    expect(fil([{ peseeKg: 1 }], [ep("ecrase", true), ep("en_cure")])).toEqual(["faite", "faite", "en_cours", "faite", "faite"]);
    expect(fil([{ peseeKg: 1 }], [ep("ecrase", true)])).toEqual(["faite", "faite", "faite", "faite", "faite"]);
    expect(fil([{ peseeKg: 1 }], [ep("ecrase")])).toEqual(["faite", "faite", "faite", "faite", "en_cours"]);
  });
});
