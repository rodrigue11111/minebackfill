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

export default function RpgCwForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgCw,
    setRpgCw,
    setRpgCwRecipe,
    setRpgCwResult,
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
        residue: { specific_gravity: rpgCw.residue_sg || 0, moisture_mass_pct: rpgCw.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: rpgCw.num_recipes,
        containers_per_recipe: rpgCw.desired_qty,
        safety_factor: rpgCw.safety_factor,
        solids_mass_pct: rpgCw.solid_mass_pct,
        saturation_pct: rpgCw.saturation_pct,
        binder_mass_pct_recipes: (rpgCw.binder_pct || []).slice(0, rpgCw.num_recipes),
        aggregate_fraction_pct: rpgCw.aggregate_fraction_pct,
        aggregate_specific_gravity: rpgCw.aggregate_sg,
      };
      const res = await fetch(`${API}/rpg/cw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur API (${res.status})`);
      setRpgCwResult(await res.json());
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const numRecipes = rpgCw.num_recipes || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── PAF info banner ── */}
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#15803d" }}>
        <strong>RPG — Paste Aggregate Fill :</strong> formules PAF actives.
        L&apos;agrégat granulaire est pris en compte dans le Gs équivalent et la distribution des masses.
      </div>

      {/* ── Agrégat (PAF-specific) ── */}
      <CardSection title="Agrégat granulaire" subtitle="Paramètres spécifiques au RPG (PAF)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Gs agrégat" hint="Masse volumique spécifique de l'agrégat">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 2.65"
              value={rpgCw.aggregate_sg || ""}
              onChange={(e) => setRpgCw({ aggregate_sg: num(e.target.value) })} />
          </Field>
          <Field label="A_m — fraction agrégat (%)" hint="Ma/(Ma+Mr)×100 — % d'agrégat dans les solides non-liant">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 30"
              value={rpgCw.aggregate_fraction_pct || ""}
              onChange={(e) => setRpgCw({ aggregate_fraction_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Résidu ── */}
      <CardSection title="Résidu">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Gs résidu" hint="Masse volumique spécifique des grains">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.4"
              value={rpgCw.residue_sg || ""}
              onChange={(e) => setRpgCw({ residue_sg: num(e.target.value) })} />
          </Field>
          <Field label="Teneur en eau résidu w₀ (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 23.8"
              value={rpgCw.residue_w_pct || ""}
              onChange={(e) => setRpgCw({ residue_w_pct: num(e.target.value) })} />
          </Field>
          <Field label="Cw% — solides massiques" hint="% massique total de solides">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 78"
              value={rpgCw.solid_mass_pct || ""}
              onChange={(e) => setRpgCw({ solid_mass_pct: num(e.target.value) })} />
          </Field>
          <Field label="Saturation Sr (%)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 100"
              value={rpgCw.saturation_pct || ""}
              onChange={(e) => setRpgCw({ saturation_pct: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Paramètres du mélange ── */}
      <CardSection title="Paramètres du mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Quantité (nb. de moules)">
            <input type="number" style={inputStyle} min={1}
              value={rpgCw.desired_qty ?? 1}
              onChange={(e) => setRpgCw({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de sécurité">
            <input type="number" step="any" style={inputStyle} min={1}
              value={rpgCw.safety_factor ?? 1}
              onChange={(e) => setRpgCw({ safety_factor: num(e.target.value) })} />
          </Field>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Nombre de recettes</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = numRecipes === n;
              return (
                <label key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 34, borderRadius: 6, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`, background: active ? "#2563eb" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, color: active ? "#fff" : "#374151", transition: "all 0.13s" }}>
                  <input type="radio" name="rpg_cw_num_recipes" style={{ display: "none" }} checked={active} onChange={() => setRpgCw({ num_recipes: n as 1 | 2 | 3 | 4 })} />
                  {n}
                </label>
              );
            })}
          </div>
        </div>
      </CardSection>

      {/* ── Bw% par recette ── */}
      <CardSection title={`Bw% par recette (${numRecipes} recette${numRecipes > 1 ? "s" : ""})`}
        subtitle="Bw% = Mb / (Mr_sec + Ma_sec) × 100">
        <div style={{ display: "grid", gridTemplateColumns: numRecipes === 1 ? "1fr" : "repeat(2, 1fr)", gap: "12px 16px" }}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={`Recette ${i + 1} — Bw%`}>
              <input
                type="number" step="any"
                style={{ ...inputStyle, borderLeft: `3px solid ${RECIPE_COLORS[i]}` }}
                placeholder="ex : 5"
                value={rpgCw.binder_pct?.[i] ?? ""}
                onChange={(e) => setRpgCwRecipe(i, { binder_pct: num(e.target.value) })}
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
        <button type="button" className="btn-secondary" onClick={() => { setRpgCw({ solid_mass_pct: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, aggregate_fraction_pct: 0, aggregate_sg: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0] }); setRpgCwResult(null); setError(null); }}>
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
