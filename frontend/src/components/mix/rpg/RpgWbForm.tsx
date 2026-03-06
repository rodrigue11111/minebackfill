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
  display: "block", width: "100%", border: "1px solid #cbd5e1", borderRadius: 6,
  padding: "7px 11px", background: "#fff", fontSize: 13.5, outline: "none",
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

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

export default function RpgWbForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgWb,
    setRpgWb,
    setRpgWbRecipe,
    setRpgWbResult,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        category: "RPG",
        general: construireGeneralPayload(general),
        constants: construireConstantesPayload(constantes),
        residue: { specific_gravity: rpgWb.residue_sg || 0, moisture_mass_pct: rpgWb.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: rpgWb.num_recipes,
        containers_per_recipe: rpgWb.desired_qty,
        safety_factor: rpgWb.safety_factor,
        saturation_pct: rpgWb.saturation_pct,
        binder_mass_pct_recipes: (rpgWb.binder_pct || []).slice(0, rpgWb.num_recipes),
        wc_ratio_recipes: (rpgWb.wc_ratio || []).slice(0, rpgWb.num_recipes),
        aggregate_fraction_pct: rpgWb.aggregate_fraction_pct,
        aggregate_specific_gravity: rpgWb.aggregate_sg,
      };
      const res = await fetch(`${API}/rpg/wb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : `Erreur API (${res.status})`;
        throw new Error(detail);
      }
      setRpgWbResult(data);
    } catch (err: any) {
      if (err instanceof TypeError) {
        setError("Impossible de joindre le serveur. Verifiez que le backend est demarre.");
      } else {
        setError(err.message || "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  const numRecipes = rpgWb.num_recipes || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── PAF info banner ── */}
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#15803d" }}>
        <strong>RPG — Paste Aggregate Fill :</strong> formules PAF actives.
        Le Cw% est dérivé du rapport E/C et du Bw% selon la relation PAF.
      </div>

      {/* ── Agrégat (PAF-specific) ── */}
      <CardSection title="Agrégat granulaire" subtitle="Paramètres spécifiques au RPG (PAF)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Gs agrégat" hint="Masse volumique spécifique de l'agrégat">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 2.65"
              value={rpgWb.aggregate_sg || ""}
              onChange={(e) => setRpgWb({ aggregate_sg: num(e.target.value) })} />
          </Field>
          <Field label="A_m — fraction agrégat (%)" hint="Ma/(Ma+Mr)×100 — % d'agrégat dans les solides non-liant">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 30"
              value={rpgWb.aggregate_fraction_pct || ""}
              onChange={(e) => setRpgWb({ aggregate_fraction_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Résidu & saturation ── */}
      <CardSection title="Résidu & saturation">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Gs résidu" hint="Masse volumique spécifique des grains">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.4"
              value={rpgWb.residue_sg || ""}
              onChange={(e) => setRpgWb({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau résidu w₀ (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 23.8"
              value={rpgWb.residue_w_pct || ""}
              onChange={(e) => setRpgWb({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Saturation Sr (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 100"
              value={rpgWb.saturation_pct || ""}
              onChange={(e) => setRpgWb({ saturation_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Paramètres du mélange ── */}
      <CardSection title="Paramètres du mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Quantité (nb. de moules)">
            <input type="number" style={inputStyle} min={1}
              value={rpgWb.desired_qty ?? 1}
              onChange={(e) => setRpgWb({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de sécurité">
            <input type="number" step="any" style={inputStyle} min={1}
              value={rpgWb.safety_factor ?? 1}
              onChange={(e) => setRpgWb({ safety_factor: num(e.target.value) })} />
          </Field>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Nombre de recettes</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = numRecipes === n;
              return (
                <label key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 34, borderRadius: 6, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`, background: active ? "#2563eb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, color: active ? "#fff" : "#374151", transition: "all 0.13s" }}>
                  <input type="radio" name="rpg_wb_num_recipes" style={{ display: "none" }} checked={active} onChange={() => setRpgWb({ num_recipes: n as 1 | 2 | 3 | 4 })} />
                  {n}
                </label>
              );
            })}
          </div>
        </div>
      </CardSection>

      {/* ── Per-recipe: Bw% + E/C ── */}
      <CardSection
        title={`Recettes — Bw% & rapport E/C (${numRecipes} recette${numRecipes > 1 ? "s" : ""})`}
        subtitle="Bw% = Mb/(Mr+Ma)×100  ·  E/C = Meau/Mliant"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <div key={i} style={{ background: "#f8fafc", border: `1.5px solid ${RECIPE_COLORS[i]}20`, borderLeft: `4px solid ${RECIPE_COLORS[i]}`, borderRadius: "0 8px 8px 0", padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
              <div style={{ gridColumn: "1/-1", fontSize: 11.5, fontWeight: 700, color: RECIPE_COLORS[i], textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 2 }}>
                Recette {i + 1}
              </div>
              <Field label="Bw% — liant (%)" hint="% massique de liant / (résidu+agrégat)">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 5"
                  value={rpgWb.binder_pct?.[i] ?? ""}
                  onChange={(e) => setRpgWbRecipe(i, { binder_pct: num(e.target.value) })} />
              </Field>
              <Field label="Rapport E/C" hint="Eau / ciment massique (ex : 4 à 8)">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 6.0"
                  value={rpgWb.wc_ratio?.[i] ?? ""}
                  onChange={(e) => setRpgWbRecipe(i, { wc_ratio: num(e.target.value) })} />
              </Field>
            </div>
          ))}
        </div>
      </CardSection>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleCompute} disabled={loading} className="btn-primary">
          {loading ? (<><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Calcul en cours…</>) : "▶ Lancer le calcul"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setRpgWb({ saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, aggregate_fraction_pct: 0, aggregate_sg: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0], wc_ratio: [0, 0, 0, 0] }); setRpgWbResult(null); setError(null); }}>
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
