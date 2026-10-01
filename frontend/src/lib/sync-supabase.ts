// frontend/src/lib/sync-supabase.ts
// Transport du moteur de synchronisation vers Supabase : le SEUL module qui
// parle au réseau pour la synchronisation v2. Il appelle les fonctions SQL
// lire_docs et ecrire_doc (supabase/schema.sql) et traduit leurs réponses et
// leurs erreurs dans les termes du moteur.
//
// Le client est INJECTÉ (même patron que cloud.ts) : testable sans réseau.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ErreurSync,
  type Curseur, type Envoi, type Kind, type LigneServeur, type ReponseEcriture, type Transport,
} from "./sync-moteur";
import type { EcrireCourbe } from "./sync-courbes";

/** Délai au-delà duquel un appel est abandonné (réessayé plus tard). */
const DELAI_APPEL_MS = 20000;

/**
 * Refus DÉFINITIFS du serveur : renvoyer le même contenu échouerait encore.
 * 42501 droits / RLS · 23514 contrainte (id, taille) · 53400 quota ·
 * 22001 valeur trop longue · 23502 valeur manquante · 22P02 format invalide.
 */
const PERMANENTS = new Set(["42501", "23514", "53400", "22001", "23502", "22P02"]);

export function classerErreur(e: { code?: string | null; message?: string } | null | undefined): ErreurSync {
  const code = e?.code || "reseau";
  if (code === "28000") return new ErreurSync("session", code, e?.message);
  if (PERMANENTS.has(code)) return new ErreurSync("permanente", code, e?.message);
  // Réseau coupé, délai dépassé, serveur indisponible, jeton à rafraîchir,
  // fonction absente (schéma v2 pas encore appliqué) : on réessaiera.
  return new ErreurSync("transitoire", code, e?.message);
}

interface LigneLue {
  doc_kind: string;
  doc_id: string;
  doc_rev: number | string;
  maj_serveur: string;
  supprime: boolean;
  contenu: unknown;
}

interface LigneEcrite {
  ok: boolean;
  rev_serveur: number | string | null;
  maj_serveur: string | null;
  supprime_serveur: boolean | null;
  contenu_serveur: unknown;
}

const KINDS = new Set<string>(["resultat", "gachee"]);

type Rpc = (fn: string, params: Record<string, unknown>) => {
  abortSignal: (s: AbortSignal) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

/**
 * @param attendu uid du compte auquel le stockage local est lié. Le serveur
 *   refuse (28000) si la session courante est un autre compte : rien ne
 *   s'écrit jamais sous le mauvais compte.
 */
export function transportSupabase(sb: SupabaseClient, attendu: () => string): Transport {
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;

  async function appeler<T>(fn: string, params: Record<string, unknown>): Promise<T[]> {
    let r: { data: unknown; error: { code?: string; message?: string } | null };
    try {
      r = await rpc(fn, params).abortSignal(AbortSignal.timeout(DELAI_APPEL_MS));
    } catch (e) {
      throw classerErreur({ code: "reseau", message: e instanceof Error ? e.message : String(e) });
    }
    if (r.error) throw classerErreur(r.error);
    return (Array.isArray(r.data) ? r.data : []) as T[];
  }

  return {
    async lirePage(apres: Curseur | null, reculS: number, limite: number): Promise<LigneServeur[]> {
      const lignes = await appeler<LigneLue>("lire_docs", {
        p_attendu: attendu(),
        // Le curseur repart TEL QUEL : jamais reconverti en Date (perte des
        // microsecondes -> la même page relue sans fin).
        p_apres_maj: apres?.maj ?? null,
        p_apres_kind: apres?.kind ?? null,
        p_apres_id: apres?.id ?? null,
        p_recul_s: reculS,
        p_limite: limite,
      });
      return lignes
        .filter((l) => KINDS.has(l.doc_kind))
        .map((l) => ({
          kind: l.doc_kind as Kind, id: l.doc_id, rev: Number(l.doc_rev),
          maj: l.maj_serveur, supprime: l.supprime, contenu: l.contenu,
        }));
    },

    async ecrire(e: Envoi): Promise<ReponseEcriture> {
      const lignes = await appeler<LigneEcrite>("ecrire_doc", {
        p_attendu: attendu(),
        p_kind: e.kind,
        p_id: e.id,
        p_payload: e.supprime ? null : e.contenu,
        p_base_rev: e.baseRev,
        p_supprime: e.supprime,
      });
      const x = lignes[0];
      if (!x || x.rev_serveur === null) return { ok: false, ligne: null };
      if (x.ok) return { ok: true, rev: Number(x.rev_serveur), maj: x.maj_serveur ?? "" };
      return {
        ok: false,
        ligne: {
          kind: e.kind, id: e.id, rev: Number(x.rev_serveur), maj: x.maj_serveur ?? "",
          supprime: !!x.supprime_serveur, contenu: x.contenu_serveur,
        },
      };
    },
  };
}

/**
 * Écriture d'un document « courbe » (ecrire_doc), hors moteur : les courbes
 * sont envoyées par sync-courbes.ts, à part (voir son en-tête). Mêmes règles
 * d'erreur que le transport : refus définitif, session, ou passager.
 */
export function ecrivainCourbes(sb: SupabaseClient, attendu: () => string): EcrireCourbe {
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  return async (id, contenu, baseRev) => {
    let r: { data: unknown; error: { code?: string; message?: string } | null };
    try {
      r = await rpc("ecrire_doc", {
        p_attendu: attendu(), p_kind: "courbe", p_id: id, p_payload: contenu, p_base_rev: baseRev, p_supprime: false,
      }).abortSignal(AbortSignal.timeout(DELAI_APPEL_MS));
    } catch (e) {
      throw classerErreur({ code: "reseau", message: e instanceof Error ? e.message : String(e) });
    }
    if (r.error) throw classerErreur(r.error);
    const x = (Array.isArray(r.data) ? r.data[0] : undefined) as LigneEcrite | undefined;
    if (!x || x.rev_serveur === null) return { ok: false, ligne: null };
    if (x.ok) return { ok: true, rev: Number(x.rev_serveur) };
    return { ok: false, ligne: { rev: Number(x.rev_serveur), supprime: !!x.supprime_serveur, contenu: x.contenu_serveur } };
  };
}

/**
 * Nettoyage serveur : met à la corbeille les courbes de CE compte dont
 * l'éprouvette n'existe plus dans aucune gâchée en ligne (purger_mes_courbes).
 * Base pas encore à jour, ou échec : sans conséquence (rend 0).
 */
export async function purgerMesCourbes(sb: SupabaseClient, attendu: string): Promise<number> {
  try {
    const { data, error } = await sb.rpc("purger_mes_courbes", { p_attendu: attendu });
    return error ? 0 : Number(data) || 0;
  } catch {
    return 0;
  }
}
