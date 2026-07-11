"use client";

import React, { useState } from "react";
import { useStore, trouverPrixLiant } from "@/lib/store";
import { calculeUsine, facteurRemplacement, type UsineParams } from "@/lib/industrie_helpers";

/**
 * Calculs à l'usine de remblai (cours, Dias 72-83) :
 *  - mélange en continu (t/h) : résidus secs, liant, eau à ajouter (Dia 83) ;
 *  - facteurs de remplacement de Hassani & Bois 1992 (Dias 73-75).
 * Calculs purement locaux (aucun appel API).
 */

const num = (v: string) => {
  const x = parseFloat(v);
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

const fmt = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);

function LigneResultat({ label, valeur, unite, bold, negatif }: {
  label: string; valeur: string; unite: string; bold?: boolean; negatif?: boolean;
}) {
  return (
    <tr style={{ borderTop: "1px solid #f1f5f9" }}>
      <td style={{ padding: "7px 10px", fontSize: 12.5, color: "#475569", fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: "7px 10px", fontSize: 12.5, textAlign: "right", fontWeight: bold ? 700 : 500, color: negatif ? "#dc2626" : "#0f172a", fontFamily: "var(--font-geist-mono)" }}>
        {valeur}
      </td>
      <td style={{ padding: "7px 10px", fontSize: 11.5, color: "#94a3b8" }}>{unite}</td>
    </tr>
  );
}

