import { describe, expect, it } from "vitest";
import { FORMULAS } from "./formulas-data";
import { FICHES_CALCULATEUR } from "./formules-calculateur";
import { SYMBOL_TO_RECIPE } from "@/components/mix/FormulaPopover";

describe("formulas-data — invariants", () => {
  it("les identifiants de formules sont uniques", () => {
    const ids = FORMULAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque formule a un id, un titre et une équation", () => {
    for (const f of FORMULAS) {
      expect(f.id).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.equationLatex).toBeTruthy();
    }
  });

  it("aucune clé de substitution ne contient de caractère de contrôle", () => {
    // Un backslash mal échappé dans une clé LaTeX (ex. "\rho_w" au lieu de
    // "\\rho_w") produit un caractère de contrôle (retour chariot) : la clé ne
    // matche alors jamais. On interdit tout caractère de code < 0x20.
    const suspectes = Object.keys(SYMBOL_TO_RECIPE).filter((k) =>
      [...k].some((ch) => ch.charCodeAt(0) < 0x20),
    );
    expect(suspectes).toEqual([]);
  });

  it("les clés de substitution façon LaTeX correspondent à un symbole existant", () => {
    // Toute clé commençant par un backslash (symbole LaTeX) doit exister comme
    // `symbol` d'au moins une variable de formule — sinon elle est morte.
    // Fiches du cours et fiches du calculateur (hors cours, 2026-10-30).
    const symboles = new Set<string>();
    for (const f of [...FORMULAS, ...FICHES_CALCULATEUR]) for (const v of f.variables) symboles.add(v.symbol);
    const orphelines = Object.keys(SYMBOL_TO_RECIPE)
      .filter((k) => k.startsWith("\\"))
      .filter((k) => !symboles.has(k));
    expect(orphelines).toEqual([]);
  });

  it("fiches du calculateur : ids C01 à C99 uniques, distincts du cours, chacune avec sa source", () => {
    const ids = FICHES_CALCULATEUR.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FICHES_CALCULATEUR) {
      expect(f.id).toMatch(/^C\d{2}$/);
      expect(FORMULAS.some((c) => c.id === f.id)).toBe(false);
      expect(f.source.length).toBeGreaterThan(10);
    }
  });
});
