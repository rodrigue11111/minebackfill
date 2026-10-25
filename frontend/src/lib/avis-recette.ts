// frontend/src/lib/avis-recette.ts
// Avertissements tirés d'un résultat de calcul, SANS formule nouvelle : on lit
// ce que le calcul a déjà établi. Module PUR.

import type { Recipe } from "./types";
import { PLAGES } from "./plages";

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

/**
 * Texte du bandeau « eau à retirer ». Recette de base : la recette est
 * irréalisable telle quelle avec ce résidu. Essai-erreur : les masses
 * décrivent le mélange ajusté refait depuis le début ; un ajout de résidu sec
 * le rend plus sec que le résidu stocké, et la gâchée déjà faite n'a rien à
 * retirer. Le conseil « visez un Cw plus bas » s'y lisait comme un ordre de
 * retirer de l'eau du seau (retour d'utilisation du 25 octobre 2026).
 */
export function texteEauARetirer(isEssai: boolean): {
  titre: string;
  ligne: (recette: number, masse: string) => string;
  conseil: string;
} {
  return isEssai
    ? {
      titre: "Mélange plus sec que le résidu stocké.",
      ligne: (n, m) => `Recette ${n} : pour refaire ce mélange depuis le début, le résidu humide apporterait ${m} d'eau de trop`,
      conseil: "Rien à retirer dans la gâchée déjà faite : ce chiffre ne concerne qu'une nouvelle gâchée. "
        + "Le mélange ajusté est plus sec que votre résidu à sa teneur en eau w₀ (par exemple après un ajout de résidu sec) ; "
        + "pour le refaire d'un coup, séchez une partie du résidu.",
    }
    : {
      titre: "Eau à retirer.",
      ligne: (n, m) => `Recette ${n} : il faudrait RETIRER ${m} d'eau`,
      conseil: "Le résidu apporte déjà plus d'eau que la recette n'en contient : visez un Cw plus bas, ou séchez le résidu.",
    };
}

/**
 * Recettes dont le Cw sort de la plage usuelle d'un RPC (modèle prédictif :
 * le Cw est un RÉSULTAT, aucun champ ne l'avertissait). Un affaissement de
 * 180 mm lu au petit cône donnait ainsi un Cw de 36 % sans réaction.
 */
export function cwHorsPlageUsuelle(recipes: Recipe[]): { recette: number; cw: number }[] {
  return recipes.flatMap((r, i) => {
    const cw = r?.solids_mass_pct;
    return typeof cw === "number" && Number.isFinite(cw) && (cw < PLAGES.cw.min || cw > PLAGES.cw.max) ? [{ recette: i + 1, cw }] : [];
  });
}
