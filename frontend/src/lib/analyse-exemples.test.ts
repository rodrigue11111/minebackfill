import { describe, expect, it } from "vitest";
import { EXEMPLES_ANALYSE } from "./analyse-exemples";
import { paramsPour, sortiesPour } from "./analyse-series";

describe("exemples de la page Analyse", () => {
  it("paramètres et grandeurs existent en RPC comme en RPG ; plages ordonnées", () => {
    for (const c of ["RPC", "RPG"] as const) {
      const params = new Set(paramsPour(c).map((p) => p.cle));
      const sorties = new Set(sortiesPour(c).map((s) => s.cle));
      for (const e of EXEMPLES_ANALYSE) {
        expect([c, e.param, params.has(e.param)]).toEqual([c, e.param, true]);
        for (const s of e.sorties) expect([c, s, sorties.has(s)]).toEqual([c, s, true]);
        expect(e.max).toBeGreaterThan(e.min);
      }
    }
  });
});
