"use client";

// Onglet « Labo » — gâchées RÉELLES. Chaque gâchée part d'une formulation
// sauvegardée (Calculs → Sauvegarder) et enregistre ce qui a vraiment été fait :
// masses cibles vs pesées (écart kg/%), lots, humidité mesurée, mesures fraîches
// (slump, température, w, Cw — persistées) et ajustements de l'essai-erreur.
// Auto-sauvegarde : chaque saisie est persistée immédiatement (localStorage).

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/use-hydrated";
import { num, fmt } from "@/lib/format";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import {
  ecart, nbHorsTolerance, genererCode, composantsDepuisRecette,
  type Gachee, type Ajustement,
} from "@/lib/gachee";

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 11px",
  background: "#fff", fontSize: 14, outline: "none",
};

function Carte({ titre, extra, children }: { titre: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>{titre}</span>
        {extra}
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function Champ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

function nouvelId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export default function LaboPage() {
  const monte = useHydrated();
  const { gachees, ajouterGachee, modifierGachee, supprimerGachee, savedResults } = useStore();
  const [selId, setSelId] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [formId, setFormId] = useState<string>("");
  const [recIndex, setRecIndex] = useState(0);

  const formulations = savedResults.filter((s) => (s.recipes?.length ?? 0) > 0);
  const selection = gachees.find((g) => g.id === selId) ?? null;

  function creer() {
    const form = formulations.find((s) => s.id === formId) ?? formulations[0];
    if (!form) return;
    const recette = form.recipes[Math.min(recIndex, form.recipes.length - 1)];
    if (!recette) return;
    const g: Gachee = {
      id: nouvelId(),
      code: genererCode(gachees, new Date()),
      creeLe: new Date().toISOString(),
      statut: "brouillon",
      formulationLabel: form.label,
      formulationId: form.id,
      categorie: form.category,
      recetteIndex: Math.min(recIndex, form.recipes.length - 1),
      solverVersion: form.solverVersion,
      composants: composantsDepuisRecette(recette, (i) => `Ciment ${i}`),
      tolerancePct: 2,
      ajustements: [],
    };
    ajouterGachee(g);
    setNouvelle(false);
    setSelId(g.id);
  }

  if (!monte) return null;

  // ── Éditeur d'une gâchée ──
  if (selection) {
    const g = selection;
    const maj = (patch: Partial<Gachee>) => modifierGachee(g.id, patch);
    const majComposant = (cle: string, peseeKg: number | undefined) =>
      maj({ composants: g.composants.map((c) => (c.cle === cle ? { ...c, peseeKg } : c)) });
    const ajouterAjustement = () =>
      maj({ ajustements: [...g.ajustements, { id: nouvelId(), type: "eau", masseKg: 0 }] });
    const majAjustement = (id: string, patch: Partial<Ajustement>) =>
      maj({ ajustements: g.ajustements.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
    const retirerAjustement = (id: string) =>
      maj({ ajustements: g.ajustements.filter((a) => a.id !== id) });

    return (
      <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 18px 64px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setSelId(null)} className="btn-secondary">← Toutes les gâchées</button>
            <div style={{ display: "flex", gap: 8 }}>
              {(["brouillon", "terminee"] as const).map((st) => {
                const actif = g.statut === st;
                return (
                  <button key={st} type="button" onClick={() => maj({ statut: st })}
                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      border: `1.5px solid ${actif ? "#16a34a" : "#e2e8f0"}`, background: actif ? "#16a34a" : "#fff", color: actif ? "#fff" : "#374151" }}>
                    {st === "brouillon" ? "Brouillon" : "Terminée"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Gâchée {g.code}</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              Formulation : <strong>{g.formulationLabel}</strong> · {g.categorie}
              {g.solverVersion ? ` · solveur ${g.solverVersion}` : ""}
            </p>
          </div>

          {/* Pesées cibles vs réelles */}
          <Carte titre="Pesées : cible vs réelle" extra={
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
              Tolérance ±
              <input type="number" step="any" style={{ ...inputStyle, width: 64, padding: "4px 8px" }}
                value={g.tolerancePct} onChange={(e) => maj({ tolerancePct: num(e.target.value) })} /> %
            </span>
          }>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 8, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                <span>Composant</span><span>Cible (kg)</span><span>Pesée (kg)</span><span>Écart</span>
              </div>
              {g.composants.map((c) => {
                const e = ecart(c);
                const hors = e !== null && Math.abs(e.pct) > g.tolerancePct;
                return (
                  <div key={c.cle} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{c.label}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{fmt(c.cibleKg, 1)}</span>
                    <input type="number" step="any" style={inputStyle} placeholder="—"
                      value={c.peseeKg ?? ""} onChange={(ev) => majComposant(c.cle, ev.target.value === "" ? undefined : num(ev.target.value))} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: e === null ? "#cbd5e1" : hors ? "#dc2626" : "#16a34a" }}>
                      {e === null ? "—" : `${e.kg >= 0 ? "+" : ""}${fmt(e.kg, 1)} kg (${e.pct >= 0 ? "+" : ""}${fmt(e.pct, 1)} %)`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Carte>

          {/* Lots + humidité */}
          <Carte titre="Matériaux utilisés">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <Champ label="Lot de résidu"><input style={inputStyle} value={g.lotResidu ?? ""} onChange={(e) => maj({ lotResidu: e.target.value })} /></Champ>
              <Champ label="Lot de granulat"><input style={inputStyle} value={g.lotGranulat ?? ""} onChange={(e) => maj({ lotGranulat: e.target.value })} /></Champ>
              <Champ label="Lot de liant"><input style={inputStyle} value={g.lotLiant ?? ""} onChange={(e) => maj({ lotLiant: e.target.value })} /></Champ>
              <Champ label="Humidité mesurée du résidu w₀ (%)" hint="Mesure du jour (peut différer de la valeur de la recette)">
                <input type="number" step="any" style={inputStyle} placeholder="—"
                  value={g.w0MesurePct ?? ""} onChange={(e) => maj({ w0MesurePct: e.target.value === "" ? undefined : num(e.target.value) })} />
              </Champ>
            </div>
          </Carte>

          {/* Mesures fraîches */}
          <Carte titre="Mesures sur pâte fraîche">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              <Champ label="Slump mesuré (mm)"><input type="number" step="any" style={inputStyle} value={g.slumpMesureMm ?? ""} onChange={(e) => maj({ slumpMesureMm: e.target.value === "" ? undefined : num(e.target.value) })} /></Champ>
              <Champ label="Température (°C)"><input type="number" step="any" style={inputStyle} value={g.temperatureC ?? ""} onChange={(e) => maj({ temperatureC: e.target.value === "" ? undefined : num(e.target.value) })} /></Champ>
              <Champ label="w mesuré (%)"><input type="number" step="any" style={inputStyle} value={g.wMesurePct ?? ""} onChange={(e) => maj({ wMesurePct: e.target.value === "" ? undefined : num(e.target.value) })} /></Champ>
              <Champ label="Cw mesuré (%)"><input type="number" step="any" style={inputStyle} value={g.cwMesurePct ?? ""} onChange={(e) => maj({ cwMesurePct: e.target.value === "" ? undefined : num(e.target.value) })} /></Champ>
            </div>
          </Carte>

          {/* Ajustements essai-erreur */}
          <Carte titre="Ajustements (essai-erreur)" extra={
            <button type="button" onClick={ajouterAjustement} className="btn-secondary" style={{ fontSize: 12 }}>+ Ajouter</button>
          }>
            {g.ajustements.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Aucun ajustement. Ajoute ce que tu as versé après le premier malaxage (eau, résidu, granulat, liant).</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {g.ajustements.map((a) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 8, alignItems: "center" }}>
                    <select style={inputStyle} value={a.type} onChange={(e) => majAjustement(a.id, { type: e.target.value as Ajustement["type"] })}>
                      <option value="eau">Eau</option><option value="residu">Résidu</option>
                      <option value="granulat">Granulat</option><option value="liant">Liant</option>
                    </select>
                    <input type="number" step="any" style={inputStyle} placeholder="kg" value={a.masseKg || ""} onChange={(e) => majAjustement(a.id, { masseKg: num(e.target.value) })} />
                    <input style={inputStyle} placeholder="Note (optionnel)" value={a.note ?? ""} onChange={(e) => majAjustement(a.id, { note: e.target.value })} />
                    <button type="button" onClick={() => retirerAjustement(a.id)} className="btn-secondary" style={{ fontSize: 12 }}>Retirer</button>
                  </div>
                ))}
              </div>
            )}
          </Carte>

          <Carte titre="Observations">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Remarques sur la gâchée, la consistance, les incidents…"
              value={g.observations ?? ""} onChange={(e) => maj({ observations: e.target.value })} />
          </Carte>

          <div>
            <button type="button" onClick={() => { if (window.confirm(`Supprimer la gâchée ${g.code} ?`)) { supprimerGachee(g.id); setSelId(null); } }}
              className="btn-secondary" style={{ color: "var(--danger)" }}>Supprimer cette gâchée</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Liste des gâchées ──
  return (
    <div style={{ background: "var(--background)", flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 18px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Laboratoire — gâchées</h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: 13.5, lineHeight: 1.5 }}>
              Enregistre ce que tu as VRAIMENT préparé : pesées réelles, lots, mesures. Une gâchée
              part d&apos;une formulation sauvegardée dans Calculs.
            </p>
          </div>
          <button type="button" onClick={() => setNouvelle((v) => !v)} className="btn-primary">Nouvelle gâchée</button>
        </div>

        {nouvelle && (
          <Carte titre="Nouvelle gâchée">
            {formulations.length === 0 ? (
              <p style={{ fontSize: 13, color: "#b45309" }}>
                Aucune formulation sauvegardée. Va dans <strong>Calculs</strong>, lance un calcul RPC/RPG, puis clique
                <strong> « Sauvegarder »</strong> dans le panneau de résultats. Reviens ensuite ici.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Champ label="Formulation">
                  <select style={inputStyle} value={formId || formulations[0].id} onChange={(e) => { setFormId(e.target.value); setRecIndex(0); }}>
                    {formulations.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.category}</option>)}
                  </select>
                </Champ>
                {(() => {
                  const form = formulations.find((s) => s.id === (formId || formulations[0].id))!;
                  return form.recipes.length > 1 ? (
                    <Champ label="Recette">
                      <select style={inputStyle} value={recIndex} onChange={(e) => setRecIndex(Number(e.target.value))}>
                        {form.recipes.map((_, i) => <option key={i} value={i}>Recette {i + 1}</option>)}
                      </select>
                    </Champ>
                  ) : null;
                })()}
                <button type="button" onClick={creer} className="btn-primary" style={{ alignSelf: "flex-start" }}>Créer la gâchée</button>
              </div>
            )}
          </Carte>
        )}

        {gachees.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "#94a3b8", textAlign: "center", padding: "24px 0" }}>Aucune gâchée pour l&apos;instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gachees.map((g, i) => {
              const hors = nbHorsTolerance(g);
              return (
                <button key={g.id} type="button" onClick={() => setSelId(g.id)}
                  style={{ textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${RECIPE_COLORS[i % 4] ?? "#2563eb"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>{g.code}</div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                      {g.formulationLabel} · {g.categorie} · {new Date(g.creeLe).toLocaleDateString("fr-CA")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {hors > 0 && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 999, padding: "3px 9px" }}>
                        {hors} écart{hors > 1 ? "s" : ""} hors tolérance
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: g.statut === "terminee" ? "var(--success)" : "#d97706", background: g.statut === "terminee" ? "#f0fdf4" : "#fffbeb", border: `1px solid ${g.statut === "terminee" ? "#bbf7d0" : "#fcd34d"}`, borderRadius: 999, padding: "3px 9px" }}>
                      {g.statut === "terminee" ? "Terminée" : "Brouillon"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
