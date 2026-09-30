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

/** Fonction ou colonne inconnue du serveur : la base n'a pas le schéma de ce site. */
export function schemaPasAJour(code: string | undefined): boolean {
  return code === "PGRST202" || code === "42883" || code === "42703" || code === "PGRST204";
}

/**
 * Le serveur a refusé d'écrire dans les comptes de connexion (auth.users,
 * auth.sessions) : droit que Supabase peut retirer au propriétaire des
 * fonctions. Le blocage se fait alors dans Supabase Studio.
 */
export function droitAuthRefuse(e: unknown): boolean {
  return e instanceof Error && /permission denied for (table|relation) (users|sessions)/i.test(e.message);
}

/** Message d'une erreur réseau pour l'enseignant (schéma absent, droit refusé : quoi faire). */
export function messageErreurClasse(e: unknown): string {
  if (e instanceof ErreurClasse && schemaPasAJour(e.code)) {
    return "la base de données n'est pas à jour pour cette version du site : exécutez supabase/schema.sql dans SQL Editor (voir docs/OPERATIONS.md)";
  }
  if (droitAuthRefuse(e)) {
    return "le serveur refuse de modifier les comptes de connexion : bloquez ce compte dans Supabase Studio (Authentication → Users → « Ban user »), voir docs/OPERATIONS.md";
  }
  return e instanceof Error ? e.message : String(e);
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

export interface DocComplet {
  contenu: unknown;
  rev: number;
  maj: string;
  supprime: boolean;
}

/**
 * Un document INTÉGRAL d'un étudiant (la lecture de la classe est allégée).
 * Lecture directe de user_docs : la RLS l'accorde à l'enseignant. null = le
 * document n'existe pas (ou plus) en ligne.
 */
export async function lireDocComplet(
  sb: SupabaseClient, proprietaire: string, kind: "resultat" | "gachee", id: string,
): Promise<DocComplet | null> {
  const { data, error } = await sb.from("user_docs").select("payload, rev, updated_at, deleted")
    .eq("user_id", proprietaire).eq("kind", kind).eq("id", id).maybeSingle();
  if (error) throw echec(error);
  if (!data) return null;
  const d = data as { payload: unknown; rev: number | string; updated_at: string; deleted: boolean };
  return { contenu: d.payload, rev: Number(d.rev), maj: d.updated_at, supprime: d.deleted };
}

export async function lireProfils(sb: SupabaseClient): Promise<ProfilClasse[]> {
  const { data, error } = await sb.from("profiles").select("id, email, display_name, role");
  if (error) throw echec(error);
  return (data ?? []) as ProfilClasse[];
}

/* ── Annotations ─────────────────────────────────────────────────────────── */

/**
 * Une ligne de `annotations`, lue en direct par l'enseignant. Lue en
 * `select("*")` : une colonne ajoutée plus tard (lu_le) manque sur une base
 * pas encore à jour, sans faire échouer la lecture.
 */
export interface LigneAnnotation {
  id: string;
  owner_id: string;
  auteur_id?: string;
  target_kind: "resultat" | "gachee";
  target_id: string;
  target_rev: number | string | null;
  ancre: string | null;
  texte: string;
  deleted: boolean;
  created_at?: string;
  updated_at: string;
  /** Accusé de lecture du destinataire ; absent sur une base pas à jour. */
  lu_le?: string | null;
}

/** Une réponse de l'étudiant (il écrit sur son propre travail). */
export const estReponse = (a: Pick<LigneAnnotation, "auteur_id" | "owner_id">): boolean => a.auteur_id === a.owner_id;

/** Enseignant : toutes les annotations (la RLS lui donne tout). */
export async function lireAnnotationsClasse(sb: SupabaseClient): Promise<LigneAnnotation[]> {
  const toutes: LigneAnnotation[] = [];
  // On avance du nombre de lignes REÇUES, pas de la taille demandée : si le
  // serveur tronque les pages (max_rows), un pas fixe sauterait des lignes.
  for (let debut = 0, p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await sb.from("annotations")
      .select("*")
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
  }).select("*").single();
  if (error) throw echec(error);
  return data as LigneAnnotation;
}

