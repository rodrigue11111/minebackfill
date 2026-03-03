"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";

const num = (v: any) => {
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 11px", background: "#fff", fontSize: 13.5, outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "10px 18px", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "#64748b", background: "#f8fafc" }}>
        {title}
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

export default function SlumpForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    slump,
    setSlump,
    setSlumpRecipe,
    setSlumpResult,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPC",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: slump.residue_sg || 0, moisture_mass_pct: slump.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: slump.num_recipes,
        containers_per_recipe: slump.desired_qty,
        safety_factor: slump.safety_factor,
        cone_type: slump.cone_type,
        slump_mm: slump.slump_mm,
        saturation_pct: slump.saturation_pct,
        binder_mass_pct_recipes: (slump.binder_pct || []).slice(0, slump.num_recipes),
      };
      const res = await fetch(`${API}/rpc/slump`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Erreur API (${res.status})`);
      setSlumpResult(await res.json() as any);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const numRecipes = slump.num_recipes || 1;
  const coneType = slump.cone_type ?? "mini";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Slump target ── */}
      <CardSection title="Slump cible">
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Type de cône</label>
          <div style={{ display: "flex", gap: 10 }}>
            {(["mini", "grand"] as const).map((t) => {
              const active = coneType === t;
              return (
                <label
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 7,
                    border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                    background: active ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#2563eb" : "#374151",
                    transition: "all 0.13s",
                  }}
                >
                  <input type="radio" name="cone_type" style={{ display: "none" }} checked={active} onChange={() => setSlump({ cone_type: t })} />
                  {t === "mini" ? "🔺 Petit cône" : "🔺 Grand cône"}
                </label>
              );
            })}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Affaissement slump (mm)" hint="Valeur mesurée au cône d'Abrams">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 180" value={slump.slump_mm ?? ""} onChange={(e) => setSlump({ slump_mm: num(e.target.value) })} />
          </Field>
          <Field label="Saturation Sr (%)" hint="100% = entièrement saturé">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 100" value={slump.saturation_pct ?? ""} onChange={(e) => setSlump({ saturation_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Residue ── */}
      <CardSection title="Résidu">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Gs résidu">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.4" value={slump.residue_sg ?? ""} onChange={(e) => setSlump({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau w₀ (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 23.8" value={slump.residue_w_pct ?? ""} onChange={(e) => setSlump({ residue_w_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Mix metadata ── */}
      <CardSection title="Paramètres du mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Quantité (nb. de moules)">
            <input type="number" style={inputStyle} min={1} value={slump.desired_qty ?? 1} onChange={(e) => setSlump({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de sécurité">
            <input type="number" step="any" style={inputStyle} min={1} value={slump.safety_factor ?? 1} onChange={(e) => setSlump({ safety_factor: num(e.target.value) })} />
          </Field>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Nombre de recettes</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = numRecipes === n;
              return (
                <label key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 34, borderRadius: 6, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`, background: active ? "#2563eb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, color: active ? "#fff" : "#374151", transition: "all 0.13s" }}>
                  <input type="radio" name="slump_num_recipes" style={{ display: "none" }} checked={active} onChange={() => setSlump({ num_recipes: n as 1 | 2 | 3 | 4 })} />
                  {n}
                </label>
              );
            })}
          </div>
        </div>
      </CardSection>

      {/* ── Per-recipe Bw% ── */}
      <CardSection title={`Liant Bw% par recette (${numRecipes} recette${numRecipes > 1 ? "s" : ""})`}>
        <div style={{ display: "grid", gridTemplateColumns: numRecipes === 1 ? "1fr" : "repeat(2, 1fr)", gap: "12px 16px" }}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={`Recette ${i + 1} — Bw%`}>
              <input
                type="number"
                step="any"
                style={{ ...inputStyle, borderLeft: `3px solid ${RECIPE_COLORS[i]}` }}
                placeholder="ex : 4.5"
                value={slump.binder_pct?.[i] ?? ""}
                onChange={(e) => setSlumpRecipe(i, { binder_pct: num(e.target.value) })}
              />
            </Field>
          ))}
        </div>
      </CardSection>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleCompute} disabled={loading} className="btn-primary">
          {loading ? (<><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Calcul en cours…</>) : "▶ Lancer le calcul"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setSlump({ cone_type: "mini", slump_mm: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0,0,0,0] }); setSlumpResult(null); setError(null); }}>
          Réinitialiser
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
