"use client";

import React, { useEffect, useRef, useState } from "react";
import { FORMULA_MAP, type Formula } from "@/lib/formulas-data";
import { FICHE_CALCULATEUR_MAP, MENTION_HORS_COURS, type FicheCalculateur } from "@/lib/formules-calculateur";
import { gammaSolideKNM3, masseRejetSecTotaleKg, rhoSolideKgM3, volumeAirM3 } from "@/lib/derived";
import { OPTIONS_KATEX_SURES } from "@/components/formulas/KaTeXRenderer";
import { useFormules } from "@/lib/use-formules";
import type { Recipe } from "@/lib/types";
import { TIRET, fmt, fmtGroupe } from "@/lib/format";
import { placerPopover, type RectAncre, type Vue } from "@/lib/placer-popover";

/* ── Value substitution: map formula variable symbols to recipe fields ──
   Exporté pour un test d'invariant : chaque clé doit correspondre au `symbol`
   d'au moins une formule (sinon la substitution est morte, cf. bug \rho_w). */

// Grandeurs dérivées des lignes complétées le 2026-10-30 (fiches du cours et
// fiches du calculateur, formules-calculateur.ts), toutes lues dans le résultat.
const rhoW = (r: Recipe): number => {
  const rd = r.dry_density_kg_m3, e = r.void_ratio, gs = r.gs_backfill;
  return rd != null && e != null && gs ? (rd * (1 + e)) / gs : 1000;
};
const quotient = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a != null && b ? a / b : null;
const residuHumide = (r: Recipe) => r.components?.residue_wet_mass_kg ?? null;
const residuSec = (r: Recipe) => r.components?.residue_dry_mass_kg ?? null;
const eauDuResidu = (r: Recipe): number | null => {
  const h = residuHumide(r), s = residuSec(r);
  return h != null && s != null ? h - s : null;
};
const w0Residu = (r: Recipe): number | null => {
  const q = quotient(residuHumide(r), residuSec(r));
  return q !== null ? q - 1 : null;
};