/**
 * Retire une annotation dont on est l'auteur. La RLS ne lève pas d'erreur sur
 * une ligne qui ne nous appartient pas : elle n'en modifie aucune. Zéro ligne
 * touchée est donc un ÉCHEC, jamais un succès silencieux.
 */
export async function retirerAnnotation(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("annotations").update({ deleted: true }).eq("id", id).select("id");
  if (error) throw echec(error);
  if (!Array.isArray(data) || data.length === 0) {
    throw new ErreurClasse("aucune_ligne", "ce message n'a pas été retiré (il n'est pas de vous, ou n'existe plus)");
  }
}

/** Accusés de lecture : rend les ids réellement marqués et l'heure serveur. */
export async function marquerAnnotationsLues(sb: SupabaseClient, ids: string[]): Promise<{ id: string; luLe: string }[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb.rpc("marquer_annotations_lues", { p_ids: ids.slice(0, 500) });
  if (error) throw echec(error);
  return ((Array.isArray(data) ? data : []) as { annotation_id: string; lu_serveur: string }[])
    .map((x) => ({ id: x.annotation_id, luLe: x.lu_serveur }));
}

/** Enseignant : réponses d'étudiants pas encore lues. */
export async function nbReponsesNonLues(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.rpc("nb_reponses_non_lues");
  if (error) throw echec(error);
  return Number(data) || 0;
}

/**
 * Étudiant : répond sur SON document (le serveur fait les contrôles). Avec une
 * ancre (une pesée, une éprouvette), la réponse va sous la note de
 * l'enseignant visée (repondre_annotation_ancree). Base pas encore à jour :
 * repli sur repondre_annotation — la réponse part alors au fil général.
 */
export async function repondreAnnotation(sb: SupabaseClient, r: {
  attendu: string; kind: "resultat" | "gachee"; id: string; rev: number | null; texte: string; ancre?: string | null;
}): Promise<Annotation> {
  const base = { p_attendu: r.attendu, p_kind: r.kind, p_id: r.id, p_rev: r.rev, p_texte: r.texte };
  let ancre = r.ancre ?? null;
  let { data, error } = ancre
    ? await sb.rpc("repondre_annotation_ancree", { ...base, p_ancre: ancre })
    : await sb.rpc("repondre_annotation", base);
  if (error && ancre && schemaPasAJour(error.code)) {
    ancre = null;
    ({ data, error } = await sb.rpc("repondre_annotation", base));
  }
  if (error) throw echec(error);
  const x = (Array.isArray(data) ? data[0] : data) as { annotation_id: string; cree_serveur: string; maj_serveur: string } | undefined;
  if (!x) throw new ErreurClasse("reseau", "réponse non enregistrée");
  return {
    id: x.annotation_id, cibleKind: r.kind, cibleId: r.id, cibleRev: r.rev, ancre: ancre?.trim() || null, texte: r.texte.trim(),
    supprime: false, maj: x.maj_serveur, auteur: "moi", creeLe: x.cree_serveur, luLe: null,
  };
}

interface LigneFil {
  annotation_id: string; cible_kind: "resultat" | "gachee"; cible_id: string; cible_rev: number | string | null;
  ancre: string | null; texte: string | null; supprime: boolean; maj_serveur: string;
  de_moi?: boolean; cree_serveur?: string; lu_serveur?: string | null;
}

/**
 * Étudiant : son fil de commentaires, par curseur (lire_fil_annotations).
 * Base pas encore à jour : repli sur lire_annotations (commentaires de
 * l'enseignant seulement, sans accusé de lecture).
 */
