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

/* ── Shared style tokens ── */
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "7px 11px",
  background: "#fff",
  fontSize: 13.5,
  outline: "none",
  transition: "border-color 0.15s",
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

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid #f1f5f9",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.07em",
          color: "#64748b",
          background: "#f8fafc",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

export default function CwForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    cw,
    setCw,
    setCwRecipe,
    setCwResult,
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
        residue: { specific_gravity: cw.residue_sg || 0, moisture_mass_pct: cw.residue_w_pct || 0 },
        binder_system: construireSystemeLiant(general, catalogue_liants),
        num_recipes: cw.num_recipes,
        containers_per_recipe: cw.desired_qty,
        safety_factor: cw.safety_factor,
        solids_mass_pct: cw.solid_mass_pct,
        saturation_pct: cw.saturation_pct,
        binder_mass_pct_recipes: (cw.binder_pct || []).slice(0, cw.num_recipes),
      };
      const res = await fetch(`${API}/rpc/cw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Erreur API (${res.status})`);
      setCwResult(await res.json() as any);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const numRecipes = cw.num_recipes || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Residue & water ── */}
      <CardSection title="Résidu & eau de mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Cw% — % solide massique" hint="Pourcentage massique de solides total">
            <input
              type="number"
              step="any"
              style={inputStyle}
              placeholder="ex : 78"
              value={cw.solid_mass_pct ?? ""}
              onChange={(e) => setCw({ solid_mass_pct: num(e.target.value) })}
            />
          </Field>
          <Field label="Saturation Sr (%)" hint="100% = entièrement saturé">
            <input
              type="number"
              step="any"
              style={inputStyle}
              placeholder="ex : 100"
              value={cw.saturation_pct ?? ""}
              onChange={(e) => setCw({ saturation_pct: num(e.target.value) })}
            />
          </Field>
          <Field label="Gs résidu" hint="Masse volumique spécifique des grains">
            <input
              type="number"
              step="any"
              style={inputStyle}
              placeholder="ex : 3.4"
              value={cw.residue_sg ?? ""}
              onChange={(e) => setCw({ residue_sg: num(e.target.value) })}
            />
          </Field>
          <Field label="Teneur en eau résidu w₀ (%)" hint="Humidité naturelle du résidu">
            <input
              type="number"
              step="any"
              style={inputStyle}
              placeholder="ex : 23.8"
              value={cw.residue_w_pct ?? ""}
              onChange={(e) => setCw({ residue_w_pct: num(e.target.value) })}
            />
          </Field>
        </div>
      </CardSection>

      {/* ── Mix metadata ── */}
      <CardSection title="Paramètres du mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          <Field label="Quantité (nb. de moules)">
            <input
              type="number"
              style={inputStyle}
              min={1}
              value={cw.desired_qty ?? 1}
              onChange={(e) => setCw({ desired_qty: num(e.target.value) })}
            />
          </Field>
          <Field label="Facteur de sécurité">
            <input
              type="number"
              step="any"
              style={inputStyle}
              min={1}
              value={cw.safety_factor ?? 1}
              onChange={(e) => setCw({ safety_factor: num(e.target.value) })}
            />
          </Field>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Nombre de recettes
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = numRecipes === n;
              return (
                <label
                  key={n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 34,
                    borderRadius: 6,
                    border: `1.5px solid ${active ? "var(--primary, #2563eb)" : "#e2e8f0"}`,
                    background: active ? "var(--primary, #2563eb)" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    color: active ? "#fff" : "#374151",
                    transition: "all 0.13s",
                  }}
                >
                  <input
                    type="radio"
                    name="cw_num_recipes"
                    style={{ display: "none" }}
                    checked={active}
                    onChange={() => setCw({ num_recipes: n as 1 | 2 | 3 | 4 })}
                  />
                  {n}
                </label>
              );
            })}
          </div>
        </div>
      </CardSection>

      {/* ── Per-recipe binder% ── */}
      <CardSection title={`Liant par recette — Bw% (${numRecipes} recette${numRecipes > 1 ? "s" : ""})`}>
        <div style={{ display: "grid", gridTemplateColumns: numRecipes === 1 ? "1fr" : "repeat(2, 1fr)", gap: "12px 16px" }}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <Field key={i} label={`Recette ${i + 1} — Bw%`} hint="% massique de liant dans le mélange">
              <input
                type="number"
                step="any"
                style={{ ...inputStyle, borderLeft: `3px solid ${["#2563eb","#16a34a","#d97706","#dc2626"][i]}` }}
                placeholder="ex : 4.5"
                value={cw.binder_pct?.[i] ?? ""}
                onChange={(e) => setCwRecipe(i, { binder_pct: num(e.target.value) })}
              />
            </Field>
          ))}
        </div>
      </CardSection>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={handleCompute}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              Calcul en cours…
            </>
          ) : (
            "▶ Lancer le calcul"
          )}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setCw({ solid_mass_pct: 0, saturation_pct: 0, residue_sg: 0, residue_w_pct: 0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [0, 0, 0, 0] });
            setCwResult(null as any);
            setError(null);
          }}
        >
          Réinitialiser
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 7,
            padding: "10px 14px",
            fontSize: 13,
            color: "#dc2626",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
