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

  const activeBinders: { code: string; nom: string }[] = [];
  const bcount = general.binder_count ?? 1;
  for (let i = 1; i <= bcount; i++) {
    const code = general[`binder${i}_type`];
    if (code) {
      const item = catalogue_liants.find((l: any) => l.code === code);
      activeBinders.push({ code, nom: item?.nom ?? code });
    }
  }

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
        if (!res.ok) throw new Error(`Erreur API pour Bw=${bw}% (${res.status})`);
        const data = await res.json();
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px" }}>
          <Field label="Gs residu">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.4"
              value={industrie.residue_sg || ""} onChange={(e) => setIndustrie({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau w0 (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 23.8"
              value={industrie.residue_w_pct || ""} onChange={(e) => setIndustrie({ residue_w_pct: num(e.target.value) })} />
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

      {/* Binder prices */}
      <CardSection title="Prix des liants" subtitle="Cout par kilogramme (devise locale)">
        {activeBinders.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#94a3b8" }}>
            Aucun liant configure. Allez dans Informations pour definir le systeme liant.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: activeBinders.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: "10px 16px" }}>
            {activeBinders.map((b) => (
              <Field key={b.code} label={`${b.nom} ($/kg)`}>
                <input type="number" step="any" style={inputStyle} placeholder="ex : 0.15"
                  value={getPrice(b.code) || ""} onChange={(e) => setBinderPrice(b.code, num(e.target.value))} />
              </Field>
            ))}
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
