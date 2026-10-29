// Formules des masses Mr, Mb et Mw (2026-10-26) : la fiche affichée, évaluée
// avec SES valeurs substituées, redonne la valeur de la ligne.
//
// Les recettes viennent du vrai calculateur à κ = 1,1 et 9 moules
// (classe-demo-recettes.json, backend/scripts/recettes_demo_classe.py), en RPC
// et en RPG. Le test protège contre deux erreurs : une formule qui ne décrit
// pas la valeur, et un double comptage de κ (le V_T du résultat le contient
// déjà ; une forme en κ·ρ·V_T le compterait deux fois).

import { describe, expect, it } from "vitest";
import RECETTES from "./classe-demo-recettes.json";
import { getFormulaValues } from "@/components/mix/FormulaPopover";
import { FORMULA_MAP } from "./formulas-data";
import { formulesDeLigne, REPORT_ROWS, type ReportCtx, type ReportRow } from "./report-schema";
import { DEFAULT_UNITS } from "./units";
import type { Recipe } from "./types";

type Valeurs = Record<string, number>;

/** Chaque forme de l'équation AFFICHÉE (equationLatex), codée à la main. */
const FORMES: Record<string, (v: Valeurs) => number[]> = {
  // M_t = C_wf M_T / (1 + B_w)
  F070: (v) => [v["C_{wf}"] * v["M_T"] / (1 + v["B_w"])],
  // M_t = M_T (1 − A_m) C_w-PAF / (1 + B_w)
  F048: (v) => [v["M_T"] * (1 - v["A_m"]) * v["C_{w\\text{-PAF}}"] / (1 + v["B_w"])],
  // M_b = M_t-secs · B_w = M_h C_w B_w / (1 + B_w)
  F040: (v) => [v["M_{t\\text{-secs}}"] * v["B_w"], v["M_h"] * v["C_w"] * v["B_w"] / (1 + v["B_w"])],
  // M_b = M_T · B_w / (1 + B_w) · C_w-PAF
  F051: (v) => [v["M_T"] * v["B_w"] / (1 + v["B_w"]) * v["C_{w\\text{-PAF}}"]],
  // M_w = M (1 − C_w) = w · M_s
  F014: (v) => [v["M"] * (1 - v["C_w"]), v["w"] * v["M_s"]],
};

const ctx = (isRpg: boolean, isEssai = false): ReportCtx => ({
  units: { ...DEFAULT_UNITS, mass: "kg" }, massLabel: "kg", volLabel: "L", densLabel: "g/cm3",
  binderName: (n) => `Liant ${n}`, isEssai, isRpg, bcount: 2,
});

const ligne = (libelle: string, c: ReportCtx): ReportRow =>
  REPORT_ROWS.find((r) => r.section === 1 && r.label(c) === libelle)!;

const LIGNES = ["Résidu sec Mr", "Liant Mb", "Eau totale Mw"];

const cas = Object.entries(RECETTES.formulations).flatMap(([cle, f]) =>
  (f.recettes as unknown as Recipe[]).map((r, i) => ({ nom: `${cle} recette ${i + 1}`, rpg: f.categorie === "RPG", kappa: f.kappa, r })));

describe("formules des masses : la fiche redonne la valeur affichée (κ = 1,1)", () => {
  it("les recettes du test sont bien à κ = 1,1, en RPC et en RPG", () => {
    expect(cas.every((c) => c.kappa === 1.1)).toBe(true);
    expect(cas.some((c) => c.rpg)).toBe(true);
    expect(cas.some((c) => !c.rpg)).toBe(true);
  });

  for (const c of cas) {
    it(`${c.nom} : Mr, Mb et Mw`, () => {
      const contexte = ctx(c.rpg);
      for (const libelle of LIGNES) {
        const row = ligne(libelle, contexte);
        const ids = formulesDeLigne(row, contexte);
        expect(ids.length, libelle).toBe(1);
        const attendu = row.getter(c.r, contexte) as number;
        for (const id of ids) {
          const formule = FORMULA_MAP.get(id)!;
          // Aucune forme développée en κ : il est déjà dans V_T.
          expect(formule.variables.some((v) => v.symbol === "\\kappa"), `${id} contient κ`).toBe(false);
          const valeurs = getFormulaValues(formule, c.r);
          const vides = valeurs.filter((v) => v.value === null).map((v) => v.symbol);
          expect(vides, `${id} : symboles sans valeur`).toEqual([]);
          const v: Valeurs = Object.fromEntries(valeurs.map((x) => [x.symbol, x.value as number]));
          for (const resultat of FORMES[id](v)) {
            expect(Math.abs(resultat - attendu) / attendu, `${libelle} par ${id}`).toBeLessThan(1e-9);
          }
        }
      }
    });
  }
});

describe("formules des masses : par catégorie, aucune en essai-erreur", () => {
  it("RPC : F070, F040, F014 ; RPG : F048, F051, F014", () => {
    expect(LIGNES.map((l) => formulesDeLigne(ligne(l, ctx(false)), ctx(false)))).toEqual([["F070"], ["F040"], ["F014"]]);
    expect(LIGNES.map((l) => formulesDeLigne(ligne(l, ctx(true)), ctx(true)))).toEqual([["F048"], ["F051"], ["F014"]]);
  });

  it("essai-erreur : base plus ajouts, aucune formule de dosage attachée", () => {
    const e = ctx(false, true);
    for (const libelle of ["Résidu sec total Mr", "Liant total Mb", "Eau totale Mw"]) {
      expect(formulesDeLigne(ligne(libelle, e), e), libelle).toEqual([]);
    }
  });

  it("toute formule attachée a sa forme évaluée dans ce test", () => {
    const ids = new Set(REPORT_ROWS.filter((r) => typeof r.formulaIds === "function")
      .flatMap((r) => [...formulesDeLigne(r, ctx(false)), ...formulesDeLigne(r, ctx(true))]));
    for (const id of ids) expect(FORMES[id], id).toBeDefined();
  });
});
