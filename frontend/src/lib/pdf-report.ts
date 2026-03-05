import type { UnitPreferences } from "@/lib/units";
import {
  fromStoreMass, fromStoreVolume, fromStoreDensity,
  MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS,
} from "@/lib/units";

/* ── helpers ── */
const val = (x: number | null | undefined, fallback = 0) =>
  x === undefined || x === null || Number.isNaN(x) ? fallback : x;

const masseRejetSecTotaleKg = (r: any) =>
  val(r?.components?.residue_dry_mass_kg) + val(r?.components?.aggregate_dry_mass_kg);
const masseSolidesTotaleKg = (r: any) =>
  masseRejetSecTotaleKg(r) + val(r?.components?.binder_total_mass_kg);
const masseRemblaiTotaleKg = (r: any) =>
  masseSolidesTotaleKg(r) + val(r?.components?.water_total_mass_kg);
const masseEauDansResidusKg = (r: any) =>
  val(r?.components?.residue_wet_mass_kg) - val(r?.components?.residue_dry_mass_kg);
const volumeAirM3 = (r: any) =>
  val(r?.void_volume_m3) - val(r?.water_volume_m3);
const cwCalculePct = (r: any) => {
  const ms = masseSolidesTotaleKg(r);
  const mw = val(r?.components?.water_total_mass_kg);
  const mt = ms + mw;
  return mt <= 0 ? null : (ms / mt) * 100;
};
const cvCalculePct = (r: any) => {
  const vs = val(r?.solid_volume_m3);
  const vt = val(r?.total_backfill_volume_m3);
  return vt <= 0 ? null : (vs / vt) * 100;
};

