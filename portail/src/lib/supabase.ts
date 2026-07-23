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
import { MODE_TEST_SANS_COMPTE } from "./mode-test";

// Clé de session PARTAGÉE portail <-> MineBackfill. Doit rester IDENTIQUE à
// frontend/src/lib/supabase.ts, sinon plus de SSO.
const STORAGE_KEY = "pb_auth";

const DOMAINE_PARENT = "progicielbelem.com";
// Marge sous la limite navigateur (~4096 octets par cookie, nom compris). Le
// découpage se fait APRÈS encodage : c'est la taille écrite qui est limitée
// (découper avant encodage produisait des cookies > 4 Ko, rejetés en silence).
const TAILLE_CHUNK = 3200;

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

// Valeur BRUTE du cookie (sans décodage) : les morceaux sont des tranches d'une
// chaîne encodée UNIQUE — on recolle d'abord, on décode une seule fois.
function litCookieBrut(nom: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + echapper(nom) + "=([^;]*)"));
  return m ? m[1] : null;
}

function nbChunks(cle: string): number {
  let n = 0;
  while (litCookieBrut(`${cle}.${n}`) !== null) n++;
  return n;
}

/**
 * Stockage compatible Supabase basé sur des cookies (partageable entre
 * sous-domaines). La valeur est encodée PUIS découpée en morceaux ≤ TAILLE_CHUNK
 * octets (c'est la taille écrite qui est limitée par le navigateur).
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
        // Cookie tronqué/corrompu (ancienne version > 4 Ko) : « pas de
        // session » — la prochaine connexion réécrit des cookies sains.
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
 * Nettoie une valeur d'environnement collée à la main dans Vercel (retours à
 * la ligne, tabulations, guillemets, valeur collée plusieurs fois) : un
 * caractère de contrôle dans un en-tête HTTP fait échouer fetch avec
 * « Invalid value ». Identique à frontend/src/lib/supabase.ts.
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
  // Mode test (mode-test.ts) : portail en accès libre, cloud désactivé.
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
