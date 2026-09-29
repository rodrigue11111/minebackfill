// frontend/src/lib/cloud.ts
// Catalogues officiels publiés par l'enseignant (Supabase). Le client est
// INJECTÉ (pas importé) pour rester testable sans réseau.
//
// La synchronisation v1 des résultats (fusion, envoi, suppression) a été
// retirée : elle est remplacée par la synchronisation v2 (sync-*.ts), qui
// couvre aussi les gâchées. Pourquoi : docs/HISTORIQUE_EXTENSIBILITE.md.

import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogueCloudId =
  | "liants" | "residus" | "granulats" | "retardateurs" | "constantes" | "sessions";

/** Enveloppe versionnée, identique au format de persisted.ts. */
export interface EnveloppeVersionnee<T = unknown> {
  v: number;
  data: T;
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
