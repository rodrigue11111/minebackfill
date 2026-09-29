// frontend/src/lib/courbes-client.ts
// Raccord des courbes au navigateur : le magasin IndexedDB, le déplacement
// des courbes encore rangées dans les gâchées, et leur nettoyage. Toutes les
// décisions vivent dans courbes.ts (pur, testé).

import { deplacerCourbes, encoderCourbe, type MagasinCourbes } from "./courbes";
import { magasinIndexedDb } from "./courbes-idb";
import type { PointCourbe } from "./presse-urstm";
import { loadGacheesFromStorage, persistGachees, useStore } from "./store";

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
