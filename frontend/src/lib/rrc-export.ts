// Exports RRC/CRF — Excel (tableau complet) et feuille de préparation PDF.
// Le RRC a sa propre forme de résultat (RrcRecipe), distincte des recettes
// pâte (MixState) : exports dédiés, plus simples.

import type { UnitPreferences } from "@/lib/units";
import { fromStoreMass, MASS_LABELS } from "@/lib/units";
import type { RrcRecipe } from "@/lib/types";
import type { GeneralInfo } from "@/lib/store";

const fmtNum = (v: number | null | undefined, digits = 3): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
};

interface Ligne {
  label: string;
  get: (r: RrcRecipe) => number | null;
  digits?: number;
}

function lignes(massLabel: string, toMass: (kg: number | null | undefined) => number | null): Ligne[] {
  return [
    { label: "Bw (liant/roches) (%)", get: (r) => r.bw_mass_pct ?? null, digits: 2 },
    { label: "W/C du coulis", get: (r) => r.wc_ratio ?? null },
    { label: "Teneur en eau w (%)", get: (r) => r.w_mass_pct ?? null },
    { label: "Solides Cw (%)", get: (r) => r.solids_mass_pct ?? null },
    { label: `Masse totale M_CRF (${massLabel})`, get: (r) => toMass(r.total_mass_kg) },
    { label: "Volume CRF V_CRF (m3)", get: (r) => r.crf_volume_m3 ?? null, digits: 2 },
    { label: `Roches steriles M_WR (${massLabel})`, get: (r) => toMass(r.waste_rock_mass_kg) },
    { label: `Ciment M_c (${massLabel})`, get: (r) => toMass(r.cement_mass_kg) },
    { label: `Eau M_w (${massLabel})`, get: (r) => toMass(r.water_mass_kg) },
    { label: `Fluide (eau + SR) M* (${massLabel})`, get: (r) => toMass(r.fluid_mass_kg) },
    { label: `Retardateur M_SR (${massLabel})`, get: (r) => toMass(r.retarder_mass_kg) },
    { label: "Retardateur V_SR (L)", get: (r) => r.retarder_volume_l ?? null, digits: 2 },
    { label: "Dosage retardateur D_m (% de Mc)", get: (r) => r.retarder_dosage_mass_pct ?? null },
    { label: `Coulis M_c-slurry (${massLabel})`, get: (r) => toMass(r.slurry_mass_kg) },
    { label: "Coulis V_c-slurry (m3)", get: (r) => r.slurry_volume_m3 ?? null },
  ];
}

export async function exportRrcExcel(
  recipes: RrcRecipe[],
  general: GeneralInfo,
  units: UnitPreferences,
) {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const toMass = (kg: number | null | undefined) => fromStoreMass(kg, units.mass);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RRC");
  ws.addRow(["MINEBACKFILL — RRC / Remblai rocheux cimenté (CRF)"]).font = { bold: true, size: 14 };
  ws.addRow([`Projet : ${general.project_name ?? "—"}`, `Opérateur : ${general.operator_name ?? "—"}`]);
  ws.addRow([`Date : ${new Date().toLocaleDateString("fr-CA")}`]);
  ws.addRow([]);

  const header = ws.addRow(["Paramètre", ...recipes.map((_, i) => `Recette ${i + 1}`)]);
  header.font = { bold: true };
  for (const l of lignes(massLabel, toMass)) {
    ws.addRow([l.label, ...recipes.map((r) => {
      const v = l.get(r);
      return v === null ? "—" : parseFloat(v.toFixed(l.digits ?? 3));
    })]);
  }
  ws.getColumn(1).width = 38;
  recipes.forEach((_, i) => { ws.getColumn(i + 2).width = 16; });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `MineBackfill_RRC_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportRrcPdf(
  recipes: RrcRecipe[],
  general: GeneralInfo,
  units: UnitPreferences,
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14;
  const contentW = pageW - 2 * mL;
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const toMass = (kg: number | null | undefined) => fromStoreMass(kg, units.mass);

  const NAVY: [number, number, number] = [12, 30, 66];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LIGNE: [number, number, number] = [203, 213, 225];

  recipes.forEach((r, idx) => {
    if (idx > 0) doc.addPage();
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("FEUILLE DE PRÉPARATION — RRC / CRF", mL, 11.5);
    doc.setFillColor(26, 58, 138);
    doc.rect(0, 18, pageW, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(200, 210, 240);
    doc.text(`Recette ${idx + 1}/${recipes.length}  |  Bw = ${fmtNum(r.bw_mass_pct, 2)} %  |  W/C = ${fmtNum(r.wc_ratio, 2)}`, mL, 23.5);

    let y = 34;
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const infos: [string, string][] = [
      ["Projet", general.project_name || "________________________"],
      ["Opérateur", general.operator_name || "________________________"],
      ["Date", new Date().toLocaleDateString("fr-CA")],
      ["Chantier", `V = ${fmtNum(r.crf_volume_m3, 1)} m3 — M_CRF = ${fmtNum(toMass(r.total_mass_kg), 0)} ${massLabel}`],
    ];
    infos.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${k} :`, mL, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v), mL + 30, y);
      y += 5.6;
    });
    y += 3;

    // Masses à charger
    doc.setFillColor(...NAVY);
    doc.rect(mL, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("MASSES À CHARGER", mL + 2, y + 4.8);
    y += 9;

    const rows: [string, string][] = [
      [`Roches stériles M_WR (${massLabel})`, fmtNum(toMass(r.waste_rock_mass_kg), 1)],
      [`Ciment M_c (${massLabel})`, fmtNum(toMass(r.cement_mass_kg), 1)],
      [`Eau M_w (${massLabel})`, fmtNum(toMass(r.water_mass_kg), 1)],
      ["Retardateur V_SR (L)", fmtNum(r.retarder_volume_l, 2)],
    ];
    doc.setFontSize(9.5);
    rows.forEach(([label, value], i) => {
      const h = 9;
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(mL, y, contentW, h, "F");
      }
      doc.setDrawColor(...MUTED);
      doc.rect(mL + 2.5, y + 2.2, 4.6, 4.6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(label, mL + 12, y + 5.8);
      doc.setFont("helvetica", "bold");
      doc.text(value, mL + contentW - 62, y + 5.8);
      doc.setDrawColor(...LIGNE);
      doc.line(mL + contentW - 32, y + 6.6, mL + contentW - 4, y + 6.6);
      y += h;
    });
    y += 6;

    // Coulis
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Coulis cimentaire (ciment + eau + retardateur)", mL, y);
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Masse : ${fmtNum(toMass(r.slurry_mass_kg), 1)} ${massLabel}   —   Volume : ${fmtNum(r.slurry_volume_m3, 2)} m3   —   Dosage retardateur D_m : ${fmtNum(r.retarder_dosage_mass_pct, 3)} % de M_c`, mL, y);
    y += 8;

    doc.setFontSize(9.5);
    doc.text(`Contrôles : w = ${fmtNum(r.w_mass_pct, 2)} %   Cw = ${fmtNum(r.solids_mass_pct, 2)} %`, mL, y);
    y += 12;

    doc.text("Préparé par : ______________________", mL, y);
    doc.text("Signature : ______________________", mL + contentW / 2, y);

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`MineBackfill — RRC/CRF  |  ${new Date().toLocaleDateString("fr-CA")}`, mL, pageH - 8);
  });

  doc.save(`MineBackfill_RRC_preparation_${new Date().toISOString().slice(0, 10)}.pdf`);
}
