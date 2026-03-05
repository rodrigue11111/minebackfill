"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import type { IndustrieCostResult, ProductionLogEntry } from "@/lib/store";

const fmt = (v: number | undefined | null, digits = 2) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

const SECTION_BORDER = "#e2e8f0";

export default function ProductionLog() {
  const store = useStore() as any;
  const {
    industrie,
    industrieResults,
    binderPrices,
    productionLog,
    addProductionLogEntry,
    deleteProductionLogEntry,
  } = store;

  const results: IndustrieCostResult[] = industrieResults || [];
  const log: ProductionLogEntry[] = productionLog || [];

  const [showSave, setShowSave] = useState(false);
  const [saveDate, setSaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saveNotes, setSaveNotes] = useState("");
  const [saveBw, setSaveBw] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSave = () => {
    const chosen = results.find((r) => r.bw_pct === saveBw) ?? results[0];
    if (!chosen) return;

    addProductionLogEntry({
      date: saveDate,
      notes: saveNotes,
      category: industrie.category,
      residue_sg: industrie.residue_sg,
      residue_w_pct: industrie.residue_w_pct,
      aggregate_sg: industrie.aggregate_sg,
      aggregate_fraction_pct: industrie.aggregate_fraction_pct,
      bw_pct: chosen.bw_pct,
      recipe: chosen.recipe,
      binder_prices: [...binderPrices],
      binder_cost: chosen.binder_cost,
      cost_per_m3: chosen.cost_per_m3,
      cost_per_tonne: chosen.cost_per_tonne,
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setShowSave(false);
      setSaveSuccess(false);
      setSaveNotes("");
    }, 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Save button */}
      {results.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSaveBw(results.sort((a, b) => a.cost_per_m3 - b.cost_per_m3)[0]?.bw_pct ?? null);
              setSaveDate(new Date().toISOString().slice(0, 10));
              setSaveNotes("");
              setSaveSuccess(false);
              setShowSave(true);
            }}
          >
            Enregistrer le lot du jour
          </button>

          {showSave && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, width: 340,
              background: "#fff", border: `1px solid ${SECTION_BORDER}`, borderRadius: 8,
              padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20,
            }}>
              {saveSuccess ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Lot enregistre</div>
                  <button onClick={() => setShowSave(false)} style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}>
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Date</label>
                      <input type="date" className="field-input" value={saveDate} onChange={(e) => setSaveDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Bw% retenu</label>
                      <select className="field-input" value={saveBw ?? ""} onChange={(e) => setSaveBw(parseFloat(e.target.value))}>
                        {results.map((r) => (
                          <option key={r.bw_pct} value={r.bw_pct}>{r.bw_pct}% — {fmt(r.cost_per_m3)} $/m3</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Notes</label>
                      <input type="text" className="field-input" value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} placeholder="Observations du lot..." />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <button className="btn-primary" style={{ flex: 1, justifyContent: "center", padding: "7px 12px", fontSize: 12 }} onClick={handleSave}>
                      Enregistrer
                    </button>
                    <button className="btn-secondary" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setShowSave(false)}>
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {log.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px" }} aria-hidden="true">
            <rect x="8" y="6" width="32" height="36" rx="4" stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
            <path d="M16 16h16M16 22h12M16 28h8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
            Aucun lot enregistre
          </p>
          <p style={{ fontSize: 13, maxWidth: 340, margin: "0 auto" }}>
            Apres avoir effectue un calcul de couts, cliquez sur <strong>Enregistrer le lot du jour</strong> pour sauvegarder les resultats ici.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "100px 80px 80px 110px 1fr 120px",
            gap: 8, padding: "8px 16px", fontSize: 11, fontWeight: 700,
            color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em",
            borderBottom: "2px solid #e2e8f0",
          }}>
            <span>Date</span>
            <span>Categorie</span>
            <span>Bw%</span>
            <span>Cout/m3</span>
            <span>Notes</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {log.map((entry: ProductionLogEntry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: "100px 80px 80px 110px 1fr 120px",
                    gap: 8, padding: "10px 16px", background: isExpanded ? "#f8fafc" : "#fff",
                    border: `1px solid ${isExpanded ? "#cbd5e1" : "#e2e8f0"}`,
                    borderRadius: isExpanded ? "8px 8px 0 0" : 8, alignItems: "center",
                    cursor: "pointer", transition: "background 0.12s",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{entry.date}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", textAlign: "center" }}>{entry.category}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>{fmt(entry.bw_pct, 1)}%</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>{fmt(entry.cost_per_m3)} $/m3</span>
                  <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.notes || "\u2014"}</span>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : entry.id); }}
                      style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: 5, background: "#f8fafc", color: "#374151", cursor: "pointer" }}
                    >
                      {isExpanded ? "Reduire" : "Voir"}
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProductionLogEntry(entry.id); setConfirmDeleteId(null); if (expandedId === entry.id) setExpandedId(null); }}
                        style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 600, border: "1px solid #fecaca", borderRadius: 5, background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
                      >
                        Confirmer
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(entry.id); }}
                        style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 500, border: "1px solid #e2e8f0", borderRadius: 5, background: "#fff", color: "#94a3b8", cursor: "pointer" }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 16 }}>
                    <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap", fontSize: 12 }}>
                      <span><span style={{ color: "#94a3b8" }}>Gs residu : </span>{fmt(entry.residue_sg, 3)}</span>
                      <span><span style={{ color: "#94a3b8" }}>w0 : </span>{fmt(entry.residue_w_pct, 1)}%</span>
                      {entry.aggregate_sg ? <span><span style={{ color: "#94a3b8" }}>Gs agregat : </span>{fmt(entry.aggregate_sg, 3)}</span> : null}
                      {entry.aggregate_fraction_pct ? <span><span style={{ color: "#94a3b8" }}>A_m : </span>{fmt(entry.aggregate_fraction_pct, 1)}%</span> : null}
                      <span><span style={{ color: "#94a3b8" }}>Cout/t : </span>{fmt(entry.cost_per_tonne)} $/t</span>
                    </div>
                    <table className="result-table" style={{ background: "#fff" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b" }}>Parametre</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#374151" }}>Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Bw%", value: fmt(entry.recipe?.bw_mass_pct, 2) + " %" },
                          { label: "Cw%", value: fmt(entry.recipe?.solids_mass_pct, 2) + " %" },
                          { label: "E/C", value: fmt(entry.recipe?.wc_ratio, 3) },
                          { label: "e (indice des vides)", value: fmt(entry.recipe?.void_ratio, 4) },
                          { label: "Cout liant", value: fmt(entry.binder_cost, 2) + " $" },
                          { label: "Cout/m3", value: fmt(entry.cost_per_m3, 2) + " $/m3" },
                        ].map((row, ri) => (
                          <tr key={ri} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "5px 10px", fontSize: 12, color: "#475569" }}>{row.label}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
