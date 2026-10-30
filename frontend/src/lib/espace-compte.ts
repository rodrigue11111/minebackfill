// frontend/src/lib/espace-compte.ts
// Saisies en cours qui suivent le compte (2026-10-30). Demande de
// l'utilisateur : après déconnexion et connexion d'un autre compte, la page
// Informations et les formulaires de Calculs montraient encore les saisies
// du compte précédent. sync-bascule.ts ne basculait que les documents
// (résultats, gâchées, commentaires, revues).
//
// Portée choisie par l'utilisateur : la page Informations (clé
// minebackfill_general) et le brouillon des formulaires de Calculs (clé
// minebackfill_brouillon_calculs). Les moules enregistrés, les bibliothèques
// personnelles et les unités restent communs à l'appareil. La simple
// déconnexion ne change rien : la bascule se fait à la connexion d'un AUTRE
// compte, comme pour les documents.
//
// Au changement de compte, les deux clés du compte précédent sont mises de
// côté TELLES QUELLES (texte brut, avec leur enveloppe et leur version :
// leurs migrations s'appliquent à la relecture) sous
// `minebackfill_espace_<uid>`. Le compte qui arrive retrouve les siennes,
// sinon les deux clés sont vidées et il part des formulaires vides. Rien
// n'est envoyé en ligne : ces saisies restent sur CET appareil.
//
// Les accès au stockage sont INJECTÉS : testable en node.

import { BROUILLON_KEY } from "./brouillon-calculs";
import { GENERAL_KEY } from "./store";

/** Clés des saisies en cours qui suivent le compte. */
export const CLES_ESPACE = [GENERAL_KEY, BROUILLON_KEY] as const;
type CleEspace = (typeof CLES_ESPACE)[number];

/** Saisies d'un compte : le texte brut de chaque clé, null si elle est absente. */
export type Espace = Record<CleEspace, string | null>;

export const PREFIXE_ESPACE = "minebackfill_espace_";
export const VERSION_ESPACE = 1;
export const cleEspace = (uid: string) => `${PREFIXE_ESPACE}${uid}`;

export interface StockageEspace {
  lire: (cle: string) => string | null;
  ecrire: (cle: string, valeur: string) => boolean;
  supprimer: (cle: string) => void;
}

/** Mise de côté relue : null si absente, illisible ou d'une version inconnue. */
export function lireEspace(brut: string | null): Espace | null {
  if (brut === null) return null;
  let e: unknown;
  try { e = JSON.parse(brut); } catch { return null; }
  if (!e || typeof e !== "object") return null;
  const { v, data } = e as { v?: unknown; data?: unknown };
  if (v !== VERSION_ESPACE || !data || typeof data !== "object") return null;
  const out = {} as Espace;
  for (const k of CLES_ESPACE) {
    const x = (data as Record<string, unknown>)[k];
    if (x !== undefined && x !== null && typeof x !== "string") return null;
    out[k] = x ?? null;
  }
  return out;
}

function remettre(s: StockageEspace, espace: Espace): void {
  for (const k of CLES_ESPACE) {
    const v = espace[k];
    if (v === null) s.supprimer(k);
    else s.ecrire(k, v);
  }
}

/**
 * Le compte `ancienUid` cède la place à `nouvelUid` sur cet appareil. Rend
 * false si le stockage a refusé une écriture : les saisies affichées restent
 * alors celles d'avant, et rien n'est perdu.
 */
export function basculerEspace(s: StockageEspace, ancienUid: string, nouvelUid: string): boolean {
  if (ancienUid === nouvelUid) return true;
  const actuel = Object.fromEntries(CLES_ESPACE.map((k) => [k, s.lire(k)])) as Espace;

  // 1. Mettre de côté D'ABORD : si l'écriture échoue, rien n'a bougé.
  if (!s.ecrire(cleEspace(ancienUid), JSON.stringify({ v: VERSION_ESPACE, data: actuel }))) return false;

  // 2. Le nouveau compte : ses saisies laissées ici, sinon des formulaires vides.
  // Une mise de côté illisible n'est pas effacée (rien n'est jeté sans être lu).
  const attente = lireEspace(s.lire(cleEspace(nouvelUid)));
  for (const k of CLES_ESPACE) {
    const v = attente?.[k] ?? null;
    if (v === null) { s.supprimer(k); continue; }
    if (!s.ecrire(k, v)) {
      // Stockage refusé en cours de route : les saisies du compte précédent
      // reviennent. Sa mise de côté reste aussi, sans dommage.
      remettre(s, actuel);
      return false;
    }
  }
  if (attente) s.supprimer(cleEspace(nouvelUid));
  return true;
}
