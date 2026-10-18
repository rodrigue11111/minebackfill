import { describe, expect, it } from "vitest";
import { eauARetirer } from "./avis-recette";
import type { Recipe } from "./types";

describe("avis : eau à retirer", () => {
  it("seulement les recettes dont l'eau à ajouter est négative, en valeur positive", () => {
    const r = (kg: number | undefined) => ({ components: { water_to_add_mass_kg: kg } }) as unknown as Recipe;
    expect(eauARetirer([r(1.2), r(-0.434), r(undefined), r(0), r(-2)])).toEqual([{ recette: 2, kg: 0.434 }, { recette: 5, kg: 2 }]);
    expect(eauARetirer([])).toEqual([]);
  });
});
