"use client";

// Saisie de la fraction de granulats en % MASSIQUE (Am) ou % VOLUMIQUE (Av).
// La valeur CANONIQUE (store + backend) est TOUJOURS Am — c'est elle qui est
// persistée et envoyée au calcul. En mode volumique, la saisie est convertie
// en Am à la volée avec les Gs saisis au moment de la frappe (équation [3] de
// Belem et al. 2018 — voir lib/granulats.ts) ; l'Av AFFICHÉ est re-dérivé
// d'Am avec les Gs COURANTS : si l'on change un Gs après coup, c'est donc
// l'équivalent volumique affiché qui bouge, pas la masse déjà spécifiée.
// Pendant la frappe, un tampon local préserve le texte tel que tapé (pas de
// réécriture par l'aller-retour de conversion).

import React, { useState } from "react";
import { amDepuisAv, avDepuisAm } from "@/lib/granulats";
import { num } from "@/lib/format";

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", border: "1px solid #cbd5e1", borderRadius: 6,
  padding: "7px 11px", background: "#fff", fontSize: 13.5, outline: "none",
};

function arrondi(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function borne0a100(v: number): number {
  return Math.min(100, Math.max(0, v));
}

export default function ChampFractionGranulat({
  amPct,
  gsResidu,
  gsGranulat,
  onChangeAm,
}: {
  /** Valeur canonique : A_m% (Ma/(Ma+Mr)×100) — celle du store et du backend. */
  amPct: number;
  gsResidu: number;
  gsGranulat: number;
  onChangeAm: (amPct: number) => void;
}) {
  const [mode, setMode] = useState<"am" | "av">("am");
  // Tampon de frappe (mode volumique) : non nul pendant l'édition, pour ne
  // jamais réécrire le texte de l'utilisateur avec la valeur re-dérivée.
  const [saisieAv, setSaisieAv] = useState<string | null>(null);
  const gsOk = gsResidu > 0 && gsGranulat > 0;
  // Sans Gs valides, la conversion est impossible : on retombe sur Am.
  const modeEffectif: "am" | "av" = mode === "av" && gsOk ? "av" : "am";

  const av = gsOk ? avDepuisAm(amPct || 0, gsResidu, gsGranulat) : null;
  const valeurAffichee =
    modeEffectif === "am"
      ? amPct || ""
      : saisieAv !== null
        ? saisieAv
        : av !== null
          ? arrondi(av) || ""
          : "";

  const equivalence =
    !gsOk
      ? "Renseignez les Gs du résidu et de l'agrégat pour la saisie volumique."
      : modeEffectif === "am"
        ? av !== null
          ? `= Av ${arrondi(av).toLocaleString("fr-CA")} %v/v (éq. [3], Belem et al. 2018)`
          : ""
        : `= Am ${arrondi(amPct || 0).toLocaleString("fr-CA")} %m — valeur envoyée au calcul (on pèse des masses)`;

  const changerMode = (m: "am" | "av") => {
    setSaisieAv(null);
    setMode(m);
  };

  const boutonMode = (m: "am" | "av", libelle: string, desactive: boolean) => {
    const actif = modeEffectif === m;
    return (
      <button
        key={m}
        type="button"
        disabled={desactive}
        onClick={() => changerMode(m)}
        title={desactive ? "Gs du résidu et de l'agrégat requis" : undefined}
        style={{
          padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
          border: `1px solid ${actif ? "#2563eb" : "#e2e8f0"}`,
          background: actif ? "#2563eb" : "#fff",
          color: actif ? "#fff" : desactive ? "#cbd5e1" : "#64748b",
          cursor: desactive ? "not-allowed" : "pointer",
          transition: "all 0.13s",
        }}
      >
        {libelle}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
          {modeEffectif === "am" ? "A_m — fraction agrégat (% massique)" : "A_v — fraction agrégat (% volumique)"}
        </label>
        <span style={{ display: "flex", gap: 4 }}>
          {boutonMode("am", "% masse", false)}
          {boutonMode("av", "% volume", !gsOk)}
        </span>
      </div>
      <input
        type="number"
        step="any"
        min={0}
        max={100}
        style={inputStyle}
        placeholder={modeEffectif === "am" ? "ex : 30" : "ex : 33"}
        value={valeurAffichee}
        onChange={(e) => {
          if (modeEffectif === "av") {
            setSaisieAv(e.target.value);
            const am = amDepuisAv(borne0a100(num(e.target.value)), gsResidu, gsGranulat);
            // Précision pleine : l'arrondi n'existe qu'à l'AFFICHAGE.
            onChangeAm(am !== null ? borne0a100(am) : 0);
          } else {
            onChangeAm(num(e.target.value));
          }
        }}
        onBlur={() => setSaisieAv(null)}
      />
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
        {modeEffectif === "am"
          ? `Ma/(Ma+Mr)×100 — % d'agrégat dans les solides non-liant. ${equivalence}`
          : `Va/(Va+Vr)×100 — % du volume des grains (la grandeur pilotée par l'article). ${equivalence}`}
      </p>
    </div>
  );
}
