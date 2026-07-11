// frontend/src/lib/cloud.ts
// Fonctions de synchronisation cloud (Supabase). Le client est INJECTÉ (pas
// importé) pour rester testable sans réseau. La fusion des résultats est PURE
// (aucune dépendance Supabase) — c'est le cœur testé.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavedResult } from "./store";

export type CatalogueCloudId =
  | "liants" | "residus" | "granulats" | "retardateurs" | "constantes";

/** Enveloppe versionnée, identique au format de persisted.ts. */
export interface EnveloppeVersionnee<T = unknown> {
  v: number;
  data: T;
}

/* ── Fusion des résultats — PURE, testable sans réseau ─────────────────── */

/**
 * Fusionne résultats locaux et cloud. Dédup par `id` : l'existant LOCAL gagne
 * (même sémantique que l'import de sauvegarde). Trie par `savedAt` décroissant.
 * `aPousser` = les résultats locaux absents du cloud (à envoyer).
 */
export function fusionnerResultats(
  locaux: SavedResult[],
  cloud: SavedResult[],
): { fusionnes: SavedResult[]; aPousser: SavedResult[] } {
  const parId = new Map<string, SavedResult>();
  // Le cloud d'abord, puis le local par-dessus : le local gagne à id égal.
  for (const r of cloud) parId.set(r.id, r);
  for (const r of locaux) parId.set(r.id, r);

  const fusionnes = [...parId.values()].sort((a, b) =>
    (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));

  const idsCloud = new Set(cloud.map((r) => r.id));
  const aPousser = locaux.filter((r) => !idsCloud.has(r.id));

  return { fusionnes, aPousser };
}

/* ── Fonctions à client injecté ────────────────────────────────────────── */

/** Lit l'enveloppe {v,data} d'un catalogue officiel (null si absent). */
export async function fetchCatalogueOfficiel(
  sb: SupabaseClient,
  id: CatalogueCloudId,
): Promise<EnveloppeVersionnee | null> {
  const { data, error } = await sb
    .from("official_catalogs").select("data").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return (data as { data: EnveloppeVersionnee }).data;
}

/** Publie (upsert) un catalogue officiel. Réservé au prof (RLS). */
export async function publierCatalogue(
  sb: SupabaseClient,
  id: CatalogueCloudId,
  enveloppe: EnveloppeVersionnee,
  updatedBy: string | null,
): Promise<{ error: string | null }> {
  const { error } = await sb.from("official_catalogs").upsert({
    id, data: enveloppe, updated_at: new Date().toISOString(), updated_by: updatedBy,
  });
  return { error: error?.message ?? null };
}

/** Liste les résultats visibles (les siens ; tous pour le prof, via RLS). */
export async function listerResultatsCloud(sb: SupabaseClient): Promise<SavedResult[]> {
  const { data, error } = await sb
    .from("saved_results").select("payload").order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as { payload: SavedResult }[]).map((row) => row.payload);
}

/** Envoie (upsert) un résultat. Silencieux : le localStorage reste la vérité. */
export async function upsertResultatCloud(
  sb: SupabaseClient,
  userId: string,
  entry: SavedResult,
): Promise<void> {
  await sb.from("saved_results").upsert({
    id: entry.id, user_id: userId, payload: entry,
  });
}

/** Supprime un résultat du cloud (les siens uniquement, via RLS). */
export async function supprimerResultatCloud(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  await sb.from("saved_results").delete().eq("id", id);
}
