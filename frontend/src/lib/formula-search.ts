import { FORMULAS, type Formula, type FormulaVariable } from "./formulas-data";

// ============================================================
// Normalisation — removes superficial differences so that
// "rho_h", "ρh", "rhoh", "ρ_h" all match each other.
// ============================================================

const GREEK_MAP: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta",
  ε: "epsilon", ζ: "zeta", η: "eta", θ: "theta",
  ι: "iota", κ: "kappa", λ: "lambda", μ: "mu",
  ν: "nu", ξ: "xi", π: "pi", ρ: "rho",
  σ: "sigma", τ: "tau", υ: "upsilon", φ: "phi",
  χ: "chi", ψ: "psi", ω: "omega",
  Γ: "Gamma", Δ: "Delta", Θ: "Theta", Λ: "Lambda",
  Ξ: "Xi", Π: "Pi", Σ: "Sigma", Φ: "Phi", Ψ: "Psi", Ω: "Omega",
};

// LaTeX command → plain text equivalents
const LATEX_MAP: Record<string, string> = {
  "\\rho": "rho",
  "\\alpha": "alpha",
  "\\beta": "beta",
  "\\gamma": "gamma",
  "\\delta": "delta",
  "\\epsilon": "epsilon",
  "\\theta": "theta",
  "\\mu": "mu",
  "\\nu": "nu",
  "\\sigma": "sigma",
  "\\tau": "tau",
  "\\omega": "omega",
  "\\phi": "phi",
  "\\pi": "pi",
  "\\lambda": "lambda",
  "\\eta": "eta",
  "\\cdot": "*",
  "\\times": "*",
  "\\frac": "/",
  "\\left": "",
  "\\right": "",
  "\\quad": " ",
  "\\qquad": " ",
  "\\,": " ",
  "\\;": " ",
  "\\!": "",
  "\\text": "",
  "\\mathrm": "",
  "\\mathbf": "",
  "\\sqrt": "sqrt",
  "\\sum": "sum",
  "\\infty": "inf",
};

export function normalise(raw: string): string {
  let s = raw;

  // Replace LaTeX commands
  for (const [cmd, repl] of Object.entries(LATEX_MAP)) {
    s = s.split(cmd).join(repl);
  }

  // Replace Greek unicode characters
  for (const [char, repl] of Object.entries(GREEK_MAP)) {
    s = s.split(char).join(repl);
  }

  // Remove LaTeX braces, backslashes
  s = s.replace(/[\\{}^_]/g, " ");

  // Remove extra whitespace
  s = s.replace(/\s+/g, " ").trim();

  // Lowercase
  s = s.toLowerCase();

  return s;
}

// Build a searchable token set from a formula
function buildSearchText(f: Formula): string {
  const parts = [
    f.id,
    f.title,
    f.subtitle,
    f.section,
    f.equationLatex,
    f.equationPlainText,
    f.contextSnippet,
    f.keywords.join(" "),
    f.variables.map((v) => `${v.symbol} ${v.description}`).join(" "),
  ];
  return normalise(parts.join(" "));
}

// Pre-compute search text for each formula
const SEARCH_INDEX: Array<{ formula: Formula; text: string }> = FORMULAS.map(
  (f) => ({ formula: f, text: buildSearchText(f) })
);

// ============================================================
// Main search function
// ============================================================

export interface SearchResult {
  formula: Formula;
  score: number;
  /** Short snippet of matched context (not highlighted — rendering handled by UI) */
  matchedIn: Array<"title" | "section" | "equation" | "keyword" | "variable" | "context">;
}

