import { describe, expect, it } from "vitest";
import { ecartPoints, effetEcartW0, texteEcart, texteVise, wDepuisCwPct, wPateMesuree } from "./mesures-pate";
import { COLONNES_ESSAIS, COLONNES_GACHEES } from "./jeu-essais";

describe("w de la pâte déduit de Cw mesuré (F012 : Cw = 1 / (1 + w))", () => {
  it("Cw 75 % : w 33,33 % ; Cw 82,722 % : w 20,886 % (feuille Intra 2017, D76 et D77)", () => {
    expect(wDepuisCwPct(75)).toBeCloseTo(100 / 3, 10);
    // 82,722 % est lui-même arrondi : w à 0,005 point près.
    expect(wDepuisCwPct(82.722)).toBeCloseTo(20.886, 2);
    expect(wDepuisCwPct(100)).toBe(0);
  });

  it("indéfini hors de (0, 100]", () => {
    for (const v of [undefined, 0, -5, 101, Number.NaN]) expect(wDepuisCwPct(v)).toBeUndefined();
  });

  it("déduit de Cw d'abord ; sinon le w saisi d'une gâchée plus ancienne ; sinon rien", () => {
    const d = wPateMesuree({ cwMesurePct: 75, wMesurePct: 40 });
    expect(d?.source).toBe("deduit");
    expect(d?.valeur).toBeCloseTo(100 / 3, 10);
    expect(wPateMesuree({ wMesurePct: 31.2 })).toEqual({ valeur: 31.2, source: "saisi" });
    expect(wPateMesuree({})).toBeUndefined();
  });

  it("le jeu d'essais exporte w déduit de Cw mesuré", () => {
    const col = [...COLONNES_ESSAIS, ...COLONNES_GACHEES].find((c) => c.cle === "w_mesure_pct")!;
    expect(col.val({ g: { cwMesurePct: 75 } } as never)).toBeCloseTo(100 / 3, 10);
    expect(col.val({ g: { wMesurePct: 31.2 } } as never)).toBe(31.2);
    expect(col.val({ g: {} } as never)).toBeNull();
  });
});

describe("valeur visée et écart", () => {
  it("écart en points, signe moins typographique, pluriel à partir de 2", () => {
    expect(ecartPoints(28, 31.6)).toBeCloseTo(-3.6, 10);
    expect(ecartPoints(undefined, 31.6)).toBeUndefined();
    expect(texteEcart(-3.6)).toBe("−3,6 points");
    expect(texteEcart(1.2)).toBe("+1,2 point");
    expect(texteEcart(0.01)).toBe("0 point");
  });

  it("« Visé : … » avec l'écart quand la mesure existe ; rien si rien n'est visé", () => {
    expect(texteVise(31.6, 28)).toBe("Visé : 31,6 % · écart −3,6 points.");
    expect(texteVise(75, undefined)).toBe("Visé : 75 %.");
    expect(texteVise(undefined, 28)).toBe("");
  });

  it("w₀ plus sec ou plus humide que dans le calcul : conséquence sur la pâte", () => {
    expect(effetEcartW0(-3.6)).toContain("plus sèche (Cw plus élevé)");
    expect(effetEcartW0(2)).toContain("plus fluide (Cw plus bas)");
    expect(effetEcartW0(0.01)).toBe("");
    expect(effetEcartW0(undefined)).toBe("");
  });
});
