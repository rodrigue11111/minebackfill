// frontend/src/lib/supabase.ts
// Client Supabase paresseux, singleton, désactivé si les variables
// d'environnement sont absentes. Sans configuration, `getSupabase()` renvoie
// null et toute la couche cloud est inerte — l'app reste 100 % locale.
//
// CONNEXION UNIQUE (SSO) entre le portail et MineBackfill : la session est
// stockée dans un COOKIE posé sur le domaine parent « .progicielbelem.com »,
// donc lisible par tous les sous-domaines (www + minebackfill). Se connecter à
// une application vaut pour l'autre. Le portail utilise le MÊME code et la MÊME
// clé (`STORAGE_KEY`) — les deux lisent le même cookie. Voir aussi
// portail/src/lib/supabase.ts (adaptateur identique).
//
// IMPORTANT : ne JAMAIS appeler getSupabase() pendant le rendu (uniquement dans
// useEffect / handlers). Le prérendu serveur des client components exécute le
// corps du composant, et auth-js touche au stockage (document.cookie).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Clé de session PARTAGÉE portail <-> MineBackfill (nom de base des cookies).
// Doit rester IDENTIQUE dans portail/src/lib/supabase.ts, sinon plus de SSO.
const STORAGE_KEY = "pb_auth";

// Domaine parent commun (portail sur www., MineBackfill sur minebackfill.).
const DOMAINE_PARENT = "progicielbelem.com";

// Marge sous la limite ~4 Ko par cookie : une session (jetons + profil) peut
// dépasser cette taille, on la découpe en morceaux `${clé}.0`, `.1`, ...
const TAILLE_CHUNK = 3072;

/**
 * Attributs du cookie selon l'hôte courant. Pur et exporté pour être testé.
 * - En production (…progicielbelem.com) : `domain=.progicielbelem.com` → cookie
 *   partagé entre sous-domaines (SSO), et `Secure` (HTTPS).
 * - En local / preview (localhost, *.vercel.app) : pas de domaine parent → le
 *   cookie reste sur l'hôte courant ; chaque app garde sa session (le SSO n'a
 *   de sens qu'en prod, et un cookie « .progicielbelem.com » serait refusé
 *   ailleurs).
 */
export function attributsCookie(hostname: string, protocol: string): string {
  let attrs = "path=/; SameSite=Lax";
  if (protocol === "https:") attrs += "; Secure";
  if (hostname === DOMAINE_PARENT || hostname.endsWith("." + DOMAINE_PARENT)) {
    attrs += `; domain=.${DOMAINE_PARENT}`;
  }
  return attrs;
}

function echapper(nom: string): string {
  return nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function litCookie(nom: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + echapper(nom) + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

// Nombre de morceaux contigus (`${clé}.0`, `.1`, ...) présents pour une clé.
function nbChunks(cle: string): number {
  let n = 0;
  while (litCookie(`${cle}.${n}`) !== null) n++;
  return n;
}

/**
 * Stockage compatible Supabase, basé sur des cookies (donc partageable entre
 * sous-domaines). Découpé en morceaux pour rester sous la limite de taille.
 * Les valeurs de session sont de l'ASCII (JSON + jetons base64url), sans paires
 * de substitution UTF-16 : découper la chaîne brute puis encoder chaque morceau
 * est donc sûr. Exporté pour test.
 */
export function creerStockageCookie(attributs: string) {
  const AN = 60 * 60 * 24 * 365;
  const poser = (nom: string, val: string, maxAge: number) => {
    document.cookie = `${nom}=${encodeURIComponent(val)}; ${attributs}; max-age=${maxAge}`;
  };
  return {
    getItem(cle: string): string | null {
      if (typeof document === "undefined") return null;
      const n = nbChunks(cle);
      if (n === 0) return null;
      let out = "";
      for (let i = 0; i < n; i++) out += litCookie(`${cle}.${i}`) ?? "";
      return out;
    },
    setItem(cle: string, valeur: string): void {
      if (typeof document === "undefined") return;
      const ancien = nbChunks(cle);
      const total = Math.max(1, Math.ceil(valeur.length / TAILLE_CHUNK));
      for (let i = 0; i < total; i++) {
        poser(`${cle}.${i}`, valeur.slice(i * TAILLE_CHUNK, (i + 1) * TAILLE_CHUNK), AN);
      }
      // Rétrécissement : purge les morceaux excédentaires devenus orphelins.
      for (let i = total; i < ancien; i++) poser(`${cle}.${i}`, "", 0);
    },
    removeItem(cle: string): void {
      if (typeof document === "undefined") return;
      const n = nbChunks(cle);
      for (let i = 0; i < n; i++) poser(`${cle}.${i}`, "", 0);
    },
  };
}

let client: SupabaseClient | null | undefined; // undefined = pas encore résolu

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    client = null;
    return client;
  }
  // Stockage cookie côté navigateur uniquement (SSO). Au rendu serveur, on
  // laisse Supabase gérer (stockage mémoire) — getSupabase() n'est de toute
  // façon jamais appelé pendant le rendu.
  const storage =
    typeof document !== "undefined" && typeof location !== "undefined"
      ? creerStockageCookie(attributsCookie(location.hostname, location.protocol))
      : undefined;
  client = createClient(url, key, {
    auth: {
      storageKey: STORAGE_KEY,
      storage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
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