export const SYMBOL_TO_RECIPE: Record<string, (r: Recipe) => number | null> = {
  // Binder dosage
  "B_w": (r) => r.bw_mass_pct != null ? r.bw_mass_pct / 100 : null,
  "M_b": (r) => r.components?.binder_total_mass_kg ?? null,
  "M_t": (r) => r.components?.residue_dry_mass_kg ?? null,
  "M_{ag}": (r) => r.components?.aggregate_dry_mass_kg ?? 0,
  // Masses de dosage (2026-10-26, formules des lignes Mr, Mb et Mw) :
  "M_{t\\text{-secs}}": (r) => r.components?.residue_dry_mass_kg ?? null,
  "A_m": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    return mr + ma > 0 ? ma / (mr + ma) : null;
  },

  // Cw / Cv
  "C_w": (r) => r.solids_mass_pct != null ? r.solids_mass_pct / 100 : null,
  // Cw final du remblai (méthode 2) et Cw du PAF (RPG) : le Cw de la recette.
  "C_{wf}": (r) => r.solids_mass_pct != null ? r.solids_mass_pct / 100 : null,
  "C_{w\\text{-PAF}}": (r) => r.solids_mass_pct != null ? r.solids_mass_pct / 100 : null,
  "C_v": (r) => r.cv_vol_pct != null ? r.cv_vol_pct / 100 : null,
  "M_s": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    return mr + ma + mb;
  },
  "M": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mw = r.components?.water_total_mass_kg ?? 0;
    return mr + ma + mb + mw;
  },
  // Masse totale à produire (méthode 2, PAF) : la même masse totale.
  "M_T": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mw = r.components?.water_total_mass_kg ?? 0;
    return mr + ma + mb + mw;
  },

  // Water content
  "w": (r) => r.w_mass_pct != null ? r.w_mass_pct / 100 : null,
  "M_w": (r) => r.components?.water_total_mass_kg ?? null,
  "M_h": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mw = r.components?.water_total_mass_kg ?? 0;
    return mr + ma + mb + mw;
  },
  "M_d": (r) => {
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const mb = r.components?.binder_total_mass_kg ?? 0;
    return mr + ma + mb;
  },

  // Volumes
  "V_T": (r) => r.total_backfill_volume_m3 ?? null,
  "V_s": (r) => r.solid_volume_m3 ?? null,
  "V_v": (r) => r.void_volume_m3 ?? null,
  "V_w": (r) => r.water_volume_m3 ?? null,
  "V_b": (r) => r.binder_volume_m3 ?? null,
  "V_t": (r) => r.residue_volume_m3 ?? null,

  // Densities
  "\\rho_h": (r) => r.bulk_density_kg_m3 ?? null,
  "\\rho_d": (r) => r.dry_density_kg_m3 ?? null,
  "\\rho_w": (r) => {
    // rho_w = rho_d*(1+e)/Gs — reflète la constante réellement utilisée.
    // NB : la clé doit être "\\rho_w" (backslash échappé) pour correspondre au
    // symbole des formules ; "\rho_w" valait \r + "ho_w" et ne matchait jamais.
    const rd = r.dry_density_kg_m3, e = r.void_ratio, gs = r.gs_backfill;
    return rd != null && e != null && gs ? (rd * (1 + e)) / gs : 1000;
  },
  "G_s": (r) => r.gs_backfill ?? null,
  "S_r": (r) => r.saturation_pct != null ? r.saturation_pct / 100 : null,

  // Void indices
  "e": (r) => r.void_ratio ?? null,
  "n": (r) => r.porosity ?? null,
  "\\theta": (r) => r.theta_pct != null ? r.theta_pct / 100 : null,

  // Unit weight
  "\\gamma_h": (r) => r.bulk_unit_weight_kN_m3 ?? null,
  "\\gamma_d": (r) => r.dry_unit_weight_kN_m3 ?? null,
  "g": (r) => {
    // g = gamma_h*1000/rho_h — reflète la constante réellement utilisée
    const gh = r.bulk_unit_weight_kN_m3, rh = r.bulk_density_kg_m3;
    return gh != null && rh ? (gh * 1000) / rh : 9.81;
  },

  // W/C
  "(W/C)_m": (r) => r.wc_ratio ?? null,

  // Bv
  "B_v": (r) => r.bv_vol_pct != null ? r.bv_vol_pct / 100 : null,

  // Résidu humide, eau à ajouter et eau du résidu (F042, F043, F049, F052, C14)
  "M_{t\\text{-hum}}": residuHumide,
  "M_{t\\text{-wet}}": residuHumide,
  "w_{\\text{rés}}": w0Residu,
  "w_0": w0Residu,
  "C_{w\\text{-rés}}": (r) => quotient(residuSec(r), residuHumide(r)),
  "C_{w\\text{-tail}}": (r) => quotient(residuSec(r), residuHumide(r)),
  "M_{w\\text{-aj}}": (r) => r.components?.water_to_add_mass_kg ?? null,
  "M_{w\\text{-add}}": (r) => r.components?.water_to_add_mass_kg ?? null,
  "M_{w\\text{-rés}}": eauDuResidu,
  "M_{w\\text{-tail}}": eauDuResidu,
  "M_{t+ag}": (r) => masseRejetSecTotaleKg(r),
  "M_{b\\text{-ad}}": (r) => r.components?.binder_to_add_mass_kg ?? null,

  // Volumes de chaque phase (C05, C08, C10 à C13, C15, F083)
  "V_{moule}": (r) => r.container_volume_m3 ?? null,
  "V_{ag}": (r) => r.aggregate_volume_m3 ?? null,
  "V_{aggregates}": (r) => r.aggregate_volume_m3 ?? null,
  "V_a": (r) => volumeAirM3(r),
  "A_v": (r) => (r.aggregate_vol_pct_of_residue != null ? r.aggregate_vol_pct_of_residue / 100 : null),
  "A_{v,T}": (r) => (r.aggregate_vol_pct_of_backfill != null ? r.aggregate_vol_pct_of_backfill / 100 : null),

  // Grains : masses volumiques et densités relatives par phase (F008, F026,
  // F083, F085, C06, C07, C10, C11, C13). Celles du résidu et du granulat se
  // lisent dans le résultat : masse / volume de la phase.
  "\\rho_s": (r) => rhoSolideKgM3(r),
  "\\gamma_s": (r) => gammaSolideKNM3(r),
  "\\rho_{s\\text{-t}}": (r) => quotient(residuSec(r), r.residue_volume_m3),
  "\\rho_{s\\text{-ag}}": (r) => quotient(r.components?.aggregate_dry_mass_kg, r.aggregate_volume_m3),
  "\\rho_{s\\text{-binder}}": (r) => quotient(r.components?.binder_total_mass_kg, r.binder_volume_m3),
  "\\rho_{s\\text{-liant}}": (r) => (r.gs_binder != null ? r.gs_binder * rhoW(r) : null),
  "\\rho_{s\\text{-tails+aggr}}": (r) => quotient(
    (residuSec(r) ?? 0) + (r.components?.aggregate_dry_mass_kg ?? 0),
    (r.residue_volume_m3 ?? 0) + (r.aggregate_volume_m3 ?? 0),
  ),
  "G_{s,t}": (r) => { const q = quotient(residuSec(r), r.residue_volume_m3); return q !== null ? q / rhoW(r) : null; },
  "G_{s,ag}": (r) => { const q = quotient(r.components?.aggregate_dry_mass_kg, r.aggregate_volume_m3); return q !== null ? q / rhoW(r) : null; },
  "G_{s,b}": (r) => r.gs_binder ?? null,

  // Gs
  "B_{ws}": (r) => {
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const ms = mb + mr + ma;
    return ms > 0 ? mb / ms : null;
  },
  "c_c": (r) => {
    const mb = r.components?.binder_total_mass_kg ?? 0;
    const mr = r.components?.residue_dry_mass_kg ?? 0;
    const ma = r.components?.aggregate_dry_mass_kg ?? 0;
    const ms = mb + mr + ma;
    return ms > 0 ? mb / ms : null;
  },
};

