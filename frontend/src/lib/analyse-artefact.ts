// frontend/src/lib/analyse-artefact.ts
// Lecture d'un fichier de balayage exporté par la page Analyse.
// Transformations PURES, testables sans DOM.
//
// L'export JSON existait depuis le début, mais rien ne savait le relire :
// c'était un cul-de-sac. Or c'est exactement ce qu'il faut pour reproduire
// une figure d'un poste à l'autre, ou la retrouver des mois plus tard.
//
// Choix assumé : PAS de magasin « analyses sauvegardées » en localStorage.
// Cela coûterait une clé, une version, une migration, une entrée dans
// backup.ts, une synchro cloud et une interface de liste — pour une donnée
// qui est une fonction déterministe de la recette et de la plage, et dont
// l'instantané porte déjà tout le nécessaire. Le fichier suffit.

import type { InstantaneAnalyse } from "./analyse-instantane";

export interface BalayageArtefact {
  category: string;
  param: string;
  x: number[];
  series: Record<string, (number | null)[]>;
}

export interface Artefact {
  instantane: InstantaneAnalyse;
  /** Toujours au moins un résultat ; plusieurs si le fichier vient d'une
   *  comparaison de variantes. */
  resultats: BalayageArtefact[];
  /** Étiquettes des variantes, alignées sur `resultats` (vide si absentes). */
  variantes: string[];
}

export type LectureArtefact = { ok: true; artefact: Artefact } | { ok: false; erreur: string };

const PREFIXE = "minebackfill-analyse-courbes/";

function estBalayage(x: unknown): x is BalayageArtefact {
  if (!x || typeof x !== "object") return false;
  const b = x as Partial<BalayageArtefact>;
  return Array.isArray(b.x) && !!b.series && typeof b.series === "object" && typeof b.param === "string";
}

/**
 * Lit un artefact `/1` (un seul résultat) ou `/2` (plusieurs variantes).
 * Messages d'erreur en français, destinés à l'écran : l'utilisateur doit
 * comprendre POURQUOI son fichier est refusé.
 */
export function lireArtefact(texte: string): LectureArtefact {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: "Fichier illisible : ce n'est pas un JSON valide." };
  }
  if (!brut || typeof brut !== "object") {
    return { ok: false, erreur: "Fichier illisible : contenu inattendu." };
  }

  const o = brut as Record<string, unknown>;
  const format = typeof o.format === "string" ? o.format : "";
  if (!format.startsWith(PREFIXE)) {
    return {
      ok: false,
      erreur: "Ce fichier n'est pas un balayage MineBackfill (essayez un export JSON de la page Analyse).",
    };
  }
  const version = format.slice(PREFIXE.length);
  if (version !== "1" && version !== "2") {
    return { ok: false, erreur: `Balayage d'une version non reconnue (${version}).` };
  }

  const instantane = o.instantane as InstantaneAnalyse | undefined;
  if (!instantane || typeof instantane !== "object" || !("recette" in instantane)) {
    return { ok: false, erreur: "Balayage sans bloc de provenance : il ne serait pas reproductible." };
  }

  // /1 : un seul « resultat ». /2 : un tableau « resultats » + « variantes ».
  const resultats: unknown[] = version === "1"
    ? [o.resultat]
    : Array.isArray(o.resultats) ? o.resultats : [];

  if (resultats.length === 0 || !resultats.every(estBalayage)) {
    return { ok: false, erreur: "Balayage incomplet : les séries de points sont absentes ou mal formées." };
  }

  const variantes = Array.isArray(o.variantes)
    ? (o.variantes as unknown[]).map((v) => String(v))
    : [];

  return {
    ok: true,
    artefact: { instantane, resultats: resultats as BalayageArtefact[], variantes },
  };
}
