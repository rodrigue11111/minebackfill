// frontend/src/lib/analyse-variantes.ts
// Comparaison de plusieurs recettes sur un même balayage. Transformations
// PURES, testables sans DOM.
//
// Le geste naturel d'un étudiant — « et avec 3 % de liant au lieu de 5 ? » —
// était impossible : un seul balayage à la fois, écrasé à chaque tracé.
//
// Conception, et pourquoi elle évite deux pièges :
//
// 1. AUCUN CHANGEMENT BACKEND. Le payload transporte déjà
//    binder_mass_pct_recipes et _override reprend l'élément [0]. Il suffit
//    d'appeler /analyse/balayage N fois avec un Bw de base différent. Faire
//    le multi-recettes côté serveur transformerait BalayageResult.series en
//    structure à deux dimensions et casserait le contrat épinglé par
//    test_coherence_cw_base_multi_recettes_reduite, pour zéro gain.
//
// 2. PAS un historique de tracés passés, mais des VARIANTES RECALCULÉES
//    ENSEMBLE. CourbeSvg prend un seul tableau `x` partagé. Superposer des
//    balayages de plages différentes exigerait soit un x par série (refonte
//    du survol, qui suppose un index commun), soit une INTERPOLATION —
//    c'est-à-dire une formule nouvelle. Une seule plage, un seul paramètre,
//    N variantes : zéro modification de CourbeSvg.

import type { SerieTrace } from "@/components/analyse/CourbeSvg";
import { RECIPE_COLORS } from "./recipe-theme";

/** Tirets distincts par variante : indispensable pour une figure imprimée en
 *  niveaux de gris, et pour le daltonisme. La couleur seule ne suffit pas. */
export const TIRETS_VARIANTE = ["", "6 3", "2 3", "8 3 2 3"];

export interface Variante {
  bwPct: number;
  label: string;
  couleur: string;
  tirets: string;
}

export const MAX_VARIANTES = 4;

/**
 * Variantes déduites des recettes DÉJÀ saisies dans Calculs — aucun nouveau
 * champ de saisie, et cohérent avec la carte « Recette de base (reprise de
 * Calculs) ». Plafonné à 4, comme RECIPE_COLORS.
 */
export function variantesDepuisBase(binderPct: number[], numRecipes: number): Variante[] {
  const n = Math.max(1, Math.min(numRecipes || 1, MAX_VARIANTES));
  const out: Variante[] = [];
  for (let i = 0; i < n; i++) {
    const bw = binderPct[i];
    if (typeof bw !== "number" || !Number.isFinite(bw)) continue;
    out.push({
      bwPct: bw,
      label: `Bw ${bw.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} %`,
      couleur: RECIPE_COLORS[i % RECIPE_COLORS.length],
      tirets: TIRETS_VARIANTE[i % TIRETS_VARIANTE.length],
    });
  }
  return out;
}

/**
 * Garde de correction. Comparer des dosages de liant EN BALAYANT le dosage de
 * liant produirait N courbes rigoureusement identiques : le paramètre balayé
 * écrase la valeur de base. Les superposer serait un mensonge visuel — on
 * croirait voir trois recettes là où il n'y en a qu'une.
 */
export function comparaisonPossible(param: string, variantes: Variante[]): {
  ok: boolean; raison?: string;
} {
  if (param === "binder_mass_pct") {
    return {
      ok: false,
      raison: "Bw est déjà l'axe X : les variantes donneraient des courbes identiques.",
    };
  }
  if (variantes.length < 2) {
    return { ok: false, raison: "Une seule recette est saisie dans Calculs." };
  }
  return { ok: true };
}

/** Toutes les variantes partagent-elles le même axe X ? (garde-fou : CourbeSvg
 *  suppose un `x` commun à toutes les séries). */
export function memePlage(resultats: { x: number[] }[]): boolean {
  if (resultats.length < 2) return true;
  const [a, ...reste] = resultats;
  return reste.every((r) => r.x.length === a.x.length && r.x.every((v, i) => v === a.x[i]));
}

/**
 * Une série par variante, POUR UNE SEULE grandeur. Un axe Y unique suffit
 * puisqu'on compare la même grandeur entre variantes — c'est justement ce qui
 * évite d'avoir à introduire un second axe.
 */
export function construireTracesVariantes(
  resultats: { series: Record<string, (number | null)[]> }[],
  cleSortie: string,
  variantes: Variante[],
): SerieTrace[] {
  const out: SerieTrace[] = [];
  for (let i = 0; i < resultats.length; i++) {
    const valeurs = resultats[i].series[cleSortie];
    const v = variantes[i];
    if (!valeurs || !v) continue;
    out.push({
      cle: `${cleSortie}#${i}`,
      label: v.label,
      couleur: v.couleur,
      unite: "",
      valeurs,
    });
  }
  return out;
}
