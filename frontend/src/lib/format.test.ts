import { describe, expect, it } from "vitest";
import { SANS_UNITE, TIRET, fmt, libelleAvecUnite, nombreAxe, valeurAvecUnite, fmtGroupe, chiffresSignificatifs, nombreFr } from "./format";

describe("format : valeur absente et unités", () => {
  it("fmt rend TIRET pour une valeur absente", () => {
    expect(fmt(null)).toBe(TIRET);
    expect(fmt(undefined)).toBe(TIRET);
    expect(fmt(Number.NaN)).toBe(TIRET);
    expect(fmt(1.23456, 2)).toBe("1.23");
  });

  it("libelleAvecUnite : unité entre parenthèses, rien pour une grandeur sans unité", () => {
    expect(libelleAvecUnite("Taux massique de liant Bw", "%")).toBe("Taux massique de liant Bw (%)");
    expect(libelleAvecUnite("Rapport eau/liant E/L", SANS_UNITE)).toBe("Rapport eau/liant E/L");
  });

  it("valeurAvecUnite : espace insécable, et ni unité après TIRET ni « sans unité »", () => {
    expect(valeurAvecUnite("12,5", "kg")).toBe("12,5 kg");
    expect(valeurAvecUnite("6,1", SANS_UNITE)).toBe("6,1");
    expect(valeurAvecUnite(TIRET, "%")).toBe(TIRET);
  });

  it("les deux marques restent distinctes", () => {
    expect(SANS_UNITE).not.toBe(TIRET);
  });
});

describe("format : graduations d'axe", () => {
  it("jamais « -0 » : -0, bruit de calcul et petites valeurs négatives arrondies à zéro", () => {
    expect(nombreAxe(-0, 0)).toBe("0");
    expect(nombreAxe(-1e-12, 1)).toBe("0,0");
    expect(nombreAxe(-0.3, 0)).toBe("0");
    expect(nombreAxe(-0.6, 0)).toBe("-1");
    expect(nombreAxe(1234.5, 1)).toMatch(/^1\s234,5$/);
  });
});

describe("nombres lisibles (campagnes de test du 18 octobre 2026)", () => {
  it("fmt : jamais « -0 » ; les vrais négatifs gardent leur signe", () => {
    expect(fmt(-0.0001, 3)).toBe("0.000");
    expect(fmt(-0, 2)).toBe("0.00");
    expect(fmt(-1e-12, 0)).toBe("0");
    expect(fmt(-0.5, 1)).toBe("-0.5");
  });

  it("fmtGroupe : milliers séparés par une espace fine insécable", () => {
    expect(fmtGroupe(2200000, 3)).toBe("2\u202F200\u202F000.000");
    expect(fmtGroupe(-1708.6, 1)).toBe("-1\u202F708.6");
    expect(fmtGroupe(999, 0)).toBe("999");
    expect(fmtGroupe(null)).toBe(TIRET);
  });

  it("chiffresSignificatifs : 6 chiffres, sans zéros inutiles", () => {
    expect(chiffresSignificatifs(5 / 2.54)).toBe("1.9685");
    expect(chiffresSignificatifs(5500 / 2.54)).toBe("2165.35");
    expect(chiffresSignificatifs(20.5)).toBe("20.5");
  });
});

describe("nombreFr : valeurs d'Analyse sans « -0 »", () => {
  it("arrondi avant l'écriture ; vrais négatifs gardés", () => {
    expect(nombreFr(-0.0000001, 1)).toBe("0");
    expect(nombreFr(-0.04, 1)).toBe("0");
    expect(nombreFr(-0.06, 1)).toBe("-0,1");
    expect(nombreFr(1234.5678, 2).replace(/\s/g, " ")).toBe("1 234,57");
  });
});
