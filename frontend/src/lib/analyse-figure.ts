// frontend/src/lib/analyse-figure.ts
// Figure de la page Analyse et cycle de ses requêtes. Transformations PURES,
// testables sans DOM.
//
// Pourquoi (2026-10-25) : la page tenait la figure dans une dizaine de
// useState épars, mis à jour à des moments différents. Rien ne garantissait
// qu'une réponse tardive ne prenne pas la provenance d'une nouvelle sélection,
// et le rechargement d'un fichier ne gardait que la première courbe. Ici :
//   - une figure porte SA provenance et SON empreinte, prises au départ de la
//     requête ; une réponse ne les reçoit jamais d'ailleurs ;
//   - chaque requête a un numéro (`seq`) ; changer de calcul ou de recette, ou
//     effacer, fait passer au numéro suivant, et la réponse d'un numéro
//     dépassé est ignorée.
// 2026-10-26 : le rechargement d'un balayage exporté (.json) est retiré, à la
// demande de l'utilisateur (usage rare, source de confusion). L'export JSON
// reste ; lireArtefact (analyse-artefact.ts) en valide toujours le format.

import type { BalayageArtefact } from "./analyse-artefact";
import type { InstantaneAnalyse } from "./analyse-instantane";
import type { VarianteAffichee } from "./analyse-variantes";

export interface FigureCourbes {
  /** Un résultat par variante (un seul hors comparaison), la recette analysée d'abord. */
  resultats: BalayageArtefact[];
  /** Variantes dessinées, alignées sur `resultats` ; null : une seule courbe. */
  variantes: VarianteAffichee[] | null;
  /** Provenance prise AU DÉPART de la requête. */
  instantane: InstantaneAnalyse;
  /** Empreinte des entrées au départ ; null : inconnue, la figure n'est jamais dite périmée. */
  empreinte: string | null;
}

export interface EtatFigure {
  /** Numéro de la dernière requête valable : une réponse d'un autre numéro est ignorée. */
  seq: number;
  enCours: boolean;
  figure: FigureCourbes | null;
  erreur: string | null;
}

export const ETAT_FIGURE_INITIAL: EtatFigure = { seq: 0, enCours: false, figure: null, erreur: null };

export type ActionFigure =
  /** Une requête part avec ce numéro. */
  | { type: "depart"; seq: number }
  /** Sa réponse arrive : acceptée seulement si son numéro est le dernier. */
  | { type: "reponse"; seq: number; figure: FigureCourbes }
  /** Son échec : comme dans Calculs, aucune figure ancienne ne reste affichée. */
  | { type: "echec"; seq: number; message: string }
  /** Changement de calcul ou de recette : la requête en cours est ignorée, la figure reste (périmée). */
  | { type: "annuler"; seq: number }
  /** Changement de paramètre ou d'exemple : la figure est retirée. */
  | { type: "effacer"; seq: number }
  /** Message seul (changement de mode) : la figure est gardée. */
  | { type: "message"; erreur: string | null };

export function reduireFigure(e: EtatFigure, a: ActionFigure): EtatFigure {
  switch (a.type) {
    case "depart": return { ...e, seq: a.seq, enCours: true, erreur: null };
    case "reponse": return a.seq !== e.seq ? e : { ...e, enCours: false, figure: a.figure, erreur: null };
    case "echec": return a.seq !== e.seq ? e : { ...e, enCours: false, figure: null, erreur: a.message };
    case "annuler": return { ...e, seq: a.seq, enCours: false };
    case "effacer": return { ...e, seq: a.seq, enCours: false, figure: null, erreur: null };
    case "message": return { ...e, erreur: a.erreur };
  }
}

/** La figure a-t-elle été calculée avec d'autres entrées que les entrées actuelles ? */
export function figurePerimee(figure: FigureCourbes | null, empreinteCourante: string | null): boolean {
  return !!figure && figure.empreinte !== null && figure.empreinte !== empreinteCourante;
}

/** Contenu du fichier JSON exporté (format /2, `variantesDetail` en plus). */
export function artefactDepuisFigure(f: FigureCourbes): Record<string, unknown> {
  return {
    format: "minebackfill-analyse-courbes/2",
    instantane: f.instantane,
    resultats: f.resultats,
    variantes: f.variantes ? f.variantes.map((v) => v.label) : [],
    variantesDetail: f.variantes ? f.variantes.map((v) => ({ recette: v.recette, label: v.label })) : [],
  };
}
