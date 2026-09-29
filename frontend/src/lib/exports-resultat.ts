// frontend/src/lib/exports-resultat.ts
// Exports d'un résultat SAUVEGARDÉ (Excel, PDF, feuille labo), partagés par
// l'Historique et la vue enseignant (/classe). Les modules lourds (exceljs,
// jspdf) ne sont chargés qu'au clic.

import { lireBinders, type RpcMethod, type SavedResult } from "./store";
import { estVersionCourante } from "./conventions";
import type { UnitPreferences } from "./units";

export type FormatExportResultat = "excel" | "pdf" | "feuille";

/** Nom du liant n (1-indexé) d'un résultat : son code, sinon « Ciment n ». */
export const binderNameFor = (sr: SavedResult) => (n: number): string =>
  lireBinders(sr.general)[n - 1]?.code || `Ciment ${n}`;

/**
 * Avertit avant d'exporter un résultat calculé avec d'anciennes formules
 * (masses potentiellement incorrectes, cf. correctif (1+Bv)).
 * Un solverVersion absent = sauvegarde antérieure à l'estampillage (les plus
 * anciennes, donc les plus suspectes) : on avertit aussi, comme le badge
 * « anciennes formules ». Les estampilles des packs ACTUELS (« intra2017-1.0 »,
 * « gramme-1.0 », variantes -personnalise) sont toutes légitimes.
 */
export function confirmerExportObsolete(sr: SavedResult): boolean {
  if (!estVersionCourante(sr.solverVersion)) {
    return window.confirm(
      "Ce résultat a été calculé avec une version antérieure des formules ; " +
      "ses masses peuvent être incorrectes. Exporter quand même ?",
    );
  }
  return true;
}

/** Exporte un résultat sauvegardé. RRC : la feuille labo est le PDF RRC. */
export async function exporterResultat(sr: SavedResult, format: FormatExportResultat, units: UnitPreferences): Promise<void> {
  if (!confirmerExportObsolete(sr)) return;
  if (sr.category === "RRC") {
    if (!sr.rrc) return;
    const { exportRrcExcel, exportRrcPdf } = await import("./rrc-export");
    if (format === "excel") exportRrcExcel(sr.rrc.result.recipes, sr.general, units);
    else exportRrcPdf(sr.rrc.result.recipes, sr.general, units);
    return;
  }
  const args = [sr.recipes, sr.general, binderNameFor(sr), sr.category, sr.method as RpcMethod, units] as const;
  if (format === "excel") {
    const { exportToExcel } = await import("@/components/mix/ResultsPanel");
    exportToExcel(...args);
  } else if (format === "pdf") {
    const { exportToPdf } = await import("./pdf-report");
    exportToPdf(...args);
  } else {
    const { exportPreparationPdf } = await import("./preparation-sheet");
    exportPreparationPdf(...args);
  }
}
