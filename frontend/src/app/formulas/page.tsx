"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FORMULAS, FORMULA_MAP, SECTIONS, VARIABLES_ALL, type Formula, type FormulaVariable } from "@/lib/formulas-data";
import { searchFormulas, getSuggestions, findDerivableFormulas, type SearchResult, type Suggestion, type DerivableResult } from "@/lib/formula-search";
import { KaTeX } from "@/components/formulas/KaTeXRenderer";

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
function SectionBadge({ section, small }: { section: string; small?: boolean }) {
  const col = getSectionColor(section);
  const label = section.split("—")[0].trim().split(" ").slice(0, 5).join(" ");
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: small ? 10 : 10.5,
        fontWeight: 600,
        padding: small ? "1px 6px" : "2px 8px",
        borderRadius: 4,
        background: col.bg,
        color: col.color,
        border: `1px solid ${col.border}`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        maxWidth: 220,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </span>
  );
}

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
        fontSize: 11.5,
        fontWeight: 500,
        padding: "4px 10px",
        borderRadius: 5,
        border: "1px solid var(--border)",
        background: copied ? "var(--success-light)" : "#fff",
        color: copied ? "var(--success)" : "#374151",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copié" : label}
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
    <button
      onClick={() => onNavigate(f.id)}
      style={{
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: 7,
        border: "1px solid var(--border)",
        background: "#f8fafc",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "background 0.13s",
        width: "100%",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--primary-light)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f8fafc")}
    >
      <span style={{ fontSize: 10.5, color: "var(--primary)", fontWeight: 700, minWidth: 44, flexShrink: 0 }}>
        {f.id}
      </span>
      <span style={{ fontSize: 12.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {f.title}
      </span>
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: isMax ? "100vw" : "min(580px, 100vw)",
          height: "100vh",
          overflowY: "auto",
          background: "#fff",
          boxShadow: "-6px 0 32px rgba(0,0,0,0.14)",
          padding: "28px 24px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          transition: "width 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontFamily: "monospace" }}>
              {formula.id} &nbsp;·&nbsp; p.&thinsp;{formula.pageNumber}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)", lineHeight: 1.25 }}>
              {formula.title}
            </h2>
            <SectionBadge section={formula.section} />
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Fullscreen toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsMax((v) => !v); }}
              title={isMax ? "Réduire" : "Plein écran"}
              style={{
                background: isMax ? "#eff6ff" : "#f1f5f9",
                border: "none",
                cursor: "pointer",
                color: isMax ? "#2563eb" : "#64748b",
                lineHeight: 1,
                padding: "6px 8px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                transition: "background 0.13s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = isMax ? "#dbeafe" : "#e2e8f0")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = isMax ? "#eff6ff" : "#f1f5f9")}
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
            <button
              onClick={onClose}
              title="Fermer (Échap)"
              style={{
                background: "#f1f5f9",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "#64748b",
                lineHeight: 1,
                padding: "6px 8px",
                borderRadius: 6,
                transition: "background 0.13s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#e2e8f0")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Rendered equation */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid var(--card-border)",
            borderRadius: 10,
            padding: "22px 16px",
            textAlign: "center",
            overflowX: "auto",
          }}
        >
          <KaTeX tex={formula.equationLatex} displayMode={true} />
        </div>

        {/* Copy buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CopyButton value={formula.equationLatex} label="📋 Copier LaTeX" />
          <CopyButton value={formula.equationPlainText} label="Copier texte brut" />
        </div>

        {/* Context snippet */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Contexte
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "#374151", lineHeight: 1.65 }}>
            {formula.contextSnippet}
          </p>
        </div>

        {/* Variables table */}
        {formula.variables.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Variables ({formula.variables.length})
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {formula.variables.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr auto",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderTop: i > 0 ? "1px solid #f1f5f9" : undefined,
                    background: i % 2 === 0 ? "#fff" : "#f8fafc",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                    <KaTeX tex={v.symbol} />
                  </span>
                  <span style={{ fontSize: 12.5, color: "#374151" }}>{v.description}</span>
                  {v.unit && (
                    <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", fontStyle: "italic" }}>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #e2e8f0",
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Arbre de dérivation
            </div>

            {/* Parent nodes */}
            {parents.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>↖</span> Dérivée de :
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
                borderRadius: 8,
                border: "2px solid var(--primary)",
                background: "var(--primary-light)",
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
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  fontSize: 12,
                  color: "#78350f",
                  lineHeight: 1.5,
                }}
              >
                💡 {formula.derivationLinks.derivationNote}
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
                <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>↘</span> Donne naissance à :
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {children.map((c) => <DerivLink key={c.id} f={c} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Page reference */}
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
          <span>Source : S5 — Chap. 4 · GNM1002 · Prof. T. Belem</span>
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
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      style={{
        background: active ? "var(--primary-light)" : "var(--card)",
        border: `1.5px solid ${active ? "var(--primary)" : "var(--card-border)"}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "border-color 0.13s, background 0.13s, box-shadow 0.13s",
        boxShadow: active ? "0 0 0 3px var(--ring)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.borderColor = col.border;
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--card-border)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
        }
      }}
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
          <SectionBadge section={formula.section} small />
        </div>
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", flexShrink: 0, fontFamily: "monospace" }}>
          {formula.id} · p.{formula.pageNumber}
        </span>
      </div>

      {/* Equation preview */}
      <div
        style={{
          background: active ? "rgba(255,255,255,0.75)" : "#f8fafc",
          borderRadius: 7,
          padding: "12px 10px",
          overflowX: "auto",
          textAlign: "center",
          border: `1px solid ${active ? "rgba(37,99,235,0.15)" : "#f1f5f9"}`,
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
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "1px 6px",
                  borderRadius: 3,
                  border: "1px solid #e2e8f0",
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
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "1px 6px",
                  borderRadius: 3,
                  border: "1px solid #e2e8f0",
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
          stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
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
          placeholder="Rechercher : Cw, rho_h, porosité, slump, W/C, e/(1+e)…"
          className="field-input"
          style={{ paddingLeft: 38, paddingRight: value ? 36 : 12, fontSize: 13.5, height: 42 }}
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
              color: "#cbd5e1",
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
            onClick={() => { onChange(""); setOpen(false); inputRef.current?.focus(); }}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 14,
              lineHeight: 1,
              padding: "2px 4px",
            }}
          >
            ✕
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
            color: "#64748b",
          }}
        >
          <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>Apercu :</span>
          <div
            style={{
              minHeight: 22,
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
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
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 10.5, color: "#94a3b8", padding: "6px 14px 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Suggestions
          </div>
          {suggestions.map((s, i) => {
            const tc = TYPE_COLORS[s.type];
            return (
              <button
                key={i}
                onMouseDown={() => { onChange(s.label.split(" — ")[0]); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 14px",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid #f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  color: "#374151",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f8fafc")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
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
                  {s.label}
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
// Stat pill
// ──────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 20px",
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 8,
        minWidth: 90,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)" }}>{value}</span>
      <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 1 }}>{label}</span>
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
      <button
        onClick={onToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          fontWeight: 500,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: show ? "var(--primary-light)" : "#f8fafc",
          color: show ? "var(--primary)" : "#64748b",
          cursor: "pointer",
          transition: "all 0.13s",
        }}
      >
        ⌨ Clavier d&rsquo;équation {show ? "▴" : "▾"}
      </button>

      {show && (
        <div
          style={{
            marginTop: 8,
            padding: "14px 14px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
          }}
        >
          {/* Operators */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                color: "#94a3b8",
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
                  onClick={() => onAppend(op)}
                  style={{
                    padding: "5px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 5,
                    background: "#fff",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#374151",
                    lineHeight: 1,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#f0f9ff")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#fff")
                  }
                >
                  {op}
                </button>
              ))}
              <button
                onClick={() => onAppend(" ")}
                style={{
                  padding: "5px 14px",
                  border: "1px solid #d1d5db",
                  borderRadius: 5,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 10.5,
                  color: "#94a3b8",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "#f0f9ff")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "#fff")
                }
              >
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
                  color: "#94a3b8",
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
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: "3px 8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  outline: "none",
                  color: "#374151",
                  background: "#fff",
                }}
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
                  onClick={() => onAppend(sym)}
                  title={VAR_DESCRIPTIONS.get(sym) ?? sym}
                  style={{
                    padding: "3px 9px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 4,
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#374151",
                    transition: "border-color 0.1s, background 0.1s",
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
                  }}
                >
                  <KaTeX tex={sym} />
                </button>
              ))}
              {filteredVars.length === 0 && (
                <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
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
  const barColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#f97316";
  const pctColor = pct >= 80 ? "#15803d" : pct >= 50 ? "#a16207" : "#c2410c";

  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        background: "#fff",
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
              background: "#f1f5f9",
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
          <SectionBadge section={formula.section} small />
        </div>
      </div>

      {/* Variable chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {knownVars.map((v) => (
          <span
            key={v.symbol}
            title={`${v.description}${v.unit ? ` [${v.unit}]` : ""} — connu`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid #86efac",
              background: "#f0fdf4",
              fontSize: 12,
              color: "#15803d",
              fontWeight: 600,
            }}
          >
            <KaTeX tex={v.symbol} />
            <span style={{ fontSize: 9, opacity: 0.8 }}>✓</span>
          </span>
        ))}
        {unknownVars.map((v) => (
          <span
            key={v.symbol}
            title={`${v.description}${v.unit ? ` [${v.unit}]` : ""} — à trouver`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid #fbbf24",
              background: "#fffbeb",
              fontSize: 12,
              color: "#92400e",
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
          background: "#f8fafc",
          borderRadius: 6,
          padding: "10px",
          textAlign: "center",
          border: "1px solid #f1f5f9",
          overflowX: "auto",
        }}
      >
        <KaTeX tex={formula.equationLatex} displayMode style={{ fontSize: "0.82em" }} />
      </div>

      {/* Open detail */}
      <button
        onClick={() => onOpen(formula.id)}
        style={{
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: 500,
          padding: "4px 12px",
          borderRadius: 5,
          border: "1px solid var(--border)",
          background: "#f8fafc",
          cursor: "pointer",
          color: "#374151",
          transition: "background 0.13s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "var(--primary-light)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "#f8fafc")
        }
      >
        Voir les détails →
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
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          Variables connues ({selected.size}) — cliquez pour retirer
        </div>
        {selected.size === 0 ? (
          <div style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>
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
                  border: "1px solid #93c5fd",
                  borderRadius: 20,
                  background: "#eff6ff",
                  cursor: "pointer",
                  color: "#1d4ed8",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <KaTeX tex={sym} />
                <span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
              </button>
            ))}
            <button
              onClick={() => setSelected(new Set())}
              style={{
                padding: "4px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 20,
                background: "#f8fafc",
                cursor: "pointer",
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
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
                  borderRadius: 5,
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 500,
                  transition: "all 0.1s",
                  border: `1px solid ${isSelected ? "#93c5fd" : "#e2e8f0"}`,
                  background: isSelected ? "#eff6ff" : "#fff",
                  color: isSelected ? "#1d4ed8" : "#374151",
                }}
              >
                <KaTeX tex={sym} />
              </button>
            );
          })}
          {filteredEntries.length === 0 && (
            <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "4px 0" }}>
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
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Formules calculables — {derivable.length} trouvée{derivable.length !== 1 ? "s" : ""}
            , triées par couverture
          </div>
          {derivable.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 24px",
                background: "#f8fafc",
                borderRadius: 10,
                color: "#94a3b8",
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
                <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", paddingTop: 4 }}>
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
    <div style={{ flex: 1, overflowY: "auto", background: "var(--background)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 24px 80px" }}>

        {/* Page header + stats */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              Bibliothèque de formules
            </h1>
            <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: 13 }}>
              Source : <em>S5 — Chapitre 4 · GNM1002-H2026 · Prof. Tikou Belem</em>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StatPill label="formules" value={FORMULAS.length} />
            <StatPill label="sections" value={SECTIONS.length} />
            <StatPill label="avec liens" value={withLinks} />
          </div>
        </div>

        {/* Mode tabs + main card */}
        <div className="form-card" style={{ marginBottom: 20, padding: "16px 20px" }}>
          {/* Mode switcher */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 14,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 12,
            }}
          >
            {(
              [
                { key: "search", label: "🔍 Rechercher" },
                { key: "derive", label: "🧮 Que puis-je calculer ?" },
              ] as const
            ).map(({ key, label }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    background: active ? "var(--primary)" : "transparent",
                    color: active ? "#fff" : "var(--muted-foreground)",
                    transition: "all 0.13s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {mode === "search" ? (
            <>
              <SearchInput value={query} onChange={setQuery} inputRef={searchRef} />
              <SymbolPalette
                show={showPalette}
                onToggle={() => setShowPalette((v) => !v)}
                onAppend={handleAppend}
              />
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {query
                    ? `${results.length} résultat${results.length !== 1 ? "s" : ""} · titre, variable, équation, mot-clé, contexte`
                    : `${FORMULAS.length} formules · appuyez / pour chercher`}
                </span>
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    style={{ background: "none", border: "none", fontSize: 11.5, color: "var(--primary)", cursor: "pointer", fontWeight: 500 }}
                  >
                    Effacer
                  </button>
                )}
              </div>
            </>
          ) : (
            <DeriveMode onOpenFormula={(id) => { setSelectedId(id); }} />
          )}
        </div>

        {mode === "derive" ? null : (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* ── Sidebar ── */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              borderRadius: 10,
              paddingTop: 12,
              paddingBottom: 12,
              position: "sticky",
              top: "calc(var(--nav-height) + 16px)",
              maxHeight: "calc(100vh - var(--nav-height) - 32px)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#94a3b8",
                padding: "0 14px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Filtrer par section
            </div>

            {/* All */}
            {["all", ...SECTIONS].map((sec) => {
              const active = selectedSection === sec;
              const label = sec === "all" ? "Toutes les formules" : sec.split("—")[0].trim();
              const count = sectionCounts[sec] ?? 0;
              const col = sec !== "all" ? getSectionColor(sec) : null;

              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "7px 14px",
                    background: active ? (col ? col.bg : "var(--primary-light)") : "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    color: active ? (col ? col.color : "var(--primary)") : "#374151",
                    borderLeft: active ? `3px solid ${col ? col.color : "var(--primary)"}` : "3px solid transparent",
                    transition: "all 0.13s",
                    lineHeight: 1.35,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = "none";
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 10.5, flexShrink: 0, color: active ? "inherit" : "var(--muted-foreground)", marginLeft: 4 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Formula grid ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {results.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "80px 24px",
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 14 }}>🔎</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
                  Aucune formule trouvée
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.6 }}>
                  Essayez : &ldquo;Cw&rdquo;, &ldquo;porosité&rdquo;, &ldquo;rho_h&rdquo;, &ldquo;slump&rdquo;,
                  &ldquo;W/C&rdquo;, &ldquo;liant&rdquo;, &ldquo;PAF&rdquo;, &ldquo;CRF&rdquo; ou un fragment d&rsquo;équation
                </div>
                <button
                  onClick={() => { setQuery(""); setSelectedSection("all"); }}
                  className="btn-secondary"
                  style={{ marginTop: 18, fontSize: 13 }}
                >
                  Réinitialiser la recherche
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 14,
                }}
              >
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
      </div>

      {/* Detail slide-over */}
      {selectedFormula && (
        <FormulaDetail
          formula={selectedFormula}
          onClose={() => setSelectedId(null)}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
