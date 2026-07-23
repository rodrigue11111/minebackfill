"use client";

// Onglet « Analyse » — courbes de réponse paramétriques. On REPREND la recette
// déjà saisie dans Calculs (RPC ou RPG, méthode Cw%), on choisit un paramètre à
// faire varier (X) et les grandeurs à tracer (Y), et le backend rejoue le
// solveur sur la plage (endpoint /analyse/balayage). Aucun calcul dupliqué ici.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import ErrorBox from "@/components/ErrorBox";
import CourbeSvg, { type SerieTrace } from "@/components/analyse/CourbeSvg";
import {
  paramsPour, sortiesPour, paramMeta, sortieMeta, type CategorieAnalyse,
} from "@/lib/analyse-series";
import {
  construireConstantesPayload, construireGeneralPayload, construireSystemeLiant,
} from "@/lib/rpc_payload";
import { messageErreurApi, messageErreurReseau } from "@/lib/api-error";
import { num, fmt } from "@/lib/format";

interface Balayage {
  category: string;
  param: string;
  x: number[];
  series: Record<string, (number | null)[]>;
}

const DEFAUT_SORTIES = ["wc_ratio", "void_ratio"];

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "10px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b" }}>
        {titre}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 11px",
  background: "#fff", fontSize: 13.5, outline: "none",
};

