// frontend/src/lib/annotations.ts
// Fil de commentaires sur le travail d'un étudiant (résultat ou gâchée) :
// ceux de l'enseignant, et les réponses de l'étudiant. Lus par le SEUL
// propriétaire du travail (RLS, supabase/schema.sql). Module PUR : modèle,
// fusion, migration.

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
  /** Horodatage serveur de la dernière modification, rendu tel quel au curseur. */
  maj: string;
  /** Auteur : l'enseignant, ou l'étudiant lui-même (réponse). */
  auteur: "enseignant" | "moi";
  /** Création (serveur) : l'ORDRE du fil — `maj` bouge quand le message est lu. */
  creeLe: string;
  /** Lu par le destinataire (serveur), null sinon. */
  luLe: string | null;
}

/**
 * Stockage v1 (avant les réponses) : seul l'enseignant écrivait. Les champs
 * déjà présents sont GARDÉS — un onglet resté sur l'ancien site peut réécrire
 * une enveloppe v1 qui contient des annotations v2.
 */
export function migrerAnnotationV1(a: Omit<Annotation, "auteur" | "creeLe" | "luLe"> & Partial<Annotation>): Annotation {
  return { ...a, auteur: a.auteur ?? "enseignant", creeLe: a.creeLe ?? a.maj, luLe: a.luLe ?? null };
}

/**
 * Fusion des lectures incrémentales : la plus récente version de chaque
 * annotation gagne ; les annotations retirées disparaissent. Ordre du fil :
 * la création.
 */
export function fusionnerAnnotations(courantes: Annotation[], nouvelles: Annotation[]): Annotation[] {
  const parId = new Map(courantes.map((a) => [a.id, a]));
  for (const a of nouvelles) {
    const avant = parId.get(a.id);
    if (!avant || a.maj >= avant.maj) parId.set(a.id, a);
  }
  return [...parId.values()]
    .filter((a) => !a.supprime && a.texte)
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe) || a.id.localeCompare(b.id));
}

/** Annotations d'un document, dans l'ordre du fil. */
export function annotationsDe(toutes: Annotation[], kind: "resultat" | "gachee", id: string): Annotation[] {
  return toutes.filter((a) => a.cibleKind === kind && a.cibleId === id);
}

/**
 * Commentaires de l'enseignant pas encore lus, sur des documents PRÉSENTS sur
 * cet appareil : un commentaire sur un document disparu ne pourrait jamais
 * être affiché, donc jamais marqué lu — il relancerait l'étudiant sans fin.
 */
export function nonLuesDeLEnseignant(toutes: Annotation[], existe: (kind: "resultat" | "gachee", id: string) => boolean): Annotation[] {
  return toutes.filter((a) => a.auteur === "enseignant" && a.luLe === null && existe(a.cibleKind, a.cibleId));
}

/** Clés « kind:id » des documents qui ont un commentaire de l'enseignant non lu. */
export function docsAvecNonLus(toutes: Annotation[]): Set<string> {
  return new Set(toutes.filter((a) => a.auteur === "enseignant" && a.luLe === null).map((a) => `${a.cibleKind}:${a.cibleId}`));
}