/** Valeurs des variables d'une formule pour une recette (exportée pour le test des masses). */
export function getFormulaValues(formula: Pick<Formula, "variables">, recipe: Recipe | undefined): { symbol: string; description: string; unit: string | null; value: number | null }[] {
  return formula.variables.map((v) => {
    // Sans recette RPC/RPG (RRC), pas de valeur : des getters « ?? 0 » afficheraient des zéros.
    const value = recipe ? (SYMBOL_TO_RECIPE[v.symbol]?.(recipe) ?? null) : null;
    return { symbol: v.symbol, description: v.description, unit: v.unit, value };
  });
}

const fmtVal = (v: number | null, digits = 4): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return TIRET;
  if (Math.abs(v) >= 100) return fmtGroupe(v, 2);
  if (Math.abs(v) >= 1) return fmt(v, 3);
  return fmt(v, digits);
};

/* ── KaTeX rendering ── */
function KaTeXBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    import("katex").then((katex) => {
      if (!cancelled && ref.current) {
        katex.default.render(latex, ref.current, {
          ...OPTIONS_KATEX_SURES,
          displayMode: true,
        });
      }
    });
    return () => { cancelled = true; };
  }, [latex]);
  return <div ref={ref} style={{ margin: "8px 0", overflowX: "auto" }} />;
}

/** Fiche modifiée par l'enseignant : signalée, et montrée SANS valeurs (elle ne décrit pas le calcul). */
function VersionEnseignant({ fiche }: { fiche: { equationLatex: string; variables: { symbol: string; description: string; unit: string | null }[] } }) {
  return (
    <div className="mix-fx-enseignant" role="note">
      <p style={{ margin: 0 }}>
        Cette fiche a été modifiée par l&apos;enseignant dans la bibliothèque Formules. Le calcul utilise la version ci-dessus.
      </p>
      <details>
        <summary>Voir la version de l&apos;enseignant</summary>
        <div style={{ background: "var(--champ)", borderRadius: 8, padding: "6px 12px", margin: "6px 0" }}>
          <KaTeXBlock latex={fiche.equationLatex} />
        </div>
        {fiche.variables.map((v, i) => (
          <div key={i} style={{ fontSize: 12, display: "flex", gap: 6 }}>
            <span style={{ fontFamily: "monospace", fontWeight: 600, minWidth: 60 }}>{v.symbol}</span>
            <span style={{ color: "var(--texte-2)" }}>{v.description}{v.unit ? ` (${v.unit})` : ""}</span>
          </div>
        ))}
      </details>
    </div>
  );
}

/* ── Main component ── */
interface FormulaPopoverProps {
  formulaIds: string[];
  /** Recette dont on lit les valeurs ; absente pour le RRC (fiche sans valeurs). */
  recipe?: Recipe;
  /** Valeur cliquée : la fiche se place contre elle et la suit au défilement. */
  ancre: HTMLElement;
  onClose: () => void;
}

const lireRect = (el: HTMLElement): RectAncre => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left };
};
const lireVue = (): Vue => ({ largeur: window.innerWidth, hauteur: window.innerHeight });

