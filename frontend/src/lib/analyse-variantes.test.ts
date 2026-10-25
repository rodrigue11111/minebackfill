import { describe, it, expect } from "vitest";
import {
  variantesDepuisRecettes, comparaisonPossible, memePlage, construireTracesVariantes,
  MAX_VARIANTES, TIRETS_VARIANTE,
} from "./analyse-variantes";
import type { LectureRecette } from "./analyse-source";
import { RECIPE_COLORS } from "./recipe-theme";

const ok = (cwPct: number, bwPct: number, srPct = 100, volumeM3 = 0.0123, amPct?: number): LectureRecette =>
  ({ ok: true, valeurs: { cwPct, srPct, bwPct, volumeM3, amPct } });

// Calcul selon Cw : même Cw, Bw différents. Calcul selon E/L : Cw ET Bw différents.
const CALCUL_CW = [ok(75, 3), ok(75, 5), ok(75, 7)];
const CALCUL_EL = [ok(74.2, 4.5), ok(76.1, 6)];

describe("analyse-variantes — variantesDepuisRecettes", () => {
  it("la recette analysée d'abord, puis les autres dans l'ordre ; numéro et couleur de la recette", () => {
    const { variantes } = variantesDepuisRecettes(CALCUL_CW, 1, "solids_mass_pct");
    expect(variantes.map((v) => v.recette)).toEqual([2, 1, 3]);
    expect(variantes.map((v) => v.couleur)).toEqual([RECIPE_COLORS[1], RECIPE_COLORS[0], RECIPE_COLORS[2]]);
    expect(variantes[0].valeurs.bwPct).toBe(5);
  });

  it("tirets distincts selon la position : la recette analysée reste en trait plein", () => {
    const { variantes } = variantesDepuisRecettes(CALCUL_CW, 2, "solids_mass_pct");
    expect(variantes[0].tirets).toBe(TIRETS_VARIANTE[0]);
    expect(TIRETS_VARIANTE[0]).toBe("");
    expect(new Set(variantes.map((x) => x.tirets)).size).toBe(3);
  });

  it("libellés : seulement ce qui DIFFÈRE entre recettes, hors paramètre balayé", () => {
    const cw = variantesDepuisRecettes(CALCUL_CW, 0, "solids_mass_pct").variantes;
    expect(cw.map((v) => v.label)).toEqual(["R1 (Bw 3 %)", "R2 (Bw 5 %)", "R3 (Bw 7 %)"]);
    const el = variantesDepuisRecettes(CALCUL_EL, 0, "binder_mass_pct").variantes;
    expect(el[1].label).toBe("R2 (Cw 76,1 %)");
  });

  it("une recette illisible est écartée avec sa raison ; plafond MAX_VARIANTES", () => {
    const { variantes, exclues } = variantesDepuisRecettes([ok(75, 3), { ok: false, raison: "Recette 2 : Sr manque." }, ok(75, 7)], 0, "solids_mass_pct");
    expect(variantes.map((v) => v.recette)).toEqual([1, 3]);
    expect(exclues).toEqual([{ recette: 2, raison: "Recette 2 : Sr manque." }]);
    const six = [1, 2, 3, 4, 5, 6].map((b) => ok(75, b));
    expect(variantesDepuisRecettes(six, 0, "solids_mass_pct").variantes).toHaveLength(MAX_VARIANTES);
  });
});

describe("analyse-variantes — comparaisonPossible", () => {
  const v = (lectures: LectureRecette[], param: string) => variantesDepuisRecettes(lectures, 0, param).variantes;

  it("calcul selon Cw balayé en Bw : refusé (les courbes se superposeraient)", () => {
    const r = comparaisonPossible("binder_mass_pct", v(CALCUL_CW, "binder_mass_pct"));
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("axe X");
  });

  it("calcul selon E/L balayé en Bw : accepté, ses recettes diffèrent aussi par Cw", () => {
    expect(comparaisonPossible("binder_mass_pct", v(CALCUL_EL, "binder_mass_pct")).ok).toBe(true);
    expect(comparaisonPossible("solids_mass_pct", v(CALCUL_EL, "solids_mass_pct")).ok).toBe(true);
  });

  it("recettes qui ne diffèrent que par Sr, balayées en Sr : refusé ; recettes identiques : refusé", () => {
    expect(comparaisonPossible("saturation_pct", v([ok(75, 5, 90), ok(75, 5, 100)], "saturation_pct")).ok).toBe(false);
    expect(comparaisonPossible("solids_mass_pct", v([ok(75, 5), ok(75, 5)], "solids_mass_pct")).ok).toBe(false);
  });

  it("une seule recette analysable : refusé", () => {
    const r = comparaisonPossible("solids_mass_pct", v([ok(75, 5)], "solids_mass_pct"));
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("qu'une recette");
  });
});

describe("analyse-variantes — memePlage", () => {
  it("accepte un seul résultat", () => {
    expect(memePlage([{ x: [1, 2, 3] }])).toBe(true);
  });

  it("accepte des abscisses identiques", () => {
    expect(memePlage([{ x: [1, 2, 3] }, { x: [1, 2, 3] }])).toBe(true);
  });

  it("refuse des abscisses différentes", () => {
    // CourbeSvg suppose un tableau x COMMUN à toutes les séries : accepter des
    // plages différentes exigerait une interpolation, donc une formule.
    expect(memePlage([{ x: [1, 2, 3] }, { x: [1, 2, 4] }])).toBe(false);
    expect(memePlage([{ x: [1, 2, 3] }, { x: [1, 2] }])).toBe(false);
  });
});

describe("analyse-variantes — construireTracesVariantes", () => {
  const variantes = variantesDepuisRecettes([ok(75, 3), ok(75, 5)], 0, "solids_mass_pct").variantes;

  it("rend une série par variante pour une grandeur donnée", () => {
    const t = construireTracesVariantes(
      [{ series: { wc_ratio: [10, 9] } }, { series: { wc_ratio: [6, 5] } }],
      "wc_ratio", variantes,
    );
    expect(t).toHaveLength(2);
    expect(t[0].valeurs).toEqual([10, 9]);
    expect(t[1].valeurs).toEqual([6, 5]);
    expect(t[0].couleur).not.toBe(t[1].couleur);
  });

  it("étiquette chaque série par sa recette, pas par la grandeur", () => {
    const t = construireTracesVariantes(
      [{ series: { wc_ratio: [1] } }, { series: { wc_ratio: [2] } }], "wc_ratio", variantes,
    );
    expect(t[0].label).toContain("R1");
  });

  it("saute une variante dont la grandeur manque", () => {
    const t = construireTracesVariantes(
      [{ series: { wc_ratio: [1] } }, { series: {} }], "wc_ratio", variantes,
    );
    expect(t).toHaveLength(1);
  });

  it("donne des clés uniques (rendu React)", () => {
    const t = construireTracesVariantes(
      [{ series: { wc_ratio: [1] } }, { series: { wc_ratio: [2] } }], "wc_ratio", variantes,
    );
    expect(new Set(t.map((x) => x.cle)).size).toBe(t.length);
  });
});
