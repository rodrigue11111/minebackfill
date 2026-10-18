// frontend/src/lib/courbes-client.ts
// Raccord des courbes au navigateur : le magasin IndexedDB, le déplacement
// des courbes encore rangées dans les gâchées, et leur nettoyage. Toutes les
// décisions vivent dans courbes.ts (pur, testé).

import { cleCourbe, courbesOrphelines, decoderCourbe, deplacerCourbes, encoderCourbe, type CourbeColonnes, type MagasinCourbes } from "./courbes";
import { magasinIndexedDb } from "./courbes-idb";
import type { PointCourbe } from "./presse-urstm";
import { loadGacheesFromStorage, persistGachees, useStore } from "./store";
import type { Gachee } from "./gachee";
import type { Eprouvette } from "./eprouvette";
import { loadVersioned, persistVersioned } from "./persisted";
import { etatCourbesInitial, type EtatCourbes } from "./sync-courbes";

let magasin: MagasinCourbes | null | undefined;

/** Le magasin du navigateur (null : pas d'IndexedDB, les courbes restent dans les gâchées). */
export function magasinCourbes(): MagasinCourbes | null {
  if (magasin === undefined) magasin = typeof window === "undefined" ? null : magasinIndexedDb();
  return magasin;
}

/**
 * Enregistre des courbes AVANT de les référencer (import de presse), sous
 * leur clé de courbe. Renvoie les clés réellement enregistrées : une clé
 * absente doit garder sa courbe dans la gâchée (comportement d'avant, aucune
 * perte).
 */
export async function enregistrerCourbes(entrees: [string, PointCourbe[]][]): Promise<Set<string>> {
  const m = magasinCourbes();
  if (!m || entrees.length === 0) return new Set();
  try {
    await m.ecrire(entrees.map(([cle, pts]) => [cle, encoderCourbe(pts)]));
    return new Set(entrees.map(([cle]) => cle));
  } catch {
    return new Set();
  }
}

let deplacementEnCours = false;

/**
 * Déplace dans IndexedDB les courbes encore stockées dans les gâchées
 * (imports antérieurs), puis allège le stockage local. Gardé : si les gâchées
 * ont changé pendant l'écriture (l'utilisateur tape), on n'écrase rien et on
 * réessaiera au prochain chargement.
 */
export async function deplacerCourbesStockees(): Promise<number> {
  const m = magasinCourbes();
  if (!m || deplacementEnCours) return 0;
  deplacementEnCours = true;
  try {
    const avant = loadGacheesFromStorage();
    const empreinteAvant = JSON.stringify(avant);
    let r: Awaited<ReturnType<typeof deplacerCourbes>>;
    try {
      r = await deplacerCourbes(avant, m);
    } catch {
      return 0; // magasin en échec : les courbes restent où elles sont
    }
    if (!r) return 0;
    if (JSON.stringify(loadGacheesFromStorage()) !== empreinteAvant) return 0;
    if (!persistGachees(r.gachees)) return 0;
    useStore.getState().loadGachees();
    return r.deplacees;
  } finally {
    deplacementEnCours = false;
  }
}

/**
 * Retire du magasin les courbes données (sans attendre). Supprime ce qu'on
 * lui donne : c'est à l'appelant de passer par courbesAOublier, qui garde
 * les clés qu'une autre gâchée désigne encore.
 */
export function oublierCourbes(cles: string[]): void {
  const m = magasinCourbes();
  if (m && cles.length > 0) m.supprimer(cles).catch(() => { /* orpheline : sans conséquence */ });
}

/** Courbe d'une éprouvette, lue dans le magasin de CET appareil (null : absente). */
export async function lireCourbeLocale(e: Pick<Eprouvette, "id" | "essai">): Promise<PointCourbe[] | null> {
  const m = magasinCourbes();
  if (!m) return null;
  try {
    const c = await m.lire(cleCourbe(e));
    return c ? decoderCourbe(c) : null;
  } catch {
    return null;
  }
}

/** Range une courbe lue en ligne dans le magasin, sous sa clé (vrai si c'est fait). */
export async function rangerCourbe(cle: string, c: CourbeColonnes): Promise<boolean> {
  const m = magasinCourbes();
  if (!m) return false;
  try {
    await m.ecrire([[cle, c]]);
    return true;
  } catch {
    return false;
  }
}

