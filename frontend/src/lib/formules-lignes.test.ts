// Toute ligne des Résultats montre sa formule (2026-10-30), et la fiche,
// évaluée avec les valeurs du résultat, redonne la valeur affichée.
//
// Recettes du vrai calculateur (classe-demo-recettes.json, à κ = 1,1 et 9
// moules), en RPC (selon Cw et selon E/L) et en RPG. Chaque forme de
// l'équation est codée à la main dans FORMES, comme formula-masses.test.ts le
// fait pour Mr, Mb et Mw. Les fiches dont une entrée n'est pas dans le
// résultat (parts de liant, nombre de moules, κ, dimensions du moule) sont
// vérifiées contre ces entrées, lues dans le même fichier de recettes.

import { describe, expect, it } from "vitest";
import RECETTES from "./classe-demo-recettes.json";
import { SYMBOL_TO_RECIPE } from "@/components/mix/FormulaPopover";
import { FORMULA_MAP } from "./formulas-data";
import { FICHE_CALCULATEUR_MAP } from "./formules-calculateur";
import { formulesDeLigne, REPORT_ROWS, type ReportCtx } from "./report-schema";
import { DEFAULT_UNITS } from "./units";
import type { Recipe } from "./types";

type V = (symbole: string) => number;

/**
 * Fiche -> symbole du membre de gauche, formes du membre de droite (unités de
 * la fiche : fractions, kg, m³, kg/m³) et facteur vers l'unité de la ligne.
 */
const FORMES: Record<string, { gauche: string; formes: (v: V) => number[]; echelle?: number }> = {
  F050: { gauche: "M_{ag}", formes: (v) => [v("M_T") * v("A_m") * v("C_{w\\text{-PAF}}") / (1 + v("B_w"))] },
  F042: { gauche: "M_{t\\text{-hum}}", formes: (v) => [v("M_{t\\text{-secs}}") * (1 + v("w_{\\text{rés}}"))] },
  F049: { gauche: "M_{t\\text{-wet}}", formes: (v) => [v("M_t") / v("C_{w\\text{-tail}}")] },
  F043: { gauche: "M_{w\\text{-aj}}", formes: (v) => [v("M_w") - v("M_{w\\text{-rés}}"), v("M_h") * (1 - v("C_w")) - v("M_{t\\text{-hum}}") * (1 - v("C_{w\\text{-rés}}"))] },
  F052: { gauche: "M_{w\\text{-add}}", formes: (v) => [v("M_w") - v("M_{w\\text{-tail}}"), v("M_T") * (1 - v("C_{w\\text{-PAF}}")) - v("M_{w\\text{-tail}}")] },
  F083: { gauche: "A_v", echelle: 100, formes: (v) => [v("A_m") / (v("A_m") + (1 - v("A_m")) * v("\\rho_{s\\text{-ag}}") / v("\\rho_{s\\text{-t}}"))] },
  F085: { gauche: "B_v", echelle: 100, formes: (v) => [v("B_w") * v("\\rho_{s\\text{-tails+aggr}}") / v("\\rho_{s\\text{-binder}}")] },
  F022: { gauche: "B_v", echelle: 100, formes: (v) => [v("V_b") / v("V_t")] },
  F094: { gauche: "\\gamma_d", formes: (v) => [v("g") * v("\\rho_d") / 1000] },
  F008: { gauche: "G_s", formes: (v) => [v("\\rho_s") / v("\\rho_w")] },
  F101: { gauche: "V_s", formes: (v) => [v("C_v") * v("V_T")] },
  F102: { gauche: "V_v", formes: (v) => [v("V_T") - v("V_s"), v("V_T") * (1 - v("C_v"))] },
  F013: { gauche: "M_s", formes: (v) => [v("M") / (1 + v("w")), v("M") * v("C_w")] },
  F014: { gauche: "M_w", formes: (v) => [v("M") * (1 - v("C_w")), v("w") * v("M_s")] },
  F015: { gauche: "M", formes: (v) => [v("M_s") / v("C_w"), v("M_s") * (1 + v("w"))] },
  C04: { gauche: "A_m", echelle: 100, formes: (v) => [v("M_{ag}") / (v("M_t") + v("M_{ag}"))] },
  C05: { gauche: "A_{v,T}", echelle: 100, formes: (v) => [v("V_{ag}") / v("V_T")] },
  C06: { gauche: "\\rho_s", formes: (v) => [v("G_s") * v("\\rho_w"), v("\\rho_d") * (1 + v("e"))] },
  C07: { gauche: "\\gamma_s", formes: (v) => [v("g") * v("\\rho_s") / 1000] },
  C10: { gauche: "V_t", formes: (v) => [v("M_t") / (v("G_{s,t}") * v("\\rho_w"))] },
  C11: { gauche: "V_b", formes: (v) => [v("M_b") / (v("G_{s,b}") * v("\\rho_w"))] },
  C12: { gauche: "V_w", formes: (v) => [v("M_w") / v("\\rho_w")] },
  C13: { gauche: "V_{ag}", formes: (v) => [v("M_{ag}") / (v("G_{s,ag}") * v("\\rho_w"))] },
  C14: { gauche: "M_{w\\text{-rés}}", formes: (v) => [v("M_{t\\text{-hum}}") - v("M_t"), v("w_0") * v("M_t")] },
  C15: { gauche: "V_a", formes: (v) => [v("V_v") - v("V_w"), v("V_v") * (1 - v("S_r"))] },
  C16: { gauche: "M_{t+ag}", formes: (v) => [v("M_t") + v("M_{ag}")] },
};

/** Fiches dont une entrée n'est pas dans le résultat : vérifiées à part, ci-dessous. */
const A_PART = new Set(["C01", "C08", "C09", "F026"]);

