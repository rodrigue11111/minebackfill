// frontend/src/lib/supabase.ts
// Client Supabase paresseux, singleton, désactivé si les variables
// d'environnement sont absentes. Sans configuration, `getSupabase()` renvoie
// null et toute la couche cloud est inerte — l'app reste 100 % locale.
//
// IMPORTANT : ne JAMAIS appeler getSupabase() pendant le rendu (uniquement dans
// useEffect / handlers). Le prérendu serveur des client components exécute le
// corps du composant, et auth-js touche localStorage.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined; // undefined = pas encore résolu

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key
    ? createClient(url, key, {
        auth: {
          // Préfixe cohérent avec les 10 clés minebackfill_* existantes.
          storageKey: "minebackfill_auth",
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
  return client;
}

/** Vrai si la synchronisation en ligne est configurée (env présentes). */
export function cloudConfigure(): boolean {
  return getSupabase() !== null;
}

/** Rôle applicatif d'un utilisateur (miroir de public.profiles.role). */
export type UserRole = "prof" | "etudiant";

export interface CloudSession {
  userId: string;
  email: string | null;
  role: UserRole;
}