// ── État de l'envoi des courbes en ligne (HORS sauvegarde, comme l'état de
// synchronisation : restauré ailleurs, il ferait croire des courbes envoyées).
// Version 2 : un état PAR COMPTE (changer de compte ne perd plus l'état de
// l'autre), indexé par identifiant de document (un par import).
export const SYNC_COURBES_KEY = "minebackfill_sync_courbes";
const VERSION_ETAT_COURBES = 2;

interface EtatCourbesComptes {
  comptes: Record<string, EtatCourbes>;
}

/**
 * v1 → v2. La v1 tenait un seul compte, `{ uid, envoyees, bloquees }`, indexé
 * par id d'éprouvette (documents à l'ancien identifiant, qui restent en ligne
 * et lisibles) : le compte est repris, ses entrées sont abandonnées (au pire
 * un appel « déjà en ligne » par courbe au prochain envoi).
 */
export function migrerEtatCourbes(data: unknown, depuis: number): EtatCourbesComptes {
  const uid = depuis === 1 ? (data as { uid?: unknown } | null)?.uid : undefined;
  return { comptes: typeof uid === "string" && uid ? { [uid]: etatCourbesInitial() } : {} };
}

function lireEtatsCourbes(): EtatCourbesComptes {
  const e = loadVersioned<EtatCourbesComptes | null>(SYNC_COURBES_KEY, VERSION_ETAT_COURBES, migrerEtatCourbes, null);
  return e && typeof e.comptes === "object" && e.comptes !== null ? e : { comptes: {} };
}

export function chargerEtatCourbes(uid: string): EtatCourbes {
  const e = lireEtatsCourbes().comptes[uid];
  return e && typeof e.envoyees === "object" && e.envoyees !== null && typeof e.bloquees === "object" && e.bloquees !== null
    ? e : etatCourbesInitial();
}

export function sauverEtatCourbes(uid: string, e: EtatCourbes): boolean {
  const tous = lireEtatsCourbes();
  return persistVersioned(SYNC_COURBES_KEY, VERSION_ETAT_COURBES, { comptes: { ...tous.comptes, [uid]: e } });
}

/** Une courbe lue en ligne est déjà en ligne : rien à renvoyer. */
export function marquerCourbeEnLigne(uid: string, cle: string, rev: number): void {
  const e = chargerEtatCourbes(uid);
  if (e.envoyees[cle]?.rev === rev) return;
  sauverEtatCourbes(uid, { ...e, envoyees: { ...e.envoyees, [cle]: { rev } } });
}

const PREFIXE_MISE_DE_COTE = "minebackfill_compte_";

/** Gâchées du travail d'autres comptes mis de côté sur cet appareil. */
function gacheesMisesDeCote(): Gachee[] | null {
  try {
    const r: Gachee[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (!cle?.startsWith(PREFIXE_MISE_DE_COTE)) continue;
      const brut = JSON.parse(localStorage.getItem(cle) ?? "null") as { data?: { gachees?: Gachee[] } } | null;
      if (!brut?.data || !Array.isArray(brut.data.gachees)) return null; // illisible : prudence
      r.push(...brut.data.gachees);
    }
    return r;
  } catch {
    return null;
  }
}

/**
 * Retire du magasin les courbes qu'aucune gâchée ne référence plus (gâchée
 * supprimée sur un autre appareil, retrait en échec, éprouvette réimportée).
 * PRUDENT : rien n'est effacé si les gâchées ne se lisent pas avec certitude
 * (clé absente ou illisible, migration en échec, travail mis de côté
 * illisible). Le magasin est listé D'ABORD : une courbe enregistrée ensuite
 * (import en cours) n'est pas dans la liste, donc jamais effacée.
 */
export async function balayerCourbesOrphelines(m: MagasinCourbes | null = magasinCourbes()): Promise<number> {
  if (!m || typeof localStorage === "undefined") return 0;
  try {
    const cles = await m.lister();
    const brut = JSON.parse(localStorage.getItem("minebackfill_gachees") ?? "null") as { data?: unknown } | null;
    if (!brut || !Array.isArray(brut.data)) return 0;
    const gachees = loadGacheesFromStorage();
    // loadVersioned rend une liste vide sur exception : avec un stockage non
    // vide, ce vide-là ne prouve rien, et tout serait effacé.
    if (gachees.length === 0 && brut.data.length > 0) return 0;
    const deCote = gacheesMisesDeCote();
    if (deCote === null) return 0;
    const orphelines = courbesOrphelines(cles, [...gachees, ...deCote]);
    if (orphelines.length > 0) await m.supprimer(orphelines);
    return orphelines.length;
  } catch {
    return 0;
  }
}
