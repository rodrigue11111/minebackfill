// frontend/src/lib/sync-etat.ts
// État persistant de la synchronisation v2 : la clé `minebackfill_sync`.
//
// Elle n'est PAS dans la sauvegarde (backup.ts) : restaurée sur un autre
// appareil, elle ferait croire que des documents sont déjà synchronisés.
//
// Ce module ne dépend que de persisted.ts et du moteur : le magasin (store.tsx)
// peut l'importer sans cycle d'import, pour poser une suppression au moment
// même où l'utilisateur supprime.

import { loadVersioned, persistVersioned } from "./persisted";
import { etatInitial, marquerSuppression, type EtatSync, type Kind } from "./sync-moteur";

export const CLE_ETAT_SYNC = "minebackfill_sync";
const VERSION_ETAT = 1;

function valide(x: unknown): x is EtatSync {
  const e = x as EtatSync;
  return !!e && e.v === 1 && typeof e.docs === "object" && e.docs !== null
    && typeof e.suppressions === "object" && e.suppressions !== null
    && typeof e.bloques === "object" && e.bloques !== null
    && (e.uid === null || typeof e.uid === "string");
}

export function chargerEtatSync(): EtatSync {
  const e = loadVersioned<unknown>(CLE_ETAT_SYNC, VERSION_ETAT, (d) => d, null);
  return valide(e) ? e : etatInitial();
}

export function sauverEtatSync(e: EtatSync): boolean {
  return persistVersioned(CLE_ETAT_SYNC, VERSION_ETAT, e);
}

/**
 * Un cycle part d'un état (depart) et en produit un nouveau (fin). Pendant
 * qu'il attendait le réseau, l'utilisateur a pu supprimer un document : la
 * suppression est alors dans l'état STOCKÉ, mais pas dans `fin`. Sauver `fin`
 * tel quel la perdrait — et le document supprimé reviendrait au cycle suivant.
 * On reporte donc les suppressions posées pendant le cycle. Pure.
 */
export function reporterSuppressions(depart: EtatSync, stocke: EtatSync, fin: EtatSync): EtatSync {
  const ajoutees = Object.keys(stocke.suppressions).filter((c) => !depart.suppressions[c]);
  if (ajoutees.length === 0) return fin;
  const suppressions = { ...fin.suppressions };
  for (const c of ajoutees) suppressions[c] = true;
  return { ...fin, suppressions };
}

/**
 * Pose une suppression à transmettre en ligne, au moment où l'utilisateur
 * supprime. Sans compte lié : rien (supprimer reste une affaire locale).
 */
export function marquerSuppressionLocale(kind: Kind, id: string): void {
  const e = chargerEtatSync();
  if (e.uid === null) return;
  sauverEtatSync(marquerSuppression(e, kind, id));
}