export function searchFormulas(query: string): SearchResult[] {
  if (!query.trim()) return FORMULAS.map((f) => ({ formula: f, score: 0, matchedIn: [] }));

  const normQuery = normalise(query);
  const tokens = normQuery.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];

  for (const { formula: f, text: fullText } of SEARCH_INDEX) {
    if (!tokens.length) continue;

    let score = 0;
    const matchedIn = new Set<SearchResult["matchedIn"][number]>();

    for (const token of tokens) {
      if (!token) continue;

      const normTitle = normalise(f.title);
      const normSection = normalise(f.section);
      const normLatex = normalise(f.equationLatex);
      const normPlain = normalise(f.equationPlainText);
      const normKeywords = normalise(f.keywords.join(" "));
      const normVars = normalise(f.variables.map((v) => v.symbol + " " + v.description).join(" "));
      const normCtx = normalise(f.contextSnippet);

      if (normTitle.includes(token)) { score += 10; matchedIn.add("title"); }
      if (normSection.includes(token)) { score += 4; matchedIn.add("section"); }
      if (normLatex.includes(token)) { score += 8; matchedIn.add("equation"); }
      if (normPlain.includes(token)) { score += 8; matchedIn.add("equation"); }
      if (normKeywords.includes(token)) { score += 7; matchedIn.add("keyword"); }
      if (normVars.includes(token)) { score += 6; matchedIn.add("variable"); }
      if (normCtx.includes(token)) { score += 3; matchedIn.add("context"); }

      // Partial / fuzzy: any 3-char substring match
      if (token.length >= 3 && fullText.includes(token)) { score += 2; }
    }

    if (score > 0) {
      results.push({ formula: f, score, matchedIn: Array.from(matchedIn) });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ============================================================
// Autocomplete suggestions
// ============================================================

export interface Suggestion {
  type: "title" | "variable" | "keyword" | "section";
  label: string;
  formulaId?: string;
}

export function getSuggestions(query: string, limit = 8): Suggestion[] {
  if (query.trim().length < 2) return [];

  const norm = normalise(query);
  const suggestions: Suggestion[] = [];

  const seen = new Set<string>();

  for (const f of FORMULAS) {
    // Title match
    if (normalise(f.title).includes(norm) && !seen.has(f.title)) {
      suggestions.push({ type: "title", label: f.title, formulaId: f.id });
      seen.add(f.title);
    }

    // Variable match
    for (const v of f.variables) {
      const normSym = normalise(v.symbol);
      if ((normSym.includes(norm) || normalise(v.description).includes(norm)) && !seen.has(v.symbol)) {
        suggestions.push({ type: "variable", label: `${v.symbol} — ${v.description}`, formulaId: f.id });
        seen.add(v.symbol);
      }
    }

    // Keyword match
    for (const kw of f.keywords) {
      if (normalise(kw).includes(norm) && !seen.has(kw)) {
        suggestions.push({ type: "keyword", label: kw });
        seen.add(kw);
      }
    }
  }

  return suggestions.slice(0, limit);
}

// ============================================================
// "Que puis-je calculer ?" — derivable formulas finder
// ============================================================

export interface DerivableResult {
  formula: Formula;
  knownVars: FormulaVariable[];   // variables the user already knows
  unknownVars: FormulaVariable[]; // variables still needed / derivable outputs
  coverage: number;               // 0–1: knownVars.length / variables.length
}

/**
 * Given a list of known variable symbols, returns formulas that share at least
 * one variable with that set, sorted by coverage (highest first).
 */
export function findDerivableFormulas(knownSymbols: string[]): DerivableResult[] {
  if (knownSymbols.length === 0) return [];

  const normKnown = new Set(knownSymbols.map(normalise));

  const results: DerivableResult[] = [];

  for (const f of FORMULAS) {
    if (f.variables.length === 0) continue;

    const knownVars: FormulaVariable[] = [];
    const unknownVars: FormulaVariable[] = [];

    for (const v of f.variables) {
      if (normKnown.has(normalise(v.symbol))) {
        knownVars.push(v);
      } else {
        unknownVars.push(v);
      }
    }

    if (knownVars.length === 0) continue;

    results.push({
      formula: f,
      knownVars,
      unknownVars,
      coverage: knownVars.length / f.variables.length,
    });
  }

  return results.sort(
    (a, b) => b.coverage - a.coverage || b.knownVars.length - a.knownVars.length
  );
}
