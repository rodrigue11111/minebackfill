"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FORMULAS, FORMULA_MAP, SECTIONS, VARIABLES_ALL, type Formula } from "@/lib/formulas-data";
import { searchFormulas, getSuggestions, findDerivableFormulas, type SearchResult, type Suggestion, type DerivableResult } from "@/lib/formula-search";
import { KaTeX } from "@/components/formulas/KaTeXRenderer";
import { Page, EnTetePage } from "@/components/ui/Page";
import { Carte } from "@/components/ui/Carte";
import { BandeChiffres } from "@/components/ui/Chiffres";
import { Icone } from "@/components/ui/Icones";
import Segmente from "@/components/ui/Segmente";

// ──────────────────────────────────────────────
// Section colour palette
// ──────────────────────────────────────────────
const SECTION_COLORS: Record<string, { bg: string; color: string; border: string }> = {};
const PALETTE = [
  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  { bg: "#fefce8", color: "#a16207", border: "#fef08a" },
  { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
  { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
];
SECTIONS.forEach((s, i) => {
  SECTION_COLORS[s] = PALETTE[i % PALETTE.length];
});

function getSectionColor(section: string) {
  return SECTION_COLORS[section] ?? PALETTE[7];
}

// ──────────────────────────────────────────────
// Tiny helper components
// ──────────────────────────────────────────────
type MatchField = "title" | "section" | "equation" | "keyword" | "variable" | "context";
const MATCH_LABELS: Record<MatchField, string> = {
  title: "titre", section: "section", equation: "équation",
  keyword: "mot-clé", variable: "variable", context: "contexte",
};
const MATCH_COLORS: Record<MatchField, { bg: string; color: string }> = {
  title: { bg: "#eff6ff", color: "#1d4ed8" },
  equation: { bg: "#f0fdf4", color: "#15803d" },
  variable: { bg: "#fdf4ff", color: "#7e22ce" },
  keyword: { bg: "#fefce8", color: "#a16207" },
  section: { bg: "#f0f9ff", color: "#0369a1" },
  context: { bg: "#f8fafc", color: "#475569" },
};

function MatchChip({ field }: { field: MatchField }) {
  const c = MATCH_COLORS[field];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 3,
        background: c.bg,
        color: c.color,
        letterSpacing: "0.03em",
      }}
    >
      {MATCH_LABELS[field]}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        fontWeight: 500,
        padding: "6px 14px",
        borderRadius: 999,
        border: "none",
        background: copied ? "var(--succes-pale)" : "var(--accent-pale)",
        color: copied ? "var(--succes-texte)" : "var(--accent)",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copié" : label}
    </button>
  );
}