/** Fiches déjà attachées avant le 2026-10-30, vérifiées ailleurs (formula-masses.test.ts) ou par leur définition. */
const AVANT = new Set(["F016", "F009", "F010", "F001", "F028", "F003", "F023", "F024", "F007", "F027", "F004", "F005", "F002", "F070", "F048", "F040", "F051"]);

const ctx = (isRpg: boolean, bcount: number, isEssai = false): ReportCtx => ({
  units: { ...DEFAULT_UNITS, mass: "kg", volume: "m3", density: "kg/m3" },
  massLabel: "kg", volLabel: "m3", densLabel: "kg/m3",
  binderName: (n) => `Liant ${n}`, isEssai, isRpg, bcount,
});

const cas = Object.entries(RECETTES.formulations).flatMap(([cle, f]) =>
  (f.recettes as unknown as Recipe[]).map((r, i) => ({ nom: `${cle} recette ${i + 1}`, f, r, c: ctx(f.categorie === "RPG", f.liants.length) })));

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

describe("toute ligne des Résultats a sa formule (2026-10-30)", () => {
  it("chaque ligne visible, en RPC et en RPG, montre au moins une fiche, qui existe", () => {
    for (const { nom, c } of cas) {
      for (const row of REPORT_ROWS.filter((x) => !x.when || x.when(c))) {
        const ids = formulesDeLigne(row, c);
        expect(ids.length, `${nom} : ${row.label(c)}`).toBeGreaterThan(0);
        for (const id of ids) expect(FORMULA_MAP.has(id) || FICHE_CALCULATEUR_MAP.has(id), id).toBe(true);
      }
    }
  });

  it("essai-erreur : liant à ajouter (C02, C03) ; les totaux « base plus ajouts » restent sans fiche de dosage", () => {
    const e = ctx(false, 2, true);
    const ids = (libelle: string) => formulesDeLigne(REPORT_ROWS.find((r) => r.label(e) === libelle && (!r.when || r.when(e)))!, e);
    expect(ids("Liant à ajouter/retirer Mb-ad")).toEqual(["C02"]);
    expect(ids("Liant 1 à ajouter/retirer Mc1-ad")).toEqual(["C03"]);
    for (const total of ["Résidu sec total Mr", "Liant total Mb", "Eau totale Mw"]) expect(ids(total), total).toEqual([]);
  });

  it("toute fiche attachée est évaluée ici, vérifiée à part, ou l'était avant", () => {
    const toutes = new Set(cas.flatMap(({ c }) => REPORT_ROWS.filter((x) => !x.when || x.when(c)).flatMap((x) => formulesDeLigne(x, c))));
    for (const id of toutes) expect(id in FORMES || A_PART.has(id) || AVANT.has(id), id).toBe(true);
  });
});

describe("chaque fiche, évaluée avec les valeurs du résultat, redonne la valeur affichée", () => {
  for (const { nom, r, c } of cas) {
    it(nom, () => {
      const v: V = (s) => {
        const x = SYMBOL_TO_RECIPE[s]?.(r);
        if (x === null || x === undefined || !Number.isFinite(x)) throw new Error(`${s} : sans valeur`);
        return x;
      };
      for (const row of REPORT_ROWS.filter((x) => !x.when || x.when(c))) {
        const affiche = row.getter(r, c);
        if (typeof affiche !== "number") continue;
        for (const id of formulesDeLigne(row, c).filter((x) => x in FORMES)) {
          const { gauche, formes, echelle = 1 } = FORMES[id];
          const libelle = `${row.label(c)} par ${id}`;
          expect(proche(v(gauche) * echelle, affiche), `${libelle} : membre de gauche ${v(gauche) * echelle} contre ${affiche}`).toBe(true);
          for (const forme of formes(v)) expect(proche(forme * echelle, affiche), `${libelle} : forme ${forme * echelle} contre ${affiche}`).toBe(true);
          // Toute variable de la fiche qui a une correspondance donne une valeur.
          const fiche = FORMULA_MAP.get(id) ?? FICHE_CALCULATEUR_MAP.get(id)!;
          for (const x of fiche.variables) if (SYMBOL_TO_RECIPE[x.symbol]) expect(() => v(x.symbol), `${id} : ${x.symbol}`).not.toThrow();
        }
      }
    });
  }
});

describe("fiches dont une entrée n'est pas dans le résultat", () => {
  for (const { nom, f, r, c } of cas) {
    it(nom, () => {
      // C01 : M_c,i = x_i M_b, avec les parts de la page Informations.
      const mb = r.components!.binder_total_mass_kg!;
      f.liants.forEach((l, i) => {
        const mci = (r.components as unknown as { binder_masses_kg: number[] }).binder_masses_kg[i];
        expect(proche(mci, (l.fraction_pct / 100) * mb), `${l.code}`).toBe(true);
      });
      // C08 : V_moule = π r² h (rayon et hauteur en cm dans Informations).
      const vMoule = Math.PI * (f.moule.container_radius / 100) ** 2 * (f.moule.container_height / 100);
      expect(proche(r.container_volume_m3!, vMoule)).toBe(true);
      // C09 : V_T = N_c V_moule κ.
      expect(proche(r.total_backfill_volume_m3!, f.nb_moules * vMoule * f.kappa)).toBe(true);
      // F026 sur « Gs du liant » : ρs-liant / ρw redonne la valeur affichée.
      const gsLiant = REPORT_ROWS.find((x) => x.label(c) === "Densité relative Gs du liant")!;
      expect(proche(SYMBOL_TO_RECIPE["\\rho_{s\\text{-liant}}"](r)! / SYMBOL_TO_RECIPE["\\rho_w"](r)!, gsLiant.getter(r, c) as number)).toBe(true);
    });
  }
});
