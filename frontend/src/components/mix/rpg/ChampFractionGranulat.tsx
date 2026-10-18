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

import { useState } from "react";
import { amDepuisAv, avDepuisAm } from "@/lib/granulats";
import ChampNombre, { lireNombre } from "@/components/ui/ChampNombre";

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
  amPct: number | undefined;
  gsResidu: number;
  gsGranulat: number;
  /** undefined : champ vidé. */
  onChangeAm: (amPct: number | undefined) => void;
}) {
  const [mode, setMode] = useState<"am" | "av">("am");
  // Tampon de frappe (mode volumique) : non nul pendant l'édition, pour ne
  // jamais réécrire le texte de l'utilisateur avec la valeur re-dérivée.
  const [saisieAv, setSaisieAv] = useState<string | null>(null);
  const gsOk = gsResidu > 0 && gsGranulat > 0;
  // Sans Gs valides, la conversion est impossible : on retombe sur Am.
  const modeEffectif: "am" | "av" = mode === "av" && gsOk ? "av" : "am";

  const av = gsOk && amPct !== undefined ? avDepuisAm(amPct, gsResidu, gsGranulat) : null;
  // Mode volumique : le texte tapé pendant l'édition, sinon l'Av re-dérivé d'Am.
  const valeurAv = saisieAv !== null ? saisieAv : av !== null ? String(arrondi(av)) : "";

  const equivalence =
    !gsOk
      ? "Renseignez les Gs du résidu et du granulat pour la saisie volumique."
      : modeEffectif === "am"
        ? av !== null
          ? `= Av ${arrondi(av).toLocaleString("fr-CA")} %v/v (éq. [3], Belem et al. 2018)`
          : ""
        : `= Am ${arrondi(amPct || 0).toLocaleString("fr-CA")} %m, valeur envoyée au calcul (on pèse des masses)`;

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
        title={desactive ? "Gs du résidu et du granulat requis" : undefined}
        aria-pressed={actif}
        className={actif ? "mix-bascule mix-bascule-active" : "mix-bascule"}
      >
        {libelle}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <label className="ui-champ-libelle" htmlFor="fraction-granulat">
          {modeEffectif === "am" ? "Fraction massique de granulat Am (%)" : "Fraction volumique de granulat Av (%)"}
        </label>
        <span style={{ display: "flex", gap: 4 }}>
          {boutonMode("am", "% masse", false)}
          {boutonMode("av", "% volume", !gsOk)}
        </span>
      </div>
      {modeEffectif === "am" ? (
        <ChampNombre id="fraction-granulat" placeholder="ex : 30" value={amPct} onChange={onChangeAm} />
      ) : (
        <input
          type="text"
          inputMode="decimal"
          id="fraction-granulat"
          className="field-input"
          placeholder="ex : 33"
          value={valeurAv}
          onChange={(e) => {
            setSaisieAv(e.target.value);
            if (e.target.value.trim() === "") { onChangeAm(undefined); return; }
            const n = lireNombre(e.target.value);
            if (n === undefined) return;
            const am = amDepuisAv(borne0a100(n), gsResidu, gsGranulat);
            // Précision pleine : l'arrondi n'existe qu'à l'AFFICHAGE.
            onChangeAm(am !== null ? borne0a100(am) : undefined);
          }}
          onBlur={() => setSaisieAv(null)}
        />
      )}
      <p className="ui-champ-aide" style={{ margin: "6px 0 0" }}>
        {modeEffectif === "am"
          ? `Ma/(Ma+Mr)×100 : part du granulat dans les solides hors liant. ${equivalence}`
          : `Va/(Va+Vr)×100 : % du volume des grains (la grandeur pilotée par l'article). ${equivalence}`}
      </p>
    </div>
  );
}