export default function AnalysePage() {
  const { API, general, constantes, catalogue_liants, cw, rpgCw } = useStore();

  const [categorie, setCategorie] = useState<CategorieAnalyse>("RPG");
  const [param, setParam] = useState("binder_mass_pct");
  const [xMin, setXMin] = useState(1);
  const [xMax, setXMax] = useState(10);
  const [steps, setSteps] = useState(40);
  const [sorties, setSorties] = useState<string[]>(DEFAUT_SORTIES);
  const [normaliser, setNormaliser] = useState(false);
  const [res, setRes] = useState<Balayage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = categorie === "RPC" ? cw : rpgCw;

  const changerCategorie = (c: CategorieAnalyse) => {
    setCategorie(c);
    const params = paramsPour(c);
    if (!params.some((p) => p.cle === param)) {
      const p0 = params[0];
      setParam(p0.cle);
      setXMin(p0.defautMin);
      setXMax(p0.defautMax);
    }
    // ne garder que les grandeurs valides pour cette catégorie
    const valides = new Set(sortiesPour(c).map((s) => s.cle));
    setSorties((prev) => {
      const gardees = prev.filter((k) => valides.has(k));
      return gardees.length ? gardees : DEFAUT_SORTIES.filter((k) => valides.has(k));
    });
    setRes(null);
  };

  const changerParam = (cle: string) => {
    setParam(cle);
    const m = paramMeta(cle);
    if (m) { setXMin(m.defautMin); setXMax(m.defautMax); }
    setRes(null);
  };

  const basculerSortie = (cle: string) =>
    setSorties((prev) => (prev.includes(cle) ? prev.filter((k) => k !== cle) : [...prev, cle]));

  function construireBase() {
    const commun = {
      category: categorie,
      general: construireGeneralPayload(general),
      constants: construireConstantesPayload(constantes),
      residue: { specific_gravity: base.residue_sg || 0, moisture_mass_pct: base.residue_w_pct || 0 },
      binder_system: construireSystemeLiant(general, catalogue_liants),
      num_recipes: 1,
      containers_per_recipe: base.desired_qty || 1,
      safety_factor: base.safety_factor || 1,
      solids_mass_pct: base.solid_mass_pct,
      saturation_pct: base.saturation_pct,
      binder_mass_pct_recipes: [(base.binder_pct || [])[0] ?? 0],
    };
    if (categorie === "RPG") {
      return {
        ...commun,
        aggregate_fraction_pct: rpgCw.aggregate_fraction_pct,
        aggregate_specific_gravity: rpgCw.aggregate_sg,
      };
    }
    return commun;
  }

  async function tracer() {
    setError(null);
    if (!general.container_type) {
      setError("Choisissez d'abord un type de contenant dans Informations : il est nécessaire au calcul des volumes.");
      return;
    }
    if (!(base.residue_sg > 0) || !(base.solid_mass_pct > 0) || !(base.saturation_pct > 0)) {
      setError(`Renseignez d'abord une recette dans Calculs → ${categorie} (méthode Cw%) : Gs du résidu, Cw% et Sr (> 0).`);
      return;
    }
    if (categorie === "RPG" && !(rpgCw.aggregate_sg > 0)) {
      setError("Renseignez le Gs de l'agrégat dans Calculs → RPG (Cw%).");
      return;
    }
    if (!(xMax > xMin)) {
      setError("La borne « à » doit être supérieure à la borne « de ».");
      return;
    }
    try {
      setLoading(true);
      const body = {
        category: categorie,
        [categorie === "RPC" ? "base_inputs_rpc" : "base_inputs_rpg"]: construireBase(),
        param,
        x_min: xMin,
        x_max: xMax,
        steps,
      };
      const r = await fetch(`${API}/analyse/balayage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(messageErreurApi(data, r.status));
      setRes(data as Balayage);
    } catch (e) {
      setError(e instanceof TypeError ? messageErreurReseau() : e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const paramsDispo = paramsPour(categorie);
  const sortiesDispo = sortiesPour(categorie);
  const xLabel = paramMeta(param)?.label ?? param;

  const traces: SerieTrace[] = useMemo(() => {
    if (!res) return [];
    return sorties
      .map((cle) => {
        const m = sortieMeta(cle);
        const v = res.series[cle];
        return m && v ? { cle, label: m.label, couleur: m.couleur, unite: m.unite, valeurs: v } : null;
      })
      .filter((s): s is SerieTrace => s !== null);
  }, [res, sorties]);

  const bwAffiche = (base.binder_pct || [])[0];
  // Aucun point calculable (ex. recette de base incomplète) : la réponse est
  // arrivée mais toutes les séries sont nulles -> message au lieu d'un graphe muet.
  const toutNul =
    traces.length > 0 &&
    traces.every((t) => t.valeurs.every((v) => v === null || !Number.isFinite(v)));

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Analyse — courbes de réponse</h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.55 }}>
            Fait varier UN paramètre de ta recette et trace la réponse des grandeurs calculées.
            Chaque point est une vraie résolution du solveur (mêmes formules que Calculs).
            La recette de base est reprise de <strong>Calculs → {categorie} (Cw%)</strong>.
          </p>
        </div>

        {/* ── Recette de base (reprise) ── */}
        <Carte titre="Recette de base (reprise de Calculs)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 13, color: "#374151" }}>
            <span>Gs résidu : <strong>{fmt(base.residue_sg, 3)}</strong></span>
            <span>w₀ : <strong>{fmt(base.residue_w_pct, 1)} %</strong></span>
            <span>Cw : <strong>{fmt(base.solid_mass_pct, 1)} %</strong></span>
            <span>Sr : <strong>{fmt(base.saturation_pct, 0)} %</strong></span>
            <span>Bw (recette 1) : <strong>{fmt(bwAffiche, 2)} %</strong></span>
            {categorie === "RPG" && <span>Am : <strong>{fmt(rpgCw.aggregate_fraction_pct, 1)} %</strong></span>}
            <Link href="/mix" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>Modifier dans Calculs</Link>
          </div>
        </Carte>

        {/* ── Contrôles ── */}
        <Carte titre="Paramètres de la courbe">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Catégorie */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["RPC", "RPG"] as const).map((c) => {
                const actif = categorie === c;
                return (
                  <button key={c} type="button" onClick={() => changerCategorie(c)}
                    style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      border: `1.5px solid ${actif ? "#2563eb" : "#e2e8f0"}`, background: actif ? "#2563eb" : "#fff", color: actif ? "#fff" : "#374151" }}>
                    {c}
                  </button>
                );
              })}
            </div>

            {/* Paramètre X + plage */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px 14px", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Paramètre à faire varier (X)</label>
                <select style={inputStyle} value={param} onChange={(e) => changerParam(e.target.value)}>
                  {paramsDispo.map((p) => <option key={p.cle} value={p.cle}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>De</label>
                <input type="number" step="any" style={inputStyle} value={xMin} onChange={(e) => setXMin(num(e.target.value))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>À</label>
                <input type="number" step="any" style={inputStyle} value={xMax} onChange={(e) => setXMax(num(e.target.value))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Points</label>
                <input type="number" min={2} max={200} style={inputStyle} value={steps} onChange={(e) => setSteps(Math.max(2, Math.min(200, Math.round(num(e.target.value)) || 2)))} />
              </div>
            </div>

            {/* Grandeurs Y */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Grandeurs à tracer (Y)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sortiesDispo.map((s) => {
                  const actif = sorties.includes(s.cle);
                  return (
                    <button key={s.cle} type="button" onClick={() => basculerSortie(s.cle)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1.5px solid ${actif ? s.couleur : "#e2e8f0"}`, background: actif ? `${s.couleur}12` : "#fff", color: actif ? "#0f172a" : "#64748b" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: actif ? s.couleur : "#cbd5e1" }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button type="button" onClick={tracer} disabled={loading} className="btn-primary">
                {loading ? "Calcul en cours…" : "Tracer la courbe"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={normaliser} onChange={(e) => setNormaliser(e.target.checked)} />
                Normaliser (comparer des grandeurs d&apos;échelles différentes ; valeurs réelles au survol)
              </label>
            </div>
          </div>
        </Carte>

        <ErrorBox message={error} />

        {/* ── Graphe ── */}
        {res && (
          <Carte titre="Courbe de réponse">
            {traces.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 6 }}>
                {traces.map((t) => (
                  <span key={t.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                    <span style={{ width: 14, height: 3, background: t.couleur, borderRadius: 2 }} />
                    {t.label}{t.unite !== "—" ? ` (${t.unite})` : ""}
                  </span>
                ))}
              </div>
            )}
            {toutNul ? (
              <div style={{ padding: "28px 8px", textAlign: "center", color: "#b45309", fontSize: 13, lineHeight: 1.55 }}>
                Aucun point n&apos;a pu être calculé sur cette plage. Vérifie la recette de base
                (type de contenant dans Informations, Sr, Gs…) et la plage choisie.
              </div>
            ) : (
              <CourbeSvg x={res.x} xLabel={xLabel} series={traces} normaliser={normaliser} />
            )}
          </Carte>
        )}
      </div>
    </div>
  );
}
