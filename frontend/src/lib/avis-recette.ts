// frontend/src/lib/avis-recette.ts
// Avertissements tirés d'un résultat de calcul, SANS formule nouvelle : on lit
// ce que le calcul a déjà établi. Module PUR.

import type { Recipe } from "./types";

/**
 * Recettes dont l'« eau à ajouter » est négative : le résidu apporte déjà
 * plus d'eau que la recette n'en demande. Il faudrait RETIRER de l'eau, ce
 * qu'une gâchée ne peut pas faire ; la valeur s'affichait telle quelle, sans
 * explication.
 */
export function eauARetirer(recipes: Recipe[]): { recette: number; kg: number }[] {
  return recipes.flatMap((r, i) => {
    const kg = r?.components?.water_to_add_mass_kg;
    return typeof kg === "number" && Number.isFinite(kg) && kg < 0 ? [{ recette: i + 1, kg: -kg }] : [];
  });
}
