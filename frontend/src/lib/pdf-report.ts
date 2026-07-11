import type { UnitPreferences } from "@/lib/units";
import type { Recipe } from "@/lib/types";
import type { Category, GeneralInfo } from "@/lib/store";
import { methodLabel } from "@/lib/method-registry";
import { REPORT_SECTIONS, rowsForSection, type ReportCtx } from "@/lib/report-schema";
import { MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS } from "@/lib/units";
import { fmt } from "@/lib/format";
import { EXPORT_FOOTER } from "@/lib/branding";

/* ── Colour palette (RGB tuples) ── */
const NAVY: [number, number, number] = [12, 30, 66];
const PRIMARY_LIGHT: [number, number, number] = [239, 246, 255];
const PRIMARY_TXT: [number, number, number] = [29, 78, 216];
const GREEN_HDR: [number, number, number] = [220, 252, 231];
const GREEN_TXT: [number, number, number] = [21, 128, 61];
const PURPLE_HDR: [number, number, number] = [243, 232, 255];
const PURPLE_TXT: [number, number, number] = [124, 58, 237];
const AMBER_HDR: [number, number, number] = [254, 243, 199];
const AMBER_TXT: [number, number, number] = [146, 64, 14];
const CYAN_HDR: [number, number, number] = [207, 250, 254];
const CYAN_TXT: [number, number, number] = [14, 116, 144];
const WHITE: [number, number, number] = [255, 255, 255];
const GREY_BG: [number, number, number] = [248, 250, 252];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

export async function exportToPdf(
  recipes: Recipe[],
  general: GeneralInfo,
  binderName: (n: 1 | 2 | 3) => string,
  category: string,
  method: string,
  units: UnitPreferences,
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 12;
  const marginR = 12;
  const contentW = pageW - marginL - marginR;

  const recipeCount = recipes.length;
  const bcount = general.binder_count ?? 1;
  const isEssai = method === "essai";
  const isRpg = category === "RPG";
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const volLabel = VOLUME_LABELS[units.volume] ?? "L";
  const densLabel = DENSITY_LABELS[units.density] ?? "g/cm3";

  const libelleMethode = methodLabel(category as Category, method);

  let y = 10;

  /* ── Footer on every page ── */
  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`${EXPORT_FOOTER}  |  ${new Date().toLocaleDateString("fr-CA")}`, marginL, pageH - 6);
      doc.text(`Page ${i}/${pages}`, pageW - marginR, pageH - 6, { align: "right" });
    }
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      y = 12;
    }
  };

  /* ════════════════════════════════
     PAGE 1 — HEADER & PROJECT INFO
     ════════════════════════════════ */

  // Title banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("MINEBACKFILL — Résultats de calcul", marginL, 13);

  // Sub-banner
  doc.setFillColor(26, 58, 138);
  doc.rect(0, 20, pageW, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(200, 210, 240);
  doc.text(
    `${category} — ${libelleMethode}  |  ${recipeCount} recette${recipeCount > 1 ? "s" : ""}  |  ${new Date().toLocaleDateString("fr-CA")}`,
    marginL, 27,
  );
  y = 36;

  // Project info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoRows: [string, string][] = [
    ["Opérateur", general.operator_name ?? ""],
    ["Projet", general.project_name ?? ""],
    ["Résidu", general.residue_id ?? ""],
    ["Date du mélange", general.mix_date ?? ""],
  ].filter(([, v]) => v) as [string, string][];

  for (const [label, value] of infoRows) {
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont("helvetica", "bold");
    doc.text(label + " :", marginL, y);
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginL + 40, y);
    y += 5.5;
  }
  y += 4;

  /* ── Table drawing helpers ── */
  const colW_label = contentW * 0.38;
  const colW_unit = contentW * 0.10;
  const colW_recipe = (contentW - colW_label - colW_unit) / recipeCount;

  const drawSectionHeader = (title: string, bgColor: [number, number, number], txtColor: [number, number, number]) => {
    checkPageBreak(20);
    doc.setFillColor(...bgColor);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...txtColor);
    doc.text(title, marginL + 3, y + 5);
    y += 7;
  };

  const drawColumnHeaders = () => {
    doc.setFillColor(...GREY_BG);
    doc.rect(marginL, y, contentW, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    doc.text("Paramètre", marginL + 2, y + 4.2);
    doc.text("Unité", marginL + colW_label + 2, y + 4.2);
    for (let i = 0; i < recipeCount; i++) {
      const x = marginL + colW_label + colW_unit + colW_recipe * i;
      doc.text(`Recette ${i + 1}`, x + colW_recipe - 2, y + 4.2, { align: "right" });
    }
    // Border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(marginL, y, contentW, 6);
    y += 6;
  };

  let rowIdx = 0;
  const drawDataRow = (label: string, unit: string, getter: (r: Recipe) => number | null | undefined, digits = 3, bold = false) => {
    checkPageBreak(5.5);
    const rowH = 5.5;
    const isAlt = rowIdx % 2 === 1;
    if (isAlt) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginL, y, contentW, rowH, "F");
    }
    doc.setFontSize(8.5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text(label, marginL + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(8);
    doc.text(unit, marginL + colW_label + 2, y + 4);
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    for (let i = 0; i < recipeCount; i++) {
      const v = getter(recipes[i]);
      const x = marginL + colW_label + colW_unit + colW_recipe * (i + 1) - 2;
      doc.text(fmt(v, digits), x, y + 4, { align: "right" });
    }
    // Light border
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.1);
    doc.line(marginL, y + rowH, marginL + contentW, y + rowH);
    y += rowH;
    rowIdx++;
  };

  /* ── Sections 1-6 : générées depuis le schéma de rapport unique ── */
  const ctx: ReportCtx = {
    units, massLabel, volLabel, densLabel, binderName,
    isEssai, isRpg, bcount,
  };
  const SECTION_COLORS: Record<number, [[number, number, number], [number, number, number]]> = {
    1: [PRIMARY_LIGHT, PRIMARY_TXT],
    2: [GREEN_HDR, GREEN_TXT],
    3: [PURPLE_HDR, PURPLE_TXT],
    4: [AMBER_HDR, AMBER_TXT],
    5: [CYAN_HDR, CYAN_TXT],
    6: [PRIMARY_LIGHT, PRIMARY_TXT],
  };
  REPORT_SECTIONS.forEach((section, si) => {
    if (si > 0) y += 4;
    const [bg, txt] = SECTION_COLORS[section.id];
    drawSectionHeader(section.title(ctx).toUpperCase(), bg, txt);
    drawColumnHeaders();
    rowIdx = 0;
    for (const row of rowsForSection(section.id, ctx)) {
      drawDataRow(row.label(ctx), row.unit(ctx), (r) => row.getter(r, ctx), row.digits, row.bold);
    }
  });

  /* ── Footer ── */
  addFooter();

  /* ── Save ── */
  const filename = `MineBackfill_${category}_${method}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
