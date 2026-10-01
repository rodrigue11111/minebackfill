// frontend/src/lib/revues.ts
// Revue des gâchées par l'enseignant. Module PUR : types, conversion des
// lignes lues en ligne, règles d'affichage.
//
// « Marquer terminée » vaut soumission. L'enseignant accepte ou refuse (motif
// obligatoire pour un refus) et peut écarter des éprouvettes. Sa décision vit
// dans la table `revues` (supabase/schema.sql), JAMAIS dans le document de
// l'étudiant : l'enseignant n'écrit pas chez lui. Le mot « valide » reste
// réservé à essaiValide (classe.ts) : une revue « accepte » ou « refuse ».

import type { Gachee } from "./gachee";

export type DecisionRevue = "acceptee" | "refusee";

/** Une décision de l'enseignant sur une gâchée. */
export interface Revue {
  kind: "gachee";
  /** Id de la gâchée. */
  id: string;
  /** Révision du document au moment de la décision (« modifiée depuis »). */
  rev: number | null;
  decision: DecisionRevue;
  motif: string | null;
  /** Éprouvettes écartées par l'enseignant (ids). */
  ecartees: string[];
  /** Horodatage serveur de la décision. */
  maj: string;
}

/** Côté enseignant : la revue porte aussi le compte de l'étudiant. */
export interface RevueClasse extends Revue {
  ownerId: string;
}

/** Ce que les écrans et les exports lisent d'une revue. */
export interface InfoRevue {
  decision: DecisionRevue;
  motif: string | null;
  ecartees: string[];
  maj: string;
  /** Le document a été modifié depuis la décision. */
  perimee: boolean;
}

export const LIBELLE_DECISION: Record<DecisionRevue, string> = { acceptee: "acceptée", refusee: "refusée" };

export const cleRevue = (ownerId: string, gacheeId: string): string => `${ownerId}|${gacheeId}`;

/** Vrai si le document a changé depuis la décision (révision plus récente). */
export function revuePerimee(r: Pick<Revue, "rev">, revDoc: number | null | undefined): boolean {
  return r.rev !== null && revDoc !== null && revDoc !== undefined && revDoc > r.rev;
}

/** Revue d'une gâchée de la classe, avec son état « modifiée depuis ». */
export function infoRevue(
  revues: Map<string, RevueClasse>,
  revDoc: (ownerId: string, gacheeId: string) => number | null | undefined,
  ownerId: string,
  gacheeId: string,
): InfoRevue | undefined {
  const r = revues.get(cleRevue(ownerId, gacheeId));
  if (!r) return undefined;
  return { decision: r.decision, motif: r.motif, ecartees: r.ecartees, maj: r.maj, perimee: revuePerimee(r, revDoc(ownerId, gacheeId)) };
}

/**
 * À revoir par l'enseignant : gâchée TERMINÉE (soumise) sans décision, ou
 * modifiée depuis la décision. Jamais une copie de conflit.
 */
export function aRevoir(g: Pick<Gachee, "statut" | "conflit">, info: InfoRevue | undefined): boolean {
  return !g.conflit && g.statut === "terminee" && (!info || info.perimee);
}

/** Libellé court (« Revue : acceptée »). */
export const libelleRevue = (r: Pick<Revue, "decision">): string => `Revue : ${LIBELLE_DECISION[r.decision]}`;

// ── Lignes lues en ligne ──

/** Une ligne de la table `revues` (lecture de l'enseignant). */
export interface LigneRevueClasse {
  owner_id: string;
  target_kind: string;
  target_id: string;
  target_rev: number | string | null;
  decision: string;
  motif: string | null;
  ecartees: string[] | null;
  updated_at: string;
}

/** Une ligne de lire_mes_revues (lecture de l'étudiant). */
export interface LigneMesRevues {
  cible_kind: string;
  cible_id: string;
  cible_rev: number | string | null;
  decision_revue: string;
  motif_revue: string | null;
  ecartees_revue: string[] | null;
  maj_serveur: string;
}

const decision = (d: string): DecisionRevue | null => (d === "acceptee" || d === "refusee" ? d : null);
const rev = (v: number | string | null): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

export function revueClasseDepuisLigne(l: LigneRevueClasse): RevueClasse | null {
  const d = decision(l.decision);
  if (!d || l.target_kind !== "gachee") return null;
  return { ownerId: l.owner_id, kind: "gachee", id: l.target_id, rev: rev(l.target_rev), decision: d, motif: l.motif ?? null, ecartees: l.ecartees ?? [], maj: l.updated_at };
}

export function revueDepuisLigne(l: LigneMesRevues): Revue | null {
  const d = decision(l.decision_revue);
  if (!d || l.cible_kind !== "gachee") return null;
  return { kind: "gachee", id: l.cible_id, rev: rev(l.cible_rev), decision: d, motif: l.motif_revue ?? null, ecartees: l.ecartees_revue ?? [], maj: l.maj_serveur };
}

/** Index des revues de la classe par (compte, gâchée). */
export function indexerRevues(revues: RevueClasse[]): Map<string, RevueClasse> {
  return new Map(revues.map((r) => [cleRevue(r.ownerId, r.id), r]));
}
