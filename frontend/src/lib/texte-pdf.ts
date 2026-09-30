// frontend/src/lib/texte-pdf.ts
// Texte compatible avec la police intégrée de jsPDF, pour TOUS les PDF
// (rapport de résultats, feuille de préparation, RRC, rapport de classe).
//
// Helvetica intégrée = encodage WinAnsi (CP1252) : Latin-1 plus quelques
// signes (’ « » œ – — … €). Un SEUL caractère hors de cette table fait passer
// toute la chaîne en UCS-2, rendue illisible. On ramène donc chaque caractère
// hors table à un équivalent sûr ; les lettres grecques des symboles du cours
// (ρh, γd, θ, κ) sont écrites en toutes lettres (rho_h, gamma_d, theta, kappa).

const CP1252_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);

const EQUIVALENTS: Record<string, string> = {
  "\u202F": " ", "\u2009": " ", "\u2007": " ", "\u200B": "", "\u2212": "-", "\u2011": "-", "\u2010": "-",
  "≥": ">=", "≤": "<=", "≈": "~", "≠": "!=", "σ": "s", "→": "->", "←": "<-", "▸": ">", "▾": "v",
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  // Micro : la lettre grecque devient le signe micro de Latin-1 (µm).
  "μ": "µ",
};

const GRECQUES: Record<string, string> = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "eps", "η": "eta",
  "θ": "theta", "κ": "kappa", "λ": "lambda", "ν": "nu", "π": "pi", "ρ": "rho",
  "τ": "tau", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  "Γ": "Gamma", "Δ": "Delta", "Σ": "Sigma", "Φ": "Phi", "Ω": "Omega",
};

/** Un indice collé au symbole (ρh, γd, ρ₁) : il sera séparé par « _ ». */
const INDICE = /[A-Za-z0-9₀-₉]/;

export function pourPdf(s: string): string {
  const car = [...s.normalize("NFC")];
  let r = "";
  car.forEach((c, i) => {
    const code = c.codePointAt(0)!;
    if (code <= 0xff || CP1252_EXTRA.has(c)) r += c;
    else if (EQUIVALENTS[c] !== undefined) r += EQUIVALENTS[c];
    else if (GRECQUES[c] !== undefined) r += GRECQUES[c] + (INDICE.test(car[i + 1] ?? "") ? "_" : "");
    else r += "?";
  });
  return r;
}

/** Nombre à virgule décimale, milliers séparés par une espace ordinaire. */
export function nombrePdf(v: number | null | undefined, dec = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const [ent, frac] = Math.abs(v).toFixed(dec).split(".");
  const groupe = ent.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 && Number(Math.abs(v).toFixed(dec)) !== 0 ? "-" : ""}${groupe}${frac ? `,${frac}` : ""}`;
}

/**
 * Fait passer par pourPdf TOUT texte que ce document dessine (doc.text), une
 * fois pour toutes : aucun appel ne peut l'oublier. Renvoie le même document.
 */
export function assainirTextePdf<D extends { text: unknown }>(doc: D): D {
  const dessiner = (doc.text as (t: string | string[], ...reste: unknown[]) => unknown).bind(doc);
  (doc as unknown as { text: (t: string | string[], ...reste: unknown[]) => unknown }).text = (t, ...reste) =>
    dessiner(Array.isArray(t) ? t.map((x) => pourPdf(String(x))) : pourPdf(String(t)), ...reste);
  return doc;
}
