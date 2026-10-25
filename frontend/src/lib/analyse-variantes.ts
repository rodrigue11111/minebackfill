// frontend/src/lib/analyse-variantes.ts
// Comparaison de plusieurs recettes sur un même balayage. Transformations
// PURES, testables sans DOM.
//
// Le geste naturel d'un étudiant — « et avec 3 % de liant au lieu de 5 ? » —
// était impossible : un seul balayage à la fois, écrasé à chaque tracé.
//
// Conception, et pourquoi elle évite deux pièges :
//
// 1. AUCUN CHANGEMENT BACKEND. Une requête /analyse/balayage par variante,
//    chacune avec la base de SA recette (Cw, Sr, Bw, Am, volume ; depuis
//    2026-10-25, les recettes d'un calcul sauvegardé). Faire
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
import type { ValeursRecette } from "./analyse-corps";
import type { LectureRecette } from "./analyse-source";
import { nombreFr } from "./format";
import { RECIPE_COLORS } from "./recipe-theme";

/** Tirets distincts par variante : indispensable pour une figure imprimée en
 *  niveaux de gris, et pour le daltonisme. La couleur seule ne suffit pas. */
export const TIRETS_VARIANTE = ["", "6 3", "2 3", "8 3 2 3"];

/** Ce qu'il faut pour DESSINER une variante, y compris celles d'un fichier rechargé. */
export interface VarianteAffichee {
  /** Numéro de la recette dans le calcul (1 à 4) ; null pour un ancien fichier qui ne le dit pas. */
  recette: number | null;
  label: string;
  couleur: string;
  tirets: string;
}

/** Variante calculable : une recette du calcul sauvegardé et ses valeurs. */
export interface Variante extends VarianteAffichee {
  recette: number;
  valeurs: ValeursRecette;
}

export const MAX_VARIANTES = 4;

/** Champ des valeurs porté par chaque paramètre balayable. */
const CHAMP_DU_PARAM: Record<string, keyof ValeursRecette> = {
  binder_mass_pct: "bwPct",
  solids_mass_pct: "cwPct",
  saturation_pct: "srPct",
  aggregate_fraction_pct: "amPct",
};

const CHAMPS: { cle: keyof ValeursRecette; symbole: string; texte: (v: number) => string }[] = [
  { cle: "bwPct", symbole: "Bw", texte: (v) => `Bw ${nombreFr(v, 2)} %` },
  { cle: "cwPct", symbole: "Cw", texte: (v) => `Cw ${nombreFr(v, 2)} %` },
  { cle: "srPct", symbole: "Sr", texte: (v) => `Sr ${nombreFr(v, 1)} %` },
  { cle: "amPct", symbole: "Am", texte: (v) => `Am ${nombreFr(v, 1)} %` },
  { cle: "volumeM3", symbole: "V", texte: (v) => `V ${v < 1 ? `${nombreFr(v * 1000, 2)} L` : `${nombreFr(v, 3)} m³`}` },
];

const egal = (a: number | undefined, b: number | undefined) =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)));

/**
 * Variantes = les recettes DU CALCUL SAUVEGARDÉ, la recette analysée d'abord
 * (c'est elle que lisent la référence, le panneau de variation et l'export).
 * Couleur selon le numéro de recette (comme dans Calculs), tirets selon la
 * position (la base reste en trait plein). Le libellé donne les valeurs qui
 * DIFFÈRENT entre recettes, hors paramètre balayé. Une recette illisible est
 * écartée avec sa raison. Plafonné à 4, comme RECIPE_COLORS.
 */
export function variantesDepuisRecettes(lectures: LectureRecette[], indexBase: number, param: string): {
  variantes: Variante[];
  exclues: { recette: number; raison: string }[];
} {
  const ordre = [indexBase, ...lectures.map((_, i) => i).filter((i) => i !== indexBase)];
  const valides: { i: number; v: ValeursRecette }[] = [];
  const exclues: { recette: number; raison: string }[] = [];
  for (const i of ordre) {
    const l = lectures[i];
    if (!l) continue;
    if (l.ok) valides.push({ i, v: l.valeurs });
    else exclues.push({ recette: i + 1, raison: l.raison });
  }
  const retenues = valides.slice(0, MAX_VARIANTES);
  const champParam = CHAMP_DU_PARAM[param];
  const differents = CHAMPS.filter((c) => c.cle !== champParam && retenues.some((r) => !egal(r.v[c.cle], retenues[0].v[c.cle])));
  const variantes = retenues.map((r, k) => ({
    recette: r.i + 1,
    valeurs: r.v,
    label: `R${r.i + 1}` + (differents.length
      ? ` (${differents.map((c) => { const x = r.v[c.cle]; return x === undefined ? `${c.symbole} ?` : c.texte(x); }).join(", ")})`
      : ""),
    couleur: RECIPE_COLORS[r.i % RECIPE_COLORS.length],
    tirets: TIRETS_VARIANTE[k % TIRETS_VARIANTE.length],
  }));
  return { variantes, exclues };
}

/**
 * Garde de correction. Des recettes qui ne diffèrent QUE par le paramètre
 * balayé donneraient des courbes rigoureusement identiques : le paramètre
 * balayé écrase leur seule différence. Les superposer serait un mensonge
 * visuel, on croirait voir plusieurs recettes là où il n'y en a qu'une. Des
 * recettes qui diffèrent aussi par autre chose (un calcul selon E/L, où Cw
 * change avec Bw) restent comparables, même en balayant Bw.
 */
export function comparaisonPossible(param: string, variantes: Variante[]): {
  ok: boolean; raison?: string;
} {
  if (variantes.length < 2) {
    return { ok: false, raison: "Ce calcul n'a qu'une recette analysable : rien à comparer." };
  }
  const champ = CHAMP_DU_PARAM[param];
  const autres = CHAMPS.filter((c) => c.cle !== champ);
  const identiques = variantes.every((v) => autres.every((c) => egal(v.valeurs[c.cle], variantes[0].valeurs[c.cle])));
  if (identiques) {
    const symbole = CHAMPS.find((c) => c.cle === champ)?.symbole ?? param;
    return {
      ok: false,
      raison: `Hors de ${symbole}, l'axe X, les recettes de ce calcul sont identiques : leurs courbes se superposeraient.`,
    };
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
  variantes: VarianteAffichee[],
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
