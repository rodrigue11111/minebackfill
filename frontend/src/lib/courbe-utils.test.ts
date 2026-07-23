import { describe, it, expect } from "vitest";
import { bornes, echelle, graduations, decimalesTick, chemin } from "./courbe-utils";

describe("bornes", () => {
  it("ignore les valeurs nulles", () => {
    expect(bornes([[1, null, 3], [null, 2, null]])).toEqual([1, 3]);
  });
  it("tout nul -> [0, 1] (jamais NaN)", () => {
    expect(bornes([[null, null]])).toEqual([0, 1]);
  });
  it("série plate -> marge symétrique", () => {
    expect(bornes([[5, 5, 5]])).toEqual([4, 6]);
  });
});

describe("echelle", () => {
  it("mappe les extrémités du domaine sur la plage", () => {
    const f = echelle([0, 10], [100, 300]);
    expect(f(0)).toBe(100);
    expect(f(10)).toBe(300);
    expect(f(5)).toBe(200);
  });
  it("domaine dégénéré -> constante (pas de division par zéro)", () => {
    const f = echelle([5, 5], [0, 200]);
    expect(f(5)).toBe(0);
    expect(Number.isFinite(f(9))).toBe(true);
  });
});

describe("graduations", () => {
  it("produit des ticks ronds dans l'intervalle", () => {
    const t = graduations(0, 10, 5);
    expect(t).toContain(0);
    expect(t).toContain(10);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...t)).toBeLessThanOrEqual(10);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(t.length).toBeLessThanOrEqual(9);
  });
  it("gère les petites plages sans exploser", () => {
    const t = graduations(0.2, 0.35, 5);
    expect(t.every((v) => v >= 0.2 - 1e-9 && v <= 0.35 + 1e-9)).toBe(true);
  });
  it("intervalle nul ou inversé -> renvoie [min]", () => {
    expect(graduations(5, 5)).toEqual([5]);
    expect(graduations(9, 1)).toEqual([9]);
  });

  it("choisit le pas rond le PLUS PROCHE (densité ~cible, pas doublée)", () => {
    // span 0,02 : pas0=0,004 -> mantisse 4 -> pas rond 0,005 (et non 0,002).
    const t = graduations(0.14, 0.16, 5);
    expect(t.length).toBeLessThanOrEqual(6);
    expect(t.some((v) => Math.abs(v - 0.15) < 1e-9)).toBe(true);
  });
});

describe("decimalesTick", () => {
  it("adapte la précision au pas", () => {
    expect(decimalesTick(1)).toBe(0);
    expect(decimalesTick(0.1)).toBe(1);
    expect(decimalesTick(0.05)).toBe(2);
    expect(decimalesTick(100)).toBe(0);
  });
});

describe("chemin", () => {
  it("relie les points contigus (M puis L)", () => {
    const d = chemin([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }], [false, false, false]);
    expect(d).toBe("M0.00 0.00 L1.00 1.00 L2.00 4.00");
  });
  it("coupe la ligne sur un point nul (nouveau M après le trou)", () => {
    const d = chemin([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }], [false, true, false]);
    expect(d).toBe("M0.00 0.00 M2.00 4.00");
  });
  it("série entièrement nulle -> chemin vide", () => {
    expect(chemin([{ x: 0, y: 0 }], [true])).toBe("");
  });
});
