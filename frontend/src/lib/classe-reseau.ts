// frontend/src/lib/classe-reseau.ts
// Accès réseau du tableau de bord de la classe et des annotations. Client
// Supabase INJECTÉ (testable sans réseau). Les erreurs sont LEVÉES : une
// lecture en échec ne doit jamais s'afficher comme une classe vide.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Annotation } from "./annotations";
import type { LigneClasse, ProfilClasse } from "./classe";

const PAGE = 500;
const MAX_PAGES = 200;

export class ErreurClasse extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ErreurClasse";
  }
}

function echec(e: { code?: string; message?: string } | null | undefined): ErreurClasse {
  return new ErreurClasse(e?.code || "reseau", e?.message || "Lecture impossible");
}

interface LigneLue {
  proprietaire: string;
  doc_kind: string;
  doc_id: string;
  doc_rev: number | string;
  maj_serveur: string;
  cree_serveur: string;
  supprime: boolean;
  contenu: unknown;
}

/**
 * Tout le travail visible par l'enseignant, page par page jusqu'à une page
 * VIDE (une page courte ne prouve rien : le serveur peut tronquer).
 * `complet` = documents intégraux (export) ; sinon projection allégée.
 */
export async function lireClasse(
  sb: SupabaseClient,
  o: { complet: boolean; session: string | null },
): Promise<LigneClasse[]> {
  const toutes: LigneClasse[] = [];
  let apres: LigneLue | null = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await sb.rpc("lire_docs_classe", {
      p_apres_maj: apres?.maj_serveur ?? null,
      p_apres_user: apres?.proprietaire ?? null,
      p_apres_kind: apres?.doc_kind ?? null,
      p_apres_id: apres?.doc_id ?? null,
      p_recul_s: 0,
      p_limite: PAGE,
      p_complet: o.complet,
      p_session: o.session,
    });
    if (error) throw echec(error);
    const page = (Array.isArray(data) ? data : []) as LigneLue[];
    if (page.length === 0) break;
    const d = page[page.length - 1];
    if (apres && d.maj_serveur === apres.maj_serveur && d.proprietaire === apres.proprietaire
      && d.doc_kind === apres.doc_kind && d.doc_id === apres.doc_id) break;
    for (const x of page) {
      if (x.doc_kind !== "resultat" && x.doc_kind !== "gachee") continue;
      toutes.push({
        proprietaire: x.proprietaire, kind: x.doc_kind, id: x.doc_id, rev: Number(x.doc_rev),
        maj: x.maj_serveur, cree: x.cree_serveur, supprime: x.supprime, contenu: x.contenu,
      });
    }
    apres = d;
  }
  return toutes;
}

export async function lireProfils(sb: SupabaseClient): Promise<ProfilClasse[]> {
  const { data, error } = await sb.from("profiles").select("id, email, display_name, role");
  if (error) throw echec(error);
  return (data ?? []) as ProfilClasse[];
}

/* ── Annotations ─────────────────────────────────────────────────────────── */

export interface LigneAnnotation {
  id: string;
  owner_id: string;
  target_kind: "resultat" | "gachee";
  target_id: string;
  target_rev: number | string | null;
  ancre: string | null;
  texte: string;
  deleted: boolean;
  updated_at: string;
}

export function versAnnotation(l: LigneAnnotation): Annotation {
  return {
    id: l.id, cibleKind: l.target_kind, cibleId: l.target_id,
    cibleRev: l.target_rev === null ? null : Number(l.target_rev),
    ancre: l.ancre, texte: l.deleted ? null : l.texte, supprime: l.deleted, maj: l.updated_at,
  };
}

/** Enseignant : toutes les annotations (la RLS lui donne tout). */
export async function lireAnnotationsClasse(sb: SupabaseClient): Promise<LigneAnnotation[]> {
  const toutes: LigneAnnotation[] = [];
  // On avance du nombre de lignes REÇUES, pas de la taille demandée : si le
  // serveur tronque les pages (max_rows), un pas fixe sauterait des lignes.
  for (let debut = 0, p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await sb.from("annotations")
      .select("id, owner_id, target_kind, target_id, target_rev, ancre, texte, deleted, updated_at")
      .eq("deleted", false)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(debut, debut + PAGE - 1);
    if (error) throw echec(error);
    const page = (data ?? []) as LigneAnnotation[];
    if (page.length === 0) break;
    toutes.push(...page);
    debut += page.length;
  }
  return toutes;
}

export async function ajouterAnnotation(sb: SupabaseClient, a: {
  ownerId: string; auteurId: string; kind: "resultat" | "gachee"; id: string;
  rev: number | null; ancre: string | null; texte: string;
}): Promise<LigneAnnotation> {
  const { data, error } = await sb.from("annotations").insert({
    owner_id: a.ownerId, auteur_id: a.auteurId, target_kind: a.kind, target_id: a.id,
    target_rev: a.rev, ancre: a.ancre, texte: a.texte,
  }).select("id, owner_id, target_kind, target_id, target_rev, ancre, texte, deleted, updated_at").single();
  if (error) throw echec(error);
  return data as LigneAnnotation;
}

export async function retirerAnnotation(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("annotations").update({ deleted: true }).eq("id", id);
  if (error) throw echec(error);
}

/** Étudiant : ses annotations, par curseur (lire_annotations). */
export async function lireMesAnnotations(
  sb: SupabaseClient,
  attendu: string,
  apres: { maj: string; id: string } | null,
): Promise<{ annotations: Annotation[]; curseur: { maj: string; id: string } | null }> {
  const r: Annotation[] = [];
  let curseur = apres;
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await sb.rpc("lire_annotations", {
      p_attendu: attendu, p_apres_maj: curseur?.maj ?? null, p_apres_id: curseur?.id ?? null,
      p_recul_s: p === 0 && curseur ? 120 : 0, p_limite: PAGE,
    });
    if (error) throw echec(error);
    const page = (Array.isArray(data) ? data : []) as {
      annotation_id: string; cible_kind: "resultat" | "gachee"; cible_id: string; cible_rev: number | string | null;
      ancre: string | null; texte: string | null; supprime: boolean; maj_serveur: string;
    }[];
    if (page.length === 0) break;
    const d = page[page.length - 1];
    if (curseur && d.maj_serveur === curseur.maj && d.annotation_id === curseur.id) break;
    for (const x of page) {
      r.push({
        id: x.annotation_id, cibleKind: x.cible_kind, cibleId: x.cible_id,
        cibleRev: x.cible_rev === null ? null : Number(x.cible_rev),
        ancre: x.ancre, texte: x.texte, supprime: x.supprime, maj: x.maj_serveur,
      });
    }
    curseur = { maj: d.maj_serveur, id: d.annotation_id };
  }
  return { annotations: r, curseur };
}
