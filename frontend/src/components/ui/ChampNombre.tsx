"use client";

// Saisie numérique sûre (reprise du NumInput du Labo) : la virgule décimale est
// acceptée, le texte en cours de frappe est gardé tel quel (« 1, » ne devient
// pas « 1 »), et un champ vidé renvoie undefined plutôt que 0.

import { useState } from "react";

/** Nombre lu dans une saisie (virgule ou point, espaces ignorées) ; undefined si vide ou invalide. */
export function lireNombre(brut: string): number | undefined {
  const t = brut.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export default function ChampNombre({ value, onChange, placeholder, id, className = "field-input", ariaLabel, style, disabled }: {
  value: number | undefined | null;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon !== null ? brouillon : value ?? "";
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      value={affiche}
      onFocus={() => setBrouillon(value === undefined || value === null ? "" : String(value))}
      onBlur={() => setBrouillon(null)}
      onChange={(e) => {
        const brut = e.target.value;
        setBrouillon(brut);
        if (brut.trim() === "") { onChange(undefined); return; }
        const n = lireNombre(brut);
        if (n !== undefined) onChange(n);
      }}
    />
  );
}
