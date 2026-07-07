"use client";

import React, { useState } from "react";
import { calculeMesures, type MesureLabo } from "@/lib/mesures";

/**
 * Bloc « Paramètres mesurés au laboratoire » de la feuille Intra 2017
 * (lignes 72-77) : après la gâchée, l'opérateur mesure le slump puis
 * fait un essai de teneur en eau (tare, tare + pâte humide, tare + pâte
 * sèche) et compare aux valeurs calculées.
 *
 *   w mesuré  = (m_h − m_s) / (m_s − tare)    [cellule D76]
 *   Cw mesuré = (m_s − tare) / (m_h − tare)   [cellule D77]
 *
 * Calcul purement local (aucun appel API). Les masses sont en grammes,
 * comme sur la feuille.
 */

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", border: "1px solid #cbd5e1", borderRadius: 6,
  padding: "7px 11px", background: "#fff", fontSize: 13.5, outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

interface RecetteCalculee {
  w_mass_pct?: number | null;
  solids_mass_pct?: number | null;
}

const num = (v: string): number | undefined => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : undefined;
};

const fmt = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);

function Ecart({ mesure, calcule }: { mesure: number | null; calcule: number | null | undefined }) {
  if (mesure === null || calcule === null || calcule === undefined) return null;
  const d = mesure - calcule;
  const gros = Math.abs(d) > 1.0; // plus d'un point de pourcentage
  return (
    <span style={{ color: gros ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
      {" "}(écart {d >= 0 ? "+" : ""}{d.toFixed(2)} pt)
    </span>
  );
}

export default function MesuresLabo({
  numRecipes,
  recipes,
}: {
  numRecipes: number;
  recipes?: RecetteCalculee[] | null;
}) {
  const [mesures, setMesures] = useState<MesureLabo[]>([]);

  const setMesure = (i: number, patch: Partial<MesureLabo>) =>
    setMesures((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push({});
      next[i] = { ...next[i], ...patch };
      return next;
    });

  return (
    <div className="form-card">
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
          Paramètres mesurés au laboratoire
        </h3>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
          Après la gâchée : slump mesuré et essai de teneur en eau (masses en grammes, comme la feuille de référence).
          w mesuré = (m_h − m_s)/(m_s − tare) ; Cw mesuré = (m_s − tare)/(m_h − tare).
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {Array.from({ length: numRecipes }).map((_, i) => {
          const m = mesures[i] || {};
          const { w, cw } = calculeMesures(m);
          const calc = recipes?.[i];
          return (
            <div
              key={i}
              style={{
                background: "#f8fafc", borderRadius: 8,
                borderLeft: `4px solid ${RECIPE_COLORS[i]}`,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: RECIPE_COLORS[i], textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Recette {i + 1}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 12px" }}>
                <Field label="Slump mesuré (mm)">
                  <input type="number" step="any" style={inputStyle} placeholder="—"
                    value={m.slump ?? ""} onChange={(e) => setMesure(i, { slump: num(e.target.value) })} />
                </Field>
                <Field label="Tare (g)">
                  <input type="number" step="any" style={inputStyle} placeholder="—"
                    value={m.tare ?? ""} onChange={(e) => setMesure(i, { tare: num(e.target.value) })} />
                </Field>
                <Field label="Tare + pâte humide m_h (g)">
                  <input type="number" step="any" style={inputStyle} placeholder="—"
                    value={m.mh ?? ""} onChange={(e) => setMesure(i, { mh: num(e.target.value) })} />
                </Field>
                <Field label="Tare + pâte sèche m_s (g)">
                  <input type="number" step="any" style={inputStyle} placeholder="—"
                    value={m.ms ?? ""} onChange={(e) => setMesure(i, { ms: num(e.target.value) })} />
                </Field>
              </div>
              {(w !== null || cw !== null) && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#374151", display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <span>
                    <strong>w mesuré : {fmt(w)} %</strong>
                    {calc ? <> — calculé : {fmt(calc.w_mass_pct)} %<Ecart mesure={w} calcule={calc.w_mass_pct} /></> : null}
                  </span>
                  <span>
                    <strong>Cw mesuré : {fmt(cw)} %</strong>
                    {calc ? <> — calculé : {fmt(calc.solids_mass_pct)} %<Ecart mesure={cw} calcule={calc.solids_mass_pct} /></> : null}
                  </span>
                </div>
              )}
              {m.tare !== undefined && m.mh !== undefined && m.ms !== undefined && w === null && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>
                  Valeurs incohérentes : on attend m_h &gt; m_s &gt; tare.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
