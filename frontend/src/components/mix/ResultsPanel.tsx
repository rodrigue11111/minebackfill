"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { GeneralInfo, LiantCatalogueItem } from "@/lib/store";
import {
  fromStoreMass, fromStoreVolume, fromStoreDensity,
  MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS,
  type UnitPreferences,
} from "@/lib/units";
import FormulaPopover from "@/components/mix/FormulaPopover";
import type { Recipe, RrcRecipe } from "@/lib/types";
import {
  val, masseRejetSecTotaleKg, masseSolidesTotaleKg, masseRemblaiTotaleKg,
  masseEauDansResidusKg, volumeAirM3, cwCalculePct, cvCalculePct,
  rhoSolideKgM3, gammaSolideKNM3,
} from "@/lib/derived";

/* ── helpers ── */
const fmt = (v: number | undefined | null, digits = 3) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

type RecetteAffichage = {
  components?: {
    residue_dry_mass_kg?: number | null;
    residue_wet_mass_kg?: number | null;
    aggregate_dry_mass_kg?: number | null;
    binder_total_mass_kg?: number | null;
    water_total_mass_kg?: number | null;
  } | null;
  solid_volume_m3?: number | null;
  total_backfill_volume_m3?: number | null;
  void_volume_m3?: number | null;
  water_volume_m3?: number | null;
};


