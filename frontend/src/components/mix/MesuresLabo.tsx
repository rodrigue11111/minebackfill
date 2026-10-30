"use client";

import { useState } from "react";
import { calculeMesures, type MesureLabo } from "@/lib/mesures";
import { fmt, TIRET } from "@/lib/format";
import { CardSection, Field, GrilleChamps, PointRecette } from "@/components/mix/champs";
import ChampNombre from "@/components/ui/ChampNombre";

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
 * comme sur la feuille. Les saisies vivent dans l'état de l'essai-erreur
 * (magasin) : elles survivent à la navigation, partent avec le résultat
 * sauvegardé et entrent dans les rapports PDF et Excel.
 *
 * 2026-10-30 (demande de l'utilisateur) : seul l'affaissement, mesuré juste
 * après le malaxage, se saisit encore ici. La teneur en eau demande environ
 * 24 h d'étuve : tare, m_h et m_s se saisissent dans la gâchée, au Labo
 * (Gachee.etuvePate). Des masses saisies ici auparavant restent affichées
 * en lecture et dans les rapports.
 */

interface RecetteCalculee {
  w_mass_pct?: number | null;
  solids_mass_pct?: number | null;
}

/** Champs mesurés : une masse ou un affaissement négatifs sont refusés à la saisie. */
const CHAMPS_MESURES: { cle: keyof MesureLabo; libelle: string; unite: string; refus: string }[] = [
  { cle: "slump", libelle: "Affaissement mesuré", unite: "mm", refus: "Un affaissement ne peut pas être négatif." },
];

function Ecart({ mesure, calcule }: { mesure: number | null; calcule: number | null | undefined }) {
  if (mesure === null || calcule === null || calcule === undefined) return null;
  const d = mesure - calcule;
  const gros = Math.abs(d) > 1.0; // plus d'un point de pourcentage
  return (
    <span style={{ color: gros ? "var(--danger-texte)" : "var(--succes-texte)", fontWeight: 600 }}>
      {" "}(écart {d >= 0 ? "+" : ""}{fmt(d, 2)} pt)
    </span>
  );
}

export default function MesuresLabo({
  numRecipes,
  recipes,
  slumpCibleMm,
  mesures,
  onChange,
}: {
  numRecipes: number;
  recipes?: RecetteCalculee[] | null;
  /**
   * Affaissement visé du protocole essai-erreur (mm). Si fourni, l'écart et le
   * geste conseillé (eau ou solides) s'affichent sous l'affaissement mesuré —
   * protocole de Belem et al. 2018, §2.3.
   */
  slumpCibleMm?: number;
  /** Mesures par recette (état de l'essai-erreur). */
  mesures: MesureLabo[];
  onChange: (mesures: MesureLabo[]) => void;
}) {
  const setMesure = (i: number, patch: Partial<MesureLabo>) => {
    const next = [...mesures];
    while (next.length <= i) next.push({});
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  // Message de la saisie refusée en cours, par champ (« recette-clé »).
  const [refus, setRefus] = useState<Record<string, string | null>>({});

  return (
    <CardSection
      title="Paramètres mesurés au laboratoire"
      subtitle={<>Juste après le malaxage : affaissement mesuré (ASTM C143/C143M). La teneur en eau de la pâte demande
        environ 24 h d&apos;étuve (ASTM D2216) : saisissez tare, m_h et m_s dans la gâchée, au Labo.</>}
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
                {CHAMPS_MESURES.map(({ cle, libelle, unite, refus: messageRefus }) => (
                  <Field key={cle} label={libelle} unit={unite} erreur={refus[`${i}-${cle}`]}>
                    <ChampNombre placeholder={TIRET} min={0} messageRefus={messageRefus}
                      value={m[cle]} onChange={(n) => setMesure(i, { [cle]: n })}
                      onRefus={(msg) => setRefus((r) => ({ ...r, [`${i}-${cle}`]: msg }))} />
                  </Field>
                ))}
              </GrilleChamps>
              {slumpCibleMm !== undefined && slumpCibleMm > 0 && m.slump !== undefined && (
                <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--texte)" }}>
                  <strong>Affaissement : {m.slump.toLocaleString("fr-CA")} mm</strong> pour une cible de {slumpCibleMm.toLocaleString("fr-CA")} mm{" "}
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
                // Masses saisies ici avant le 2026-10-30 : gardées, en lecture.
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
