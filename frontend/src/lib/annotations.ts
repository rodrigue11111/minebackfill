// frontend/src/lib/annotations.ts
// Annotations de l'enseignant sur le travail d'un étudiant (résultat ou
// gâchée). Écrites par l'enseignant, lues par le SEUL propriétaire du travail
// (RLS, supabase/schema.sql). Module PUR : modèle et fusion.

export interface Annotation {
  id: string;
  cibleKind: "resultat" | "gachee";
  cibleId: string;
  /** Révision du document annoté : permet de dire « sur une version antérieure ». */
  cibleRev: number | null;
  /** Endroit précis (ex. code d'éprouvette), facultatif. */
  ancre: string | null;
  /** Texte ; null si l'annotation a été retirée. */
  texte: string | null;
  supprime: boolean;
  /** Horodatage serveur, rendu tel quel au curseur. */
  maj: string;
}

/**
 * Fusion des lectures incrémentales : la plus récente version de chaque
 * annotation gagne ; les annotations retirées disparaissent.
 */
export function fusionnerAnnotations(courantes: Annotation[], nouvelles: Annotation[]): Annotation[] {
  const parId = new Map(courantes.map((a) => [a.id, a]));
  for (const a of nouvelles) {
    const avant = parId.get(a.id);
    if (!avant || a.maj >= avant.maj) parId.set(a.id, a);
  }
  return [...parId.values()]
    .filter((a) => !a.supprime && a.texte)
    .sort((a, b) => a.maj.localeCompare(b.maj));
}

/** Annotations d'un document, dans l'ordre chronologique. */
export function annotationsDe(toutes: Annotation[], kind: "resultat" | "gachee", id: string): Annotation[] {
  return toutes.filter((a) => a.cibleKind === kind && a.cibleId === id);
}
