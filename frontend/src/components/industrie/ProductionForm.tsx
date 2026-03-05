"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import type { IndustrieCostResult } from "@/lib/store";
import {
  buildCwPayload,
  computeBinderCost,
  computeCostPerM3,
  computeCostPerTonne,
} from "@/lib/industrie_helpers";

const num = (v: any) => {
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "7px 11px",
  background: "#fff",
  fontSize: 13.5,
  outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function CardSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "10px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "#64748b" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

export default function ProductionForm() {
  const store = useStore() as any;
  const {
    API,
    general,
    setGeneral,
    constantes,
    catalogue_liants,
    industrie,
    setIndustrie,
    binderPrices,
    setBinderPrice,
    setIndustrieResults,
  } = store;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cat = industrie.category;
  const isRpg = cat === "RPG";

  const getPrice = (code: string) => {
    const p = binderPrices.find((bp: any) => bp.code === code);
    return p?.price_per_kg ?? 0;
  };

  const bcount = general.binder_count ?? 1;
  const liantsValides = catalogue_liants.filter((l: any) => String(l.code ?? "").trim() !== "");

  const activeBinders: { code: string; nom: string }[] = [];
  for (let i = 1; i <= bcount; i++) {
    const code = general[`binder${i}_type`];
    if (code) {
      const item = catalogue_liants.find((l: any) => l.code === code);
      activeBinders.push({ code, nom: item?.nom ?? code });
    }
  }

  const fractionTotal =
    (general.binder1_fraction_pct ?? 0) +
    (general.binder2_fraction_pct ?? 0) +
    (general.binder3_fraction_pct ?? 0);
  const fractionOk = Math.abs(fractionTotal - 100) < 0.01;

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);

      const levels = industrie.bw_levels || [3, 4, 5, 6, 7, 8];
      const endpoint = isRpg ? `${API}/rpg/cw` : `${API}/rpc/cw`;

      const promises = levels.map(async (bw: number) => {
        const payload = buildCwPayload(bw, industrie, general, catalogue_liants, constantes);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = typeof data?.detail === "string" ? data.detail : `Erreur API pour Bw=${bw}% (${res.status})`;
          throw new Error(detail);
        }
        return { bw, recipe: data.recipes?.[0] ?? null };
      });

      const results = await Promise.all(promises);

      const costResults: IndustrieCostResult[] = results
        .filter((r) => r.recipe)
        .map((r) => {
          const binderCost = computeBinderCost(r.recipe, binderPrices, catalogue_liants, general);
          return {
            bw_pct: r.bw,
            recipe: r.recipe,
            binder_cost: binderCost,
            cost_per_m3: computeCostPerM3(r.recipe, binderCost),
            cost_per_tonne: computeCostPerTonne(r.recipe, binderCost),
          };
        });

      setIndustrieResults(costResults);
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Category */}
      <CardSection title="Categorie de remblai">
        <div style={{ display: "flex", gap: 10 }}>
          {(["RPC", "RPG"] as const).map((c) => {
            const active = cat === c;
            return (
              <label
                key={c}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                  borderRadius: 8, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                  background: active ? "#eff6ff" : "#fff", cursor: "pointer", fontWeight: 700,
                  fontSize: 13.5, color: active ? "#2563eb" : "#374151", transition: "all 0.13s",
                }}
              >
                <input type="radio" name="ind_cat" style={{ display: "none" }} checked={active} onChange={() => setIndustrie({ category: c })} />
                {c === "RPC" ? "RPC (sans agregat)" : "RPG (avec agregat)"}
              </label>
            );
          })}
        </div>
      </CardSection>

      {/* Residue */}
      <CardSection title="Proprietes du residu" subtitle="Parametres recus du laboratoire">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <Field label="Gs residu">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.4"
              value={industrie.residue_sg || ""} onChange={(e) => setIndustrie({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau w0 (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 23.8"
              value={industrie.residue_w_pct || ""} onChange={(e) => setIndustrie({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Cw cible (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 78"
              value={industrie.solids_mass_pct || ""} onChange={(e) => setIndustrie({ solids_mass_pct: num(e.target.value) })} />
          </Field>
          <Field label="Saturation Sr (%)">
            <input type="number" step="any" style={inputStyle} placeholder="100"
              value={industrie.saturation_pct || ""} onChange={(e) => setIndustrie({ saturation_pct: num(e.target.value) })} />
          </Field>
        </div>
        {isRpg && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px", marginTop: 10 }}>
            <Field label="Gs agregat">
              <input type="number" step="any" style={inputStyle} placeholder="ex : 2.7"
                value={industrie.aggregate_sg || ""} onChange={(e) => setIndustrie({ aggregate_sg: num(e.target.value) })} />
            </Field>
            <Field label="w0 agregat (%)">
              <input type="number" step="any" style={inputStyle} placeholder="ex : 3"
                value={industrie.aggregate_w_pct || ""} onChange={(e) => setIndustrie({ aggregate_w_pct: num(e.target.value) })} />
            </Field>
            <Field label="Fraction agregat A_m (%)">
              <input type="number" step="any" style={inputStyle} placeholder="ex : 25"
                value={industrie.aggregate_fraction_pct || ""} onChange={(e) => setIndustrie({ aggregate_fraction_pct: num(e.target.value) })} />
            </Field>
          </div>
        )}
      </CardSection>

      {/* Slump */}
      <CardSection title="Slump mesure (optionnel)" subtitle="Valeur informative pour le suivi">
        <div style={{ maxWidth: 240 }}>
          <Field label="Slump (mm)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 180"
              value={industrie.slump_measured_mm || ""} onChange={(e) => setIndustrie({ slump_measured_mm: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* Bw% levels */}
      <CardSection title="Niveaux de Bw% a comparer" subtitle="Le calcul sera effectue pour chaque niveau">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {(industrie.bw_levels || []).map((bw: number, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                step="0.5"
                style={{ ...inputStyle, width: 72, textAlign: "center" }}
                value={bw}
                onChange={(e) => {
                  const arr = [...industrie.bw_levels];
                  arr[i] = num(e.target.value);
                  setIndustrie({ bw_levels: arr });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const arr = industrie.bw_levels.filter((_: any, j: number) => j !== i);
                  setIndustrie({ bw_levels: arr });
                }}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, padding: "0 2px" }}
                title="Retirer"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const last = industrie.bw_levels[industrie.bw_levels.length - 1] ?? 5;
              setIndustrie({ bw_levels: [...industrie.bw_levels, last + 1] });
            }}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "1px dashed #cbd5e1",
              background: "#f8fafc", fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer",
            }}
          >
            + Ajouter
          </button>
        </div>
      </CardSection>

      {/* Binder system + prices */}
      <CardSection title="Systeme liant" subtitle="Configuration, proportions et prix des liants">
        {/* Binder count */}
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Nombre de liants
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map((n) => {
              const active = bcount === n;
              return (
                <label
                  key={n}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 42, height: 34, borderRadius: 6,
                    border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                    background: active ? "#eff6ff" : "#fff", cursor: "pointer",
                    fontWeight: 700, fontSize: 13.5, color: active ? "#2563eb" : "#374151",
                    transition: "all 0.13s",
                  }}
                >
                  <input type="radio" name="ind_binder_count" style={{ display: "none" }} checked={active}
                    onChange={() => setGeneral({ binder_count: n as 1 | 2 | 3 })} />
                  {n}
                </label>
              );
            })}
          </div>
        </div>

        {/* Binder rows: type + fraction + price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((idx) => {
            if (idx > bcount) return null;
            const typeKey = `binder${idx}_type` as any;
            const fracKey = `binder${idx}_fraction_pct` as any;
            const code = general[typeKey] ?? "";
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px", gap: 10, alignItems: "end" }}>
                <Field label={`Liant ${idx}`}>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={code}
                    onChange={(e) => setGeneral({ [typeKey]: e.target.value })}
                  >
                    <option value="">-- Choisir --</option>
                    {liantsValides.map((l: any) => (
                      <option key={l.code} value={l.code}>{l.nom} (Gs={l.gs})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fraction (%)">
                  <input type="number" step="any" style={{ ...inputStyle, textAlign: "center" }}
                    value={general[fracKey] ?? ""} onChange={(e) => setGeneral({ [fracKey]: num(e.target.value) })} />
                </Field>
                <Field label="Prix ($/kg)">
                  <input type="number" step="any" style={inputStyle} placeholder="ex : 0.15"
                    value={code ? (getPrice(code) || "") : ""} onChange={(e) => { if (code) setBinderPrice(code, num(e.target.value)); }} />
                </Field>
              </div>
            );
          })}
        </div>

        {/* Fraction total indicator */}
        {bcount >= 2 && (
          <div style={{
            fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
            background: fractionOk ? "#f0fdf4" : "#fef2f2",
            color: fractionOk ? "#16a34a" : "#dc2626",
            border: `1px solid ${fractionOk ? "#bbf7d0" : "#fecaca"}`,
          }}>
            Total des fractions : {fractionTotal.toFixed(1)} %
            {!fractionOk && " (doit etre 100%)"}
          </div>
        )}
      </CardSection>

      {/* Mix params */}
      <CardSection title="Parametres du melange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
          <Field label="Quantite (nb. de moules)">
            <input type="number" style={inputStyle} min={1} value={industrie.desired_qty ?? 1}
              onChange={(e) => setIndustrie({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de securite">
            <input type="number" step="any" style={inputStyle} min={1} value={industrie.safety_factor ?? 1}
              onChange={(e) => setIndustrie({ safety_factor: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleCompute} disabled={loading} className="btn-primary">
          {loading ? (
            <>
              <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Calcul en cours...
            </>
          ) : (
            "Calculer les couts"
          )}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
