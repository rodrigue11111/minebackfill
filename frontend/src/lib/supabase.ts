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
import { MODE_TEST_SANS_COMPTE } from "./mode-test";

// Clé de session PARTAGÉE portail <-> MineBackfill (nom de base des cookies).
// Doit rester IDENTIQUE dans portail/src/lib/supabase.ts, sinon plus de SSO.
const STORAGE_KEY = "pb_auth";

// Domaine parent commun (portail sur www., MineBackfill sur minebackfill.).
const DOMAINE_PARENT = "progicielbelem.com";

// Marge sous la limite navigateur (~4096 octets par cookie, NOM COMPRIS) : une
// session (jetons + profil) dépasse cette taille, on la découpe en morceaux
// `${clé}.0`, `.1`, ... IMPORTANT : le découpage se fait APRÈS encodage — la
// limite s'applique à la taille réellement écrite, et l'encodage peut tripler
// certains caractères (`"` -> `%22`). Découper AVANT encodage produisait des
// cookies > 4 Ko que le navigateur REJETTE EN SILENCE : session absente du
// stockage -> requêtes envoyées anonymes -> la RLS cache les données (bug
// « rôle toujours étudiant »). encodeURIComponent produit de l'ASCII :
// longueur == octets.
const TAILLE_CHUNK = 3200;

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

// Valeur BRUTE du cookie (sans décodage) : les morceaux sont des tranches d'une
// chaîne encodée UNIQUE — on recolle d'abord, on décode une seule fois (une
// séquence %XX peut être coupée entre deux morceaux).
function litCookieBrut(nom: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + echapper(nom) + "=([^;]*)"));
  return m ? m[1] : null;
}

// Nombre de morceaux contigus (`${clé}.0`, `.1`, ...) présents pour une clé.
function nbChunks(cle: string): number {
  let n = 0;
  while (litCookieBrut(`${cle}.${n}`) !== null) n++;
  return n;
}

/**
 * Stockage compatible Supabase, basé sur des cookies (donc partageable entre
 * sous-domaines). La valeur est encodée PUIS découpée en morceaux ≤ TAILLE_CHUNK
 * octets (voir le commentaire de la constante : c'est la taille écrite qui est
 * limitée par le navigateur). Exporté pour test.
 */
export function creerStockageCookie(attributs: string) {
  const AN = 60 * 60 * 24 * 365;
  // `brut` est déjà du texte encodé (%XX) : ne PAS ré-encoder ici.
  const poser = (nom: string, brut: string, maxAge: number) => {
    document.cookie = `${nom}=${brut}; ${attributs}; max-age=${maxAge}`;
  };
  return {
    getItem(cle: string): string | null {
      if (typeof document === "undefined") return null;
      const n = nbChunks(cle);
      if (n === 0) return null;
      let brut = "";
      for (let i = 0; i < n; i++) brut += litCookieBrut(`${cle}.${i}`) ?? "";
      try {
        return decodeURIComponent(brut);
      } catch {
        // Cookie tronqué/corrompu (p. ex. écrit par l'ancienne version qui
        // dépassait 4 Ko) : équivaut à « pas de session » — l'utilisateur se
        // reconnecte et le setItem suivant réécrit des cookies sains.
        return null;
      }
    },
    setItem(cle: string, valeur: string): void {
      if (typeof document === "undefined") return;
      const ancien = nbChunks(cle);
      const encode = encodeURIComponent(valeur);
      const total = Math.max(1, Math.ceil(encode.length / TAILLE_CHUNK));
      for (let i = 0; i < total; i++) {
        poser(`${cle}.${i}`, encode.slice(i * TAILLE_CHUNK, (i + 1) * TAILLE_CHUNK), AN);
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

/**
 * Nettoie une valeur d'environnement collée à la main dans Vercel. Vu en
 * production : clé collée PLUSIEURS fois séparée par des retours à la ligne,
 * tabulation devant l'URL, guillemets autour de la valeur. Un caractère de
 * contrôle dans l'en-tête `apikey` fait échouer fetch avec « Failed to execute
 * 'fetch' on 'Window': Invalid value » — on ne garde donc que le premier
 * « mot » utile. Exporté pour test.
 */
export function nettoyerValeurEnv(brut: string | undefined): string | undefined {
  const premier = brut
    ?.trim()
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .split(/\s+/)[0];
  return premier ? premier : undefined;
}

let client: SupabaseClient | null | undefined; // undefined = pas encore résolu

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  // Mode test (mode-test.ts) : on se comporte comme « non configuré » — un seul
  // point de coupure désactive tout le cloud/compte (NavBar, /compte, CloudSync,
  // publication) sans toucher à chaque site d'appel.
  if (MODE_TEST_SANS_COMPTE) {
    client = null;
    return client;
  }
  const url = nettoyerValeurEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = nettoyerValeurEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