export default function UsineCalculator() {
  const { binderPrices, general, catalogue_liants } = useStore();

  const [params, setParams] = useState<UsineParams>({
    residus_humides_tph: 70,   // exemple du cours (Dia 83)
    cw_residus_pct: 80,
    cw_remblai_pct: 78,
    bw_pct: 5,
  });
  const [heuresParPoste, setHeuresParPoste] = useState(8);

  // Facteurs de remplacement (Dias 73-75)
  const [rhoMinerai, setRhoMinerai] = useState(3.2);
  const [rhoRocheux, setRhoRocheux] = useState(2.2);
  const [rhoResidus, setRhoResidus] = useState(1.9);

  const r = calculeUsine(params);

  // Coût du liant : prix moyen pondéré du mélange configuré sur la page Informations
  const prixLiant = (() => {
    const parts: { frac: number; prix: number }[] = [];
    ([1, 2, 3] as const).forEach((n) => {
      const code = general[`binder${n}_type`];
      const frac = (general[`binder${n}_fraction_pct`] ?? 0) / 100;
      if (!code || frac <= 0) return;
      const id = catalogue_liants.find((l) => l.code === code)?.id;
      const entry = trouverPrixLiant(binderPrices, { id, code });
      if (entry) parts.push({ frac, prix: entry.price_per_kg });
    });
    if (!parts.length) return null;
    const totalFrac = parts.reduce((a, p) => a + p.frac, 0) || 1;
    return parts.reduce((a, p) => a + (p.frac / totalFrac) * p.prix, 0); // $/kg
  })();

  const coutLiantParHeure = prixLiant !== null ? r.liant_tph * 1000 * prixLiant : null;

  const nR = facteurRemplacement(0.71, rhoRocheux, rhoMinerai);
  const nT = facteurRemplacement(0.64, rhoResidus, rhoMinerai);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Mélange en continu ── */}
      <div className="form-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
          Mélange en continu (t/h)
        </h3>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, marginBottom: 14 }}>
          Formule dérivée du cours (Dia 83) : eau à ajouter au mélangeur pour passer des résidus
          épaissis au remblai visé. Valeurs par défaut = exemple du cours (réponse : 2,58 t/h).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px 14px", marginBottom: 14 }}>
          <Field label="Résidus humides (t/h)">
            <input type="number" step="any" style={inputStyle} value={params.residus_humides_tph || ""}
              onChange={(e) => setParams({ ...params, residus_humides_tph: num(e.target.value) })} />
          </Field>
          <Field label="Cw des résidus (%)" hint="Sortie épaississeur/filtre">
            <input type="number" step="any" style={inputStyle} value={params.cw_residus_pct || ""}
              onChange={(e) => setParams({ ...params, cw_residus_pct: num(e.target.value) })} />
          </Field>
          <Field label="Cw du remblai visé (%)">
            <input type="number" step="any" style={inputStyle} value={params.cw_remblai_pct || ""}
              onChange={(e) => setParams({ ...params, cw_remblai_pct: num(e.target.value) })} />
          </Field>
          <Field label="Taux de liant Bw (%)">
            <input type="number" step="any" style={inputStyle} value={params.bw_pct ?? ""}
              onChange={(e) => setParams({ ...params, bw_pct: num(e.target.value) })} />
          </Field>
        </div>

        <table className="result-table" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <tbody>
            <LigneResultat label="Résidus secs M_rs" valeur={fmt(r.residus_secs_tph)} unite="t/h" />
            <LigneResultat label="Eau contenue dans les résidus" valeur={fmt(r.eau_residus_tph)} unite="t/h" />
            <LigneResultat label="Liant M_b" valeur={fmt(r.liant_tph, 3)} unite="t/h" bold />
            <LigneResultat
              label={r.eau_a_ajouter_tph >= 0 ? "Eau à ajouter M_w-aj" : "Eau à retirer M_w-aj"}
              valeur={fmt(r.eau_a_ajouter_tph)} unite="t/h" bold negatif={r.eau_a_ajouter_tph < 0} />
            <LigneResultat label="Remblai produit (total)" valeur={fmt(r.remblai_total_tph)} unite="t/h" />
            <LigneResultat label="Teneur en eau du remblai w" valeur={fmt(r.teneur_eau_remblai * 100, 2)} unite="%" />
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: "12px 14px", marginTop: 14, alignItems: "end" }}>
          <Field label="Heures par poste">
            <input type="number" step="any" style={inputStyle} value={heuresParPoste || ""}
              onChange={(e) => setHeuresParPoste(num(e.target.value))} />
          </Field>
          <div style={{ fontSize: 12.5, color: "#374151" }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Par poste ({heuresParPoste || 0} h)</div>
            liant {fmt(r.liant_tph * (heuresParPoste || 0), 1)} t — eau {fmt(r.eau_a_ajouter_tph * (heuresParPoste || 0), 1)} t —
            remblai {fmt(r.remblai_total_tph * (heuresParPoste || 0), 0)} t
          </div>
          <div style={{ fontSize: 12.5, color: "#374151" }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Par jour (24 h)</div>
            liant {fmt(r.liant_tph * 24, 1)} t — eau {fmt(r.eau_a_ajouter_tph * 24, 1)} t —
            remblai {fmt(r.remblai_total_tph * 24, 0)} t
          </div>
        </div>

        {coutLiantParHeure !== null ? (
          <p style={{ fontSize: 12.5, color: "#374151", marginTop: 12 }}>
            <strong>Coût du liant :</strong> {fmt(coutLiantParHeure, 0)} $/h
            — {fmt(coutLiantParHeure * (heuresParPoste || 0), 0)} $/poste
            — {fmt(coutLiantParHeure * 24, 0)} $/jour
            <span style={{ color: "#94a3b8" }}> (mélange de liants et prix de la page Informations / Réglages)</span>
          </p>
        ) : (
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
            Renseignez les prix des liants (onglet Paramètres de production) pour afficher le coût horaire.
          </p>
        )}
      </div>

      {/* ── Facteurs de remplacement ── */}
      <div className="form-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
          Facteurs de remplacement (Hassani et Bois, 1992)
        </h3>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, marginBottom: 14 }}>
          Estimation de la masse de remblai nécessaire par tonne de minerai extraite :
          N_R = 0,71 x rho_R/rho_0 (rocheux) ; N_T = 0,64 x rho_T/rho_0 (hydraulique/pâte).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 14px", marginBottom: 12 }}>
          <Field label="rho_0 minerai (t/m³)">
            <input type="number" step="any" style={inputStyle} value={rhoMinerai || ""}
              onChange={(e) => setRhoMinerai(num(e.target.value))} />
          </Field>
          <Field label="rho_R roches stériles (t/m³)">
            <input type="number" step="any" style={inputStyle} value={rhoRocheux || ""}
              onChange={(e) => setRhoRocheux(num(e.target.value))} />
          </Field>
          <Field label="rho_T résidus (t/m³)">
            <input type="number" step="any" style={inputStyle} value={rhoResidus || ""}
              onChange={(e) => setRhoResidus(num(e.target.value))} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#0f172a", flexWrap: "wrap" }}>
          <span><strong>N_R = {fmt(nR, 3)}</strong> t de remblai rocheux / t de minerai</span>
          <span><strong>N_T = {fmt(nT, 3)}</strong> t de remblai hydraulique ou pâte / t de minerai</span>
        </div>
      </div>
    </div>
  );
}
