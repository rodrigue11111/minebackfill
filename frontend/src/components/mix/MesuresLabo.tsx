"use client";

import { useState } from "react";
import { calculeMesures, type MesureLabo } from "@/lib/mesures";
import { fmt, TIRET } from "@/lib/format";
import { CardSection, Field, GrilleChamps, PointRecette } from "@/components/mix/champs";

/**
 * Bloc « Paramètres mesurés au laboratoire » de la feuille Intra 2017
 * (lignes 72-77) : après la gâchée, l'opérateur mesure le slump puis
 * fait un essai de teneur en eau (tare, tare + pâte humide, tare + pâte
 * sèche) et compare aux valeurs calculées.
 *
 *   w mesuré  = (m_h − m_s) / (m_s − tare)    [cellule D76]
 *   Cw mesuré = (m_s − tare) / (m_h − tare)   [cellule D77]
 *
 * Calcul purement local (aucun appel API). Les masses sont en grammes,
 * comme sur la feuille.
 */

interface RecetteCalculee {
  w_mass_pct?: number | null;
  solids_mass_pct?: number | null;
}

const num = (v: string): number | undefined => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : undefined;
};

function Ecart({ mesure, calcule }: { mesure: number | null; calcule: number | null | undefined }) {
  if (mesure === null || calcule === null || calcule === undefined) return null;
  const d = mesure - calcule;
  const gros = Math.abs(d) > 1.0; // plus d'un point de pourcentage
  return (
    <span style={{ color: gros ? "var(--danger-texte)" : "var(--succes-texte)", fontWeight: 600 }}>
      {" "}(écart {d >= 0 ? "+" : ""}{d.toFixed(2)} pt)
    </span>
  );
}

export default function MesuresLabo({
  numRecipes,
  recipes,
  slumpCibleMm,
}: {
  numRecipes: number;
  recipes?: RecetteCalculee[] | null;
  /**
   * Affaissement visé du protocole essai-erreur (mm). Si fourni, l'écart et le
   * geste conseillé (eau ou solides) s'affichent sous l'affaissement mesuré —
   * protocole de Belem et al. 2018, §2.3.
   */
  slumpCibleMm?: number;
}) {
  const [mesures, setMesures] = useState<MesureLabo[]>([]);

  const setMesure = (i: number, patch: Partial<MesureLabo>) =>
    setMesures((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push({});
      next[i] = { ...next[i], ...patch };
      return next;
    });

  return (
    <CardSection
      title="Paramètres mesurés au laboratoire"
      subtitle={<>Après la gâchée : affaissement mesuré (ASTM C143/C143M) et teneur en eau massique (ASTM D2216 ; masses en grammes, comme la feuille de référence).
        w mesuré = (m_h − m_s)/(m_s − tare) ; Cw mesuré = (m_s − tare)/(m_h − tare).</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: numRecipes }).map((_, i) => {
          const m = mesures[i] || {};
          const { w, cw } = calculeMesures(m);
          const calc = recipes?.[i];
          return (
            <div key={i} className="mix-recette">
              <div className="mix-recette-titre"><PointRecette i={i} />Recette {i + 1}</div>
              <GrilleChamps>
                <Field label="Affaissement mesuré" unit="mm">
                  <input type="number" step="any" className="field-input" placeholder={TIRET}
                    value={m.slump ?? ""} onChange={(e) => setMesure(i, { slump: num(e.target.value) })} />
                </Field>
                <Field label="Tare" unit="g">
                  <input type="number" step="any" className="field-input" placeholder={TIRET}
                    value={m.tare ?? ""} onChange={(e) => setMesure(i, { tare: num(e.target.value) })} />
                </Field>
                <Field label="Tare + pâte humide m_h" unit="g">
                  <input type="number" step="any" className="field-input" placeholder={TIRET}
                    value={m.mh ?? ""} onChange={(e) => setMesure(i, { mh: num(e.target.value) })} />
                </Field>
                <Field label="Tare + pâte sèche m_s" unit="g">
                  <input type="number" step="any" className="field-input" placeholder={TIRET}
                    value={m.ms ?? ""} onChange={(e) => setMesure(i, { ms: num(e.target.value) })} />
                </Field>
              </GrilleChamps>
              {slumpCibleMm !== undefined && slumpCibleMm > 0 && m.slump !== undefined && (
                <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--texte)" }}>
                  <strong>Affaissement : {m.slump} mm</strong> pour une cible de {slumpCibleMm} mm{" "}
                  {m.slump === slumpCibleMm ? (
                    <span style={{ color: "var(--succes-texte)", fontWeight: 600 }}>(cible atteinte)</span>
                  ) : m.slump < slumpCibleMm ? (
                    <span style={{ color: "var(--alerte-texte)", fontWeight: 600 }}>
                      (écart −{(slumpCibleMm - m.slump).toFixed(0)} mm), sous la cible : ajouter de l&apos;eau
                    </span>
                  ) : (
                    <span style={{ color: "var(--alerte-texte)", fontWeight: 600 }}>
                      (écart +{(m.slump - slumpCibleMm).toFixed(0)} mm), au-dessus : ajouter résidu et granulat (le liant suit la règle active)
                    </span>
                  )}
                </div>
              )}
              {(w !== null || cw !== null) && (
                <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--texte)", display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <span>
                    <strong>w mesuré : {fmt(w, 2)} %</strong>
                    {calc ? <>, calculé : {fmt(calc.w_mass_pct, 2)} %<Ecart mesure={w} calcule={calc.w_mass_pct} /></> : null}
                  </span>
                  <span>
                    <strong>Cw mesuré : {fmt(cw, 2)} %</strong>
                    {calc ? <>, calculé : {fmt(calc.solids_mass_pct, 2)} %<Ecart mesure={cw} calcule={calc.solids_mass_pct} /></> : null}
                  </span>
                </div>
              )}
              {m.tare !== undefined && m.mh !== undefined && m.ms !== undefined && w === null && (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger-texte)" }}>
                  Valeurs incohérentes : on attend m_h &gt; m_s &gt; tare.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardSection>
  );
}
