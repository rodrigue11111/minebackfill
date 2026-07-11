"use client";

import { useState, useCallback } from "react";
import { useStore, lireBinders } from "@/lib/store";
import type { Category, GeneralInfo, LiantCatalogueItem } from "@/lib/store";
import {
  fromStoreMass,
  MASS_LABELS, VOLUME_LABELS, DENSITY_LABELS,
  type UnitPreferences,
} from "@/lib/units";
import FormulaPopover from "@/components/mix/FormulaPopover";
import { descriptorFor, methodLabel } from "@/lib/method-registry";
import { REPORT_SECTIONS, rowsForSection, RRC_ROWS, type ReportCtx } from "@/lib/report-schema";
import { RECIPE_HEX } from "@/lib/recipe-theme";
import { fmt } from "@/lib/format";
import { APP_NAME_VERSION, EXPORT_FOOTER } from "@/lib/branding";
import type { MixResult, Recipe, RrcRecipe } from "@/lib/types";

/* ── helpers ── */

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
  const titleRow = ws.addRow(["MINEBACKFILL — Résultats de calcul"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  /* ── Subtitle ── */
  const subRow = ws.addRow([
    `${category} — ${methodLabel(category as Category, method)}  |  ${recipes.length} recette${recipes.length > 1 ? "s" : ""}  |  ${new Date().toLocaleDateString("fr-CA")}`,
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
  const filename = `MineBackfill_${category}_${method}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, filename);
}

/**
 * Bouton « Sauvegarder » autonome (déclencheur + boîte de dialogue de nom).
 * Utilisé par la vue RRC — la barre RPC/RPG a sa propre instance inline.
 */
function SaveResultControl({ onSave, placeholder }: {
  onSave: (label: string) => boolean;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("");
  const [outcome, setOutcome] = useState<"ok" | "erreur" | null>(null);
  const doSave = () => setOutcome(onSave(label.trim() || placeholder) ? "ok" : "erreur");
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn-secondary"
        style={{ padding: "6px 14px", fontSize: 12.5 }}
        onClick={() => { setShow(true); setLabel(""); setOutcome(null); }}
      >
        Sauvegarder
      </button>
      {show && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, width: 280,
            background: "#fff", border: `1px solid ${SECTION_BORDER}`, borderRadius: 8,
            padding: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20,
          }}
        >
          {outcome ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: outcome === "ok" ? HEADER_TEXT : "#dc2626", marginBottom: 4 }}>
                {outcome === "ok"
                  ? "Sauvegarde effectuée"
                  : "Sauvegarde locale impossible (stockage plein ou bloqué) — exportez vos données depuis Réglages."}
              </div>
              <button type="button" onClick={() => setShow(false)} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
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
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={placeholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSave();
                  if (e.key === "Escape") setShow(false);
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button type="button" onClick={doSave} className="btn-primary" style={{ flex: 1, justifyContent: "center", padding: "7px 12px", fontSize: 12 }}>
                  Enregistrer
                </button>
                <button type="button" onClick={() => setShow(false)} className="btn-secondary" style={{ padding: "7px 12px", fontSize: 12 }}>
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RrcResultatsView({ recipes, massLabel, toMass, general, units, onSave }: {
  recipes: RrcRecipe[];
  massLabel: string;
  toMass: (kg: number | null | undefined) => number | null;
  general: GeneralInfo;
  units: UnitPreferences;
  onSave: (label: string) => boolean;
}) {
  const n = recipes.length;
  // Lignes RRC : schéma unique partagé avec les exports (report-schema.ts).
  const rows = RRC_ROWS;
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
                  {row.label(massLabel)}
                </td>
                {recipes.map((r, ci) => (
                  <td key={ci} style={{ padding: "6px 10px", fontSize: 12.5, textAlign: "right", fontWeight: row.bold ? 700 : 400, color: "#0f172a", fontFamily: "var(--font-geist-mono)" }}>
                    {fmt(row.getter(r, toMass), row.digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 2px", alignItems: "flex-start" }}>
        <SaveResultControl
          onSave={onSave}
          placeholder={`RRC — ${new Date().toLocaleDateString("fr-CA")}`}
        />
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
  const { category, method, general, cw, essai, rpgEssai } = store;
  const catalogue_liants: LiantCatalogueItem[] = store.catalogue_liants ?? [];
  const units: UnitPreferences = store.units ?? { length: "cm", area: "cm2", mass: "kg", volume: "L", density: "g/cm3", slump: "mm" };
  const massLabel = MASS_LABELS[units.mass] ?? "kg";
  const volLabel = VOLUME_LABELS[units.volume] ?? "L";
  const densLabel = DENSITY_LABELS[units.density] ?? "g/cm3";

  // Nom du composant n (1-indexé), pour un nombre N quelconque : lit la liste
  // N-aire des liants (repli legacy binder1/2/3 via lireBinders).
  const bindersGeneral = lireBinders(general);
  const binderName = (n: number): string => {
    const ref = bindersGeneral[n - 1];
    if (!ref?.code && !ref?.id) return `Ciment ${n}`;
    const item =
      (ref.id ? catalogue_liants.find((l) => l.id === ref.id) : undefined) ??
      catalogue_liants.find((l) => l.code === ref.code);
    return item?.nom ?? ref.code ?? `Ciment ${n}`;
  };

  const isRpg = category === "RPG";
  const isEssai = method === "essai";

  // Contexte du schéma de rapport (partagé écran/Excel/PDF).
  const reportCtx: ReportCtx = {
    units, massLabel, volLabel, densLabel, binderName,
    isEssai, isRpg, bcount: bindersGeneral.length,
  };

  // Tranches d'état/résultat de la méthode active — via le registre. Pour
  // l'essai, la quantité désirée vient de l'état de la méthode de BASE.
  const descriptor = descriptorFor(category, method);
  const result = descriptor ? (store[descriptor.resultKey] as MixResult | null) : null;

  const allRecipes: Recipe[] = Array.isArray(result?.recipes) ? result.recipes : [];
  const recipes = allRecipes.filter(Boolean);

  const methodeQty = isEssai
    ? (isRpg ? rpgEssai : essai).base_method
    : method;
  const dQty = descriptorFor(category, methodeQty);
  const desiredQty =
    (dQty ? (store[dQty.stateKey] as { desired_qty?: number }).desired_qty : undefined) ??
    cw.desired_qty;

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
        onSave={(lbl) => store.saveCurrentResult(lbl)}
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
        {/* Les 6 sections sont générées depuis le schéma de rapport unique
            (report-schema.ts) — même source que les exports Excel et PDF. */}
        {REPORT_SECTIONS.map((section) => (
          <div
            key={section.id}
            style={{
              border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff",
              ...(isMaximized && section.id >= 5 ? { gridColumn: "1 / -1" } : {}),
            }}
          >
            <SectionHeader title={section.title(reportCtx)} sub={section.sub(reportCtx)} />
            <table className="result-table" style={{ background: "#fff" }}>
              <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
              <tbody>
                {rowsForSection(section.id, reportCtx).map((row) => (
                  <DataRow
                    key={row.label(reportCtx)}
                    label={row.label(reportCtx)}
                    unit={row.unit(reportCtx) || undefined}
                    getter={(r) => row.getter(r, reportCtx)}
                    recipes={recipes}
                    digits={row.digits}
                    bold={row.bold}
                    formulaIds={row.formulaIds}
                    onFormulaClick={row.formulaIds ? handleFormulaClick : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}

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
