import { describe, it, expect } from "vitest";
import { amDepuisAv, avDepuisAm } from "./granulats";

// Valeurs de l'article Belem et al. 2018 : résidus Gs 3.42, granulats NAG 2.89.
const GS_T = 3.42;
const GS_A = 2.89;

describe("conversion Av <-> Am (équation [3], Belem et al. 2018)", () => {
  it("Av = 50 %v/v -> Am ≈ 45,8 %m (le point 50/50 de l'article)", () => {
    const am = amDepuisAv(50, GS_T, GS_A)!;
    expect(am).toBeCloseTo((100 * 0.5 * GS_A) / (0.5 * GS_A + 0.5 * GS_T), 12);
    expect(am).toBeCloseTo(45.8, 1);
  });

  it("aller-retour exact Am -> Av -> Am", () => {
    for (const am of [0, 8, 17, 26, 35, 45, 100]) {
      const av = avDepuisAm(am, GS_T, GS_A)!;
      expect(amDepuisAv(av, GS_T, GS_A)!).toBeCloseTo(am, 10);
    }
  });

  it("Gs identiques -> Am = Av (aucune correction de densité)", () => {
    expect(amDepuisAv(37, 3.0, 3.0)!).toBeCloseTo(37, 12);
    expect(avDepuisAm(37, 3.0, 3.0)!).toBeCloseTo(37, 12);
  });

  it("bornes : 0 % et 100 % sont des points fixes", () => {
    expect(amDepuisAv(0, GS_T, GS_A)).toBeCloseTo(0, 12);
    expect(amDepuisAv(100, GS_T, GS_A)).toBeCloseTo(100, 12);
    expect(avDepuisAm(0, GS_T, GS_A)).toBeCloseTo(0, 12);
    expect(avDepuisAm(100, GS_T, GS_A)).toBeCloseTo(100, 12);
  });

  it("granulat moins dense que le résidu : Am < Av (moins de masse à volume égal)", () => {
    expect(amDepuisAv(30, GS_T, GS_A)!).toBeLessThan(30);
    expect(avDepuisAm(30, GS_T, GS_A)!).toBeGreaterThan(30);
  });

  it("Gs invalides ou valeur non finie -> null (jamais NaN)", () => {
    expect(amDepuisAv(50, 0, GS_A)).toBeNull();
    expect(amDepuisAv(50, GS_T, -1)).toBeNull();
    expect(avDepuisAm(Number.NaN, GS_T, GS_A)).toBeNull();
  });

  it("scénario « dérive du Gs » de la discussion : Am figé 45,8 % et Gs résidus 3,42 -> 3,00 fait chuter Av de 50 % à 46,7 %", () => {
    const amFige = amDepuisAv(50, 3.42, 2.89)!; // recette calée à Av = 50 %
    expect(avDepuisAm(amFige, 3.0, 2.89)!).toBeCloseTo(46.7, 1);
  });
});
