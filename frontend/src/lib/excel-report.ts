// frontend/src/lib/excel-report.ts
// Export Excel du rapport de résultats (RPC/RPG), mis en forme avec ExcelJS.
// Même schéma que l'écran et le PDF (report-schema.ts). Déplacé hors du
// panneau de résultats : l'Historique et la vue enseignant l'appellent aussi
// (exports-resultat.ts). Modules lourds chargés au clic.

import { lireBinders } from "./store";
import type { Category, GeneralInfo } from "./store";
import { MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS, type UnitPreferences } from "./units";
import { methodLabel } from "./method-registry";
import { REPORT_SECTIONS, rowsForSection, type ReportCtx } from "./report-schema";
import { RECIPE_HEX } from "./recipe-theme";
import { APP_NAME_VERSION, EXPORT_FOOTER } from "./branding";
import type { Recipe } from "./types";

/* ── Excel export (professional formatting with ExcelJS) ── */
export async function exportToExcel(
  recipes: Recipe[],
  general: GeneralInfo,
  binderName: (n: number) => string,
  category: string,
  method: string,
  units: UnitPreferences,
) {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME_VERSION;
  wb.created = new Date();

  const ws = wb.addWorksheet("Résultats", {
    properties: { defaultColWidth: 18 },
  });

  const recipeCount = recipes.length;
  const totalCols = 2 + recipeCount; // Param + Unit + recipes

  /* ── Colour palette ── */
  const NAVY = "0C1E42";
  const PRIMARY = "1D4ED8";
  const PRIMARY_LIGHT = "EFF6FF";
  const GREEN_HDR = "DCFCE7";
  const GREEN_TXT = "15803D";
  const PURPLE_HDR = "F3E8FF";
  const PURPLE_TXT = "7C3AED";
  const AMBER_HDR = "FEF3C7";
  const AMBER_TXT = "92400E";
  const CYAN_HDR = "CFFAFE";
  const CYAN_TXT = "0E7490";
  const BORDER_CLR = "D1D5DB";
  const GREY_BG = "F8FAFC";
  const WHITE = "FFFFFF";

  const thinBorder = (color = BORDER_CLR) => ({ style: "thin" as const, color: { argb: color } });

  const allBorders = {
    top: thinBorder(),
    left: thinBorder(),
    bottom: thinBorder(),
    right: thinBorder(),
  };

  /* ── Helper: set column widths ── */
  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 12;
  for (let c = 3; c <= totalCols; c++) ws.getColumn(c).width = 18;

  /* ── Title block ── */
  const titleRow = ws.addRow(["MineBackfill : résultats de calcul"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  /* ── Subtitle ── */
  const subRow = ws.addRow([
    `${category}  |  ${methodLabel(category as Category, method)}  |  ${recipes.length} recette${recipes.length > 1 ? "s" : ""}  |  ${new Date().toLocaleDateString("fr-CA")}`,
  ]);
  ws.mergeCells(subRow.number, 1, subRow.number, totalCols);
  subRow.height = 24;
  const subCell = subRow.getCell(1);
  subCell.font = { name: "Calibri", size: 11, color: { argb: WHITE }, italic: true };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1A3A8A" } };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  ws.addRow([]); // spacer

  /* ── General info block ── */
  const addInfoRow = (label: string, value: string) => {
    if (!value) return;
    const r = ws.addRow([label, value]);
    r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "64748B" } };
    r.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "1E293B" } };
  };

  addInfoRow("Opérateur", general.operator_name ?? "");
  addInfoRow("Projet", general.project_name ?? "");
  addInfoRow("Résidu", general.residue_id ?? "");
  addInfoRow("Date", general.mix_date ?? "");

  ws.addRow([]); // spacer

  /* ── Data-row helper ── */
  const bcount = lireBinders(general).length;
  const isEssai = method === "essai";
  const isRpg = category === "RPG";
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const volLabel = VOLUME_LABELS[units.volume] ?? "L";
  const densLabel = DENSITY_LABELS[units.density] ?? "g/cm3";

  const addSectionHeader = (title: string, bgColor: string, textColor: string) => {
    const r = ws.addRow([title]);
    ws.mergeCells(r.number, 1, r.number, totalCols);
    r.height = 26;
    const c = r.getCell(1);
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: textColor } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    c.alignment = { vertical: "middle", indent: 1 };
    c.border = allBorders;
  };

  const addColumnHeaders = () => {
    const hdrs = ["Paramètre", "Unité", ...recipes.map((_, i) => `Recette ${i + 1}`)];
    const r = ws.addRow(hdrs);
    r.height = 22;
    r.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: colNumber <= 2 ? "374151" : RECIPE_HEX[colNumber - 3] ?? "374151" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_BG.replace("#", "") } };
      cell.alignment = { vertical: "middle", horizontal: colNumber <= 2 ? "left" : "right" };
      cell.border = allBorders;
    });
  };

  let rowIndex = 0;
  const addDataRow = (label: string, unit: string, getter: (r: Recipe) => number | null | undefined, digits = 3, isBold = false) => {
    const values = recipes.map((r) => {
      const v = getter(r);
      return v === null || v === undefined || Number.isNaN(v) ? null : parseFloat(v.toFixed(digits));
    });
    const r = ws.addRow([label, unit, ...values]);
    const isAlt = rowIndex % 2 === 1;
    rowIndex++;

    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 1) {
        cell.font = { name: "Calibri", size: 10, bold: isBold, color: { argb: "374151" } };
        cell.alignment = { vertical: "middle" };
      } else if (colNumber === 2) {
        cell.font = { name: "Calibri", size: 9, color: { argb: "94A3B8" } };
        cell.alignment = { vertical: "middle" };
      } else {
        cell.font = { name: "Calibri", size: 11, bold: isBold, color: { argb: isBold ? (RECIPE_HEX[colNumber - 3] ?? "0F172A") : "0F172A" } };
        cell.alignment = { vertical: "middle", horizontal: "right" };
        if (cell.value !== null && cell.value !== undefined) {
          cell.numFmt = digits <= 2 ? `0.${"0".repeat(digits)}` : `0.${"0".repeat(digits)}`;
        }
      }
      if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
      cell.border = {
        top: thinBorder("E2E8F0"),
        bottom: thinBorder("E2E8F0"),
        left: thinBorder("E2E8F0"),
        right: thinBorder("E2E8F0"),
      };
    });
  };

  /* ── Sections 1-6 : générées depuis le schéma de rapport unique ── */
  const ctx: ReportCtx = {
    units, massLabel, volLabel, densLabel, binderName,
    isEssai, isRpg, bcount,
  };
  const SECTION_COLORS: Record<number, [string, string]> = {
    1: [PRIMARY_LIGHT.replace("#", ""), PRIMARY],
    2: [GREEN_HDR.replace("#", ""), GREEN_TXT],
    3: [PURPLE_HDR.replace("#", ""), PURPLE_TXT],
    4: [AMBER_HDR.replace("#", ""), AMBER_TXT],
    5: [CYAN_HDR.replace("#", ""), CYAN_TXT],
    6: [PRIMARY_LIGHT.replace("#", ""), PRIMARY],
  };
  REPORT_SECTIONS.forEach((section, si) => {
    if (si > 0) ws.addRow([]);
    const [bg, txt] = SECTION_COLORS[section.id];
    addSectionHeader(section.title(ctx).toUpperCase(), bg, txt);
    addColumnHeaders();
    rowIndex = 0;
    for (const row of rowsForSection(section.id, ctx)) {
      addDataRow(row.label(ctx), row.unit(ctx), (r) => row.getter(r, ctx), row.digits, row.bold);
    }
  });

  /* ── Footer ── */
  ws.addRow([]);
  const footerRow = ws.addRow([`Généré par ${EXPORT_FOOTER}`]);
  ws.mergeCells(footerRow.number, 1, footerRow.number, totalCols);
  footerRow.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "94A3B8" } };

  /* ── Print settings ── */
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  /* ── Save ── */
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = `MineBackfill_${category}_${methodLabel(category as Category, method, "fichier")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, filename);
}
