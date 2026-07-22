// Client Supabase paresseux, singleton, désactivé si les variables
// d'environnement sont absentes — même patron que MineBackfill. Le portail
// utilise LE MÊME projet Supabase que MineBackfill : un seul compte
// (enseignant ou étudiant) ouvre les deux.
//
// Sans configuration : getSupabase() renvoie null et le portail s'affiche en
// mode ouvert (liste des projets sans connexion).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined; // undefined = pas encore résolu

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "progicielbelem_auth",
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
  return client;
}

/** Vrai si la connexion est configurée (variables d'environnement présentes). */
export function authConfiguree(): boolean {
  return getSupabase() !== null;
}
