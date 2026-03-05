"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

/* ── helpers ── */
const fmt = (v: number | undefined | null, digits = 3) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

const toGcm3 = (rho?: number | null) =>
  rho === undefined || rho === null || Number.isNaN(rho) ? null : rho / 1000;

const toLiters = (v?: number | null) =>
  v === undefined || v === null || Number.isNaN(v) ? null : v * 1000;

const toGrams = (kg?: number | null) =>
  kg === undefined || kg === null || Number.isNaN(kg) ? null : kg * 1000;

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

const val = (x: number | null | undefined, fallback = 0) =>
  x === undefined || x === null || Number.isNaN(x) ? fallback : x;

const masseRejetSecTotaleKg = (r: RecetteAffichage) =>
  val(r?.components?.residue_dry_mass_kg) + val(r?.components?.aggregate_dry_mass_kg);

const masseSolidesTotaleKg = (r: RecetteAffichage) =>
  masseRejetSecTotaleKg(r) + val(r?.components?.binder_total_mass_kg);

const masseRemblaiTotaleKg = (r: RecetteAffichage) =>
  masseSolidesTotaleKg(r) + val(r?.components?.water_total_mass_kg);

const masseEauDansResidusKg = (r: RecetteAffichage) =>
  val(r?.components?.residue_wet_mass_kg) - val(r?.components?.residue_dry_mass_kg);

const volumeAirM3 = (r: RecetteAffichage) =>
  val(r?.void_volume_m3) - val(r?.water_volume_m3);

const cwCalculePct = (r: RecetteAffichage) => {
  const ms = masseSolidesTotaleKg(r);
  const mw = val(r?.components?.water_total_mass_kg);
  const mt = ms + mw;
  if (mt <= 0) return null;
  return (ms / mt) * 100;
};

const cvCalculePct = (r: RecetteAffichage) => {
  const vs = val(r?.solid_volume_m3);
  const vt = val(r?.total_backfill_volume_m3);
  if (vt <= 0) return null;
  return (vs / vt) * 100;
};

/* ── Section colours ── */
const SECTIONS = {
  mix: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    headerBg: "#dbeafe",
    headerText: "#1d4ed8",
    accent: "#2563eb",
  },
  geo1: {
    bg: "#f0fdf4",
    border: "#bbf7d0",
    headerBg: "#dcfce7",
    headerText: "#15803d",
    accent: "#16a34a",
  },
  geo2: {
    bg: "#faf5ff",
    border: "#e9d5ff",
    headerBg: "#f3e8ff",
    headerText: "#7c3aed",
    accent: "#7c3aed",
  },
  geo3: {
    bg: "#fffbeb",
    border: "#fde68a",
    headerBg: "#fef3c7",
    headerText: "#b45309",
    accent: "#d97706",
  },
  vols: {
    bg: "#ecfeff",
    border: "#a5f3fc",
    headerBg: "#cffafe",
    headerText: "#0e7490",
    accent: "#0891b2",
  },
} as const;

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

