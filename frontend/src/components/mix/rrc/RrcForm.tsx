"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { RetardateurItem } from "@/lib/materials";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";

/**
 * Formulaire RRC — Remblai Rocheux Cimenté (CRF).
 * Méthode unique du cours (Dias 66-70) : dosage par Bw (liant / roches
 * stériles) et W/C du coulis (fluide = eau + retardateur de prise).
 */

const num = (v: string) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", border: "1px solid #cbd5e1", borderRadius: 6,
  padding: "7px 11px", background: "#fff", fontSize: 13.5, outline: "none",
};

const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"];

function CardSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="form-card">
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

export default function RrcForm() {
  const { API, general, constantes, rrc, setRrc, setRrcRecipe, setRrcResult } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const numRecipes = rrc.num_recipes || 1;
  const modeVolume = rrc.quantity_mode === "volume";

  async function handleCompute() {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        category: "RRC",
        general: { ...general },
        num_recipes: rrc.num_recipes,
        quantity_mode: rrc.quantity_mode,
        volume_m3: modeVolume ? rrc.volume_m3 || null : null,
        wet_density_kg_m3: rrc.wet_density_kg_m3 || null,
        total_mass_kg: !modeVolume ? rrc.total_mass_kg || null : null,
        binder_mass_pct_recipes: (rrc.binder_pct || []).slice(0, numRecipes),
        wc_ratio_recipes: (rrc.wc_ratio || []).slice(0, numRecipes),
        cement_specific_gravity: rrc.cement_sg || 3.15,
        retarder_dosage_ml_per_100kg: rrc.retarder_d0 || 0,
        retarder_density_g_ml: rrc.retarder_density || 1.2,
        constants: {
          water_density: constantes.masse_volumique_eau_kg_m3,
          gravity: constantes.gravite_m_s2,
          slump_small_to_large_factor: constantes.facteur_petit_cone_vers_grand_cone,
          slump_model_coeff: constantes.coefficient_modele_slump,
          slump_model_offset: constantes.constante_modele_slump,
        },
      };
      const res = await fetch(`${API}/rrc/dosage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(messageErreurApi(data, res.status));
      }
      setRrcResult(data);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(messageErreurReseau());
      } else {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Quantité de CRF ── */}
      <CardSection title="Quantité de CRF" subtitle="Volume du chantier à remblayer, ou masse totale directe">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[
            { value: "volume", label: "Par volume", sub: "V x masse volumique humide" },
            { value: "masse", label: "Par masse", sub: "Masse totale de CRF" },
          ].map((opt) => {
            const active = rrc.quantity_mode === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex", flexDirection: "column", gap: 2, padding: "10px 16px",
                  borderRadius: 8, border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                  background: active ? "#eff6ff" : "#fff", cursor: "pointer", minWidth: 160, transition: "all 0.13s",
                }}
              >
                <input type="radio" name="rrc_mode" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                  checked={active} onChange={() => setRrc({ quantity_mode: opt.value as "volume" | "masse" })} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: active ? "#2563eb" : "#374151" }}>{opt.label}</span>
                <span style={{ fontSize: 11.5, color: active ? "#60a5fa" : "#94a3b8" }}>{opt.sub}</span>
              </label>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
          {modeVolume ? (
            <>
              <Field label="Volume du chantier V_CRF (m³)">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 1000"
                  value={rrc.volume_m3 || ""} onChange={(e) => setRrc({ volume_m3: num(e.target.value) })} />
              </Field>
              <Field label="Masse volumique humide (kg/m³)" hint="rho_wet du CRF en place (typ. 1800-2400)">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 2200"
                  value={rrc.wet_density_kg_m3 || ""} onChange={(e) => setRrc({ wet_density_kg_m3: num(e.target.value) })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Masse totale M_CRF (kg)">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 2200000"
                  value={rrc.total_mass_kg || ""} onChange={(e) => setRrc({ total_mass_kg: num(e.target.value) })} />
              </Field>
              <Field label="Masse volumique humide (kg/m³)" hint="Optionnelle — sert au calcul du volume équivalent">
                <input type="number" step="any" style={inputStyle} placeholder="ex : 2200"
                  value={rrc.wet_density_kg_m3 || ""} onChange={(e) => setRrc({ wet_density_kg_m3: num(e.target.value) })} />
              </Field>
            </>
          )}
        </div>
      </CardSection>

      {/* ── Coulis & retardateur ── */}
      <CardSection title="Coulis cimentaire et retardateur de prise"
        subtitle="Le fluide du coulis = eau + retardateur ; dosage D0 recommandé : 50 à 260 ml/100 kg de ciment">
        <div style={{ maxWidth: 320, marginBottom: 14 }}>
          <MaterialPresetSelect
            kind="retardateurs"
            role="retarderId"
            label="Retardateur (bibliothèque)"
            onPick={(m) => { const r = m as RetardateurItem; setRrc({ retarder_density: r.densite_g_ml, retarder_d0: r.dosage_d0_ml_100kg ?? rrc.retarder_d0 }); }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 16px" }}>
          <Field label="Gs du ciment" hint="Pour le volume du coulis">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 3.15"
              value={rrc.cement_sg || ""} onChange={(e) => setRrc({ cement_sg: num(e.target.value) })} />
          </Field>
          <Field label="Dosage retardateur D0 (ml/100 kg)" hint="0 = aucun retardateur">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 100"
              value={rrc.retarder_d0 ?? ""} onChange={(e) => setRrc({ retarder_d0: num(e.target.value) })} />
          </Field>
          <Field label="Masse volumique du retardateur (g/ml)">
            <input type="number" step="any" style={inputStyle} placeholder="ex : 1.2"
              value={rrc.retarder_density || ""} onChange={(e) => setRrc({ retarder_density: num(e.target.value) })} />
          </Field>
        </div>
      </CardSection>

      {/* ── Recettes ── */}
      <CardSection title={`Recettes — Bw et W/C (${numRecipes} recette${numRecipes > 1 ? "s" : ""})`}
        subtitle="Bw = Mc/MWR (liant / roches stériles) ; W/C = fluide / ciment">
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Nombre de recettes
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((n) => {
              const active = numRecipes === n;
              return (
                <label key={n}
                  style={{
                    padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${active ? "#2563eb" : "#e2e8f0"}`,
                    background: active ? "#eff6ff" : "#fff",
                    color: active ? "#2563eb" : "#64748b", cursor: "pointer",
                  }}
                >
                  <input type="radio" name="rrc_num_recipes" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                    checked={active} onChange={() => setRrc({ num_recipes: n as 1 | 2 | 3 | 4 })} />
                  {n}
                </label>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: numRecipes }).map((_, i) => (
            <div key={i}
              style={{
                background: "#f8fafc", borderRadius: 8,
                borderLeft: `4px solid ${RECIPE_COLORS[i]}`,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: RECIPE_COLORS[i], textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Recette {i + 1}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
                <Field label="Bw (%)">
                  <input type="number" step="any" style={inputStyle} placeholder="ex : 5"
                    value={rrc.binder_pct?.[i] || ""} onChange={(e) => setRrcRecipe(i, { binder_pct: num(e.target.value) })} />
                </Field>
                <Field label="W/C du coulis">
                  <input type="number" step="any" style={inputStyle} placeholder="ex : 1.0"
                    value={rrc.wc_ratio?.[i] || ""} onChange={(e) => setRrcRecipe(i, { wc_ratio: num(e.target.value) })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </CardSection>

      {/* ── Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={handleCompute} disabled={loading} className="btn-primary">
          {loading ? (<><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Calcul en cours…</>) : "▶ Lancer le calcul"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setRrcResult(null); setError(null); }}>
          Réinitialiser
        </button>
      </div>

      <ErrorBox message={error} />
    </div>
  );
}