export async function lireMesAnnotations(
  sb: SupabaseClient,
  attendu: string,
  apres: { maj: string; id: string } | null,
): Promise<{ annotations: Annotation[]; curseur: { maj: string; id: string } | null }> {
  const r: Annotation[] = [];
  let curseur = apres;
  let fonction = "lire_fil_annotations";
  for (let p = 0; p < MAX_PAGES; p++) {
    const params = {
      p_attendu: attendu, p_apres_maj: curseur?.maj ?? null, p_apres_id: curseur?.id ?? null,
      p_recul_s: p === 0 && curseur ? 120 : 0, p_limite: PAGE,
    };
    let { data, error } = await sb.rpc(fonction, params);
    if (error && fonction === "lire_fil_annotations" && schemaPasAJour(error.code)) {
      fonction = "lire_annotations";
      ({ data, error } = await sb.rpc(fonction, params));
    }
    if (error) throw echec(error);
    const page = (Array.isArray(data) ? data : []) as LigneFil[];
    if (page.length === 0) break;
    const d = page[page.length - 1];
    if (curseur && d.maj_serveur === curseur.maj && d.annotation_id === curseur.id) break;
    for (const x of page) {
      r.push({
        id: x.annotation_id, cibleKind: x.cible_kind, cibleId: x.cible_id,
        cibleRev: x.cible_rev === null ? null : Number(x.cible_rev),
        ancre: x.ancre, texte: x.texte, supprime: x.supprime, maj: x.maj_serveur,
        auteur: x.de_moi ? "moi" : "enseignant", creeLe: x.cree_serveur ?? x.maj_serveur, luLe: x.lu_serveur ?? null,
      });
    }
    curseur = { maj: d.maj_serveur, id: d.annotation_id };
  }
  return { annotations: r, curseur };
}

/* ── Comptes (enseignant) ────────────────────────────────────────────────── */

export interface CompteClasse {
  id: string;
  courriel: string | null;
  nom: string | null;
  role: "prof" | "etudiant";
  creeLe: string | null;
  derniereConnexion: string | null;
  /** Bloqué jusqu'à cette date (connexion refusée) ; null = actif. */
  bloqueJusquA: string | null;
  nbResultats: number;
  nbGachees: number;
  derniereActivite: string | null;
}

export async function lireComptes(sb: SupabaseClient): Promise<CompteClasse[]> {
  const { data, error } = await sb.rpc("lister_comptes");
  if (error) throw echec(error);
  return ((Array.isArray(data) ? data : []) as {
    compte_id: string; courriel: string | null; nom_affiche: string | null; compte_role: string; cree_le: string | null;
    derniere_connexion: string | null; bloque_jusqu_a: string | null; nb_resultats: number | string; nb_gachees: number | string;
    derniere_activite: string | null;
  }[]).map((x) => ({
    id: x.compte_id, courriel: x.courriel, nom: x.nom_affiche, role: x.compte_role === "prof" ? "prof" : "etudiant",
    creeLe: x.cree_le, derniereConnexion: x.derniere_connexion, bloqueJusquA: x.bloque_jusqu_a,
    nbResultats: Number(x.nb_resultats) || 0, nbGachees: Number(x.nb_gachees) || 0, derniereActivite: x.derniere_activite,
  }));
}

/** Nomme (prof) ou retire (etudiant) un enseignant. */
export async function definirRole(sb: SupabaseClient, compte: string, role: "prof" | "etudiant"): Promise<void> {
  const { error } = await sb.rpc("definir_role", { p_compte: compte, p_role: role });
  if (error) throw echec(error);
}

/** Bloque (connexion refusée) ou débloque un compte étudiant. */
export async function bloquerCompte(sb: SupabaseClient, compte: string, bloquer: boolean): Promise<void> {
  const { error } = await sb.rpc("bloquer_compte", { p_compte: compte, p_bloquer: bloquer });
  if (error) throw echec(error);
}
