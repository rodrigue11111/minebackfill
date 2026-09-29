// frontend/src/components/mix/SectionsRapport.tsx
// Rendu à l'écran du schéma de rapport unique (report-schema.ts) — même source
// que les exports Excel et PDF. Partagé par la page Calculs (ResultsPanel) et
// la lecture d'un résultat d'étudiant par l'enseignant (/classe).

import { REPORT_SECTIONS, rowsForSection, RRC_ROWS, type ReportCtx } from "@/lib/report-schema";
import { fmt } from "@/lib/format";
import type { Recipe, RrcRecipe } from "@/lib/types";

/* ── Neutral palette ── */
export const SECTION_BORDER = "#e2e8f0";
export const HEADER_BG = "#f8fafc";
export const HEADER_TEXT = "#374151";

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
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

export function RecipeHeaders({ activeCount }: { activeCount: number }) {
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

export function DataRow({
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

/** Les sections du rapport RPC/RPG, en colonne ou en grille (écran agrandi). */
export function SectionsRapport({ recipes, ctx, grille = false, padding = "0 16px", onFormulaClick }: {
  recipes: Recipe[];
  ctx: ReportCtx;
  grille?: boolean;
  padding?: string;
  onFormulaClick?: (formulaIds: string[], recipe: Recipe, rect: DOMRect) => void;
}) {
  return (
    <div
      style={
        grille
          ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding }
          : { display: "flex", flexDirection: "column", gap: 14, padding }
      }
    >
      {REPORT_SECTIONS.map((section) => (
        <div
          key={section.id}
          style={{
            border: `1px solid ${SECTION_BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff",
            ...(grille && section.id >= 5 ? { gridColumn: "1 / -1" } : {}),
          }}
        >
          <SectionHeader title={section.title(ctx)} sub={section.sub(ctx)} />
          <table className="result-table" style={{ background: "#fff" }}>
            <thead><tr style={{ background: HEADER_BG }}><RecipeHeaders activeCount={recipes.length} /></tr></thead>
            <tbody>
              {rowsForSection(section.id, ctx).map((row) => (
                <DataRow
                  key={row.label(ctx)}
                  label={row.label(ctx)}
                  unit={row.unit(ctx) || undefined}
                  getter={(r) => row.getter(r, ctx)}
                  recipes={recipes}
                  digits={row.digits}
                  bold={row.bold}
                  formulaIds={row.formulaIds}
                  onFormulaClick={row.formulaIds ? onFormulaClick : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/** Tableau des résultats RRC / CRF (lignes du schéma unique RRC_ROWS). */
export function TableauRrc({ recipes, massLabel, toMass }: {
  recipes: RrcRecipe[];
  massLabel: string;
  toMass: (kg: number | null | undefined) => number | null;
}) {
  const n = recipes.length;
  // Lignes RRC : schéma unique partagé avec les exports (report-schema.ts).
  const rows = RRC_ROWS;
  return (
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
  );
}
