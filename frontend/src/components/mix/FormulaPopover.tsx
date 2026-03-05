"use client";

import React, { useEffect, useRef } from "react";
import { FORMULA_MAP, type Formula } from "@/lib/formulas-data";

/* ── Value substitution: map formula variable symbols to recipe fields ── */
const SYMBOL_TO_RECIPE: Record<string, (r: any) => number | null> = {
  // Binder dosage
  "B_w": (r) => r.bw_mass_pct != null ? r.bw_mass_pct / 100 : null,
  "M_b": (r) => r.components?.binder_total_mass_kg ?? null,
  "M_t": (r) => r.components?.residue_dry_mass_kg ?? null,
  "M_{ag}": (r) => r.components?.aggregate_dry_mass_kg ?? 0,

  // Cw / Cv
  "C_w": (r) => r.solids_mass_pct != null ? r.solids_mass_pct / 100 : null,
  "C_v": (r) => r.cv_vol_pct != null ? r.cv_vol_pct / 100 : null,
  "M_s": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    return mr + ma + mb;
  },
  "M": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mw = r.components?.water_total_mass_kg ?? 0;
    return mr + ma + mb + mw;
  },

  // Water content
  "w": (r) => r.w_mass_pct != null ? r.w_mass_pct / 100 : null,
  "M_w": (r) => r.components?.water_total_mass_kg ?? null,
  "M_h": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mw = r.components?.water_total_mass_kg ?? 0;
    return mr + ma + mb + mw;
  },
  "M_d": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    return mr + ma + mb;
  },

  // Volumes
  "V_T": (r) => r.total_backfill_volume_m3 ?? null,
  "V_s": (r) => r.solid_volume_m3 ?? null,
  "V_v": (r) => r.void_volume_m3 ?? null,
  "V_w": (r) => r.water_volume_m3 ?? null,
  "V_b": (r) => r.binder_volume_m3 ?? null,
  "V_t": (r) => r.residue_volume_m3 ?? null,

  // Densities
  "\\rho_h": (r) => r.bulk_density_kg_m3 ?? null,
  "\\rho_d": (r) => r.dry_density_kg_m3 ?? null,
  "\\rho_w": () => 1000,
  "G_s": (r) => r.gs_backfill ?? null,
  "S_r": (r) => r.saturation_pct != null ? r.saturation_pct / 100 : null,

  // Void indices
  "e": (r) => r.void_ratio ?? null,
  "n": (r) => r.porosity ?? null,
  "\\theta": (r) => r.theta_pct != null ? r.theta_pct / 100 : null,

  // Unit weight
  "\\gamma_h": (r) => r.bulk_unit_weight_kN_m3 ?? null,
  "\\gamma_d": (r) => r.dry_unit_weight_kN_m3 ?? null,
  "g": () => 9.81,

  // W/C
  "(W/C)_m": (r) => r.wc_ratio ?? null,

  // Bv
  "B_v": (r) => r.bv_vol_pct != null ? r.bv_vol_pct / 100 : null,

  // Gs
  "B_{ws}": (r) => {
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const ms = mb + mr + ma;
    return ms > 0 ? mb / ms : null;
  },
  "c_c": (r) => {
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const ms = mb + mr + ma;
    return ms > 0 ? mb / ms : null;
  },
};

function getFormulaValues(formula: Formula, recipe: any): { symbol: string; description: string; unit: string | null; value: number | null }[] {
  return formula.variables.map((v) => {
    const getter = SYMBOL_TO_RECIPE[v.symbol];
    const value = getter ? getter(recipe) : null;
    return { symbol: v.symbol, description: v.description, unit: v.unit, value };
  });
}

const fmtVal = (v: number | null, digits = 4): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "\u2014";
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(3);
  return v.toFixed(digits);
};

/* ── KaTeX rendering ── */
function KaTeXBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    import("katex").then((katex) => {
      if (!cancelled && ref.current) {
        katex.default.render(latex, ref.current, {
          throwOnError: false,
          displayMode: true,
        });
      }
    });
    return () => { cancelled = true; };
  }, [latex]);
  return <div ref={ref} style={{ margin: "8px 0", overflowX: "auto" }} />;
}

/* ── Main component ── */
interface FormulaPopoverProps {
  formulaIds: string[];
  recipe: any;
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function FormulaPopover({ formulaIds, recipe, anchorRect, onClose }: FormulaPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Position: below the anchor, clamped to viewport
  const formulas = formulaIds.map((id) => FORMULA_MAP.get(id)).filter(Boolean) as Formula[];
  if (formulas.length === 0) return null;

  const popoverW = 420;
  const left = Math.min(
    Math.max(anchorRect.left, 8),
    window.innerWidth - popoverW - 8,
  );
  const top = anchorRect.bottom + 6;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        left,
        top: Math.min(top, window.innerHeight - 200),
        width: popoverW,
        maxHeight: "70vh",
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        zIndex: 100,
        padding: 0,
      }}
    >
      {formulas.map((formula, fi) => {
        const values = getFormulaValues(formula, recipe);
        const related = [
          ...formula.derivationLinks.derivedFrom,
          ...formula.derivationLinks.derivesInto,
        ].filter((id) => !formulaIds.includes(id)).slice(0, 4);

        return (
          <div key={formula.id} style={{ padding: "14px 16px", borderTop: fi > 0 ? "1px solid #f1f5f9" : "none" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#2563eb", background: "#eff6ff",
                padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em",
              }}>
                {formula.id}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {formula.title}
              </span>
            </div>

            {/* Equation */}
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "6px 12px", marginBottom: 10,
            }}>
              <KaTeXBlock latex={formula.equationLatex} />
            </div>

            {/* Variables with values */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Variables
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {values.map((v, vi) => (
                  <div key={vi} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#2563eb", minWidth: 60 }}>
                      {v.symbol}
                    </span>
                    <span style={{ color: "#64748b", flex: 1 }}>
                      {v.description}
                    </span>
                    {v.value !== null && (
                      <span style={{ fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                        = {fmtVal(v.value)}
                        {v.unit && <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 2 }}>{v.unit}</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Context */}
            {formula.contextSnippet && (
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 }}>
                {formula.contextSnippet}
              </p>
            )}

            {/* Derivation note */}
            {formula.derivationLinks.derivationNote && (
              <div style={{ fontSize: 11, color: "#7c3aed", background: "#f5f3ff", borderRadius: 6, padding: "5px 10px", marginBottom: 8 }}>
                {formula.derivationLinks.derivationNote}
              </div>
            )}

            {/* Reference */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#94a3b8" }}>
              <span>Ref : {formula.chapter}, p.{formula.pageNumber}</span>
              {related.length > 0 && (
                <span>
                  Voir aussi : {related.map((id) => (
                    <span key={id} style={{ color: "#2563eb", fontWeight: 600, marginLeft: 4 }}>{id}</span>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
