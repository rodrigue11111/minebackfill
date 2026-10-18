import { describe, expect, it } from "vitest";
import { avisHorsPlage, BORNES, messageHorsBornes, PLAGES } from "./plages";

describe("plages usuelles : avis doux, jamais un refus", () => {
  it("vide : rien ; bornes de la plage incluses ; 0 tapé jugé comme tout nombre", () => {
    expect(avisHorsPlage("cw", undefined)).toBeNull();
    expect(avisHorsPlage("cw", 65)).toBeNull();
    expect(avisHorsPlage("cw", 85)).toBeNull();
    expect(avisHorsPlage("gs", 0.5)).toMatch(/^Hors de la plage usuelle \(2,6 à 4,0\)/);
    expect(avisHorsPlage("kappa", 0.5)).toMatch(/Hors de la plage usuelle/);
    expect(avisHorsPlage("bw", 0)).toMatch(/Hors de la plage usuelle \(3 à 12 %\)/);
    expect(avisHorsPlage("w0", 0)).toBeNull(); // résidu sec : dans la plage 0 à 35 %
  });
});

describe("bornes physiques : la valeur sera refusée par le calcul", () => {
  it("Cw : 0 exclu, 100 inclus ; message distinct de l'avis de plage", () => {
    expect(messageHorsBornes("cw", undefined)).toBeNull();
    expect(messageHorsBornes("cw", 100)).toBeNull();
    expect(messageHorsBornes("cw", 101)).toBe("Valeur impossible : Cw doit être supérieur à 0 et au plus 100 %. Le calcul la refusera.");
    expect(messageHorsBornes("cw", 0)).toMatch(/^Valeur impossible : Cw/);
    expect(messageHorsBornes("cw", -1)).toMatch(/^Valeur impossible/);
  });

  it("Bw, w₀ : 0 accepté ; Gs, E/L, κ : strictement positifs", () => {
    expect(messageHorsBornes("bw", 0)).toBeNull();
    expect(messageHorsBornes("bw", -1)).toBe("Valeur impossible : Bw doit être compris entre 0 et 100 %. Le calcul la refusera.");
    expect(messageHorsBornes("w0", 0)).toBeNull();
    expect(messageHorsBornes("gs", 0)).toBe("Valeur impossible : Gs doit être supérieur à 0. Le calcul la refusera.");
    expect(messageHorsBornes("kappa", 0.5)).toBeNull(); // possible, seulement hors plage usuelle
  });

  it("chaque plage usuelle a ses bornes, et la plage usuelle est dans les bornes", () => {
    for (const cle of Object.keys(PLAGES) as (keyof typeof PLAGES)[]) {
      const p = PLAGES[cle];
      expect(BORNES[cle]).toBeDefined();
      expect([cle, messageHorsBornes(cle, p.max)]).toEqual([cle, null]);
      if (p.min > 0) expect([cle, messageHorsBornes(cle, p.min)]).toEqual([cle, null]);
    }
  });
});
