import { describe, it, expect } from "vitest";
import {
  variantesDepuisBase, comparaisonPossible, memePlage, construireTracesVariantes,
  MAX_VARIANTES, TIRETS_VARIANTE,
} from "./analyse-variantes";

describe("analyse-variantes — variantesDepuisBase", () => {
  it("reprend les recettes déjà saisies dans Calculs", () => {
    const v = variantesDepuisBase([3, 5, 7], 3);
    expect(v.map((x) => x.bwPct)).toEqual([3, 5, 7]);
    expect(v[0].label).toContain("3");
  });

  it("se limite au nombre de recettes demandé", () => {
    expect(variantesDepuisBase([3, 5, 7, 9], 2)).toHaveLength(2);
  });

  it("plafonne à MAX_VARIANTES", () => {
    expect(variantesDepuisBase([1, 2, 3, 4, 5, 6], 6)).toHaveLength(MAX_VARIANTES);
  });

  it("ignore une valeur absente ou non finie", () => {
    expect(variantesDepuisBase([3, NaN, 7], 3).map((x) => x.bwPct)).toEqual([3, 7]);
  });

  it("donne des tirets distincts, pas seulement des couleurs", () => {
    // Une figure imprimée en niveaux de gris doit rester lisible, et la
    // couleur seule exclut les daltoniens.
    const v = variantesDepuisBase([3, 5, 7], 3);
    expect(new Set(v.map((x) => x.tirets)).size).toBe(3);
    expect(TIRETS_VARIANTE[0]).toBe("");
  });
});

describe("analyse-variantes — comparaisonPossible", () => {
  it("refuse de comparer des Bw quand Bw EST l'axe X", () => {
    // Le paramètre balayé écrase la valeur de base : les N courbes seraient
    // rigoureusement identiques. Les superposer serait un mensonge visuel.
    const r = comparaisonPossible("binder_mass_pct", variantesDepuisBase([3, 5], 2));
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("axe X");
  });

  it("refuse quand une seule recette est saisie", () => {
    const r = comparaisonPossible("solids_mass_pct", variantesDepuisBase([5], 1));
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("seule recette");
  });

  it("accepte sur un autre paramètre avec au moins deux recettes", () => {
    expect(comparaisonPossible("solids_mass_pct", variantesDepuisBase([3, 5], 2)).ok).toBe(true);
    expect(comparaisonPossible("saturation_pct", variantesDepuisBase([3, 5, 7], 3)).ok).toBe(true);
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
  const variantes = variantesDepuisBase([3, 5], 2);

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
    expect(t[0].label).toContain("Bw");
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
