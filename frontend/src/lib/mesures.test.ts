import { describe, expect, it } from "vitest";
import { calculeMesures } from "./mesures";

describe("calculeMesures — exemple de tare du classeur Intra 2017", () => {
  // Cellules F12-F14 / K12-K14 : tare 2278.8 g, tare+m_h 2947.3 g, tare+m_s 2831.8 g
  const r = calculeMesures({ tare: 2278.8, mh: 2947.3, ms: 2831.8 });

  it("w mesuré = (2947.3-2831.8)/(2831.8-2278.8) = 20.886 %", () => {
    expect(r.w).toBeCloseTo((115.5 / 553.0) * 100, 6);
  });
  it("Cw mesuré = (2831.8-2278.8)/(2947.3-2278.8) = 82.722 %", () => {
    expect(r.cw).toBeCloseTo((553.0 / 668.5) * 100, 6);
  });
  it("cohérence : Cw = 1/(1+w)", () => {
    expect(r.cw!).toBeCloseTo(100 / (1 + r.w! / 100), 6);
  });
});

describe("calculeMesures — validation", () => {
  it("champs manquants -> null", () => {
    expect(calculeMesures({})).toEqual({ w: null, cw: null });
    expect(calculeMesures({ tare: 100, mh: 200 })).toEqual({ w: null, cw: null });
  });
  it("ordre incohérent (m_s <= tare ou m_h <= m_s) -> null", () => {
    expect(calculeMesures({ tare: 300, mh: 200, ms: 250 })).toEqual({ w: null, cw: null });
    expect(calculeMesures({ tare: 100, mh: 150, ms: 180 })).toEqual({ w: null, cw: null });
  });
  it("pâte parfaitement sèche impossible (m_h = m_s) -> null", () => {
    expect(calculeMesures({ tare: 100, mh: 200, ms: 200 })).toEqual({ w: null, cw: null });
  });
});
