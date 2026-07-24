"use client";

// Onglet « Analyse » — deux modes :
//  • Courbes de réponse (balayage d'un paramètre, endpoint /analyse/balayage) ;
//  • Composition (barres de phases + ternaire + échantillon d'une recette
//    calculée via /rpc/cw ou /rpg/cw).
// Les deux REPRENNENT la recette Cw% déjà saisie dans Calculs. Aucun calcul
// n'est réimplémenté côté client.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import ErrorBox from "@/components/ErrorBox";
import CourbeSvg, { type SerieTrace } from "@/components/analyse/CourbeSvg";
import CompositionVue from "@/components/analyse/CompositionVue";
import { indexProche, ecartPct, statsSerie } from "@/lib/courbe-analyse";
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

type Mode = "courbes" | "composition";
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

function fmtStat(v: number, unite: string): string {
  const d = unite === "kg/m³" ? 1 : unite === "%" ? 2 : 4;
  const s = v.toLocaleString("fr-CA", { maximumFractionDigits: d });
  return unite === "—" ? s : `${s} ${unite}`;
}

export default function AnalysePage() {
  const { API, general, constantes, catalogue_liants, cw, rpgCw } = useStore();

  const [mode, setMode] = useState<Mode>("courbes");
  const [categorie, setCategorie] = useState<CategorieAnalyse>("RPG");

  // Courbes
  const [param, setParam] = useState("binder_mass_pct");
  const [xMin, setXMin] = useState(1);
  const [xMax, setXMax] = useState(10);
  const [steps, setSteps] = useState(40);
  const [sorties, setSorties] = useState<string[]>(DEFAUT_SORTIES);
  const [modeCourbe, setModeCourbe] = useState<"absolu" | "ecart">("absolu");
  const [res, setRes] = useState<Balayage | null>(null);
  const [resProtocole, setResProtocole] = useState<string>("");

  // Composition
  const [recettes, setRecettes] = useState<Recipe[] | null>(null);

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
    const valides = new Set(sortiesPour(c).map((s) => s.cle));
    setSorties((prev) => {
      const gardees = prev.filter((k) => valides.has(k));
      return gardees.length ? gardees : DEFAUT_SORTIES.filter((k) => valides.has(k));
    });
    setRes(null);
    setRecettes(null);
    setError(null);
  };

  const changerParam = (cle: string) => {
    setParam(cle);
    const m = paramMeta(cle);
    if (m) { setXMin(m.defautMin); setXMax(m.defautMax); }
    setRes(null);
  };

  const basculerSortie = (cle: string) =>
    setSorties((prev) => (prev.includes(cle) ? prev.filter((k) => k !== cle) : [...prev, cle]));

  /** Contrôle de la recette de base ; renvoie un message d'erreur ou null. */
  function verifierBase(): string | null {
    if (!general.container_type)
      return "Choisis d'abord un type de contenant dans Informations : il est nécessaire au calcul des volumes.";
    if (!(base.residue_sg > 0) || !(base.solid_mass_pct > 0) || !(base.saturation_pct > 0))
      return `Renseigne d'abord une recette dans Calculs → ${categorie} (méthode Cw%) : Gs du résidu, Cw% et Sr (> 0).`;
    if (categorie === "RPG" && !(rpgCw.aggregate_sg > 0))
      return "Renseigne le Gs de l'agrégat dans Calculs → RPG (Cw%).";
    return null;
  }

  function payloadCommun(nbRecettes: number) {
    const commun = {
      category: categorie,
      general: construireGeneralPayload(general),
      constants: construireConstantesPayload(constantes),
      residue: { specific_gravity: base.residue_sg || 0, moisture_mass_pct: base.residue_w_pct || 0 },
      binder_system: construireSystemeLiant(general, catalogue_liants),
      num_recipes: nbRecettes,
      containers_per_recipe: base.desired_qty || 1,
      safety_factor: base.safety_factor || 1,
      solids_mass_pct: base.solid_mass_pct,
      saturation_pct: base.saturation_pct,
      binder_mass_pct_recipes:
        nbRecettes === 1
          ? [(base.binder_pct || [])[0] ?? 0]
          : (base.binder_pct || []).slice(0, nbRecettes),
    };
    if (categorie === "RPG") {
      return { ...commun, aggregate_fraction_pct: rpgCw.aggregate_fraction_pct, aggregate_specific_gravity: rpgCw.aggregate_sg };
    }
    return commun;
  }

  async function tracer() {
    const err = verifierBase();
    if (err) { setError(err); return; }
    if (!(xMax > xMin)) { setError("La borne « à » doit être supérieure à la borne « de »."); return; }
    setError(null);
    try {
      setLoading(true);
      const body = {
        category: categorie,
        [categorie === "RPC" ? "base_inputs_rpc" : "base_inputs_rpg"]: payloadCommun(1),
        param, x_min: xMin, x_max: xMax, steps,
      };
      const r = await fetch(`${API}/analyse/balayage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(messageErreurApi(data, r.status));
      setRes(data as Balayage);
      setResProtocole(JSON.stringify({ categorie, param, xMin, xMax, steps }));
    } catch (e) {
      setError(e instanceof TypeError ? messageErreurReseau() : e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function calculerComposition() {
    const err = verifierBase();
    if (err) { setError(err); return; }
    setError(null);
    try {
      setLoading(true);
      const endpoint = categorie === "RPC" ? "/rpc/cw" : "/rpg/cw";
      const r = await fetch(`${API}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadCommun(base.num_recipes || 1)),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(messageErreurApi(data, r.status));
      setRecettes(Array.isArray(data?.recipes) ? (data.recipes as Recipe[]).filter(Boolean) : []);
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

  const toutNul =
    traces.length > 0 &&
    traces.every((t) => t.valeurs.every((v) => v === null || !Number.isFinite(v)));
  const bwAffiche = (base.binder_pct || [])[0];

  // « Périmé » : la courbe affichée a été calculée avec d'autres paramètres.
  const protocoleActuel = JSON.stringify({ categorie, param, xMin, xMax, steps });
  const perime = res !== null && resProtocole !== protocoleActuel;

  // Valeur du paramètre balayé POUR la recette de base = point de référence.
  const referenceX: number | null =
    param === "binder_mass_pct" ? ((base.binder_pct || [])[0] ?? null)
    : param === "solids_mass_pct" ? (base.solid_mass_pct ?? null)
    : param === "saturation_pct" ? (base.saturation_pct ?? null)
    : param === "aggregate_fraction_pct" ? (rpgCw.aggregate_fraction_pct ?? null)
    : null;
  const paramCourt = xLabel.split(" — ")[0];
  // La référence n'ancre l'écart % que si elle est DANS la plage balayée ;
  // sinon on ancre sur le 1er point et on le dit clairement (pas de fausse
  // référence silencieuse).
  const refDansPlage =
    res !== null && referenceX !== null &&
    referenceX >= Math.min(...res.x) && referenceX <= Math.max(...res.x);
  const iRef = refDansPlage ? indexProche(res!.x, referenceX!) : 0;
  const tracesEcart: SerieTrace[] = traces.map((t) => ({
    ...t, unite: "%", valeurs: ecartPct(t.valeurs, iRef),
  }));
  const ecartToutNul =
    tracesEcart.length > 0 &&
    tracesEcart.every((t) => t.valeurs.every((v) => v === null || !Number.isFinite(v)));

  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Analyse</h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.55 }}>
            Visualise ta recette : <strong>courbes de réponse</strong> (fais varier un paramètre)
            ou <strong>composition</strong> (phases du mélange). Tout repart du solveur — mêmes
            formules que Calculs.
          </p>
        </div>

        {/* ── Mode ── */}
        <div style={{ display: "flex", gap: 8 }}>
          {([["courbes", "Courbes de réponse"], ["composition", "Composition"]] as const).map(([m, label]) => {
            const actif = mode === m;
            return (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
                style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                  border: `1.5px solid ${actif ? "#16a34a" : "#e2e8f0"}`, background: actif ? "#16a34a" : "#fff", color: actif ? "#fff" : "#374151" }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Recette de base (catégorie + valeurs reprises) ── */}
        <Carte titre="Recette de base (reprise de Calculs)">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["RPC", "RPG"] as const).map((c) => {
              const actif = categorie === c;
              return (
                <button key={c} type="button" onClick={() => changerCategorie(c)}
                  style={{ padding: "6px 15px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: `1.5px solid ${actif ? "#2563eb" : "#e2e8f0"}`, background: actif ? "#2563eb" : "#fff", color: actif ? "#fff" : "#374151" }}>
                  {c}
                </button>
              );
            })}
          </div>
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

        {mode === "courbes" ? (
          <>
            <Carte titre="Paramètres de la courbe">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px 14px", alignItems: "end" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
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

                <button type="button" onClick={tracer} disabled={loading} className="btn-primary" style={{ alignSelf: "flex-start" }}>
                  {loading ? "Calcul en cours…" : "Tracer la courbe"}
                </button>
              </div>
            </Carte>

            {res && (
              <Carte titre="Courbe de réponse">
                {perime && (
                  <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 7, background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 12.5 }}>
                    Paramètres modifiés — relance « Tracer la courbe » pour mettre à jour cette courbe.
                  </div>
                )}
                {toutNul ? (
                  <div style={{ padding: "28px 8px", textAlign: "center", color: "#b45309", fontSize: 13, lineHeight: 1.55 }}>
                    Aucun point n&apos;a pu être calculé sur cette plage. Vérifie la recette de base
                    (type de contenant dans Informations, Sr, Gs…) et la plage choisie.
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([["absolu", "Valeurs"], ["ecart", "Écart % vs référence"]] as const).map(([m, label]) => {
                          const actif = modeCourbe === m;
                          return (
                            <button key={m} type="button" onClick={() => setModeCourbe(m)}
                              style={{ padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: `1.5px solid ${actif ? "#2563eb" : "#e2e8f0"}`, background: actif ? "#2563eb" : "#fff", color: actif ? "#fff" : "#64748b" }}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {referenceX !== null && (
                        refDansPlage ? (
                          <span style={{ fontSize: 11.5, color: "#b45309" }}>Référence (trait orange) : {paramCourt} = {fmt(referenceX, 2)}</span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Référence ({paramCourt} = {fmt(referenceX, 2)}) hors de la plage balayée</span>
                        )
                      )}
                    </div>

                    {modeCourbe === "absolu" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                        {traces.map((t) => {
                          const s = statsSerie(res.x, t.valeurs);
                          return (
                            <div key={t.cle} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.couleur, marginBottom: 2 }}>
                                {t.label}{t.unite !== "—" ? ` (${t.unite})` : ""}
                              </div>
                              <CourbeSvg x={res.x} xLabel={xLabel} series={[t]} reference={refDansPlage ? referenceX! : undefined} hauteur={300} />
                              {s && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  <span>min {fmtStat(s.min, t.unite)}</span>
                                  <span>max {fmtStat(s.max, t.unite)}</span>
                                  <span>Δ {fmtStat(s.variation, t.unite)}</span>
                                  <span>pente {fmtStat(s.pente, t.unite)}/{paramCourt}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : ecartToutNul ? (
                      <div style={{ padding: "24px 8px", textAlign: "center", color: "#b45309", fontSize: 13, lineHeight: 1.55 }}>
                        L&apos;écart % n&apos;est pas calculable ici : la valeur de référence est nulle pour les grandeurs sélectionnées.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 6 }}>
                          {traces.map((t) => (
                            <span key={t.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                              <span style={{ width: 14, height: 3, background: t.couleur, borderRadius: 2 }} />
                              {t.label}
                            </span>
                          ))}
                        </div>
                        <CourbeSvg x={res.x} xLabel={xLabel} series={tracesEcart} reference={refDansPlage ? referenceX! : undefined} />
                        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>
                          {refDansPlage
                            ? "Écart relatif (%) de chaque grandeur par rapport à sa valeur à la recette de référence (trait orange)."
                            : `Écart relatif (%) par rapport au 1er point balayé (${paramCourt} = ${fmt(res.x[0], 2)}) — la recette de référence est hors de la plage.`}
                          {" "}Une grandeur quasi constante reste plate — contrairement à une normalisation min-max.
                        </p>
                      </>
                    )}
                  </>
                )}
              </Carte>
            )}
          </>
        ) : (
          <>
            <Carte titre="Composition du mélange">
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button type="button" onClick={calculerComposition} disabled={loading} className="btn-primary">
                  {loading ? "Calcul en cours…" : "Calculer la composition"}
                </button>
                <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
                  Calcule les {base.num_recipes || 1} recette{(base.num_recipes || 1) > 1 ? "s" : ""} et affiche leurs phases.
                </span>
              </div>
            </Carte>

            {recettes && recettes.length > 0 && <CompositionVue recipes={recettes} />}
            {recettes && recettes.length === 0 && (
              <Carte titre="Composition du mélange">
                <div style={{ padding: "12px 4px", color: "#b45309", fontSize: 13 }}>
                  Aucune recette calculable. Vérifie la recette de base (type de contenant, Gs, Cw, Sr).
                </div>
              </Carte>
            )}
          </>
        )}

        <ErrorBox message={error} />
      </div>
    </div>
  );
}
