// frontend/src/lib/courbes-client.ts
// Raccord des courbes au navigateur : le magasin IndexedDB, le déplacement
// des courbes encore rangées dans les gâchées, et leur nettoyage. Toutes les
// décisions vivent dans courbes.ts (pur, testé).

import { courbesOrphelines, decoderCourbe, deplacerCourbes, encoderCourbe, type CourbeColonnes, type MagasinCourbes } from "./courbes";
import { magasinIndexedDb } from "./courbes-idb";
import type { PointCourbe } from "./presse-urstm";
import { loadGacheesFromStorage, persistGachees, useStore } from "./store";
import type { Gachee } from "./gachee";
import { loadVersioned, persistVersioned } from "./persisted";
import { etatCourbesInitial, type EtatCourbes } from "./sync-courbes";

let magasin: MagasinCourbes | null | undefined;

/** Le magasin du navigateur (null : pas d'IndexedDB, les courbes restent dans les gâchées). */
export function magasinCourbes(): MagasinCourbes | null {
  if (magasin === undefined) magasin = typeof window === "undefined" ? null : magasinIndexedDb();
  return magasin;
}

/**
 * Enregistre des courbes AVANT de les référencer (import de presse). Renvoie
 * les ids réellement enregistrés : un id absent doit garder sa courbe dans la
 * gâchée (comportement d'avant, aucune perte).
 */
export async function enregistrerCourbes(entrees: [string, PointCourbe[]][]): Promise<Set<string>> {
  const m = magasinCourbes();
  if (!m || entrees.length === 0) return new Set();
  try {
    await m.ecrire(entrees.map(([id, pts]) => [id, encoderCourbe(pts)]));
    return new Set(entrees.map(([id]) => id));
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

/** Retire du magasin les courbes d'éprouvettes supprimées (sans attendre). */
export function oublierCourbes(ids: string[]): void {
  const m = magasinCourbes();
  if (m && ids.length > 0) m.supprimer(ids).catch(() => { /* orpheline : sans conséquence */ });
}

/** Courbe d'une éprouvette, lue dans le magasin de CET appareil (null : absente). */
export async function lireCourbeLocale(id: string): Promise<PointCourbe[] | null> {
  const m = magasinCourbes();
  if (!m) return null;
  try {
    const c = await m.lire(id);
    return c ? decoderCourbe(c) : null;
  } catch {
    return null;
  }
}

/** Range une courbe lue en ligne dans le magasin (vrai si c'est fait). */
export async function rangerCourbe(id: string, c: CourbeColonnes): Promise<boolean> {
  const m = magasinCourbes();
  if (!m) return false;
  try {
    await m.ecrire([[id, c]]);
    return true;
  } catch {
    return false;
  }
}

// ── État de l'envoi des courbes en ligne (HORS sauvegarde, comme l'état de
// synchronisation : restauré ailleurs, il ferait croire des courbes envoyées).
export const SYNC_COURBES_KEY = "minebackfill_sync_courbes";

export function chargerEtatCourbes(uid: string): EtatCourbes {
  const e = loadVersioned<EtatCourbes | null>(SYNC_COURBES_KEY, 1, (d) => d as EtatCourbes, null);
  return e && e.uid === uid && e.envoyees && e.bloquees ? e : etatCourbesInitial(uid);
}
export function sauverEtatCourbes(e: EtatCourbes): boolean {
  return persistVersioned(SYNC_COURBES_KEY, 1, e);
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
 * supprimée sur un autre appareil, retrait en échec). PRUDENT : rien n'est
 * effacé si les gâchées ne se lisent pas avec certitude (clé absente ou
 * illisible, travail mis de côté illisible).
 */
export async function balayerCourbesOrphelines(): Promise<number> {
  const m = magasinCourbes();
  if (!m || typeof localStorage === "undefined") return 0;
  try {
    const brut = JSON.parse(localStorage.getItem("minebackfill_gachees") ?? "null") as { data?: unknown } | null;
    if (!brut || !Array.isArray(brut.data)) return 0;
    const deCote = gacheesMisesDeCote();
    if (deCote === null) return 0;
    const orphelines = courbesOrphelines(await m.lister(), [...loadGacheesFromStorage(), ...deCote]);
    if (orphelines.length > 0) await m.supprimer(orphelines);
    return orphelines.length;
  } catch {
    return 0;
  }
}
