// frontend/src/lib/formules-publication.ts
// Publication et réception des fiches de formules de l'enseignant
// (formules-enseignant.ts). Les accès au réseau et au magasin sont INJECTÉS :
// testable sans navigateur.

import {
  copierCouche, FORMAT_PUBLICATION, lirePublication, validerCouche,
  type CoucheFormules, type PublicationFormules, type Rejet,
} from "./formules-enseignant";

export type ResultatPublication =
  | { etat: "refusee"; rejets: Rejet[] }
  | { etat: "erreur"; message: string }
  | { etat: "ok"; publication: PublicationFormules; pourCeCompte: boolean };

/**
 * Publie une COPIE FIGÉE du brouillon, prise à l'appel.
 * - Des rejets (fiche invalide) : rien n'est envoyé, la liste est rendue.
 * - Succès : seule la copie publiée locale prend la valeur envoyée ; le
 *   brouillon n'est JAMAIS réécrit (une modification faite pendant l'envoi
 *   reste, et l'état affiche « Modifications non publiées »).
 * - `pourCeCompte` : faux si le compte a changé avant la réponse ; l'écran ne
 *   montre alors pas le message de réussite au nouveau compte.
 */
export async function publierFormules(o: {
  brouillon: CoucheFormules;
  proprietaire: string;
  publieePar: string | null;
  maintenant: Date;
  envoyer: (enveloppe: { v: number; data: PublicationFormules }) => Promise<{ error: string | null }>;
  definirPubliees: (p: PublicationFormules) => void;
  proprietaireCourant: () => string | null;
}): Promise<ResultatPublication> {
  const copie = copierCouche(o.brouillon);
  const { couche, rejets } = validerCouche(copie);
  if (rejets.length > 0) return { etat: "refusee", rejets };
  const publication: PublicationFormules = { couche, publieeLe: o.maintenant.toISOString(), publieePar: o.publieePar };
  const { error } = await o.envoyer({ v: FORMAT_PUBLICATION, data: publication });
  if (error) return { etat: "erreur", message: error };
  o.definirPubliees(publication);
  return { etat: "ok", publication, pourCeCompte: o.proprietaireCourant() === o.proprietaire };
}

export type LectureCatalogue = { etat: "ok"; enveloppe: unknown } | { etat: "absent" } | { etat: "erreur" };

/**
 * Réception d'une publication :
 * - absent (rien n'a jamais été publié) : le cours (copie locale vidée) ;
 * - erreur, version inconnue, contenu invalide : la dernière version valide
 *   reçue est GARDÉE (rien n'est appelé) ;
 * - ok : la copie locale est remplacée (une couche vide publiée vaut « cours »).
 * Rend ce qui a été fait, pour les tests et le diagnostic.
 */
export function recevoirFormules(
  lecture: LectureCatalogue,
  definirPubliees: (p: PublicationFormules | null) => void,
): "cours" | "gardee" | "remplacee" {
  if (lecture.etat === "erreur") return "gardee";
  if (lecture.etat === "absent") { definirPubliees(null); return "cours"; }
  const p = lirePublication(lecture.enveloppe);
  if (!p) return "gardee";
  definirPubliees(p);
  return "remplacee";
}
