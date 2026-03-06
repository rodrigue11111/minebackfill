"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import {
  construireConstantesPayload,
  construireGeneralPayload,
  construireSystemeLiant,
} from "@/lib/rpc_payload";
import { fromStoreMass, toStoreMass, MASS_LABELS } from "@/lib/units";

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

export default function RpgEssaiForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    rpgCw,
    rpgWb,
    rpgEssai,
    setRpgEssai,
    setRpgEssaiAjustement,
    setRpgEssaiResult,
    units,
  } = useStore() as any;
  const massLabel = MASS_LABELS[units.mass as keyof typeof MASS_LABELS] ?? "kg";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const binder_system = construireSystemeLiant(general, catalogue_liants);
      const general_payload = construireGeneralPayload(general);
      const constantes_payload = construireConstantesPayload(constantes);
      const base_method = rpgEssai.base_method;

      const base_inputs_cw =
        base_method === "dosage_cw"
          ? {
              category: "RPG",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: rpgCw.residue_sg || 0, moisture_mass_pct: rpgCw.residue_w_pct || 0 },
              binder_system,
              num_recipes: rpgCw.num_recipes,
              containers_per_recipe: rpgCw.desired_qty,
              safety_factor: rpgCw.safety_factor,
              solids_mass_pct: rpgCw.solid_mass_pct,
              saturation_pct: rpgCw.saturation_pct,
              binder_mass_pct_recipes: (rpgCw.binder_pct || []).slice(0, rpgCw.num_recipes),
              aggregate_fraction_pct: rpgCw.aggregate_fraction_pct,
              aggregate_specific_gravity: rpgCw.aggregate_sg,
            }
          : null;

      const base_inputs_wb =
        base_method === "wb"
          ? {
              category: "RPG",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: rpgWb.residue_sg || 0, moisture_mass_pct: rpgWb.residue_w_pct || 0 },
              binder_system,
              num_recipes: rpgWb.num_recipes,
              containers_per_recipe: rpgWb.desired_qty,
              safety_factor: rpgWb.safety_factor,
              saturation_pct: rpgWb.saturation_pct,
              binder_mass_pct_recipes: (rpgWb.binder_pct || []).slice(0, rpgWb.num_recipes),
              wc_ratio_recipes: (rpgWb.wc_ratio || []).slice(0, rpgWb.num_recipes),
              aggregate_fraction_pct: rpgWb.aggregate_fraction_pct,
              aggregate_specific_gravity: rpgWb.aggregate_sg,
            }
          : null;

      const activeBase = base_method === "dosage_cw" ? rpgCw : rpgWb;

      const payload = {
        category: "RPG",
        general: general_payload,
        constants: constantes_payload,
        residue: {
          specific_gravity: activeBase.residue_sg || 0,
          moisture_mass_pct: activeBase.residue_w_pct || 0,
        },
        binder_system,
        num_recipes: activeBase.num_recipes,
        containers_per_recipe: activeBase.desired_qty,
        safety_factor: activeBase.safety_factor,
        base_method,
        base_inputs_cw,
        base_inputs_wb,
        adjustments: (rpgEssai.ajustements || []).map((a: any) => ({
          added_dry_residue_mass: a.ajout_residu_sec || 0,
          added_wet_residue_mass: a.ajout_residu_humide || 0,
          added_aggregate_mass: a.ajout_agregat || 0,
          aggregate_moisture_mass_pct: a.w0_agregat || 0,
          added_water_mass: a.ajout_eau || 0,
        })),
      };

      const res = await fetch(`${API}/rpg/essai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : `Erreur API (${res.status})`;
        throw new Error(detail);
      }
      setRpgEssaiResult(data);
    } catch (e: any) {
      if (e instanceof TypeError) {
        setError("Impossible de joindre le serveur. Verifiez que le backend est demarre.");
      } else {
        setError(e.message || "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  const baseMethod = rpgEssai.base_method || "dosage_cw";
  const numRecipes = baseMethod === "dosage_cw" ? (rpgCw.num_recipes || 1) : (rpgWb.num_recipes || 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Info banner ── */}
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#15803d" }}>
        <strong>RPG — Essai-erreur (PAF) :</strong> réutilise les données de la méthode RPG de base (Cw% ou E/C).
        L&apos;ajout d&apos;agrégat modifie A_m et recalcule Gs_PAF. Le liant est ajusté pour maintenir le Bw% cible.
      </div>

      {/* ── Base method choice ── */}
      <CardSection title="Méthode de base" subtitle="Les paramètres (Gs agrégat, A_m%, Bw%, …) sont repris depuis le formulaire RPG correspondant">
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { value: "dosage_cw", label: "Dosage Cw (%)", sub: `${rpgCw.num_recipes || 1} recette${(rpgCw.num_recipes || 1) > 1 ? "s" : ""}` },
            { value: "wb", label: "Rapport E/C", sub: `${rpgWb.num_recipes || 1} recette${(rpgWb.num_recipes || 1) > 1 ? "s" : ""}` },
          ].map((opt) => {
            const active = baseMethod === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex", flexDirection: "column" as const, gap: 2, padding: "10px 16px",
                  borderRadius: 8, border: `1.5px solid ${active ? "#16a34a" : "#e2e8f0"}`,
                  background: active ? "#f0fdf4" : "#fff", cursor: "pointer", minWidth: 160, transition: "all 0.13s",
                }}
              >
                <input type="radio" name="rpg_essai_base_method" style={{ display: "none" }} checked={active} onChange={() => setRpgEssai({ base_method: opt.value as "dosage_cw" | "wb" })} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: active ? "#16a34a" : "#374151" }}>{opt.label}</span>
                <span style={{ fontSize: 11.5, color: active ? "#4ade80" : "#94a3b8" }}>{opt.sub}</span>
              </label>
            );
          })}
        </div>
      </CardSection>

      {/* ── Adjustments per recipe ── */}
      <CardSection
        title={`Ajustements par recette — ${numRecipes} recette${numRecipes > 1 ? "s" : ""}`}
        subtitle={`Quantités à ajouter après le premier malaxage (${massLabel})`}
      >
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {Array.from({ length: numRecipes }).map((_, i) => {
            const aj = rpgEssai.ajustements?.[i] || {};
            return (
              <div
                key={i}
                style={{
                  background: "#f8fafc", borderRadius: 8,
                  borderLeft: `4px solid ${RECIPE_COLORS[i]}`,
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: RECIPE_COLORS[i], textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 10 }}>
                  Recette {i + 1}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 12px" }}>
                  <Field label={`Résidu sec (${massLabel})`}>
                    <input type="number" step="any" style={inputStyle} placeholder="0"
                      value={fromStoreMass(aj.ajout_residu_sec, units.mass) ?? ""}
                      onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_residu_sec: toStoreMass(num(e.target.value), units.mass) })} />
                  </Field>
                  <Field label={`Résidu humide (${massLabel})`}>
                    <input type="number" step="any" style={inputStyle} placeholder="0"
                      value={fromStoreMass(aj.ajout_residu_humide, units.mass) ?? ""}
                      onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_residu_humide: toStoreMass(num(e.target.value), units.mass) })} />
                  </Field>
                  <Field label={`Agrégat sec (${massLabel})`} hint="Modifie A_m et recalcule Gs_PAF">
                    <input type="number" step="any" style={inputStyle} placeholder="0"
                      value={fromStoreMass(aj.ajout_agregat, units.mass) ?? ""}
                      onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_agregat: toStoreMass(num(e.target.value), units.mass) })} />
                  </Field>
                  <Field label="w0-ag agrégat (%)" hint="Teneur en eau de l'agrégat ajouté">
                    <input type="number" step="any" style={inputStyle} placeholder="0"
                      value={aj.w0_agregat ?? ""}
                      onChange={(e) => setRpgEssaiAjustement(i, { ...aj, w0_agregat: num(e.target.value) })} />
                  </Field>
                  <Field label={`Eau (${massLabel})`}>
                    <input type="number" step="any" style={inputStyle} placeholder="0"
                      value={fromStoreMass(aj.ajout_eau, units.mass) ?? ""}
                      onChange={(e) => setRpgEssaiAjustement(i, { ...aj, ajout_eau: toStoreMass(num(e.target.value), units.mass) })} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </CardSection>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleCompute} disabled={loading} className="btn-primary">
          {loading ? (<><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Calcul en cours…</>) : "▶ Lancer le calcul"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setRpgEssai({ base_method: "dosage_cw", ajustements: [] }); setRpgEssaiResult(null); setError(null); }}>
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
