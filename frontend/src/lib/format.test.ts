import { describe, expect, it } from "vitest";
import { SANS_UNITE, TIRET, fmt, libelleAvecUnite, nombreAxe, valeurAvecUnite } from "./format";

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