const fmtNum = (v: number | null | undefined, digits = 3): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

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
  recipes: any[],
  general: any,
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

  const methodLabel = method === "dosage_cw" ? "Dosage Cw%"
    : method === "wb" ? "Rapport E/C"
    : method === "slump" ? "Slump"
    : "Essai-erreur";

  let y = 10;

  /* ── Footer on every page ── */
  const addFooter = () => {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`MineBackfill v1.0 — Module 1  |  ${new Date().toLocaleDateString("fr-CA")}`, marginL, pageH - 6);
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
  doc.text("MINEBACKFILL — Resultats de calcul", marginL, 13);

  // Sub-banner
  doc.setFillColor(26, 58, 138);
  doc.rect(0, 20, pageW, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(200, 210, 240);
  doc.text(
    `${category} — ${methodLabel}  |  ${recipeCount} recette${recipeCount > 1 ? "s" : ""}  |  ${new Date().toLocaleDateString("fr-CA")}`,
    marginL, 27,
  );
  y = 36;

  // Project info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoRows: [string, string][] = [
    ["Operateur", general.operator_name ?? ""],
    ["Projet", general.project_name ?? ""],
    ["Residu", general.residue_id ?? ""],
    ["Date du melange", general.mix_date ?? ""],
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
    doc.text("Parametre", marginL + 2, y + 4.2);
    doc.text("Unite", marginL + colW_label + 2, y + 4.2);
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
  const drawDataRow = (label: string, unit: string, getter: (r: any) => number | null | undefined, digits = 3, bold = false) => {
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
      doc.text(fmtNum(v, digits), x, y + 4, { align: "right" });
    }
    // Light border
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.1);
    doc.line(marginL, y + rowH, marginL + contentW, y + rowH);
    y += rowH;
    rowIdx++;
  };

  /* ════════════════════════════
     SECTION 1: DONNEES DU MELANGE
     ════════════════════════════ */
  drawSectionHeader("DONNEES DU MELANGE", PRIMARY_LIGHT, PRIMARY_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow(isEssai ? "Bw% cible" : "Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  drawDataRow("Liant Bv%", "% vol.", (r) => r.bv_vol_pct, 2);
  drawDataRow(isEssai ? "Residu sec (tot.)" : "Residu sec Mr", massLabel, (r) => fromStoreMass(r.components?.residue_dry_mass_kg, units.mass), 3, true);
  if (isRpg) drawDataRow("Agregat sec Ma", massLabel, (r) => fromStoreMass(r.components?.aggregate_dry_mass_kg, units.mass), 3, true);
  drawDataRow(isEssai ? "Liant (tot.)" : "Liant Mb", massLabel, (r) => fromStoreMass(r.components?.binder_total_mass_kg, units.mass), 3, true);
  drawDataRow("Residu humide Mr-hum", massLabel, (r) => fromStoreMass(r.components?.residue_wet_mass_kg, units.mass));
  drawDataRow("Eau totale Mw", massLabel, (r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass));
  drawDataRow("Eau a ajouter Mw-aj", massLabel, (r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass));
  if (bcount >= 1) drawDataRow(`${binderName(1)} Mc1`, massLabel, (r) => fromStoreMass(r.components?.binder_c1_mass_kg, units.mass));
  if (bcount >= 2) drawDataRow(`${binderName(2)} Mc2`, massLabel, (r) => fromStoreMass(r.components?.binder_c2_mass_kg, units.mass));
  if (bcount >= 3) drawDataRow(`${binderName(3)} Mc3`, massLabel, (r) => fromStoreMass(r.components?.binder_c3_mass_kg, units.mass));
  if (isEssai) {
    drawDataRow("Liant a rajouter Mb-ad", massLabel, (r) => fromStoreMass(r.components?.binder_to_add_mass_kg, units.mass));
    drawDataRow(`${binderName(1)} a rajouter`, massLabel, (r) => fromStoreMass(r.components?.binder_c1_to_add_mass_kg, units.mass));
    if (bcount >= 2) drawDataRow(`${binderName(2)} a rajouter`, massLabel, (r) => fromStoreMass(r.components?.binder_c2_to_add_mass_kg, units.mass));
    if (bcount >= 3) drawDataRow(`${binderName(3)} a rajouter`, massLabel, (r) => fromStoreMass(r.components?.binder_c3_to_add_mass_kg, units.mass));
  }
  y += 4;

  /* ── Section 2: Geotechnical ── */
  drawSectionHeader("PARAMETRES GEOTECHNIQUES", GREEN_HDR, GREEN_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow("Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  drawDataRow("Solides Cw%", "% mass.", (r) => r.solids_mass_pct, 2);
  drawDataRow("Solides Cv%", "% vol.", (r) => r.cv_vol_pct, 2);
  drawDataRow("Teneur en eau w", "%", (r) => r.w_mass_pct, 2);
  drawDataRow("Rapport E/C", "", (r) => r.wc_ratio, 3);
  drawDataRow("Saturation Sr", "%", (r) => r.saturation_pct, 1);
  y += 4;

  /* ── Section 3: Densities ── */
  drawSectionHeader("MASSES VOLUMIQUES", PURPLE_HDR, PURPLE_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow("Masse vol. humide rho_h", densLabel, (r) => fromStoreDensity(r.bulk_density_kg_m3, units.density), 4, true);
  drawDataRow("Masse vol. seche rho_d", densLabel, (r) => fromStoreDensity(r.dry_density_kg_m3, units.density), 4, true);
  drawDataRow("Poids vol. humide gamma_h", "kN/m3", (r) => r.bulk_unit_weight_kN_m3, 2);
  drawDataRow("Poids vol. sec gamma_d", "kN/m3", (r) => r.dry_unit_weight_kN_m3, 2);
  y += 4;

  /* ── Section 4: Void indices ── */
  drawSectionHeader("INDICES DES VIDES & STRUCTURE", AMBER_HDR, AMBER_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow("Indice des vides e", "", (r) => r.void_ratio, 5, true);
  drawDataRow("Porosite n", "", (r) => r.porosity, 5);
  drawDataRow("Teneur eau vol. theta", "%", (r) => r.theta_pct, 2);
  drawDataRow("Gs remblai", "", (r) => r.gs_backfill, 5);
  drawDataRow("Gs liant", "", (r) => r.gs_binder, 4);
  y += 4;

  /* ── Section 5: Volumes ── */
  drawSectionHeader("VOLUMES", CYAN_HDR, CYAN_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow("Volume moule V_moule", volLabel, (r) => fromStoreVolume(r.container_volume_m3, units.volume), 4);
  drawDataRow("Volume total V_T", volLabel, (r) => fromStoreVolume(r.total_backfill_volume_m3, units.volume), 4, true);
  drawDataRow("Volume solide V_s", volLabel, (r) => fromStoreVolume(r.solid_volume_m3, units.volume), 4);
  drawDataRow("Volume vides V_v", volLabel, (r) => fromStoreVolume(r.void_volume_m3, units.volume), 4);
  drawDataRow("Volume residu V_r", volLabel, (r) => fromStoreVolume(r.residue_volume_m3, units.volume), 4);
  drawDataRow("Volume liant V_b", volLabel, (r) => fromStoreVolume(r.binder_volume_m3, units.volume), 4);
  drawDataRow("Volume eau V_w", volLabel, (r) => fromStoreVolume(r.water_volume_m3, units.volume), 4);
  y += 4;

  /* ── Section 6: Complete results ── */
  drawSectionHeader("RESULTATS COMPLETS", PRIMARY_LIGHT, PRIMARY_TXT);
  drawColumnHeaders();
  rowIdx = 0;
  drawDataRow("Masse rejet sec totale M_r_sec_tot", massLabel, (r) => fromStoreMass(masseRejetSecTotaleKg(r), units.mass), 4, true);
  drawDataRow("Masse solides totale M_s", massLabel, (r) => fromStoreMass(masseSolidesTotaleKg(r), units.mass), 4, true);
  drawDataRow("Masse eau totale M_w", massLabel, (r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass), 4);
  drawDataRow("Masse remblai totale M_t", massLabel, (r) => fromStoreMass(masseRemblaiTotaleKg(r), units.mass), 4);
  drawDataRow("Eau dans residu M_w-res", massLabel, (r) => fromStoreMass(masseEauDansResidusKg(r), units.mass), 4);
  drawDataRow("Eau a ajouter/retirer M_w-aj", massLabel, (r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass), 4);
  drawDataRow("Volume air V_air", volLabel, (r) => fromStoreVolume(volumeAirM3(r), units.volume), 4);
  drawDataRow("Cw calcule (depuis masses)", "%", (r) => cwCalculePct(r), 4);
  drawDataRow("Cv calcule (depuis volumes)", "%", (r) => cvCalculePct(r), 4);

  /* ── Footer ── */
  addFooter();

  /* ── Save ── */
  const filename = `MineBackfill_${category}_${method}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
