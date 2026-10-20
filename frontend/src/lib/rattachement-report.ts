// frontend/src/lib/rattachement-report.ts
// « Plus tard » sur le bandeau « Rattacher les données de cet appareil » :
// mémorisé pour CE compte, sur cet appareil, pendant 12 heures. Avant le
// 2026-10-20, le choix ne vivait qu'en mémoire (sync-client.ts) et le bandeau
// revenait à chaque chargement de page. La page Compte garde l'action
// « Rattacher » tant que le rattachement est en attente.
//
// Clé `minebackfill_rattachement_reporte`, enveloppe {v:1, data:{uid, jusqua}},
// HORS sauvegarde (lien avec un compte, propre à l'appareil). Stockage absent
// ou illisible (navigation privée) : le bandeau revient, comme avant.

import { loadVersioned, persistVersioned } from "./persisted";

export const CLE_REPORT_RATTACHEMENT = "minebackfill_rattachement_reporte";
const VERSION = 1;
export const DUREE_REPORT_MS = 12 * 3_600_000;

interface Report { uid: string; jusqua: number }

const lire = (): Report | null =>
  loadVersioned<Report | null>(CLE_REPORT_RATTACHEMENT, VERSION, () => null, null);

/** Le rattachement a-t-il été reporté par ce compte, et le report court-il encore ? */
export function rattachementReporte(uid: string, maintenant = Date.now()): boolean {
  const r = lire();
  return r !== null && r.uid === uid && typeof r.jusqua === "number" && maintenant < r.jusqua;
}

/** « Plus tard » : le bandeau se tait pour ce compte pendant DUREE_REPORT_MS. */
export function reporterPour(uid: string, maintenant = Date.now()): void {
  persistVersioned<Report>(CLE_REPORT_RATTACHEMENT, VERSION, { uid, jusqua: maintenant + DUREE_REPORT_MS });
}

/** Rattachement fait (ou annulé) : plus rien à reporter. */
export function oublierReport(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(CLE_REPORT_RATTACHEMENT); } catch { /* stockage indisponible : rien à oublier */ }
}
