"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore, SOLVER_VERSION, type SavedResult, type RpcMethod } from "@/lib/store";
import { fromStoreMass, MASS_LABELS } from "@/lib/units";
import type { Recipe } from "@/lib/types";
import BackupButtons from "@/components/BackupButtons";

import { methodLabel } from "@/lib/method-registry";

/** Nombre de recettes, RPC/RPG comme RRC (dont les recettes vivent dans `rrc`). */
const nbRecettes = (sr: SavedResult) =>
  sr.category === "RRC" ? sr.rrc?.result.recipes.length ?? 0 : sr.recipes.length;

const fmt = (v: number | undefined | null, digits = 3) => {
  if (v === undefined || v === null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(digits);
};

export default function HistoriquePage() {
  const router = useRouter();
  const { savedResults, loadSavedResults, deleteSavedResult, restoreSavedResult, units, loadUnits } = useStore();

  const binderNameFor = (sr: SavedResult) => (n: 1 | 2 | 3): string =>
    ((sr.general as Record<string, unknown>)[`binder${n}_type`] as string) || `Ciment ${n}`;

  const recharger = (sr: SavedResult) => {
    if (restoreSavedResult(sr.id)) router.push("/mix");
  };
  // Avertit avant d'exporter un resultat calcule avec d'anciennes formules
  // (masses potentiellement incorrectes, cf. correctif (1+Bv)).
  const confirmerExportObsolete = (sr: SavedResult): boolean => {
    // Un solverVersion absent = sauvegarde antérieure à l'estampillage (les
    // plus anciennes, donc les plus suspectes) : on avertit aussi, comme le
    // badge « anciennes formules » plus bas.
    if (sr.solverVersion !== SOLVER_VERSION) {
      return window.confirm(
        "Ce résultat a été calculé avec une version antérieure des formules ; " +
        "ses masses peuvent être incorrectes. Exporter quand même ?",
      );
    }
    return true;
  };
  const exporterExcel = async (sr: SavedResult) => {
    if (!confirmerExportObsolete(sr)) return;
    if (sr.category === "RRC") {
      if (!sr.rrc) return;
      const { exportRrcExcel } = await import("@/lib/rrc-export");
      exportRrcExcel(sr.rrc.result.recipes, sr.general, units);
      return;
    }
    const { exportToExcel } = await import("@/components/mix/ResultsPanel");
    exportToExcel(sr.recipes, sr.general, binderNameFor(sr), sr.category, sr.method as RpcMethod, units);
  };
  const exporterPdf = async (sr: SavedResult) => {
    if (!confirmerExportObsolete(sr)) return;
    if (sr.category === "RRC") {
      if (!sr.rrc) return;
      const { exportRrcPdf } = await import("@/lib/rrc-export");
      exportRrcPdf(sr.rrc.result.recipes, sr.general, units);
      return;
    }
    const { exportToPdf } = await import("@/lib/pdf-report");
    exportToPdf(sr.recipes, sr.general, binderNameFor(sr), sr.category, sr.method as RpcMethod, units);
  };
  const exporterFeuilleLabo = async (sr: SavedResult) => {
    if (!confirmerExportObsolete(sr)) return;
    if (sr.category === "RRC") {
      if (!sr.rrc) return;
      const { exportRrcPdf } = await import("@/lib/rrc-export");
      exportRrcPdf(sr.rrc.result.recipes, sr.general, units);
      return;
    }
    const { exportPreparationPdf } = await import("@/lib/preparation-sheet");
    exportPreparationPdf(sr.recipes, sr.general, binderNameFor(sr), sr.category, sr.method as RpcMethod, units);
  };
  const massLabel = MASS_LABELS[units?.mass as keyof typeof MASS_LABELS] ?? "kg";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedResults();
    loadUnits();
  }, [loadSavedResults, loadUnits]);

  const handleDelete = (id: string) => {
    deleteSavedResult(id);
    setConfirmDeleteId(null);
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--background)" }}>
      {/* ── Hero banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--navy) 0%, #1a3a8a 100%)",
          padding: "24px 0 20px",
          borderBottom: "3px solid var(--primary)",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Historique des sauvegardes
              </div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Résultats sauvegardés
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)", marginTop: 4, fontSize: 13 }}>
                {savedResults.length} sauvegarde{savedResults.length !== 1 ? "s" : ""} en mémoire locale
                — pensez à exporter vos données (navigateur uniquement)
              </p>
              <div style={{ marginTop: 10 }}>
                <BackupButtons />
              </div>
            </div>
            <Link
              href="/mix"
              style={{
                padding: "8px 16px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.25)",
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.8)",
                textDecoration: "none",
                background: "rgba(255,255,255,0.08)",
                whiteSpace: "nowrap",
              }}
            >
              Retour aux calculs
            </Link>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 24px 64px" }}>
        {savedResults.length === 0 ? (
          <div
            className="info-card"
            style={{
              textAlign: "center",
              padding: "48px 24px",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px" }} aria-hidden="true">
              <rect x="8" y="6" width="32" height="36" rx="4" stroke="#cbd5e1" strokeWidth="2.5" fill="none"/>
              <path d="M16 16h16M16 22h12M16 28h8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
              Aucune sauvegarde
            </p>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 340, margin: "0 auto" }}>
              Après avoir effectué un calcul, cliquez sur le bouton
              {" "}<strong>Sauvegarder</strong> dans le panneau de résultats pour enregistrer vos résultats ici.
            </p>
          </div>
        ) : (
          <div className="historique-table">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* ── Table header ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 100px 80px 100px 160px 120px",
                gap: 8,
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                borderBottom: "2px solid var(--border)",
              }}
            >
              <span>Nom</span>
              <span>Catégorie</span>
              <span>Méthode</span>
              <span>Recettes</span>
              <span>Date</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>

            {/* ── Rows ── */}
            {savedResults.map((sr: SavedResult) => {
              const isExpanded = expandedId === sr.id;
              const date = new Date(sr.savedAt);
              const dateStr = date.toLocaleDateString("fr-CA");
              const timeStr = date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={sr.id}>
                  {/* Main row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 100px 80px 100px 160px 120px",
                      gap: 8,
                      padding: "12px 16px",
                      background: isExpanded ? "#f8fafc" : "#fff",
                      border: `1px solid ${isExpanded ? "#cbd5e1" : "#e2e8f0"}`,
                      borderRadius: isExpanded ? "8px 8px 0 0" : 8,
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : sr.id)}
                    onMouseEnter={(e) => {
                      if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#fff";
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sr.label}</span>
                      {sr.solverVersion !== SOLVER_VERSION && (
                        <span
                          title="Résultat calculé avec une version antérieure des formules (avant l'alignement sur la feuille Intra 2017). Rechargez et relancez le calcul pour des valeurs à jour."
                          style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          anciennes formules
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#374151",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 4,
                        padding: "2px 8px",
                        textAlign: "center",
                      }}
                    >
                      {sr.category}
                    </span>
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {methodLabel(sr.category, sr.method)}
                    </span>
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {nbRecettes(sr)} recette{nbRecettes(sr) > 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {dateStr} {timeStr}
                    </span>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : sr.id); }}
                        style={{
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: "1px solid #e2e8f0",
                          borderRadius: 5,
                          background: "#f8fafc",
                          color: "#374151",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Reduire" : "Voir"}
                      </button>
                      {confirmDeleteId === sr.id ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(sr.id); }}
                          style={{
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            border: "1px solid #fecaca",
                            borderRadius: 5,
                            background: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                        >
                          Confirmer
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(sr.id); }}
                          style={{
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 500,
                            border: "1px solid var(--border)",
                            borderRadius: 5,
                            background: "#fff",
                            color: "var(--muted-foreground)",
                            cursor: "pointer",
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Expanded detail ── */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderTop: "none",
                        borderRadius: "0 0 8px 8px",
                        padding: 16,
                      }}
                    >
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ padding: "6px 14px", fontSize: 12.5 }}
                          onClick={(e) => { e.stopPropagation(); recharger(sr); }}
                          title="Recharge la catégorie, la méthode, les entrées et les résultats dans la page Calculs">
                          Recharger dans Calculs
                        </button>
                        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }}
                          onClick={(e) => { e.stopPropagation(); exporterExcel(sr); }}>
                          Excel
                        </button>
                        <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }}
                          onClick={(e) => { e.stopPropagation(); exporterPdf(sr); }}>
                          PDF
                        </button>
                        {/* RRC : la feuille labo est le même PDF (rrc-export) — un seul bouton. */}
                        {sr.category !== "RRC" && (
                          <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12.5 }}
                            onClick={(e) => { e.stopPropagation(); exporterFeuilleLabo(sr); }}>
                            Feuille labo
                          </button>
                        )}
                        {/* Les entrées RRC portent leurs entrées dans `rrc`, pas `inputs`. */}
                        {!sr.inputs && !sr.rrc && (
                          <span style={{ fontSize: 11.5, color: "#94a3b8", alignSelf: "center" }}>
                            (sauvegarde ancienne : rechargement des résultats seulement, sans les entrées)
                          </span>
                        )}
                      </div>

                      {/* General info */}
                      {(sr.general.operator_name || sr.general.project_name || sr.general.residue_id) && (
                        <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                          {sr.general.operator_name && (
                            <span style={{ fontSize: 12, color: "#374151" }}>
                              <span style={{ color: "var(--muted-foreground)" }}>Opérateur : </span>
                              {sr.general.operator_name}
                            </span>
                          )}
                          {sr.general.project_name && (
                            <span style={{ fontSize: 12, color: "#374151" }}>
                              <span style={{ color: "var(--muted-foreground)" }}>Projet : </span>
                              {sr.general.project_name}
                            </span>
                          )}
                          {sr.general.residue_id && (
                            <span style={{ fontSize: 12, color: "#374151" }}>
                              <span style={{ color: "var(--muted-foreground)" }}>Résidu : </span>
                              {sr.general.residue_id}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tableau récapitulatif RPC/RPG. Le RRC n'a pas de
                          recettes MixState : on renvoie vers Recharger/Excel. */}
                      {sr.category === "RRC" ? (
                        <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
                          Résultat RRC / CRF ({nbRecettes(sr)} recette{nbRecettes(sr) > 1 ? "s" : ""}).
                          Utilisez « Recharger dans Calculs » pour le détail complet, ou « Excel » / « Feuille labo » pour l&apos;export.
                        </p>
                      ) : (
                      <table className="result-table" style={{ background: "#fff" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b" }}>
                              Paramètre
                            </th>
                            {sr.recipes.map((_: Recipe, i: number) => (
                              <th
                                key={i}
                                style={{
                                  padding: "7px 10px",
                                  textAlign: "right",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#374151",
                                }}
                              >
                                R{i + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: "Bw%", getter: (r: Recipe) => r.bw_mass_pct, digits: 2, unit: "%" },
                            { label: "Cw%", getter: (r: Recipe) => r.solids_mass_pct, digits: 2, unit: "%" },
                            { label: "e (indice des vides)", getter: (r: Recipe) => r.void_ratio, digits: 4, unit: "" },
                            { label: "n (porosité)", getter: (r: Recipe) => r.porosity, digits: 4, unit: "" },
                            { label: "w (%)", getter: (r: Recipe) => r.w_mass_pct, digits: 2, unit: "%" },
                            { label: "E/C", getter: (r: Recipe) => r.wc_ratio, digits: 3, unit: "" },
                            { label: "Sr (%)", getter: (r: Recipe) => r.saturation_pct, digits: 1, unit: "%" },
                            { label: `Résidu sec (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.residue_dry_mass_kg, units?.mass), digits: 3, unit: massLabel },
                            { label: `Liant (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.binder_total_mass_kg, units?.mass), digits: 3, unit: massLabel },
                            { label: `Eau totale (${massLabel})`, getter: (r: Recipe) => fromStoreMass(r.components?.water_total_mass_kg, units?.mass), digits: 3, unit: massLabel },
                          ].map((row, ri) => (
                            <tr key={ri} style={{ borderTop: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "5px 10px", fontSize: 12, color: "#475569" }}>
                                {row.label}
                              </td>
                              {sr.recipes.map((r: Recipe, ci: number) => (
                                <td
                                  key={ci}
                                  style={{
                                    padding: "5px 10px",
                                    textAlign: "right",
                                    fontSize: 12,
                                    fontVariantNumeric: "tabular-nums",
                                    color: "#0f172a",
                                  }}
                                >
                                  {fmt(row.getter(r), row.digits)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
