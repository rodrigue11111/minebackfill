"use client";

import React, { useState } from "react";
import { useStore, prixPourLiant, lireBinders, patchBinders, MAX_BINDERS } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import MaterialPresetSelect from "@/components/MaterialPresetSelect";
import type { ResiduItem, GranulatItem } from "@/lib/materials";
import { messageErreurApi } from "@/lib/api-error";
import type { IndustrieCostResult, BinderRef, LiantCatalogueItem } from "@/lib/store";
import {
  buildCwPayload,
  computeBinderCost,
  computeCostPerM3,
  computeCostPerTonne,
} from "@/lib/industrie_helpers";
import { num } from "@/lib/format";

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
  const store = useStore();
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

  const getPrice = (code: string, id?: string) => {
    const idResolu = id ?? catalogue_liants.find((l: LiantCatalogueItem) => l.code === code)?.id;
    return prixPourLiant(binderPrices, { id: idResolu, code });
  };

  const liantsValides = catalogue_liants.filter((l: LiantCatalogueItem) => String(l.code ?? "").trim() !== "");

  // Composants du liant (liste N-aire, repli legacy via lireBinders).
  const binders = lireBinders(general);
  const fractionTotal = binders.reduce((s, b) => s + (b.fraction_pct ?? 0), 0);
  const fractionOk = Math.abs(fractionTotal - 100) < 0.01;

  const setBinders = (next: BinderRef[]) => setGeneral(patchBinders(next));
  const updateBinder = (i: number, patch: Partial<BinderRef>) =>
    setBinders(binders.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const addBinder = () => setBinders([...binders, { id: null, code: null, fraction_pct: undefined }]);
  const removeBinder = (i: number) => setBinders(binders.filter((_, j) => j !== i));

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
          const detail = `Bw=${bw}% : ${messageErreurApi(data, res.status)}`;
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
    } catch (e) {
      if (e instanceof TypeError) {
        setError("Impossible de joindre le serveur. Vérifiez que le backend est démarré.");
      } else {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Category */}
      <CardSection title="Catégorie de remblai">
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
                <input type="radio" name="ind_cat" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} checked={active} onChange={() => setIndustrie({ category: c })} />
                {c === "RPC" ? "RPC (sans agrégat)" : "RPG (avec agrégat)"}
              </label>
            );
          })}
        </div>
      </CardSection>

      {/* Residue */}
      <CardSection title="Propriétés du résidu" subtitle="Paramètres reçus du laboratoire">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <MaterialPresetSelect kind="residus" role="residueId" label="Résidu (bibliothèque)"
            onPick={(m) => { const r = m as ResiduItem; setIndustrie({ residue_sg: r.gs, residue_w_pct: r.w0_pct }); }}
            matches={(m) => { const r = m as ResiduItem; return r.gs === industrie.residue_sg && r.w0_pct === industrie.residue_w_pct; }} />
          <div />
          <Field label="Gs résidu">
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
            <MaterialPresetSelect kind="granulats" role="aggregateId" label="Granulat (bibliothèque)"
              onPick={(m) => { const g = m as GranulatItem; setIndustrie({ aggregate_sg: g.gs, aggregate_w_pct: g.humidite_pct, aggregate_fraction_pct: g.fraction_defaut_pct ?? industrie.aggregate_fraction_pct }); }}
              matches={(m) => (m as GranulatItem).gs === industrie.aggregate_sg} />
            <div />
            <div />
            <Field label="Gs agrégat">
              <input type="number" step="any" style={inputStyle} placeholder="ex : 2.7"
                value={industrie.aggregate_sg || ""} onChange={(e) => setIndustrie({ aggregate_sg: num(e.target.value) })} />
            </Field>
            <Field label="w0 agrégat (%)">
              <input type="number" step="any" style={inputStyle} placeholder="ex : 3"
                value={industrie.aggregate_w_pct || ""} onChange={(e) => setIndustrie({ aggregate_w_pct: num(e.target.value) })} />
            </Field>
            <Field label="Fraction agrégat A_m (%)">
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
      <CardSection title="Niveaux de Bw% a comparer" subtitle="Le calcul sera effectué pour chaque niveau">
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
                  const arr = industrie.bw_levels.filter((_: number, j: number) => j !== i);
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
      <CardSection title="Système liant" subtitle="Configuration, proportions et prix des liants">
        {/* Binder count */}
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Composants du liant
          </label>
        </div>

        {/* Binder rows: type + fraction + price (liste dynamique) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {binders.map((b, idx) => {
            const code = b.code ?? "";
            // Identité par id (repli code pour les anciens états).
            const liantId =
              b.id ??
              liantsValides.find((l: LiantCatalogueItem) => l.code === code)?.id ??
              "";
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px auto", gap: 10, alignItems: "end" }}>
                <Field label={`Liant ${idx + 1}`}>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={liantId}
                    onChange={(e) => {
                      const item = liantsValides.find((l: LiantCatalogueItem) => l.id === e.target.value);
                      updateBinder(idx, { id: item?.id ?? null, code: item?.code ?? null });
                    }}
                  >
                    <option value="">-- Choisir --</option>
                    {liantsValides.map((l: LiantCatalogueItem) => (
                      <option key={l.id} value={l.id}>{l.nom} (Gs={l.gs})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fraction (%)">
                  <input type="number" step="any" style={{ ...inputStyle, textAlign: "center" }}
                    value={b.fraction_pct ?? ""} onChange={(e) => updateBinder(idx, { fraction_pct: e.target.value === "" ? undefined : num(e.target.value) })} />
                </Field>
                <Field label="Prix ($/kg)">
                  <input type="number" step="any" style={inputStyle} placeholder="ex : 0.15"
                    value={code ? (getPrice(code, liantId || undefined) || "") : ""}
                    onChange={(e) => { if (code) setBinderPrice(code, num(e.target.value), liantId || undefined); }} />
                </Field>
                {binders.length > 1 && (
                  <button type="button" onClick={() => removeBinder(idx)}
                    style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "0 4px 8px" }}
                    aria-label={`Retirer le liant ${idx + 1}`}>
                    Retirer
                  </button>
                )}
              </div>
            );
          })}
          {binders.length < MAX_BINDERS && (
            <button type="button" onClick={addBinder}
              style={{ alignSelf: "flex-start", border: "1.5px dashed #93c5fd", background: "transparent", color: "#2563eb", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              + Ajouter un liant
            </button>
          )}
        </div>

        {/* Fraction total indicator */}
        {binders.length >= 2 && (
          <div style={{
            fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
            background: fractionOk ? "#f0fdf4" : "#fef2f2",
            color: fractionOk ? "#16a34a" : "#dc2626",
            border: `1px solid ${fractionOk ? "#bbf7d0" : "#fecaca"}`,
          }}>
            Total des fractions : {fractionTotal.toFixed(1)} %
            {!fractionOk && " (doit être 100%)"}
          </div>
        )}
      </CardSection>

      {/* Mix params */}
      <CardSection title="Paramètres du mélange">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
          <Field label="Quantité (nb. de moules)">
            <input type="number" style={inputStyle} min={1} value={industrie.desired_qty ?? 1}
              onChange={(e) => setIndustrie({ desired_qty: num(e.target.value) })} />
          </Field>
          <Field label="Facteur de sécurité (multiplicateur)">
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
            "Calculer les coûts"
          )}
        </button>
      </div>

      <ErrorBox message={error} />
    </div>
  );
}
