// frontend/src/lib/classe-source.ts
// Source des données de la page Classe : Supabase (la classe réelle) ou la
// démonstration en mémoire (classe-demo.ts). La page et l'onglet Comptes
// passent par elle au lieu d'appeler classe-reseau.ts directement.
//
// `sourceSupabase` DÉLÈGUE tel quel aux fonctions de classe-reseau.ts, sans
// rien changer à leur comportement : c'est un simple aiguillage, pour que la
// démonstration (2026-10-26) n'ait aucun chemin vers le réseau.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LigneClasse, ProfilClasse } from "./classe";
import {
  ajouterAnnotation, bloquerCompte, definirRole, lireAnnotationsClasse, lireClasse, lireComptes, lireCourbe,
  lireCourbesClasse, lireDocComplet, lireProfils, lireRevuesClasse, marquerAnnotationsLues, poserRevue,
  retirerAnnotation, retirerRevue,
  type CompteClasse, type CourbeClasse, type CourbeLue, type DocComplet, type LigneAnnotation,
} from "./classe-reseau";
import type { DecisionRevue, RevueClasse } from "./revues";

export interface SourceClasse {
  /** Vrai pour la démonstration : rien n'est enregistré, certaines actions sont indisponibles. */
  readonly demonstration: boolean;
  lireClasse(o: { complet: boolean; session: string | null }): Promise<LigneClasse[]>;
  lireProfils(): Promise<ProfilClasse[]>;
  lireAnnotationsClasse(): Promise<LigneAnnotation[]>;
  lireRevuesClasse(): Promise<RevueClasse[] | null>;
  lireDocComplet(proprietaire: string, kind: "resultat" | "gachee" | "courbe", id: string): Promise<DocComplet | null>;
  lireCourbe(proprietaire: string, eprouvetteId: string, importeLe: string | undefined): Promise<CourbeLue | null>;
  lireCourbesClasse(avecContenu: boolean, proprietaires: string[]): Promise<CourbeClasse[]>;
  ajouterAnnotation(a: {
    ownerId: string; auteurId: string; kind: "resultat" | "gachee"; id: string;
    rev: number | null; ancre: string | null; texte: string;
  }): Promise<LigneAnnotation>;
  retirerAnnotation(id: string): Promise<void>;
  marquerAnnotationsLues(ids: string[]): Promise<{ id: string; luLe: string }[]>;
  poserRevue(r: {
    ownerId: string; id: string; rev: number | null; decision: DecisionRevue; motif: string | null; ecartees: string[];
  }): Promise<RevueClasse>;
  retirerRevue(ownerId: string, id: string): Promise<boolean>;
  lireComptes(): Promise<CompteClasse[]>;
  definirRole(compte: string, role: "prof" | "etudiant"): Promise<void>;
  bloquerCompte(compte: string, bloquer: boolean): Promise<void>;
}

/** La classe réelle : chaque méthode appelle la fonction de classe-reseau.ts du même nom. */
export function sourceSupabase(sb: SupabaseClient): SourceClasse {
  return {
    demonstration: false,
    lireClasse: (o) => lireClasse(sb, o),
    lireProfils: () => lireProfils(sb),
    lireAnnotationsClasse: () => lireAnnotationsClasse(sb),
    lireRevuesClasse: () => lireRevuesClasse(sb),
    lireDocComplet: (proprietaire, kind, id) => lireDocComplet(sb, proprietaire, kind, id),
    lireCourbe: (proprietaire, eprouvetteId, importeLe) => lireCourbe(sb, proprietaire, eprouvetteId, importeLe),
    lireCourbesClasse: (avecContenu, proprietaires) => lireCourbesClasse(sb, avecContenu, proprietaires),
    ajouterAnnotation: (a) => ajouterAnnotation(sb, a),
    retirerAnnotation: (id) => retirerAnnotation(sb, id),
    marquerAnnotationsLues: (ids) => marquerAnnotationsLues(sb, ids),
    poserRevue: (r) => poserRevue(sb, r),
    retirerRevue: (ownerId, id) => retirerRevue(sb, ownerId, id),
    lireComptes: () => lireComptes(sb),
    definirRole: (compte, role) => definirRole(sb, compte, role),
    bloquerCompte: (compte, bloquer) => bloquerCompte(sb, compte, bloquer),
  };
}