// ──────────────────────────────────────────────
// Formula Detail Panel (slide-over)
// ──────────────────────────────────────────────
function FormulaDetail({
  formula,
  onClose,
  onNavigate,
}: {
  formula: Formula;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const [isMax, setIsMax] = useState(false);
  const parents = formula.derivationLinks.derivedFrom
    .map((id) => FORMULA_MAP.get(id))
    .filter(Boolean) as Formula[];
  const children = formula.derivationLinks.derivesInto
    .map((id) => FORMULA_MAP.get(id))
    .filter(Boolean) as Formula[];

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const DerivLink = ({ f }: { f: Formula }) => (
    <button type="button" className="frm-lien-derivation" onClick={() => onNavigate(f.id)}>
      <span style={{ fontSize: 10.5, color: "var(--primary)", fontWeight: 700, minWidth: 44, flexShrink: 0 }}>
        {f.id}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--texte)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {f.title}
      </span>
    </button>
  );

  return (
    <div className="frm-voile" onClick={onClose}>
      <div
        className="frm-volet"
        role="dialog"
        aria-modal="true"
        aria-label={formula.title}
        style={{ width: isMax ? "100vw" : "min(580px, 100vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontFamily: "monospace" }}>
              {formula.id} &nbsp;·&nbsp; p.&thinsp;{formula.pageNumber}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--texte)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              {formula.title}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Fullscreen toggle */}
            <button
              type="button"
              className={isMax ? "frm-bouton-icone frm-bouton-icone-actif" : "frm-bouton-icone"}
              onClick={(e) => { e.stopPropagation(); setIsMax((v) => !v); }}
              title={isMax ? "Réduire" : "Plein écran"}
              aria-label={isMax ? "Réduire" : "Plein écran"}
            >
              {isMax ? (
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M5 1v4H1M8 5V1h4M8 12V8h4M5 8v4H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M1 5V1h4M8 1h4v4M12 8v4h-4M5 12H1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            {/* Close */}
            <button type="button" className="frm-bouton-icone" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer">
              <Icone nom="fermer" taille={14} epaisseur={2.2} />
            </button>
          </div>
        </div>

        {/* Rendered equation */}
        <div
          style={{
            background: "var(--champ)",
            borderRadius: "var(--rayon-bloc)",
            padding: "22px 16px",
            overflowX: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <KaTeX tex={formula.equationLatex} displayMode={true} />
        </div>

        {/* Copy buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CopyButton value={formula.equationLatex} label="Copier LaTeX" />
          <CopyButton value={formula.equationPlainText} label="Copier texte brut" />
        </div>

        {/* Context snippet */}
        <div>
          <div className="frm-rubrique">
            Contexte
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--texte)", lineHeight: 1.65 }}>
            {formula.contextSnippet}
          </p>
        </div>

        {/* Variables table */}
        {formula.variables.length > 0 && (
          <div>
            <div className="frm-rubrique">
              Variables ({formula.variables.length})
            </div>
            <div style={{ background: "var(--champ)", borderRadius: "var(--rayon-champ)", overflow: "hidden" }}>
              {formula.variables.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr auto",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderTop: i > 0 ? "1px solid var(--filet-fort)" : undefined,
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                    <KaTeX tex={v.symbol} />
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--texte)" }}>{v.description}</span>
                  {v.unit && (
                    <span style={{ fontSize: 11, color: "var(--texte-3)", whiteSpace: "nowrap", fontStyle: "italic" }}>
                      [{v.unit}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        {formula.keywords.length > 0 && (
          <div>
            <div className="frm-rubrique">
              Mots-clés
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {formula.keywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: 11.5,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "var(--segment-fond)",
                    color: "var(--texte-2)",
                    border: "1px solid var(--filet-fort)",
                    cursor: "default",
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Derivation tree */}
        {(parents.length > 0 || children.length > 0) && (
          <div>
            <div className="frm-rubrique" style={{ marginBottom: 12 }}>
              Arbre de dérivation
            </div>

            {/* Parent nodes */}
            {parents.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--texte-2)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  Dérivée de :
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {parents.map((p) => <DerivLink key={p.id} f={p} />)}
                </div>
              </div>
            )}

            {/* Vertical connector */}
            {parents.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                <div style={{ width: 2, height: 18, background: "var(--primary)", opacity: 0.4 }} />
              </div>
            )}

            {/* Current node */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--rayon-champ)",
                background: "var(--accent-pale)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 800, minWidth: 44, flexShrink: 0 }}>
                {formula.id}
              </span>
              <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                {formula.title}
              </span>
            </div>

            {/* Derivation note */}
            {formula.derivationLinks.derivationNote && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "var(--alerte-pale)",
                  fontSize: 12.5,
                  color: "var(--alerte-texte)",
                  lineHeight: 1.5,
                }}
              >
                {formula.derivationLinks.derivationNote}
              </div>
            )}

            {/* Vertical connector */}
            {children.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                <div style={{ width: 2, height: 18, background: "var(--primary)", opacity: 0.4 }} />
              </div>
            )}

            {/* Child nodes */}
            {children.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 11.5, color: "var(--texte-2)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  Donne naissance à :
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {children.map((c) => <DerivLink key={c.id} f={c} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Page référence */}
        <div
          style={{
            fontSize: 12,
            color: "var(--muted-foreground)",
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Source : S5, chap. 4 · GNM1002 · Prof. T. Belem</span>
          <span style={{ fontWeight: 600 }}>p.&thinsp;{formula.pageNumber}</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Formula Card
// ──────────────────────────────────────────────
function FormulaCard({
  result,
  active,
  onClick,
}: {
  result: SearchResult;
  active: boolean;
  onClick: () => void;
}) {
  const { formula, matchedIn } = result;
  const col = getSectionColor(formula.section);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={active ? "frm-carte frm-carte-active" : "frm-carte"}
      style={{ "--frm-bord": col.border } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: active ? "var(--primary)" : "var(--foreground)",
              marginBottom: 5,
              lineHeight: 1.3,
            }}
          >
            {formula.title}
          </div>
        </div>
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "monospace" }}>
          {formula.id} · p.{formula.pageNumber}
        </span>
      </div>

      {/* Equation preview */}
      <div
        style={{
          background: active ? "rgba(255,255,255,0.75)" : "var(--champ)",
          borderRadius: "var(--rayon-champ)",
          padding: "12px 10px",
          overflowX: "auto",
          textAlign: "center",
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <KaTeX tex={formula.equationLatex} displayMode={true} style={{ fontSize: "0.82em" }} />
      </div>

      {/* Footer: match chips + derivation indicators */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 6 }}>
        {/* Match field chips */}
        {matchedIn.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {matchedIn.map((f) => (
              <MatchChip key={f} field={f as MatchField} />
            ))}
          </div>
        )}

        {/* Derivation chain */}
        {(formula.derivationLinks.derivedFrom.length > 0 || formula.derivationLinks.derivesInto.length > 0) && (
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {formula.derivationLinks.derivedFrom.length > 0 && (
              <span
                title={`Dérivée de : ${formula.derivationLinks.derivedFrom.join(", ")}`}
                style={{
                  fontSize: 10,
                  color: "var(--texte-2)",
                  background: "var(--segment-fond)",
                  padding: "1px 6px",
                  borderRadius: 3,
                  cursor: "default",
                }}
              >
                ← {formula.derivationLinks.derivedFrom.length}
              </span>
            )}
            {formula.derivationLinks.derivesInto.length > 0 && (
              <span
                title={`Donne : ${formula.derivationLinks.derivesInto.join(", ")}`}
                style={{
                  fontSize: 10,
                  color: "var(--texte-2)",
                  background: "var(--segment-fond)",
                  padding: "1px 6px",
                  borderRadius: 3,
                  cursor: "default",
                }}
              >
                → {formula.derivationLinks.derivesInto.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Search input with autocomplete dropdown
// ──────────────────────────────────────────────
function SearchInput({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => getSuggestions(value), [value]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const afficherApercuEquation = /[\\^_{}]/.test(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const TYPE_COLORS: Record<Suggestion["type"], { bg: string; color: string }> = {
    title: { bg: "#eff6ff", color: "#1d4ed8" },
    variable: { bg: "#fdf4ff", color: "#7e22ce" },
    keyword: { bg: "#fefce8", color: "#a16207" },
    section: { bg: "#f0f9ff", color: "#0369a1" },
  };

  const TYPE_LABELS: Record<Suggestion["type"], string> = {
    title: "titre",
    variable: "variable",
    keyword: "mot-clé",
    section: "section",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        {/* Search icon */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--texte-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--texte-3)" }}
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); onChange(""); } }}
          placeholder="Rechercher : Cw, rho_h, porosité, affaissement, E/L, e/(1+e)…"
          className="field-input"
          style={{ paddingLeft: 38, paddingRight: value ? 36 : 12, height: 44 }}
        />

        {/* Keyboard hint */}
        {!value && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: "var(--texte-3)",
              pointerEvents: "none",
              fontFamily: "monospace",
            }}
          >
            /
          </span>
        )}

        {/* Clear button */}
        {value && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => { onChange(""); setOpen(false); inputRef.current?.focus(); }}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--texte-3)",
              lineHeight: 0,
              padding: 4,
            }}
          >
            <Icone nom="fermer" taille={13} epaisseur={2.2} />
          </button>
        )}
      </div>

      {value && afficherApercuEquation && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--texte-2)",
          }}
        >
          <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>Aperçu :</span>
          <div
            style={{
              minHeight: 22,
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid var(--filet-fort)",
              background: "var(--champ)",
              overflowX: "auto",
              maxWidth: "100%",
            }}
          >
            <KaTeX tex={value} />
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            borderRadius: "var(--rayon-champ)",
            boxShadow: "var(--ombre-flottante)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 10.5, color: "var(--texte-3)", padding: "6px 14px 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Suggestions
          </div>
          {suggestions.map((s, i) => {
            const tc = TYPE_COLORS[s.type];
            return (
              <button
                key={i}
                type="button"
                className="frm-suggestion"
                onMouseDown={() => { onChange(s.symbol ?? s.label); setOpen(false); }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: tc.bg,
                    color: tc.color,
                    textTransform: "uppercase",
                    minWidth: 52,
                    textAlign: "center",
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                  }}
                >
                  {TYPE_LABELS[s.type]}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {/* Une variable porte son symbole et sa description
                      séparément : on rend le symbole comme les pastilles et
                      l'aperçu le font déjà, au lieu d'afficher le LaTeX brut.
                      Repli sur le libellé pour les autres types. */}
                  {s.symbol ? (
                    <>
                      <KaTeX tex={s.symbol} />
                      {s.description ? <span style={{ color: "var(--texte-2)", marginLeft: 8 }}>{s.description}</span> : null}
                    </>
                  ) : (
                    s.label
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Symbol palette (equation builder keyboard)
// ──────────────────────────────────────────────
const OPERATORS = ["+", "−", "×", "/", "(", ")", "=", "^", "·"];

// Build a deduplicated map: symbol → first description found
const VAR_DESCRIPTIONS: Map<string, string> = new Map();
for (const f of FORMULAS) {
  for (const v of f.variables) {
    if (!VAR_DESCRIPTIONS.has(v.symbol)) VAR_DESCRIPTIONS.set(v.symbol, v.description);
  }
}

function SymbolPalette({
  show,
  onToggle,
  onAppend,
}: {
  show: boolean;
  onToggle: () => void;
  onAppend: (sym: string) => void;
}) {
  const [filter, setFilter] = useState("");

  const filteredVars = useMemo(() => {
    if (!filter) return VARIABLES_ALL;
    const q = filter.toLowerCase();
    return VARIABLES_ALL.filter(
      (sym) =>
        sym.toLowerCase().includes(q) ||
        (VAR_DESCRIPTIONS.get(sym) ?? "").toLowerCase().includes(q)
    );
  }, [filter]);

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="btn-discret" aria-expanded={show} onClick={onToggle}>
        Clavier d&rsquo;équation
        <span style={{ display: "inline-flex", transform: show ? "rotate(-90deg)" : "rotate(90deg)" }}>
          <Icone nom="chevron" taille={11} epaisseur={2.4} />
        </span>
      </button>

      {show && (
        <div
          style={{
            marginTop: 8,
            padding: "14px 14px",
            background: "var(--champ)",
            borderRadius: "var(--rayon-bloc)",
          }}
        >
          {/* Operators */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: "var(--texte-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Opérateurs
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {OPERATORS.map((op) => (
                <button
                  key={op}
                  type="button"
                  className="frm-touche frm-touche-operateur"
                  onClick={() => onAppend(op)}
                >
                  {op}
                </button>
              ))}
              <button type="button" className="frm-touche frm-touche-espace" onClick={() => onAppend(" ")}>
                espace
              </button>
            </div>
          </div>

          {/* Variable symbols */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--texte-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                Variables ({VARIABLES_ALL.length})
              </span>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrer…"
                aria-label="Filtrer les variables"
                className="field-input"
                style={{ flex: 1, minHeight: 32, padding: "4px 10px", fontSize: 13, background: "var(--surface)" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                maxHeight: 136,
                overflowY: "auto",
              }}
            >
              {filteredVars.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className="frm-touche"
                  onClick={() => onAppend(sym)}
                  title={VAR_DESCRIPTIONS.get(sym) ?? sym}
                >
                  <KaTeX tex={sym} />
                </button>
              ))}
              {filteredVars.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--texte-3)", fontStyle: "italic" }}>
                  Aucune variable correspondante
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Derive result card
// ──────────────────────────────────────────────
function DeriveResultCard({
  result,
  onOpen,
}: {
  result: DerivableResult;
  onOpen: (id: string) => void;
}) {
  const { formula, knownVars, unknownVars, coverage } = result;
  const pct = Math.round(coverage * 100);
  const barColor = pct >= 80 ? "var(--succes)" : pct >= 50 ? "#F5B800" : "var(--hors-tolerance)";
  const pctColor = pct >= 80 ? "var(--succes-texte)" : pct >= 50 ? "var(--alerte-texte)" : "var(--hors-tolerance-texte)";

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "var(--rayon-bloc)",
        background: "var(--surface)",
        boxShadow: "var(--ombre-carte)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "monospace",
              color: "var(--primary)",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {formula.id}
          </span>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {formula.title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: pctColor }}>{pct}%</span>
          <div
            style={{
              width: 64,
              height: 6,
              borderRadius: 3,
              background: "var(--segment-fond)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: barColor,
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      </div>

      {/* Variable chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {knownVars.map((v) => (
          <span
            key={v.symbol}
            title={`${v.description}${v.unit ? ` [${v.unit}]` : ""} (connu)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--succes-pale)",
              fontSize: 12,
              color: "var(--succes-texte)",
              fontWeight: 600,
            }}
          >
            <KaTeX tex={v.symbol} />
            <Icone nom="coche" taille={10} epaisseur={2.6} />
          </span>
        ))}
        {unknownVars.map((v) => (
          <span
            key={v.symbol}
            title={`${v.description}${v.unit ? ` [${v.unit}]` : ""} (à trouver)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--alerte-pale)",
              fontSize: 12,
              color: "var(--alerte-texte)",
              fontWeight: 600,
            }}
          >
            <KaTeX tex={v.symbol} />
            <span style={{ fontSize: 9, opacity: 0.6 }}>?</span>
          </span>
        ))}
      </div>

      {/* Equation preview */}
      <div
        style={{
          background: "var(--champ)",
          padding: "10px",
          textAlign: "center",
          borderRadius: "var(--rayon-champ)",
          overflowX: "auto",
        }}
      >
        <KaTeX tex={formula.equationLatex} displayMode style={{ fontSize: "0.82em" }} />
      </div>

      {/* Open detail */}
      <button type="button" className="btn-discret" style={{ alignSelf: "flex-start" }} onClick={() => onOpen(formula.id)}>
        Voir les détails
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────
// "Que puis-je calculer ?" panel
// ──────────────────────────────────────────────
function DeriveMode({ onOpenFormula }: { onOpenFormula: (id: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [varSearch, setVarSearch] = useState("");

  // Unique symbol → description map (stable)
  const allVarEntries = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of FORMULAS) {
      for (const v of f.variables) {
        if (!map.has(v.symbol)) map.set(v.symbol, v.description);
      }
    }
    return Array.from(map.entries());
  }, []);

  const filteredEntries = useMemo(() => {
    if (!varSearch) return allVarEntries;
    const q = varSearch.toLowerCase();
    return allVarEntries.filter(
      ([sym, desc]) => sym.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
    );
  }, [allVarEntries, varSearch]);

  const derivable = useMemo(
    () => findDerivableFormulas(Array.from(selected)),
    [selected]
  );

  const toggle = useCallback((sym: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Selected chips */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--texte-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          Variables connues ({selected.size}) : cliquez sur une variable pour la retirer
        </div>
        {selected.size === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--texte-3)", fontStyle: "italic" }}>
            Sélectionnez des variables ci-dessous pour découvrir ce que vous pouvez calculer.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Array.from(selected).map((sym) => (
              <button
                key={sym}
                onClick={() => toggle(sym)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  border: "none",
                  borderRadius: 999,
                  background: "var(--accent-pale)",
                  cursor: "pointer",
                  color: "var(--accent)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <KaTeX tex={sym} />
                <Icone nom="fermer" taille={10} epaisseur={2.6} />
              </button>
            ))}
            <button type="button" className="btn-discret" onClick={() => setSelected(new Set())}>
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* Variable picker */}
      <div>
        <input
          type="text"
          value={varSearch}
          onChange={(e) => setVarSearch(e.target.value)}
          placeholder="Rechercher une variable… (ex: Cw, rho, porosité, liant)"
          className="field-input"
          style={{ fontSize: 13, height: 40 }}
        />
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            maxHeight: 168,
            overflowY: "auto",
          }}
        >
          {filteredEntries.map(([sym, desc]) => {
            const isSelected = selected.has(sym);
            return (
              <button
                key={sym}
                onClick={() => toggle(sym)}
                title={desc}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 500,
                  transition: "all 0.1s",
                  border: "none",
                  background: isSelected ? "var(--accent-pale)" : "var(--champ)",
                  color: isSelected ? "var(--accent)" : "var(--texte)",
                }}
              >
                <KaTeX tex={sym} />
              </button>
            );
          })}
          {filteredEntries.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--texte-3)", fontStyle: "italic", padding: "4px 0" }}>
              Aucune variable correspondante
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {selected.size > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--texte-3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Formules calculables : {derivable.length} trouvée{derivable.length !== 1 ? "s" : ""}
            , triées par couverture
          </div>
          {derivable.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 24px",
                background: "var(--champ)",
                borderRadius: 10,
                color: "var(--texte-3)",
                fontSize: 13,
              }}
            >
              Aucune formule ne peut être calculée avec ces seules variables.
              <br />
              Essayez d&rsquo;en ajouter d&rsquo;autres.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {derivable.slice(0, 30).map((r) => (
                <DeriveResultCard key={r.formula.id} result={r} onOpen={onOpenFormula} />
              ))}
              {derivable.length > 30 && (
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--texte-3)", paddingTop: 4 }}>
                  … et {derivable.length - 30} autres formules
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
export default function FormulaLibraryPage() {
  const [query, setQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"search" | "derive">("search");
  const [showPalette, setShowPalette] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleAppend = useCallback(
    (sym: string) => {
      setQuery((prev) => {
        const sep = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
        return prev + sep + sym;
      });
      searchRef.current?.focus();
    },
    []
  );

  // "/" keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const rawResults = useMemo(() => searchFormulas(query), [query]);

  const results = useMemo<SearchResult[]>(() => {
    if (selectedSection === "all") return rawResults;
    return rawResults.filter((r) => r.formula.section === selectedSection);
  }, [rawResults, selectedSection]);

  const selectedFormula = selectedId ? FORMULA_MAP.get(selectedId) ?? null : null;

  const handleNavigate = useCallback((id: string) => setSelectedId(id), []);

  // Counts per section (from ALL formulas, not filtered)
  const sectionCounts = useMemo(() => {
    const map: Record<string, number> = { all: FORMULAS.length };
    for (const f of FORMULAS) map[f.section] = (map[f.section] ?? 0) + 1;
    return map;
  }, []);

  // Number of formulas with derivation links
  const withLinks = useMemo(
    () => FORMULAS.filter((f) => f.derivationLinks.derivedFrom.length > 0 || f.derivationLinks.derivesInto.length > 0).length,
    []
  );

  return (
    <Page>
      <EnTetePage
        titre="Formules"
        sousTitre={<>Bibliothèque des formules du cours. Source : <em>S5, chapitre 4 · GNM1002-H2026 · Prof. Tikou Belem</em>.</>}
      />

      <BandeChiffres
        ariaLabel="Contenu de la bibliothèque"
        chiffres={[
          { libelle: "Formules", valeur: FORMULAS.length },
          { libelle: "Sections", valeur: SECTIONS.length },
          { libelle: "Avec liens de dérivation", valeur: withLinks },
        ]}
      />

      <Carte>
        <Segmente
          ariaLabel="Mode de la bibliothèque"
          valeur={mode}
          onChange={(v) => setMode(v)}
          options={[
            { valeur: "search", libelle: "Rechercher" },
            { valeur: "derive", libelle: "Que puis-je calculer ?", libelleCourt: "Calculable ?" },
          ]}
        />

        {mode === "search" ? (
          <div>
            <SearchInput value={query} onChange={setQuery} inputRef={searchRef} />
            <SymbolPalette
              show={showPalette}
              onToggle={() => setShowPalette((v) => !v)}
              onAppend={handleAppend}
            />
            <div className="frm-recherche-pied">
              <span>
                {query
                  ? `${results.length} résultat${results.length !== 1 ? "s" : ""} · titre, variable, équation, mot-clé, contexte`
                  : `${FORMULAS.length} formules · appuyez / pour chercher`}
              </span>
              {query && (
                <button type="button" className="btn-discret" onClick={() => setQuery("")}>
                  Effacer
                </button>
              )}
            </div>
          </div>
        ) : (
          <DeriveMode onOpenFormula={(id) => { setSelectedId(id); }} />
        )}
      </Carte>

      {mode === "derive" ? null : (
        <div className="frm-corps">
          {/* ── Filtre par section ── */}
          <nav className="frm-filtres" aria-label="Filtrer par section">
            <div className="frm-filtres-titre">Sections</div>
            {["all", ...SECTIONS].map((sec) => {
              const active = selectedSection === sec;
              const label = sec === "all" ? "Toutes les formules" : sec;
              const count = sectionCounts[sec] ?? 0;
              return (
                <button
                  key={sec}
                  type="button"
                  className="frm-filtre"
                  aria-pressed={active}
                  title={sec === "all" ? undefined : sec}
                  onClick={() => setSelectedSection(sec)}
                >
                  <span className="frm-filtre-nom">{label}</span>
                  <span className="frm-filtre-compte">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* ── Grille des formules ── */}
          <div style={{ minWidth: 0 }}>
            {results.length === 0 ? (
              <Carte>
                <div className="frm-vide">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <p className="frm-vide-titre">Aucune formule trouvée</p>
                  <p className="classe-rien">
                    Essayez : &ldquo;Cw&rdquo;, &ldquo;porosité&rdquo;, &ldquo;rho_h&rdquo;, &ldquo;affaissement&rdquo;,
                    &ldquo;E/L&rdquo;, &ldquo;liant&rdquo;, &ldquo;granulat&rdquo;, &ldquo;roches stériles&rdquo; ou un fragment d&rsquo;équation
                  </p>
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setSelectedSection("all"); }}
                    className="btn-secondary"
                    style={{ marginTop: 10 }}
                  >
                    Réinitialiser la recherche
                  </button>
                </div>
              </Carte>
            ) : (
              <div className="frm-grille">
                {results.map((r) => (
                  <FormulaCard
                    key={r.formula.id}
                    result={r}
                    active={selectedId === r.formula.id}
                    onClick={() => setSelectedId(selectedId === r.formula.id ? null : r.formula.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Volet de détail */}
      {selectedFormula && (
        <FormulaDetail
          formula={selectedFormula}
          onClose={() => setSelectedId(null)}
          onNavigate={handleNavigate}
        />
      )}
    </Page>
  );
}