/* ── Neutral palette ── */
const SECTION_BORDER = "#e2e8f0";
const HEADER_BG = "#f8fafc";
const HEADER_TEXT = "#374151";

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        background: HEADER_BG,
        borderBottom: `1px solid ${SECTION_BORDER}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 700, color: HEADER_TEXT }}>
        {title}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function RecipeHeaders({ activeCount }: { activeCount: number }) {
  return (
    <>
      <th
        style={{
          padding: "9px 14px",
          textAlign: "left",
          fontSize: 12.5,
          fontWeight: 600,
          color: "#64748b",
          width: "40%",
        }}
      >
        Paramètre
      </th>
      {Array.from({ length: activeCount }).map((_, i) => (
        <th
          key={i}
          style={{
            padding: "9px 12px",
            textAlign: "right",
            fontSize: 13,
            fontWeight: 800,
            color: HEADER_TEXT,
            whiteSpace: "nowrap",
          }}
        >
          Recette {i + 1}
        </th>
      ))}
    </>
  );
}

function DataRow({
  label,
  unit,
  getter,
  recipes,
  digits = 3,
  bold = false,
  formulaIds,
  onFormulaClick,
}: {
  label: string;
  unit?: string;
  getter: (r: Recipe) => number | undefined | null;
  recipes: Recipe[];
  digits?: number;
  bold?: boolean;
  formulaIds?: string[];
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
}) {
  const hasFormula = formulaIds && formulaIds.length > 0 && onFormulaClick;
  return (
    <tr>
      <td
        style={{
          padding: "8px 14px",
          fontSize: 13.5,
          color: bold ? "#1e293b" : "#475569",
          fontWeight: bold ? 600 : 400,
          lineHeight: 1.4,
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        {label}
        {unit && (
          <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 4 }}>
            ({unit})
          </span>
        )}
        {hasFormula && (
          <span style={{ color: "#c4b5fd", fontSize: 10, marginLeft: 5, fontWeight: 600 }} title="Cliquez sur une valeur pour voir la formule">
            fx
          </span>
        )}
      </td>
      {recipes.map((r, i) => (
        <td
          key={i}
          onClick={hasFormula ? (e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onFormulaClick!(formulaIds!, r, rect);
          } : undefined}
          style={{
            padding: "8px 12px",
            textAlign: "right",
            fontSize: bold ? 15.5 : 14.5,
            fontVariantNumeric: "tabular-nums",
            fontWeight: bold ? 700 : 500,
            color: "#0f172a",
            letterSpacing: "0.01em",
            borderBottom: "1px solid #f1f5f9",
            ...(hasFormula ? {
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationStyle: "dashed" as const,
              textDecorationColor: "#cbd5e1",
              textUnderlineOffset: "3px",
            } : {}),
          }}
        >
          {fmt(getter(r), digits)}
        </td>
      ))}
    </tr>
  );
}

/* ── Excel export (professional formatting with ExcelJS) ── */
export async function exportToExcel(
  recipes: Recipe[],
  general: GeneralInfo,
  binderName: (n: 1 | 2 | 3) => string,
  category: string,
  method: string,
  units: UnitPreferences,
) {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = "MineBackfill v1.0";
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
  const RECIPE_HEX = ["2563EB", "16A34A", "D97706", "DC2626"];

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
  const titleRow = ws.addRow(["MINEBACKFILL — Résultats de calcul"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  /* ── Subtitle ── */
  const subRow = ws.addRow([
    `${category} — ${method === "dosage_cw" ? "Dosage Cw%" : method === "wb" ? "Rapport E/C" : method === "slump" ? "Slump" : "Essai-erreur"}  |  ${recipes.length} recette${recipes.length > 1 ? "s" : ""}  |  ${new Date().toLocaleDateString("fr-CA")}`,
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
  const bcount = general.binder_count ?? 1;
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

  /* ── Section 1: Mix data ── */
  addSectionHeader("DONNÉES DU MÉLANGE", PRIMARY_LIGHT.replace("#", ""), PRIMARY);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow(isEssai ? "Bw% cible" : "Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  addDataRow("Liant Bv%", "% vol.", (r) => r.bv_vol_pct, 2);
  addDataRow(isEssai ? "Résidu sec (tot.)" : "Résidu sec Mr", massLabel, (r) => fromStoreMass(r.components?.residue_dry_mass_kg, units.mass), 3, true);
  if (isRpg) addDataRow("Agrégat sec Ma", massLabel, (r) => fromStoreMass(r.components?.aggregate_dry_mass_kg, units.mass), 3, true);
  addDataRow(isEssai ? "Liant (tot.)" : "Liant Mb", massLabel, (r) => fromStoreMass(r.components?.binder_total_mass_kg, units.mass), 3, true);
  addDataRow("Résidu humide Mr-hum", massLabel, (r) => fromStoreMass(r.components?.residue_wet_mass_kg, units.mass));
  addDataRow("Eau totale Mw", massLabel, (r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass));
  addDataRow("Eau à ajouter/retirer Mw-aj", massLabel, (r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass));
  if (bcount >= 1) addDataRow(`${binderName(1)} Mc1`, massLabel, (r) => fromStoreMass(r.components?.binder_c1_mass_kg, units.mass));
  if (bcount >= 2) addDataRow(`${binderName(2)} Mc2`, massLabel, (r) => fromStoreMass(r.components?.binder_c2_mass_kg, units.mass));
  if (bcount >= 3) addDataRow(`${binderName(3)} Mc3`, massLabel, (r) => fromStoreMass(r.components?.binder_c3_mass_kg, units.mass));
  if (isEssai) {
    addDataRow("Liant à ajouter/retirer Mb-ad", massLabel, (r) => fromStoreMass(r.components?.binder_to_add_mass_kg, units.mass));
    addDataRow(`${binderName(1)} à ajouter/retirer Mc1-ad`, massLabel, (r) => fromStoreMass(r.components?.binder_c1_to_add_mass_kg, units.mass));
    if (bcount >= 2) addDataRow(`${binderName(2)} à ajouter/retirer Mc2-ad`, massLabel, (r) => fromStoreMass(r.components?.binder_c2_to_add_mass_kg, units.mass));
    if (bcount >= 3) addDataRow(`${binderName(3)} à ajouter/retirer Mc3-ad`, massLabel, (r) => fromStoreMass(r.components?.binder_c3_to_add_mass_kg, units.mass));
  }

  ws.addRow([]);

  /* ── Section 2: Geotechnical ── */
  addSectionHeader("PARAMÈTRES GÉOTECHNIQUES", GREEN_HDR.replace("#", ""), GREEN_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  addDataRow("Solides Cw%", "% mass.", (r) => r.solids_mass_pct, 2);
  addDataRow("Solides Cv%", "% vol.", (r) => r.cv_vol_pct, 2);
  addDataRow("Teneur en eau w", "%", (r) => r.w_mass_pct, 2);
  addDataRow("Rapport E/C", "", (r) => r.wc_ratio, 3);
  addDataRow("Saturation Sr", "%", (r) => r.saturation_pct, 1);
  if (isRpg) {
    addDataRow("Granulat massique Am", "%", (r) => r.aggregate_mass_pct, 2);
    addDataRow("Granulat vol. / résidus", "% vol.", (r) => r.aggregate_vol_pct_of_residue, 2);
    addDataRow("Granulat vol. / remblai", "% vol.", (r) => r.aggregate_vol_pct_of_backfill, 2);
  }

  ws.addRow([]);

  /* ── Section 3: Densities ── */
  addSectionHeader("MASSES VOLUMIQUES", PURPLE_HDR.replace("#", ""), PURPLE_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Masse vol. humide rho_h", densLabel, (r) => fromStoreDensity(r.bulk_density_kg_m3, units.density), 4, true);
  addDataRow("Masse vol. sèche rho_d", densLabel, (r) => fromStoreDensity(r.dry_density_kg_m3, units.density), 4, true);
  addDataRow("Poids vol. humide gamma_h", "kN/m3", (r) => r.bulk_unit_weight_kN_m3, 2);
  addDataRow("Poids vol. sec gamma_d", "kN/m3", (r) => r.dry_unit_weight_kN_m3, 2);
  addDataRow("Masse vol. solide rho_s", densLabel, (r) => fromStoreDensity(rhoSolideKgM3(r), units.density), 4);
  addDataRow("Poids vol. solide gamma_s", "kN/m3", (r) => gammaSolideKNM3(r), 2);

  ws.addRow([]);

  /* ── Section 4: Void indices ── */
  addSectionHeader("INDICES DES VIDES & STRUCTURE", AMBER_HDR.replace("#", ""), AMBER_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Indice des vides e", "", (r) => r.void_ratio, 5, true);
  addDataRow("Porosité n", "", (r) => r.porosity, 5);
  addDataRow("Teneur eau vol. theta", "%", (r) => r.theta_pct, 2);
  addDataRow("Gs remblai", "", (r) => r.gs_backfill, 5);
  addDataRow("Gs liant", "", (r) => r.gs_binder, 4);

  ws.addRow([]);

  /* ── Section 5: Volumes ── */
  addSectionHeader("VOLUMES", CYAN_HDR.replace("#", ""), CYAN_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Volume moule V_moule", volLabel, (r) => fromStoreVolume(r.container_volume_m3, units.volume), 4);
  addDataRow("Volume total V_T", volLabel, (r) => fromStoreVolume(r.total_backfill_volume_m3, units.volume), 4, true);
  addDataRow("Volume solide V_s", volLabel, (r) => fromStoreVolume(r.solid_volume_m3, units.volume), 4);
  addDataRow("Volume vides V_v", volLabel, (r) => fromStoreVolume(r.void_volume_m3, units.volume), 4);
  addDataRow("Volume résidu V_r", volLabel, (r) => fromStoreVolume(r.residue_volume_m3, units.volume), 4);
  addDataRow("Volume liant V_b", volLabel, (r) => fromStoreVolume(r.binder_volume_m3, units.volume), 4);
  addDataRow("Volume eau V_w", volLabel, (r) => fromStoreVolume(r.water_volume_m3, units.volume), 4);
  if (isRpg) addDataRow("Volume granulat V_g", volLabel, (r) => fromStoreVolume(r.aggregate_volume_m3, units.volume), 4);

  ws.addRow([]);

  /* ── Section 6: Complete results ── */
  addSectionHeader("RÉSULTATS COMPLETS", PRIMARY_LIGHT.replace("#", ""), PRIMARY);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Masse rejet sec totale M_r_sec_tot", massLabel, (r) => fromStoreMass(masseRejetSecTotaleKg(r), units.mass), 4, true);
  addDataRow("Masse solides totale M_s", massLabel, (r) => fromStoreMass(masseSolidesTotaleKg(r), units.mass), 4, true);
  addDataRow("Masse eau totale M_w", massLabel, (r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass), 4);
  addDataRow("Masse remblai totale M_t", massLabel, (r) => fromStoreMass(masseRemblaiTotaleKg(r), units.mass), 4);
  addDataRow("Eau dans résidu M_w-res", massLabel, (r) => fromStoreMass(masseEauDansResidusKg(r), units.mass), 4);
  addDataRow("Eau à ajouter/retirer M_w-aj", massLabel, (r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass), 4);
  addDataRow("Volume air V_air", volLabel, (r) => fromStoreVolume(volumeAirM3(r), units.volume), 4);
  addDataRow("Cw calcule (depuis masses)", "%", (r) => cwCalculePct(r), 4);
  addDataRow("Cv calcule (depuis volumes)", "%", (r) => cvCalculePct(r), 4);

  /* ── Footer ── */
  ws.addRow([]);
  const footerRow = ws.addRow(["Généré par MineBackfill v1.0 — Module 1"]);
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
  const filename = `MineBackfill_${category}_${method}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, filename);
}

