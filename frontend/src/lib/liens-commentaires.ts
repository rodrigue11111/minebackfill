// frontend/src/lib/liens-commentaires.ts
// Liens directs vers un document commenté par l'enseignant (2026-10-26 : le
// bandeau des commentaires renvoyait au Labo et à l'Historique en général, et
// l'étudiant devait chercher la gâchée ou le résultat). Module PUR.

import { PREFIXE_PESEE } from "./ancres";
import type { Annotation } from "./annotations";

/** Onglet de l'éditeur d'une gâchée sur téléphone. */
export type VueEditeur = "pesees" | "eprouvettes" | "echanges";

/** Adresse qui ouvre directement le document : la gâchée au Labo, le résultat dans Mes calculs. */
export function lienDocument(kind: "resultat" | "gachee", id: string): string {
  return kind === "gachee" ? `/labo?gachee=${encodeURIComponent(id)}` : `/historique?resultat=${encodeURIComponent(id)}`;
}

/** Onglet où se lit une note : sous sa pesée, sous son éprouvette, sinon dans les Échanges. */
export function vueDepuisAncre(ancre: string | null, codesEprouvettes: string[]): VueEditeur {
  if (ancre?.startsWith(PREFIXE_PESEE)) return "pesees";
  if (ancre && codesEprouvettes.includes(ancre)) return "eprouvettes";
  return "echanges";
}

/** Onglet de la première note non lue de l'enseignant ; undefined s'il n'y en a pas. */
export function vuePourNonLues(annotations: Annotation[], codesEprouvettes: string[]): VueEditeur | undefined {
  const a = annotations.find((x) => x.auteur === "enseignant" && x.luLe === null && !x.supprime);
  return a ? vueDepuisAncre(a.ancre, codesEprouvettes) : undefined;
}
