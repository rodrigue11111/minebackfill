// Client Supabase paresseux, singleton, désactivé si les variables
// d'environnement sont absentes — même patron que MineBackfill. Le portail
// utilise LE MÊME projet Supabase que MineBackfill : un seul compte
// (enseignant ou étudiant) ouvre les deux.
//
// CONNEXION UNIQUE (SSO) : la session est stockée dans un COOKIE posé sur le
// domaine parent « .progicielbelem.com », lisible par tous les sous-domaines
// (le portail sur www., MineBackfill sur minebackfill.). Se connecter ici vaut
// pour MineBackfill et inversement. L'adaptateur ci-dessous et la clé
// `STORAGE_KEY` sont IDENTIQUES à frontend/src/lib/supabase.ts — c'est ce qui
// fait que les deux applications lisent le même cookie.
//
// Sans configuration : getSupabase() renvoie null et le portail s'affiche en
// mode ouvert (liste des projets sans connexion).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Clé de session PARTAGÉE portail <-> MineBackfill. Doit rester IDENTIQUE à
// frontend/src/lib/supabase.ts, sinon plus de SSO.
const STORAGE_KEY = "pb_auth";

const DOMAINE_PARENT = "progicielbelem.com";
const TAILLE_CHUNK = 3072; // marge sous la limite ~4 Ko par cookie

/**
 * Attributs du cookie selon l'hôte : partage sur « .progicielbelem.com » en
 * production, cookie local sinon (dev / preview). Pur.
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

function nbChunks(cle: string): number {
  let n = 0;
  while (litCookie(`${cle}.${n}`) !== null) n++;
  return n;
}

/**
 * Stockage compatible Supabase basé sur des cookies (partageable entre
 * sous-domaines), découpé en morceaux pour rester sous la limite de taille.
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

/** Vrai si la connexion est configurée (variables d'environnement présentes). */
export function authConfiguree(): boolean {
  return getSupabase() !== null;
}