function RrcResultatsView({ recipes, massLabel, toMass, general, units }: {
  recipes: RrcRecipe[];
  massLabel: string;
  toMass: (kg: number | null | undefined) => number | null;
  general: GeneralInfo;
  units: UnitPreferences;
}) {
  const n = recipes.length;
  const rows: { label: string; get: (r: RrcRecipe) => number | null | undefined; digits?: number; bold?: boolean }[] = [
    { label: "Bw (liant/roches) (%)", get: (r) => r.bw_mass_pct, digits: 2, bold: true },
    { label: "W/C du coulis", get: (r) => r.wc_ratio, digits: 3 },
    { label: "Teneur en eau w (%)", get: (r) => r.w_mass_pct, digits: 3 },
    { label: "Solides Cw (%)", get: (r) => r.solids_mass_pct, digits: 3 },
    { label: `Masse totale M_CRF (${massLabel})`, get: (r) => toMass(r.total_mass_kg), bold: true },
    { label: "Volume CRF V_CRF (m3)", get: (r) => r.crf_volume_m3, digits: 2 },
    { label: `Roches stériles M_WR (${massLabel})`, get: (r) => toMass(r.waste_rock_mass_kg), bold: true },
    { label: `Ciment M_c (${massLabel})`, get: (r) => toMass(r.cement_mass_kg), bold: true },
    { label: `Eau M_w (${massLabel})`, get: (r) => toMass(r.water_mass_kg) },
    { label: `Fluide (eau + SR) M* (${massLabel})`, get: (r) => toMass(r.fluid_mass_kg) },
    { label: `Retardateur M_SR (${massLabel})`, get: (r) => toMass(r.retarder_mass_kg) },
    { label: "Retardateur V_SR (L)", get: (r) => r.retarder_volume_l, digits: 2 },
    { label: "Dosage retardateur D_m (% de Mc)", get: (r) => r.retarder_dosage_mass_pct, digits: 3 },
    { label: `Coulis M_c-slurry (${massLabel})`, get: (r) => toMass(r.slurry_mass_kg) },
    { label: "Coulis V_c-slurry (m3)", get: (r) => r.slurry_volume_m3, digits: 3 },
  ];
  return (
    <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <SectionHeader title="RRC — Remblai rocheux cimenté (CRF)" sub="masses, retardateur de prise et coulis — cours Dias 66-70" />
        <table className="result-table" style={{ background: "#fff" }}>
          <thead>
            <tr style={{ background: HEADER_BG }}>
              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b" }}>Paramètre</th>
              {Array.from({ length: n }).map((_, i) => (
                <th key={i} style={{ padding: "7px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                  Recette {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 10px", fontSize: 12.5, color: "#475569", fontWeight: row.bold ? 700 : 400 }}>
                  {row.label}
                </td>
                {recipes.map((r, ci) => (
                  <td key={ci} style={{ padding: "6px 10px", fontSize: 12.5, textAlign: "right", fontWeight: row.bold ? 700 : 400, color: "#0f172a", fontFamily: "var(--font-geist-mono)" }}>
                    {fmt(row.get(r), row.digits ?? 3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 2px" }}>
        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }}
          onClick={async () => {
            const { exportRrcExcel } = await import("@/lib/rrc-export");
            exportRrcExcel(recipes, general, units);
          }}>
          Excel
        </button>
        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }}
          onClick={async () => {
            const { exportRrcPdf } = await import("@/lib/rrc-export");
            exportRrcPdf(recipes, general, units);
          }}
          title="Feuille de préparation : masses à charger, coulis, signature">
          Feuille labo (PDF)
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "#94a3b8", padding: "0 2px" }}>
        Invariant : M_WR + M_c + M* = M_CRF. Le coulis = ciment + eau + retardateur.
      </p>
    </div>
  );
}

export default function ResultsPanel({ isMaximized = false }: { isMaximized?: boolean }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveOutcome, setSaveOutcome] = useState<"ok" | "erreur" | null>(null);

  /* ── Formula popover state ── */
  const [formulaPopover, setFormulaPopover] = useState<{
    formulaIds: string[];
    recipe: Recipe;
    anchorRect: DOMRect;
  } | null>(null);

  const handleFormulaClick = useCallback((formulaIds: string[], recipe: Recipe, rect: DOMRect) => {
    setFormulaPopover({ formulaIds, recipe, anchorRect: rect });
  }, []);
  const store = useStore();
  const { category, method, general, cw, wb, slump, essai, rpgCw, rpgWb, rpgEssai } = store;
  const catalogue_liants: LiantCatalogueItem[] = store.catalogue_liants ?? [];
  const units: UnitPreferences = store.units ?? { length: "cm", area: "cm2", mass: "kg", volume: "L", density: "g/cm3", slump: "mm" };
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const volLabel = VOLUME_LABELS[units.volume] ?? "L";
  const densLabel = DENSITY_LABELS[units.density] ?? "g/cm3";

  const binderName = (n: 1 | 2 | 3): string => {
    const code = general[`binder${n}_type`];
    if (!code) return `Ciment ${n}`;
    return catalogue_liants.find((l) => l.code === code)?.nom ?? `Ciment ${n}`;
  };

  const cwResult = store.cwResult;
  const wbResult = store.wbResult;
  const slumpResult = store.slumpResult;
  const essaiResult = store.essaiResult;
  const rpgCwResult = store.rpgCwResult;
  const rpgWbResult = store.rpgWbResult;
  const rpgEssaiResult = store.rpgEssaiResult;

  const isRpg = category === "RPG";
  const isEssai = method === "essai";

  const result = isRpg
    ? method === "wb" ? rpgWbResult : method === "essai" ? rpgEssaiResult : rpgCwResult
    : method === "wb"
    ? wbResult
    : method === "slump"
    ? slumpResult
    : method === "essai"
    ? essaiResult
    : cwResult;

  const allRecipes: Recipe[] = Array.isArray(result?.recipes) ? result.recipes : [];
  const recipes = allRecipes.filter(Boolean);

  const desiredQty = isRpg
    ? method === "wb"
      ? rpgWb.desired_qty
      : method === "essai"
      ? (rpgEssai.base_method === "wb" ? rpgWb.desired_qty : rpgCw.desired_qty)
      : rpgCw.desired_qty
    : method === "wb"
    ? wb.desired_qty
    : method === "slump"
    ? slump.desired_qty
    : method === "essai"
    ? essai.base_method === "dosage_cw"
      ? cw.desired_qty
      : wb.desired_qty
    : cw.desired_qty;

  /* ── RRC : vue dédiée (formules CRF, pas de MixState) ── */
  if (category === "RRC") {
    const rrcRecipes = store.rrcResult?.recipes ?? [];
    if (rrcRecipes.length === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, textAlign: "center", gap: 14, color: "var(--muted-foreground)" }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#374151", margin: 0 }}>Résultats RRC / CRF</p>
          <p style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
            Renseignez la quantité de CRF, Bw et W/C puis cliquez sur <strong>Lancer le calcul</strong>.
          </p>
        </div>
      );
    }
    return (
      <RrcResultatsView
        recipes={rrcRecipes}
        massLabel={massLabel}
        toMass={(kg) => fromStoreMass(kg, units.mass)}
        general={general}
        units={units}
      />
    );
  }

  /* ── Empty state ── */
  if (recipes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 32,
          textAlign: "center",
          gap: 14,
          color: "var(--muted-foreground)",
        }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="4" y="20" width="8" height="18" rx="2" fill="#cbd5e1" />
          <rect x="18" y="12" width="8" height="26" rx="2" fill="#94a3b8" />
          <rect x="32" y="6" width="8" height="32" rx="2" fill="#64748b" />
        </svg>
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#374151", margin: 0 }}>
            Résultats de calcul
          </p>
          <p style={{ fontSize: 13, maxWidth: 240, marginTop: 6, lineHeight: 1.5 }}>
            Renseignez les parametres et cliquez sur{" "}
            <strong>Lancer le calcul</strong> pour afficher les résultats ici.
          </p>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  return (
    <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Project Banner ── */}
      <div style={{ padding: "0 16px 0" }}>
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--muted-foreground)",
              marginBottom: 6,
            }}
          >
            {isRpg ? "RPG (PAF)" : "RPC"} — {recipes.length} recette{recipes.length > 1 ? "s" : ""}
            {isEssai ? " (ajustees)" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px" }}>
            {general.residue_id && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Résidu : </span>
                {general.residue_id}
              </span>
            )}
            {general.operator_name && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Opérateur : </span>
                {general.operator_name}
              </span>
            )}
            {desiredQty !== undefined && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Qte : </span>
                {desiredQty} moule{desiredQty > 1 ? "s" : ""}
              </span>
            )}
            {general.mix_date && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Date : </span>
                {general.mix_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Recipe summary pills ── */}
      <div style={{ padding: "0 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {recipes.map((r, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${SECTION_BORDER}`,
              borderRadius: 8,
              padding: "7px 14px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Recette {i + 1}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
              Bw {fmt(r.bw_mass_pct, 1)} %
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Cw {fmt(r.solids_mass_pct, 1)} % · e {fmt(r.void_ratio, 3)}
            </div>
          </div>
        ))}

        {/* ── Save & Export buttons ── */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
          <button
            onClick={() => { setShowSaveDialog(true); setSaveLabel(""); setSaveOutcome(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: `1px solid ${SECTION_BORDER}`,
              borderRadius: 7,
              background: "#fff",
              color: HEADER_TEXT,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M10.5 12H2.5a1 1 0 01-1-1V2a1 1 0 011-1h6l3 3v7a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 12V7h5v5M4 1v3h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sauvegarder
          </button>
          <button
            onClick={() => exportToExcel(recipes, general, binderName, category, method, units)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: `1px solid ${SECTION_BORDER}`,
              borderRadius: 7,
              background: "#fff",
              color: HEADER_TEXT,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v8M3 6l3.5 3.5L10 6M2 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Excel
          </button>
          <button
            onClick={async () => {
              const { exportToPdf } = await import("@/lib/pdf-report");
              exportToPdf(recipes, general, binderName, category, method, units);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: `1px solid ${SECTION_BORDER}`,
              borderRadius: 7,
              background: "#fff",
              color: HEADER_TEXT,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3.5 1h5l3 3v8a1 1 0 01-1 1h-7a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 7.5h4M5 10h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            PDF
          </button>
          <button
            onClick={async () => {
              const { exportPreparationPdf } = await import("@/lib/preparation-sheet");
              exportPreparationPdf(recipes, general, binderName, category, method, units);
            }}
            title="Feuille de préparation à imprimer : masses à peser, cases à cocher, mesures après la gâchée"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: `1px solid ${SECTION_BORDER}`,
              borderRadius: 7,
              background: "#fff",
              color: HEADER_TEXT,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2.5h10M2 6h10M2 9.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9 10.5l1.2 1.2 2-2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Feuille labo
          </button>

          {/* ── Save dialog ── */}
          {showSaveDialog && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                background: "#fff",
                border: `1px solid ${SECTION_BORDER}`,
                borderRadius: 8,
                padding: 14,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                zIndex: 20,
              }}
            >
              {saveOutcome ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: saveOutcome === "ok" ? HEADER_TEXT : "#dc2626", marginBottom: 4 }}>
                    {saveOutcome === "ok"
                      ? "Sauvegarde effectuée"
                      : "Sauvegarde locale impossible (stockage plein ou bloqué) — exportez vos données depuis Réglages."}
                  </div>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: HEADER_TEXT, marginBottom: 6 }}>
                    Nom de la sauvegarde
                  </label>
                  <input
                    type="text"
                    className="field-input"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder={`${category} ${method} — ${new Date().toLocaleDateString("fr-CA")}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const lbl = saveLabel.trim() || `${category} ${method} — ${new Date().toLocaleDateString("fr-CA")}`;
                        setSaveOutcome(store.saveCurrentResult(lbl) ? "ok" : "erreur");
                      }
                      if (e.key === "Escape") setShowSaveDialog(false);
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => {
                        const lbl = saveLabel.trim() || `${category} ${method} — ${new Date().toLocaleDateString("fr-CA")}`;
                        setSaveOutcome(store.saveCurrentResult(lbl) ? "ok" : "erreur");
                      }}
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: "center", padding: "7px 12px", fontSize: 12 }}
                    >
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="btn-secondary"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sections 1–6 : grid when maximized, flex column otherwise ── */}
      <div
        style={
          isMaximized
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 16px" }
            : { display: "flex", flexDirection: "column", gap: 14, padding: "0 16px" }
        }
      >
        {/* ── 1. Données du mélange ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <SectionHeader title={isEssai ? "Données du mélange ajuste" : "Données du mélange"} sub={`masses en ${massLabel}`} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label={isEssai ? "Bw% cible" : "Liant Bw%"} unit="%" getter={(r) => r.bw_mass_pct} recipes={recipes} digits={2} bold formulaIds={["F016"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Liant Bv%" unit="% vol." getter={(r) => r.bv_vol_pct} recipes={recipes} digits={2} formulaIds={["F022"]} onFormulaClick={handleFormulaClick} />
              <DataRow label={isEssai ? "Résidu sec (tot.)" : "Résidu sec Mr"} unit={massLabel} getter={(r) => fromStoreMass(r.components?.residue_dry_mass_kg, units.mass)} recipes={recipes} bold />
              {isRpg && <DataRow label="Agrégat sec Ma" unit={massLabel} getter={(r) => fromStoreMass(r.components?.aggregate_dry_mass_kg, units.mass)} recipes={recipes} bold />}
              <DataRow label={isEssai ? "Liant (tot.)" : "Liant Mb"} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_total_mass_kg, units.mass)} recipes={recipes} bold />
              <DataRow label="Résidu humide Mr-hum" unit={massLabel} getter={(r) => fromStoreMass(r.components?.residue_wet_mass_kg, units.mass)} recipes={recipes} />
              <DataRow label="Eau totale Mw" unit={massLabel} getter={(r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass)} recipes={recipes} />
              <DataRow label="Eau à ajouter/retirer Mw-aj" unit={massLabel} getter={(r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass)} recipes={recipes} />
              {(general.binder_count ?? 1) >= 1 && <DataRow label={`${binderName(1)} Mc1`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c1_mass_kg, units.mass)} recipes={recipes} />}
              {(general.binder_count ?? 1) >= 2 && <DataRow label={`${binderName(2)} Mc2`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c2_mass_kg, units.mass)} recipes={recipes} />}
              {(general.binder_count ?? 1) >= 3 && <DataRow label={`${binderName(3)} Mc3`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c3_mass_kg, units.mass)} recipes={recipes} />}
              {isEssai && (
                <>
                  <DataRow label="Liant à ajouter/retirer Mb-ad" unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_to_add_mass_kg, units.mass)} recipes={recipes} />
                  <DataRow label={`${binderName(1)} — à ajouter/retirer`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c1_to_add_mass_kg, units.mass)} recipes={recipes} />
                  {(general.binder_count ?? 1) >= 2 && <DataRow label={`${binderName(2)} — à ajouter/retirer`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c2_to_add_mass_kg, units.mass)} recipes={recipes} />}
                  {(general.binder_count ?? 1) >= 3 && <DataRow label={`${binderName(3)} — à ajouter/retirer`} unit={massLabel} getter={(r) => fromStoreMass(r.components?.binder_c3_to_add_mass_kg, units.mass)} recipes={recipes} />}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 2. Geotechnique ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <SectionHeader title="Paramètres géotechniques" sub="pourcentages & rapports" />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label="Liant Bw%" unit="%" getter={(r) => r.bw_mass_pct} recipes={recipes} digits={2} bold formulaIds={["F016"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Solides Cw%" unit="% mass." getter={(r) => r.solids_mass_pct} recipes={recipes} digits={2} formulaIds={["F009"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Solides Cv%" unit="% vol." getter={(r) => r.cv_vol_pct} recipes={recipes} digits={2} formulaIds={["F010"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Teneur en eau w" unit="%" getter={(r) => r.w_mass_pct} recipes={recipes} digits={2} formulaIds={["F001"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Rapport E/C" getter={(r) => r.wc_ratio} recipes={recipes} digits={3} formulaIds={["F028"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Saturation Sr" unit="%" getter={(r) => r.saturation_pct} recipes={recipes} digits={1} formulaIds={["F003"]} onFormulaClick={handleFormulaClick} />
              {isRpg && <DataRow label="Granulat massique Am" unit="%" getter={(r) => r.aggregate_mass_pct} recipes={recipes} digits={2} />}
              {isRpg && <DataRow label="Granulat vol. / résidus" unit="% vol." getter={(r) => r.aggregate_vol_pct_of_residue} recipes={recipes} digits={2} />}
              {isRpg && <DataRow label="Granulat vol. / remblai" unit="% vol." getter={(r) => r.aggregate_vol_pct_of_backfill} recipes={recipes} digits={2} />}
            </tbody>
          </table>
        </div>

        {/* ── 3. Masses volumiques ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <SectionHeader title="Masses volumiques" sub={`densités en ${densLabel}`} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label="rho humide rho_h" unit={densLabel} getter={(r) => fromStoreDensity(r.bulk_density_kg_m3, units.density)} recipes={recipes} bold formulaIds={["F023", "F024"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="rho sèche rho_d" unit={densLabel} getter={(r) => fromStoreDensity(r.dry_density_kg_m3, units.density)} recipes={recipes} bold formulaIds={["F007"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="gamma humide gamma_h" unit="kN/m3" getter={(r) => r.bulk_unit_weight_kN_m3} recipes={recipes} digits={2} formulaIds={["F027"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="gamma sèche gamma_d" unit="kN/m3" getter={(r) => r.dry_unit_weight_kN_m3} recipes={recipes} digits={2} />
              <DataRow label="rho solide rho_s" unit={densLabel} getter={(r) => fromStoreDensity(rhoSolideKgM3(r), units.density)} recipes={recipes} />
              <DataRow label="gamma solide gamma_s" unit="kN/m3" getter={(r) => gammaSolideKNM3(r)} recipes={recipes} digits={2} />
            </tbody>
          </table>
        </div>

        {/* ── 4. Indices des vides & structure ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <SectionHeader title="Indices des vides & structure" sub="indice des vides, porosité, Gs" />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label="Indice des vides e" getter={(r) => r.void_ratio} recipes={recipes} bold formulaIds={["F004"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Porosité n" getter={(r) => r.porosity} recipes={recipes} formulaIds={["F005"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Teneur eau vol. theta" unit="%" getter={(r) => r.theta_pct} recipes={recipes} digits={2} formulaIds={["F002"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Gs remblai" getter={(r) => r.gs_backfill} recipes={recipes} formulaIds={["F026"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Gs liant" getter={(r) => r.gs_binder} recipes={recipes} formulaIds={["F008"]} onFormulaClick={handleFormulaClick} />
            </tbody>
          </table>
        </div>

        {/* ── 5. Volumes ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff", ...(isMaximized ? { gridColumn: "1 / -1" } : {}) }}>
          <SectionHeader title="Volumes" sub={`en ${volLabel}`} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label="Volume moule V_moule" unit={volLabel} getter={(r) => fromStoreVolume(r.container_volume_m3, units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Volume total V_T" unit={volLabel} getter={(r) => fromStoreVolume(r.total_backfill_volume_m3, units.volume)} recipes={recipes} digits={4} bold />
              <DataRow label="Volume solide V_s" unit={volLabel} getter={(r) => fromStoreVolume(r.solid_volume_m3, units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Volume vides V_v" unit={volLabel} getter={(r) => fromStoreVolume(r.void_volume_m3, units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Volume résidu V_r" unit={volLabel} getter={(r) => fromStoreVolume(r.residue_volume_m3, units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Volume liant V_b" unit={volLabel} getter={(r) => fromStoreVolume(r.binder_volume_m3, units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Volume eau V_w" unit={volLabel} getter={(r) => fromStoreVolume(r.water_volume_m3, units.volume)} recipes={recipes} digits={4} />
              {isRpg && <DataRow label="Volume granulat V_g" unit={volLabel} getter={(r) => fromStoreVolume(r.aggregate_volume_m3, units.volume)} recipes={recipes} digits={4} />}
            </tbody>
          </table>
        </div>

        {/* ── 6. Résultats complets ── */}
        <div style={{ border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff", ...(isMaximized ? { gridColumn: "1 / -1" } : {}) }}>
          <SectionHeader title="Résultats complets" sub={`masses en ${massLabel}, volumes en ${volLabel}`} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              <DataRow label="Masse rejet sec totale M_r_sec_tot" unit={massLabel} getter={(r) => fromStoreMass(masseRejetSecTotaleKg(r), units.mass)} recipes={recipes} digits={4} bold />
              <DataRow label="Masse solides totale M_s" unit={massLabel} getter={(r) => fromStoreMass(masseSolidesTotaleKg(r), units.mass)} recipes={recipes} digits={4} bold />
              <DataRow label="Masse eau totale M_w" unit={massLabel} getter={(r) => fromStoreMass(r.components?.water_total_mass_kg, units.mass)} recipes={recipes} digits={4} />
              <DataRow label="Masse remblai totale M_t" unit={massLabel} getter={(r) => fromStoreMass(masseRemblaiTotaleKg(r), units.mass)} recipes={recipes} digits={4} />
              <DataRow label="Eau dans résidu M_w-res" unit={massLabel} getter={(r) => fromStoreMass(masseEauDansResidusKg(r), units.mass)} recipes={recipes} digits={4} />
              <DataRow label="Eau à ajouter/retirer M_w-aj" unit={massLabel} getter={(r) => fromStoreMass(r.components?.water_to_add_mass_kg, units.mass)} recipes={recipes} digits={4} />
              <DataRow label="Volume air V_air" unit={volLabel} getter={(r) => fromStoreVolume(volumeAirM3(r), units.volume)} recipes={recipes} digits={4} />
              <DataRow label="Cw calcule (depuis masses)" unit="%" getter={(r) => cwCalculePct(r)} recipes={recipes} digits={4} formulaIds={["F009"]} onFormulaClick={handleFormulaClick} />
              <DataRow label="Cv calcule (depuis volumes)" unit="%" getter={(r) => cvCalculePct(r)} recipes={recipes} digits={4} formulaIds={["F010"]} onFormulaClick={handleFormulaClick} />
            </tbody>
          </table>
        </div>

      </div> {/* end sections wrapper */}

      {/* bottom padding */}
      <div style={{ height: 16 }} />

      {/* ── Formula popover ── */}
      {formulaPopover && (
        <FormulaPopover
          formulaIds={formulaPopover.formulaIds}
          recipe={formulaPopover.recipe}
          anchorRect={formulaPopover.anchorRect}
          onClose={() => setFormulaPopover(null)}
        />
      )}
    </div>
  );
}
