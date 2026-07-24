import { describe, it, expect } from "vitest";
import { indexProche, ecartPct, statsSerie } from "./courbe-analyse";

describe("indexProche", () => {
  it("trouve l'index de la valeur la plus proche", () => {
    expect(indexProche([2, 4, 6, 8], 5)).toBe(1); // 4 aussi proche que 6 -> premier
    expect(indexProche([2, 4, 6, 8], 6.1)).toBe(2);
    expect(indexProche([2, 4, 6, 8], 100)).toBe(3);
  });
});

describe("ecartPct", () => {
  it("écart relatif en % par rapport au point de référence", () => {
    const e = ecartPct([10, 11, 9], 0);
    expect(e[0]).toBeCloseTo(0, 10);
    expect(e[1]).toBeCloseTo(10, 10);
    expect(e[2]).toBeCloseTo(-10, 10);
  });
  it("une grandeur quasi constante reste plate (contrairement au min-max)", () => {
    const e = ecartPct([1.272942, 1.272115], 0);
    expect(Math.abs(e[1]!)).toBeLessThan(0.1); // ~ -0,065 % : plat
  });
  it("référence nulle/zéro -> tout null (écart indéfini)", () => {
    expect(ecartPct([0, 5, 10], 0).every((v) => v === null)).toBe(true);
    expect(ecartPct([null, 5, 10], 0).every((v) => v === null)).toBe(true);
  });
  it("préserve les coupures (null reste null)", () => {
    expect(ecartPct([10, null, 12], 0)[1]).toBeNull();
  });
});

describe("statsSerie", () => {
  it("min/max/variation/pente sur points valides", () => {
    const s = statsSerie([2, 4, 6], [10, 14, 22])!;
    expect(s.min).toBe(10);
    expect(s.max).toBe(22);
    expect(s.variation).toBe(12); // 22 - 10
    expect(s.pente).toBeCloseTo(12 / (6 - 2), 10); // 3
  });
  it("ignore les points nuls (premier/dernier valides)", () => {
    const s = statsSerie([2, 4, 6, 8], [null, 14, 22, null])!;
    expect(s.variation).toBe(8); // 22 - 14
    expect(s.pente).toBeCloseTo(8 / (6 - 4), 10);
  });
  it("aucun point valide -> null", () => {
    expect(statsSerie([1, 2], [null, null])).toBeNull();
  });
});
