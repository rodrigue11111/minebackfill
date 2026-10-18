import { describe, expect, it } from "vitest";
import { cwHorsPlageUsuelle, eauARetirer } from "./avis-recette";
import type { Recipe } from "./types";

describe("avis : eau à retirer", () => {
  it("seulement les recettes dont l'eau à ajouter est négative, en valeur positive", () => {
    const r = (kg: number | undefined) => ({ components: { water_to_add_mass_kg: kg } }) as unknown as Recipe;
    expect(eauARetirer([r(1.2), r(-0.434), r(undefined), r(0), r(-2)])).toEqual([{ recette: 2, kg: 0.434 }, { recette: 5, kg: 2 }]);
    expect(eauARetirer([])).toEqual([]);
  });
});

describe("Cw prédit hors de la plage usuelle (modèle prédictif)", () => {
  it("36 % et 91 % signalés ; 65 et 85 % (bornes) non ; recette numérotée", () => {
    const r = (cw: number) => ({ solids_mass_pct: cw }) as unknown as Recipe;
    expect(cwHorsPlageUsuelle([r(35.9), r(70), r(91.2)])).toEqual([{ recette: 1, cw: 35.9 }, { recette: 3, cw: 91.2 }]);
    expect(cwHorsPlageUsuelle([r(65), r(85)])).toEqual([]);
    expect(cwHorsPlageUsuelle([{} as Recipe])).toEqual([]);
  });
});
