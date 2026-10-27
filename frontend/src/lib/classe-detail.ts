// frontend/src/lib/classe-detail.ts
// Fiche d'un étudiant dans la page Classe, rangée par CALCUL (2026-10-26) :
// avec plusieurs recettes et gâchées, la liste plate « Gâchées », puis
// « Résultats sauvegardés », obligeait l'enseignant à faire lui-même le lien
// entre une gâchée et le calcul dont elle vient. Ici chaque gâchée est rangée
// sous son calcul (Gachee.formulationId = id du résultat sauvegardé). Module PUR.

import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";

export interface BlocCalcul {
  resultat: SavedResult;
  /** Gâchées de ce calcul, la plus récente d'abord. */
  gachees: Gachee[];
}

export interface FicheRegroupee {
  /** Calculs qui ont au moins une gâchée, le plus récemment actif d'abord. */
  blocs: BlocCalcul[];
  /** Calculs sauvegardés sans gâchée, le plus récent d'abord. */
  calculsSansGachee: SavedResult[];
  /** Gâchées dont le calcul n'est pas dans la liste (autre session, calcul supprimé, sans lien). */
  gacheesSansCalcul: Gachee[];
}

const recent = (a: string | undefined, b: string | undefined) => (b ?? "").localeCompare(a ?? "");

export function regrouperParCalcul(e: { resultats: SavedResult[]; gachees: Gachee[] }): FicheRegroupee {
  const parCalcul = new Map<string, Gachee[]>();
  const gacheesSansCalcul: Gachee[] = [];
  const ids = new Set(e.resultats.map((r) => r.id));
  for (const g of [...e.gachees].sort((a, b) => recent(a.creeLe, b.creeLe))) {
    if (g.formulationId && ids.has(g.formulationId)) parCalcul.set(g.formulationId, [...(parCalcul.get(g.formulationId) ?? []), g]);
    else gacheesSansCalcul.push(g);
  }
  const blocs: BlocCalcul[] = [];
  const calculsSansGachee: SavedResult[] = [];
  for (const r of e.resultats) {
    const gs = parCalcul.get(r.id);
    if (gs) blocs.push({ resultat: r, gachees: gs });
    else calculsSansGachee.push(r);
  }
  // Activité d'un bloc : sa gâchée la plus récente (ou, à défaut, le calcul).
  const activite = (b: BlocCalcul) => [b.resultat.savedAt, ...b.gachees.map((g) => g.creeLe)].sort(recent)[0];
  blocs.sort((a, b) => recent(activite(a), activite(b)));
  calculsSansGachee.sort((a, b) => recent(a.savedAt, b.savedAt));
  return { blocs, calculsSansGachee, gacheesSansCalcul };
}
