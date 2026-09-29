// frontend/src/lib/classe.ts
// Tableau de bord de la classe (enseignant). Module PUR : il reçoit les lignes
// lues par lire_docs_classe (supabase/schema.sql) et les profils, et produit
// ce que la page affiche. Rien n'est versé dans le stockage local de
// l'enseignant : la classe se lit EN MÉMOIRE, à chaque ouverture.

import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";
import { contrainteKpa, type Eprouvette } from "./eprouvette";
import { nuageUcs, type AxeFormulation, type PointNuage } from "./ucs-formulation";
import { correspond, type FiltreSession, type Session } from "./sessions";

/** Une ligne rendue par lire_docs_classe. */
export interface LigneClasse {
  proprietaire: string;
  kind: "resultat" | "gachee";
  id: string;
  rev: number;
  maj: string;
  cree: string;
  supprime: boolean;
  contenu: unknown;
}

export interface ProfilClasse {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
}

export interface EtudiantClasse {
  id: string;
  nom: string;
  email: string | null;
  resultats: SavedResult[];
  gachees: Gachee[];
  /** Essais valides (voir essaiValide), copies de conflit exclues. */
  nbEssais: number;
  /** Dernière écriture en ligne (horodatage serveur), null si aucune. */
  derniereActivite: string | null;
}

/**
 * LA règle de comptage du tableau de bord (tableau, figure, alertes,
 * comparaison, CSV, rapport) : une éprouvette ÉCRASÉE, à mesure exploitable,
 * non exclue — exactement ce que agregerParAge retient dans la moyenne.
 */
export function essaiValide(ep: Eprouvette): boolean {
  return ep.statut === "ecrase" && !ep.essai?.exclu && contrainteKpa(ep.essai) !== null;
}

/**
 * Gâchées prises en compte : sans les copies de conflit (elles gardent les
 * éprouvettes de l'original, mêmes ids : les compter doublerait les essais).
 */
export function gacheesRetenues(e: Pick<EtudiantClasse, "gachees">): Gachee[] {
  return e.gachees.filter((g) => !g.conflit);
}

/**
 * Un document lu en ligne n'est pas migré comme le stockage local : la
 * projection allégée retire des champs, et un très ancien document peut en
 * manquer. On normalise UNE fois ici, pour que rien en aval ne plante.
 */
export function normaliserGachee(contenu: unknown): Gachee {
  const g = contenu as Gachee;
  return { ...g, composants: g.composants ?? [], eprouvettes: g.eprouvettes ?? [], ajustements: g.ajustements ?? [] };
}

export function cleLigne(l: Pick<LigneClasse, "proprietaire" | "kind" | "id">): string {
  return `${l.proprietaire}|${l.kind}|${l.id}`;
}

/** Lectures répétées : pour chaque document, la révision la plus haute gagne. */
export function fusionnerLignes(courantes: Map<string, LigneClasse>, nouvelles: LigneClasse[]): Map<string, LigneClasse> {
  const r = new Map(courantes);
  for (const l of nouvelles) {
    const k = cleLigne(l);
    const avant = r.get(k);
    if (!avant || l.rev > avant.rev) r.set(k, l);
  }
  return r;
}

export function nomEtudiant(p: ProfilClasse | undefined, id: string): string {
  return p?.display_name?.trim() || p?.email || `Compte ${id.slice(0, 8)}`;
}

/**
 * Regroupe par étudiant. Tous les comptes « étudiant » apparaissent, même
 * sans document (l'enseignant voit qui n'a pas commencé). Les documents
 * supprimés sont ignorés ; le filtre de session s'applique aux documents.
 */