function SectionHeader({
  title,
  sub,
  color,
}: {
  title: string;
  sub?: string;
  color: (typeof SECTIONS)[keyof typeof SECTIONS];
}) {
  return (
    <div
      style={{
        background: color.headerBg,
        borderBottom: `2px solid ${color.border}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 700, color: color.headerText }}>
        {title}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: color.headerText, opacity: 0.6 }}>
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
        Parametre
      </th>
      {Array.from({ length: activeCount }).map((_, i) => (
        <th
          key={i}
          style={{
            padding: "9px 12px",
            textAlign: "right",
            fontSize: 13,
            fontWeight: 800,
            color: RECIPE_COLORS[i],
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
}: {
  label: string;
  unit?: string;
  getter: (r: any) => number | undefined | null;
  recipes: any[];
  digits?: number;
  bold?: boolean;
}) {
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
      </td>
      {recipes.map((r, i) => (
        <td
          key={i}
          style={{
            padding: "8px 12px",
            textAlign: "right",
            fontSize: bold ? 15.5 : 14.5,
            fontVariantNumeric: "tabular-nums",
            fontWeight: bold ? 700 : 500,
            color: bold ? RECIPE_COLORS[i] : "#0f172a",
            letterSpacing: "0.01em",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {fmt(getter(r), digits)}
        </td>
      ))}
    </tr>
  );
}

/* ── Excel export (professional formatting with ExcelJS) ── */
async function exportToExcel(
  recipes: any[],
  general: any,
  binderName: (n: 1 | 2 | 3) => string,
  category: string,
  method: string
) {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = "MineBackfill v1.0";
  wb.created = new Date();

  const ws = wb.addWorksheet("Resultats", {
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

  const thinBorder = (color = BORDER_CLR): any => ({ style: "thin", color: { argb: color } });

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
  const titleRow = ws.addRow(["MINEBACKFILL — Resultats de calcul"]);
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

  addInfoRow("Operateur", general.operator_name ?? "");
  addInfoRow("Projet", general.project_name ?? "");
  addInfoRow("Residu", general.residue_id ?? "");
  addInfoRow("Date", general.mix_date ?? "");

  ws.addRow([]); // spacer

  /* ── Data-row helper ── */
  const bcount = general.binder_count ?? 1;
  const isEssai = method === "essai";
  const isRpg = category === "RPG";

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
    const hdrs = ["Parametre", "Unite", ...recipes.map((_, i) => `Recette ${i + 1}`)];
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
  const addDataRow = (label: string, unit: string, getter: (r: any) => number | null | undefined, digits = 3, isBold = false) => {
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
  addSectionHeader("DONNEES DU MELANGE", PRIMARY_LIGHT.replace("#", ""), PRIMARY);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow(isEssai ? "Bw% cible" : "Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  addDataRow("Liant Bv%", "% vol.", (r) => r.bv_vol_pct, 2);
  addDataRow(isEssai ? "Residu sec (tot.)" : "Residu sec Mr", "kg", (r) => r.components?.residue_dry_mass_kg, 3, true);
  if (isRpg) addDataRow("Agregat sec Ma", "kg", (r) => r.components?.aggregate_dry_mass_kg, 3, true);
  addDataRow(isEssai ? "Liant (tot.)" : "Liant Mb", "kg", (r) => r.components?.binder_total_mass_kg, 3, true);
  addDataRow("Residu humide Mr-hum", "kg", (r) => r.components?.residue_wet_mass_kg);
  addDataRow("Eau totale Mw", "kg", (r) => r.components?.water_total_mass_kg);
  addDataRow("Eau a ajouter Mw-aj", "kg", (r) => r.components?.water_to_add_mass_kg);
  if (bcount >= 1) addDataRow(`${binderName(1)} Mc1`, "kg", (r) => r.components?.binder_c1_mass_kg);
  if (bcount >= 2) addDataRow(`${binderName(2)} Mc2`, "kg", (r) => r.components?.binder_c2_mass_kg);
  if (bcount >= 3) addDataRow(`${binderName(3)} Mc3`, "kg", (r) => r.components?.binder_c3_mass_kg);
  if (isEssai) {
    addDataRow("Liant a rajouter Mb-ad", "kg", (r) => r.components?.binder_to_add_mass_kg);
    addDataRow(`${binderName(1)} a rajouter Mc1-ad`, "kg", (r) => r.components?.binder_c1_to_add_mass_kg);
    if (bcount >= 2) addDataRow(`${binderName(2)} a rajouter Mc2-ad`, "kg", (r) => r.components?.binder_c2_to_add_mass_kg);
    if (bcount >= 3) addDataRow(`${binderName(3)} a rajouter Mc3-ad`, "kg", (r) => r.components?.binder_c3_to_add_mass_kg);
  }

  ws.addRow([]);

  /* ── Section 2: Geotechnical ── */
  addSectionHeader("PARAMETRES GEOTECHNIQUES", GREEN_HDR.replace("#", ""), GREEN_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Liant Bw%", "%", (r) => r.bw_mass_pct, 2, true);
  addDataRow("Solides Cw%", "% mass.", (r) => r.solids_mass_pct, 2);
  addDataRow("Solides Cv%", "% vol.", (r) => r.cv_vol_pct, 2);
  addDataRow("Teneur en eau w", "%", (r) => r.w_mass_pct, 2);
  addDataRow("Rapport E/C", "", (r) => r.wc_ratio, 3);
  addDataRow("Saturation Sr", "%", (r) => r.saturation_pct, 1);

  ws.addRow([]);

  /* ── Section 3: Densities ── */
  addSectionHeader("MASSES VOLUMIQUES", PURPLE_HDR.replace("#", ""), PURPLE_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Masse vol. humide rho_h", "g/cm3", (r) => toGcm3(r.bulk_density_kg_m3), 4, true);
  addDataRow("Masse vol. seche rho_d", "g/cm3", (r) => toGcm3(r.dry_density_kg_m3), 4, true);
  addDataRow("Poids vol. humide gamma_h", "kN/m3", (r) => r.bulk_unit_weight_kN_m3, 2);
  addDataRow("Poids vol. sec gamma_d", "kN/m3", (r) => r.dry_unit_weight_kN_m3, 2);

  ws.addRow([]);

  /* ── Section 4: Void indices ── */
  addSectionHeader("INDICES DES VIDES & STRUCTURE", AMBER_HDR.replace("#", ""), AMBER_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Indice des vides e", "", (r) => r.void_ratio, 5, true);
  addDataRow("Porosite n", "", (r) => r.porosity, 5);
  addDataRow("Teneur eau vol. theta", "%", (r) => r.theta_pct, 2);
  addDataRow("Gs remblai", "", (r) => r.gs_backfill, 5);
  addDataRow("Gs liant", "", (r) => r.gs_binder, 4);

  ws.addRow([]);

  /* ── Section 5: Volumes ── */
  addSectionHeader("VOLUMES", CYAN_HDR.replace("#", ""), CYAN_TXT);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Volume moule V_moule", "L", (r) => toLiters(r.container_volume_m3), 4);
  addDataRow("Volume total V_T", "L", (r) => toLiters(r.total_backfill_volume_m3), 4, true);
  addDataRow("Volume solide V_s", "L", (r) => toLiters(r.solid_volume_m3), 4);
  addDataRow("Volume vides V_v", "L", (r) => toLiters(r.void_volume_m3), 4);
  addDataRow("Volume residu V_r", "L", (r) => toLiters(r.residue_volume_m3), 4);
  addDataRow("Volume liant V_b", "L", (r) => toLiters(r.binder_volume_m3), 4);
  addDataRow("Volume eau V_w", "L", (r) => toLiters(r.water_volume_m3), 4);

  ws.addRow([]);

  /* ── Section 6: Complete results ── */
  addSectionHeader("RESULTATS COMPLETS", PRIMARY_LIGHT.replace("#", ""), PRIMARY);
  addColumnHeaders();
  rowIndex = 0;
  addDataRow("Masse rejet sec totale M_r_sec_tot", "kg", (r) => masseRejetSecTotaleKg(r), 4, true);
  addDataRow("Masse solides totale M_s", "kg", (r) => masseSolidesTotaleKg(r), 4, true);
  addDataRow("Masse eau totale M_w", "kg", (r) => r.components?.water_total_mass_kg, 4);
  addDataRow("Masse remblai totale M_t", "kg", (r) => masseRemblaiTotaleKg(r), 4);
  addDataRow("Eau dans residu M_w-res", "kg", (r) => masseEauDansResidusKg(r), 4);
  addDataRow("Eau a ajouter/retirer M_w-aj", "kg", (r) => r.components?.water_to_add_mass_kg, 4);
  addDataRow("Masse remblai totale M_t", "g", (r) => toGrams(masseRemblaiTotaleKg(r)), 2);
  addDataRow("Volume air V_air", "L", (r) => toLiters(volumeAirM3(r)), 4);
  addDataRow("Cw calcule (depuis masses)", "%", (r) => cwCalculePct(r), 4);
  addDataRow("Cv calcule (depuis volumes)", "%", (r) => cvCalculePct(r), 4);

  /* ── Footer ── */
  ws.addRow([]);
  const footerRow = ws.addRow(["Genere par MineBackfill v1.0 — Module 1"]);
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

export default function ResultsPanel({ isMaximized = false }: { isMaximized?: boolean }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const store = useStore() as any;
  const { category, method, general = {}, cw = {}, wb = {}, slump = {}, essai = {}, rpgCw = {}, rpgWb = {}, rpgEssai = {} as any } = store;
  const catalogue_liants: any[] = store.catalogue_liants ?? [];

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

  const allRecipes: any[] = Array.isArray(result?.recipes) ? result.recipes : [];
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
            Resultats de calcul
          </p>
          <p style={{ fontSize: 13, maxWidth: 240, marginTop: 6, lineHeight: 1.5 }}>
            Renseignez les parametres et cliquez sur{" "}
            <strong>Lancer le calcul</strong> pour afficher les resultats ici.
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
                <span style={{ color: "var(--muted-foreground)" }}>Residu : </span>
                {general.residue_id}
              </span>
            )}
            {general.operator_name && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Operateur : </span>
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
              border: `2px solid ${RECIPE_COLORS[i]}`,
              borderRadius: 8,
              padding: "7px 14px",
              background: `${RECIPE_COLORS[i]}10`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: RECIPE_COLORS[i],
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
            onClick={() => { setShowSaveDialog(true); setSaveLabel(""); setSaveSuccess(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: "1px solid var(--primary)",
              borderRadius: 7,
              background: "var(--primary-light)",
              color: "var(--primary)",
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
            onClick={() => exportToExcel(recipes, general, binderName, category, method)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              border: "1px solid #16a34a",
              borderRadius: 7,
              background: "#f0fdf4",
              color: "#15803d",
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

          {/* ── Save dialog ── */}
          {showSaveDialog && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 280,
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                zIndex: 20,
              }}
            >
              {saveSuccess ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)", marginBottom: 4 }}>
                    Sauvegarde effectuee
                  </div>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
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
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
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
                        store.saveCurrentResult(lbl);
                        setSaveSuccess(true);
                      }
                      if (e.key === "Escape") setShowSaveDialog(false);
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => {
                        const lbl = saveLabel.trim() || `${category} ${method} — ${new Date().toLocaleDateString("fr-CA")}`;
                        store.saveCurrentResult(lbl);
                        setSaveSuccess(true);
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
        {/* ── 1. Donnees du melange ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.mix.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.mix.bg,
          }}
        >
          <SectionHeader
            title={isEssai ? "Donnees du melange ajuste" : "Donnees du melange"}
            sub="masses en kg"
            color={SECTIONS.mix}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.mix.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow
                label={isEssai ? "Bw% cible" : "Liant Bw%"}
                unit="%"
                getter={(r) => r.bw_mass_pct}
                recipes={recipes}
                digits={2}
                bold
              />
              <DataRow
                label="Liant Bv%"
                unit="% vol."
                getter={(r) => r.bv_vol_pct}
                recipes={recipes}
                digits={2}
              />
              <DataRow
                label={isEssai ? "Residu sec (tot.)" : "Residu sec Mr"}
                unit="kg"
                getter={(r) => r.components?.residue_dry_mass_kg}
                recipes={recipes}
                bold
              />
              {isRpg && (
                <DataRow
                  label="Agregat sec Ma"
                  unit="kg"
                  getter={(r) => r.components?.aggregate_dry_mass_kg}
                  recipes={recipes}
                  bold
                />
              )}
              <DataRow
                label={isEssai ? "Liant (tot.)" : "Liant Mb"}
                unit="kg"
                getter={(r) => r.components?.binder_total_mass_kg}
                recipes={recipes}
                bold
              />
              <DataRow
                label="Residu humide Mr-hum"
                unit="kg"
                getter={(r) => r.components?.residue_wet_mass_kg}
                recipes={recipes}
              />
              <DataRow
                label="Eau totale Mw"
                unit="kg"
                getter={(r) => r.components?.water_total_mass_kg}
                recipes={recipes}
              />
              <DataRow
                label="Eau a ajouter Mw-aj"
                unit="kg"
                getter={(r) => r.components?.water_to_add_mass_kg}
                recipes={recipes}
              />
              {(general.binder_count ?? 1) >= 1 && (
                <DataRow
                  label={`${binderName(1)} Mc1`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c1_mass_kg}
                  recipes={recipes}
                />
              )}
              {(general.binder_count ?? 1) >= 2 && (
                <DataRow
                  label={`${binderName(2)} Mc2`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c2_mass_kg}
                  recipes={recipes}
                />
              )}
              {(general.binder_count ?? 1) >= 3 && (
                <DataRow
                  label={`${binderName(3)} Mc3`}
                  unit="kg"
                  getter={(r) => r.components?.binder_c3_mass_kg}
                  recipes={recipes}
                />
              )}
              {isEssai && (
                <>
                  <DataRow
                    label="Liant a rajouter Mb-ad"
                    unit="kg"
                    getter={(r) => r.components?.binder_to_add_mass_kg}
                    recipes={recipes}
                  />
                  <DataRow
                    label={`${binderName(1)} — a rajouter`}
                    unit="kg"
                    getter={(r) => r.components?.binder_c1_to_add_mass_kg}
                    recipes={recipes}
                  />
                  {(general.binder_count ?? 1) >= 2 && (
                    <DataRow
                      label={`${binderName(2)} — a rajouter`}
                      unit="kg"
                      getter={(r) => r.components?.binder_c2_to_add_mass_kg}
                      recipes={recipes}
                    />
                  )}
                  {(general.binder_count ?? 1) >= 3 && (
                    <DataRow
                      label={`${binderName(3)} — a rajouter`}
                      unit="kg"
                      getter={(r) => r.components?.binder_c3_to_add_mass_kg}
                      recipes={recipes}
                    />
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ── 2. Geotechnique ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo1.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo1.bg,
          }}
        >
          <SectionHeader
            title="Parametres geotechniques"
            sub="pourcentages & rapports"
            color={SECTIONS.geo1}
          />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo1.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow label="Liant Bw%" unit="%" getter={(r) => r.bw_mass_pct} recipes={recipes} digits={2} bold />
              <DataRow label="Solides Cw%" unit="% mass." getter={(r) => r.solids_mass_pct} recipes={recipes} digits={2} />
              <DataRow label="Solides Cv%" unit="% vol." getter={(r) => r.cv_vol_pct} recipes={recipes} digits={2} />
              <DataRow label="Teneur en eau w" unit="%" getter={(r) => r.w_mass_pct} recipes={recipes} digits={2} />
              <DataRow label="Rapport E/C" getter={(r) => r.wc_ratio} recipes={recipes} digits={3} />
              <DataRow label="Saturation Sr" unit="%" getter={(r) => r.saturation_pct} recipes={recipes} digits={1} />
            </tbody>
          </table>
        </div>

        {/* ── 3. Masses volumiques ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo2.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo2.bg,
          }}
        >
          <SectionHeader title="Masses volumiques" sub="densites et poids volumiques" color={SECTIONS.geo2} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo2.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow label="rho humide rho_h" unit="g/cm3" getter={(r) => toGcm3(r.bulk_density_kg_m3)} recipes={recipes} bold />
              <DataRow label="rho seche rho_d" unit="g/cm3" getter={(r) => toGcm3(r.dry_density_kg_m3)} recipes={recipes} bold />
              <DataRow label="gamma humide gamma_h" unit="kN/m3" getter={(r) => r.bulk_unit_weight_kN_m3} recipes={recipes} digits={2} />
              <DataRow label="gamma seche gamma_d" unit="kN/m3" getter={(r) => r.dry_unit_weight_kN_m3} recipes={recipes} digits={2} />
            </tbody>
          </table>
        </div>

        {/* ── 4. Indices des vides & structure ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.geo3.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.geo3.bg,
          }}
        >
          <SectionHeader title="Indices des vides & structure" sub="indice des vides, porosite, Gs" color={SECTIONS.geo3} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.geo3.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow label="Indice des vides e" getter={(r) => r.void_ratio} recipes={recipes} bold />
              <DataRow label="Porosite n" getter={(r) => r.porosity} recipes={recipes} />
              <DataRow label="Teneur eau vol. theta" unit="%" getter={(r) => r.theta_pct} recipes={recipes} digits={2} />
              <DataRow label="Gs remblai" getter={(r) => r.gs_backfill} recipes={recipes} />
              <DataRow label="Gs liant" getter={(r) => r.gs_binder} recipes={recipes} />
            </tbody>
          </table>
        </div>

        {/* ── 5. Volumes ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.vols.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: SECTIONS.vols.bg,
            ...(isMaximized ? { gridColumn: "1 / -1" } : {}),
          }}
        >
          <SectionHeader title="Volumes" sub="en litres (L)" color={SECTIONS.vols} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.vols.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow label="Volume moule V_moule" unit="L" getter={(r) => toLiters(r.container_volume_m3)} recipes={recipes} digits={4} />
              <DataRow label="Volume total V_T" unit="L" getter={(r) => toLiters(r.total_backfill_volume_m3)} recipes={recipes} digits={4} bold />
              <DataRow label="Volume solide V_s" unit="L" getter={(r) => toLiters(r.solid_volume_m3)} recipes={recipes} digits={4} />
              <DataRow label="Volume vides V_v" unit="L" getter={(r) => toLiters(r.void_volume_m3)} recipes={recipes} digits={4} />
              <DataRow label="Volume residu V_r" unit="L" getter={(r) => toLiters(r.residue_volume_m3)} recipes={recipes} digits={4} />
              <DataRow label="Volume liant V_b" unit="L" getter={(r) => toLiters(r.binder_volume_m3)} recipes={recipes} digits={4} />
              <DataRow label="Volume eau V_w" unit="L" getter={(r) => toLiters(r.water_volume_m3)} recipes={recipes} digits={4} />
            </tbody>
          </table>
        </div>

        {/* ── 6. Resultats complets ── */}
        <div
          style={{
            border: `1px solid ${SECTIONS.mix.border}`,
            borderRadius: 8,
            overflow: "hidden",
            background: "#f8fafc",
            ...(isMaximized ? { gridColumn: "1 / -1" } : {}),
          }}
        >
          <SectionHeader title="Resultats complets" sub="masses et volumes detailles" color={SECTIONS.mix} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead>
              <tr style={{ background: SECTIONS.mix.bg }}>
                <RecipeHeaders activeCount={recipes.length} />
              </tr>
            </thead>
            <tbody>
              <DataRow label="Masse rejet sec totale M_r_sec_tot" unit="kg" getter={(r) => masseRejetSecTotaleKg(r)} recipes={recipes} digits={4} bold />
              <DataRow label="Masse solides totale M_s" unit="kg" getter={(r) => masseSolidesTotaleKg(r)} recipes={recipes} digits={4} bold />
              <DataRow label="Masse eau totale M_w" unit="kg" getter={(r) => r.components?.water_total_mass_kg} recipes={recipes} digits={4} />
              <DataRow label="Masse remblai totale M_t" unit="kg" getter={(r) => masseRemblaiTotaleKg(r)} recipes={recipes} digits={4} />
              <DataRow label="Eau dans residu M_w-res" unit="kg" getter={(r) => masseEauDansResidusKg(r)} recipes={recipes} digits={4} />
              <DataRow label="Eau a ajouter/retirer M_w-aj" unit="kg" getter={(r) => r.components?.water_to_add_mass_kg} recipes={recipes} digits={4} />
              <DataRow label="Masse remblai totale M_t" unit="g" getter={(r) => toGrams(masseRemblaiTotaleKg(r))} recipes={recipes} digits={2} />
              <DataRow label="Volume air V_air" unit="L" getter={(r) => toLiters(volumeAirM3(r))} recipes={recipes} digits={4} />
              <DataRow label="Cw calcule (depuis masses)" unit="%" getter={(r) => cwCalculePct(r)} recipes={recipes} digits={4} />
              <DataRow label="Cv calcule (depuis volumes)" unit="%" getter={(r) => cvCalculePct(r)} recipes={recipes} digits={4} />
            </tbody>
          </table>
        </div>

      </div> {/* end sections wrapper */}

      {/* bottom padding */}
      <div style={{ height: 16 }} />
    </div>
  );
}
