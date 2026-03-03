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

export default function EssaiForm() {
  const {
    API,
    general,
    constantes,
    catalogue_liants,
    cw,
    wb,
    essai,
    setEssai,
    setEssaiAjustement,
    setEssaiResult,
  } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCompute() {
    try {
      setLoading(true);
      setError(null);
      const binder_system = construireSystemeLiant(general, catalogue_liants);
      const general_payload = construireGeneralPayload(general);
      const constantes_payload = construireConstantesPayload(constantes);
      const base_method = essai.base_method;
      const base_inputs =
        base_method === "dosage_cw"
          ? {
              category: "RPC",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: cw.residue_sg || 0, moisture_mass_pct: cw.residue_w_pct || 0 },
              binder_system,
              num_recipes: cw.num_recipes,
              containers_per_recipe: cw.desired_qty,
              safety_factor: cw.safety_factor,
              solids_mass_pct: cw.solid_mass_pct,
              saturation_pct: cw.saturation_pct,
              binder_mass_pct_recipes: (cw.binder_pct || []).slice(0, cw.num_recipes),
            }
          : {
              category: "RPC",
              general: general_payload,
              constants: constantes_payload,
              residue: { specific_gravity: wb.residue_sg || 0, moisture_mass_pct: wb.residue_w_pct || 0 },
              binder_system,
              num_recipes: wb.num_recipes,
              containers_per_recipe: wb.desired_qty,
              safety_factor: wb.safety_factor,
              saturation_pct: wb.saturation_pct,
              binder_mass_pct_recipes: (wb.binder_pct || []).slice(0, wb.num_recipes),
              wc_ratio_recipes: (wb.wc_ratio || []).slice(0, wb.num_recipes),
            };

      const payload = {
        category: "RPC",
        general: general_payload,
        constants: constantes_payload,
        residue: { specific_gravity: (base_method === "dosage_cw" ? cw.residue_sg : wb.residue_sg) || 0, moisture_mass_pct: (base_method === "dosage_cw" ? cw.residue_w_pct : wb.residue_w_pct) || 0 },
        binder_system,
        num_recipes: base_method === "dosage_cw" ? cw.num_recipes : wb.num_recipes,
        containers_per_recipe: base_method === "dosage_cw" ? cw.desired_qty : wb.desired_qty,
        safety_factor: base_method === "dosage_cw" ? cw.safety_factor : wb.safety_factor,
        base_method,
        base_inputs_cw: base_method === "dosage_cw" ? base_inputs : null,
        base_inputs_wb: base_method === "wb" ? base_inputs : null,
        adjustments: (essai.ajustements || []).map((a) => ({
          added_dry_residue_mass: a.ajout_residu_sec || 0,
          added_wet_residue_mass: a.ajout_residu_humide || 0,
          added_water_mass: a.ajout_eau || 0,
        })),
      };

      const res = await fetch(`${API}/rpc/essai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Erreur API (${res.status})`);
      setEssaiResult(await res.json() as any);
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const baseMethod = essai.base_method || "dosage_cw";
  const numRecipes = baseMethod === "dosage_cw" ? (cw.num_recipes || 1) : (wb.num_recipes || 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Info banner ── */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#0369a1" }}>
        <strong>Méthode essai-erreur :</strong> réutilise les données de la méthode de base (Cw% ou E/C) et permet d&apos;ajouter des ajustements manuels par recette après mesure du slump.
      </div>

      {/* ── Base method choice ── */}
      <CardSection title="Méthode de base" subtitle="Les paramètres sont repris depuis le formulaire correspondant">
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { value: "dosage_cw", label: "Dosage Cw (%)", sub: `${cw.num_recipes || 1} recette${(cw.num_recipes || 1) > 1 ? "s" : ""}` },
            { value: "wb", label: "Rapport E/C", sub: `${wb.num_recipes || 1} recette${(wb.num_recipes || 1) > 1 ? "s" : ""}` },
          ].map((opt) => {
            const active = baseMethod === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex", flexDirection: "column" as const, gap: 2, padding: "10px 16px",
                  borderRadius: 8, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                  background: active ? "#eff6ff" : "#fff", cursor: "pointer", minWidth: 160, transition: "all 0.13s",
                }}
              >
                <input type="radio" name="base_method" style={{ display: "none" }} checked={active} onChange={() => setEssai({ base_method: opt.value as any })} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: active ? "#2563eb" : "#374151" }}>{opt.label}</span>
                <span style={{ fontSize: 11.5, color: active ? "#60a5fa" : "#94a3b8" }}>{opt.sub}</span>
              </label>
            );
          })}
        </div>
      </CardSection>

      {/* ── Adjustments ── */}
      <CardSection title={`Ajustements par recette — ${numRecipes} recette${numRecipes > 1 ? "s" : ""}`} subtitle="Quantités à ajouter après le premier malaxage (kg)">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {Array.from({ length: numRecipes }).map((_, i) => {
            const aj = essai.ajustements?.[i] || {};
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 12px" }}>
                  <Field label="Résidu sec (kg)">
                    <input type="number" step="any" style={inputStyle} placeholder="0" value={aj.ajout_residu_sec ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_residu_sec: num(e.target.value) })} />
                  </Field>
                  <Field label="Résidu humide (kg)">
                    <input type="number" step="any" style={inputStyle} placeholder="0" value={aj.ajout_residu_humide ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_residu_humide: num(e.target.value) })} />
                  </Field>
                  <Field label="Eau (kg)">
                    <input type="number" step="any" style={inputStyle} placeholder="0" value={aj.ajout_eau ?? ""} onChange={(e) => setEssaiAjustement(i, { ajout_eau: num(e.target.value) })} />
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
        <button type="button" className="btn-secondary" onClick={() => { setEssai({ base_method: "dosage_cw", ajustements: [] }); setEssaiResult(null); setError(null); }}>
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