export function regrouper(
  lignes: Iterable<LigneClasse>,
  profils: ProfilClasse[],
  sessions: Session[],
  filtre: FiltreSession,
): EtudiantClasse[] {
  const parId = new Map(profils.map((p) => [p.id, p]));
  const etudiants = new Map<string, EtudiantClasse>();
  const obtenir = (id: string): EtudiantClasse => {
    let e = etudiants.get(id);
    if (!e) {
      const p = parId.get(id);
      e = { id, nom: nomEtudiant(p, id), email: p?.email ?? null, resultats: [], gachees: [], nbEssais: 0, derniereActivite: null };
      etudiants.set(id, e);
    }
    return e;
  };
  for (const p of profils) if (p.role !== "prof") obtenir(p.id);

  for (const l of lignes) {
    if (l.supprime || !l.contenu || parId.get(l.proprietaire)?.role === "prof") continue;
    if (l.kind === "resultat") {
      const r = l.contenu as SavedResult;
      if (!correspond({ sessionId: r.sessionId, date: r.savedAt }, sessions, filtre)) continue;
      const e = obtenir(l.proprietaire);
      e.resultats.push(r);
      if (!e.derniereActivite || l.maj > e.derniereActivite) e.derniereActivite = l.maj;
    } else {
      const g = normaliserGachee(l.contenu);
      if (!correspond({ sessionId: g.sessionId, date: g.creeLe }, sessions, filtre)) continue;
      const e = obtenir(l.proprietaire);
      e.gachees.push(g);
      if (!g.conflit) e.nbEssais += g.eprouvettes.filter(essaiValide).length;
      if (!e.derniereActivite || l.maj > e.derniereActivite) e.derniereActivite = l.maj;
    }
  }
  for (const e of etudiants.values()) {
    e.resultats.sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
    e.gachees.sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""));
  }
  return [...etudiants.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export interface PointClasse extends PointNuage {
  etudiantId: string;
  etudiant: string;
}

/**
 * Nuage UCS de la classe, construit ÉTUDIANT PAR ÉTUDIANT : les ids de
 * formulation ne sont uniques que chez un même étudiant, une gâchée ne doit
 * donc chercher sa formulation que parmi les résultats de son auteur. Les
 * copies de conflit sont exclues (même gâchée comptée deux fois sinon).
 */
export function nuageClasse(
  etudiants: EtudiantClasse[],
  axe: AxeFormulation,
  ageJours: number,
): { points: PointClasse[]; ecartees: { etudiant: string; code: string; raison: string }[] } {
  const points: PointClasse[] = [];
  const ecartees: { etudiant: string; code: string; raison: string }[] = [];
  for (const e of etudiants) {
    const gachees = gacheesRetenues(e);
    if (gachees.length === 0) continue;
    const n = nuageUcs(gachees, e.resultats.map((r) => ({ id: r.id, recipes: r.recipes ?? [] })), axe, ageJours);
    for (const p of n.points) points.push({ ...p, id: `${e.id}:${p.id}`, etudiantId: e.id, etudiant: e.nom });
    for (const x of n.ecartees) ecartees.push({ etudiant: e.nom, ...x });
  }
  return { points, ecartees };
}

/** Âges de cure ayant au moins un essai valide dans la classe (triés). */
export function agesClasse(etudiants: EtudiantClasse[]): number[] {
  const s = new Set<number>();
  for (const e of etudiants) for (const g of gacheesRetenues(e)) for (const ep of g.eprouvettes) {
    if (essaiValide(ep)) s.add(ep.ageJours);
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Export JSON de la classe : la seule copie de sauvegarde hors de Supabase
 * (l'offre gratuite n'en fait aucune). À ranger HORS de GitHub : il contient
 * des données d'étudiants.
 */
export function exportClasse(etudiants: EtudiantClasse[], filtre: FiltreSession, maintenant: Date): unknown {
  return {
    application: "MineBackfill",
    type: "export-classe",
    version: 1,
    exporteLe: maintenant.toISOString(),
    session: filtre,
    etudiants: etudiants.map((e) => ({
      id: e.id, nom: e.nom, email: e.email, resultats: e.resultats, gachees: e.gachees,
    })),
  };
}
