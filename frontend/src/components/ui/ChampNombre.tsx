"use client";

// Saisie numérique sûre, commune à tout le site (Calculs, Analyse,
// Informations, Labo) : la virgule décimale est acceptée, le texte en cours de
// frappe est gardé tel quel (« 1, » ne devient pas « 1 »), et un champ vidé
// renvoie undefined plutôt que 0 (vide et zéro sont deux choses différentes).
//
// Deux modes :
//  - sans `min` : tout nombre lisible est écrit tel que tapé, même hors des
//    bornes physiques ; l'écran et le calcul voient la même valeur, et le
//    champ englobant (Field) dit qu'elle est impossible ;
//  - avec `min` (Labo) : une valeur sous la borne n'est PAS écrite ; le champ
//    la garde affichée avec `aria-invalid` et le message, puis, en quittant le
//    champ, rétablit la valeur précédente. Un bouton prend le focus avant le
//    clic : aucune action ne part donc avec une saisie refusée à l'écran.
// Une saisie illisible (« abc ») n'écrit rien ; en quittant le champ, il
// montre de nouveau la valeur gardée.

import { useState } from "react";

/** Nombre lu dans une saisie (virgule ou point, espaces ignorées, signe moins typographique accepté) ; undefined si vide ou illisible. */
export function lireNombre(brut: string): number | undefined {
  const t = brut.trim().replace(/\s/g, "").replace(",", ".").replace("−", "-");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Borne d'un champ : `min` inclus, ou exclu avec `minExclusif`. */
export interface BorneNombre {
  min?: number;
  minExclusif?: boolean;
}

/** Message de refus d'un nombre sous la borne, ou null s'il est accepté. */
export function refusNombre(n: number, { min, minExclusif }: BorneNombre): string | null {
  if (min === undefined) return null;
  if (minExclusif ? n > min : n >= min) return null;
  if (min === 0) return minExclusif ? "La valeur doit être strictement positive." : "Une valeur négative est impossible.";
  return minExclusif ? `La valeur doit être supérieure à ${min}.` : `La valeur doit être au moins ${min}.`;
}

export default function ChampNombre({
  value, onChange, placeholder, id, className = "field-input", ariaLabel, style, disabled,
  min, minExclusif, messageRefus, onRefus, ariaInvalid, ariaDescribedby,
}: {
  value: number | undefined | null;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Borne basse : une valeur sous la borne n'est pas écrite (voir l'en-tête). */
  min?: number;
  minExclusif?: boolean;
  /** Message propre au champ (« Le diamètre doit être strictement positif. ») ; sinon un message générique. */
  messageRefus?: string;
  /** Prévient le parent qu'une saisie est refusée (message) ou ne l'est plus (null). */
  onRefus?: (message: string | null) => void;
  /** Erreur signalée par le parent (bornes, calcul) : posée sur l'<input>. */
  ariaInvalid?: boolean;
  /** Id du message d'erreur ou d'aide qui décrit le champ. */
  ariaDescribedby?: string;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const [refuse, setRefuse] = useState(false);
  const affiche = brouillon !== null ? brouillon : value ?? "";

  const signalerRefus = (message: string | null) => {
    setRefuse(message !== null);
    onRefus?.(message);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid || refuse ? true : undefined}
      aria-describedby={ariaDescribedby}
      placeholder={placeholder}
      disabled={disabled}
      value={affiche}
      onFocus={() => setBrouillon(value === undefined || value === null ? "" : String(value))}
      onBlur={() => {
        // La saisie refusée ou illisible est jetée : le champ montre de nouveau
        // la valeur gardée (la précédente).
        setBrouillon(null);
        if (refuse) signalerRefus(null);
      }}
      onChange={(e) => {
        const brut = e.target.value;
        setBrouillon(brut);
        if (brut.trim() === "") { if (refuse) signalerRefus(null); onChange(undefined); return; }
        const n = lireNombre(brut);
        if (n === undefined) return;
        const refus = refusNombre(n, { min, minExclusif });
        if (refus) { signalerRefus(messageRefus ?? refus); return; }
        if (refuse) signalerRefus(null);
        onChange(n);
      }}
    />
  );
}