export default function FormulaPopover({ formulaIds, recipe, ancre, onClose }: FormulaPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  // Position relue au défilement et au redimensionnement (2026-10-26) : la page
  // défile dans `.ui-page`, pas dans le document ; on écoute donc le défilement
  // EN CAPTURE, où qu'il ait lieu, et la fiche suit la valeur cliquée.
  const [rect, setRect] = useState<RectAncre>(() => lireRect(ancre));
  const [vue, setVue] = useState<Vue>(lireVue);
  useEffect(() => {
    let image = 0;
    const suivre = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(() => {
        if (ancre.isConnected) setRect(lireRect(ancre));
        setVue(lireVue());
      });
    };
    document.addEventListener("scroll", suivre, true);
    window.addEventListener("resize", suivre);
    return () => {
      cancelAnimationFrame(image);
      document.removeEventListener("scroll", suivre, true);
      window.removeEventListener("resize", suivre);
    };
  }, [ancre]);

  // Clavier et lecteur d'écran : le focus entre dans la fiche à l'ouverture et
  // revient sur la valeur (ou la pastille) cliquée à la fermeture.
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    popoverRef.current?.focus();
    return () => { precedent?.focus?.(); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // TOUJOURS la fiche du COURS : c'est elle qui décrit le calcul. Une fiche
  // modifiée par l'enseignant (formules-enseignant.ts) n'est jamais présentée
  // comme la formule du résultat ; elle est signalée et montrée à part, sans
  // valeurs substituées (2026-10-29).
  const { carte } = useFormules();
  // Fiche du cours, sinon fiche du calculateur (hors cours, 2026-10-30).
  const formulas = formulaIds.map((id) => FORMULA_MAP.get(id) ?? FICHE_CALCULATEUR_MAP.get(id))
    .filter(Boolean) as (Formula | FicheCalculateur)[];
  if (formulas.length === 0) return null;

  // Sous la valeur s'il y a la place, sinon au-dessus ; toujours entière à
  // l'écran, le contenu défile à l'intérieur (lib/placer-popover.ts).
  const place = placerPopover(rect, vue);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Formule ${formulas.map((x) => x.id).join(", ")} : ${formulas[0].title}`}
      tabIndex={-1}
      style={{
        position: "fixed",
        left: place.left,
        top: place.top,
        bottom: place.bottom,
        width: place.width,
        maxHeight: place.maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
        background: "var(--surface)",
        border: "1px solid var(--filet-fort)",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        zIndex: 100,
        padding: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 8px 0" }}>
        <button type="button" className="btn-discret" onClick={onClose} aria-label="Fermer la fiche de formule">Fermer</button>
      </div>
      {formulas.map((formula, fi) => {
        const values = getFormulaValues(formula, recipe);
        const cours = "derivationLinks" in formula ? formula : null;
        const related = cours ? [
          ...cours.derivationLinks.derivedFrom,
          ...cours.derivationLinks.derivesInto,
        ].filter((id) => !formulaIds.includes(id)).slice(0, 4) : [];

        return (
          <div key={formula.id} style={{ padding: "14px 16px", borderTop: fi > 0 ? "1px solid var(--filet)" : "none" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-pale)",
                padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em",
              }}>
                {formula.id}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--texte)" }}>
                {formula.title}
              </span>
              {!cours && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--violet-texte)", background: "var(--violet-pale)", padding: "2px 7px", borderRadius: 4 }}>
                  hors cours
                </span>
              )}
            </div>

            {/* Equation */}
            <div style={{
              background: "var(--champ)", border: "1px solid var(--filet-fort)", borderRadius: 8,
              padding: "6px 12px", marginBottom: 10,
            }}>
              <KaTeXBlock latex={formula.equationLatex} />
            </div>

            {/* Variables with values */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--texte-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {recipe ? "Variables et valeurs de ce résultat (calculateur)" : "Variables"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {values.map((v, vi) => (
                  <div key={vi} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent)", minWidth: 60 }}>
                      {v.symbol}
                    </span>
                    <span style={{ color: "var(--texte-2)", flex: 1 }}>
                      {v.description}
                    </span>
                    {v.value !== null && (
                      <span style={{ fontWeight: 700, color: "var(--texte)", fontVariantNumeric: "tabular-nums" }}>
                        = {fmtVal(v.value)}
                        {v.unit && <span style={{ color: "var(--texte-3)", fontWeight: 400, marginLeft: 2 }}>{v.unit}</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Context */}
            {formula.contextSnippet && (
              <p style={{ fontSize: 11.5, color: "var(--texte-2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                {formula.contextSnippet}
              </p>
            )}

            {/* Derivation note */}
            {cours?.derivationLinks.derivationNote && (
              <div style={{ fontSize: 11, color: "var(--violet-texte)", background: "var(--violet-pale)", borderRadius: 6, padding: "5px 10px", marginBottom: 8 }}>
                {cours.derivationLinks.derivationNote}
              </div>
            )}

            {/* Reference */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--texte-3)" }}>
              {cours
                ? <span>Source : {cours.chapter}, p. {cours.pageNumber}</span>
                : <span>{MENTION_HORS_COURS} : {(formula as FicheCalculateur).source}</span>}
              {related.length > 0 && (
                <span>
                  Voir aussi : {related.map((id) => (
                    <span key={id} style={{ color: "var(--accent)", fontWeight: 600, marginLeft: 4 }}>{id}</span>
                  ))}
                </span>
              )}
            </div>

            {carte.get(formula.id)?.origine === "modifiee" && (
              <VersionEnseignant fiche={carte.get(formula.id)!} />
            )}
          </div>
        );
      })}
    </div>
  );
}
