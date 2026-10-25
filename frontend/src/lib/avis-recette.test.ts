import { describe, expect, it } from "vitest";
import { cwHorsPlageUsuelle, eauARetirer, texteEauARetirer } from "./avis-recette";
import type { Recipe } from "./types";

describe("avis : eau à retirer", () => {
  it("seulement les recettes dont l'eau à ajouter est négative, en valeur positive", () => {
    const r = (kg: number | undefined) => ({ components: { water_to_add_mass_kg: kg } }) as unknown as Recipe;
    expect(eauARetirer([r(1.2), r(-0.434), r(undefined), r(0), r(-2)])).toEqual([{ recette: 2, kg: 0.434 }, { recette: 5, kg: 2 }]);
    expect(eauARetirer([])).toEqual([]);
  });

  it("essai-erreur : le bandeau parle du mélange refait, pas de retirer de l'eau de la gâchée faite", () => {
    const base = texteEauARetirer(false);
    expect(base.titre).toBe("Eau à retirer.");
    expect(base.ligne(1, "0,746 kg")).toBe("Recette 1 : il faudrait RETIRER 0,746 kg d'eau");
    expect(base.conseil).toContain("visez un Cw plus bas");

    const essai = texteEauARetirer(true);
    expect(essai.titre).toBe("Mélange plus sec que le résidu stocké.");
    expect(essai.ligne(1, "0,746 kg")).toBe("Recette 1 : pour refaire ce mélange depuis le début, le résidu humide apporterait 0,746 kg d'eau de trop");
    expect(essai.conseil).toContain("Rien à retirer dans la gâchée déjà faite");
    expect(essai.conseil).not.toContain("Cw plus bas");
    expect(`${essai.titre} ${essai.ligne(1, "1 kg")} ${essai.conseil}`).not.toMatch(/RETIRER|[–—]/);
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
