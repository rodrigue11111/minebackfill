// src/app/mix/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import LeftPane from "@/src/components/mix/LeftPane";
import ResultsPanel from "@/src/components/mix/ResultsPanel";
import CwForm from "@/src/components/mix/rpc/CwForm";
import WbForm from "@/src/components/mix/rpc/WbForm";
import SlumpForm from "@/src/components/mix/rpc/SlumpForm";
import EssaiForm from "@/src/components/mix/rpc/EssaiForm";
import RpgCwForm from "@/src/components/mix/rpg/RpgCwForm";
import RpgWbForm from "@/src/components/mix/rpg/RpgWbForm";
import RpgEssaiForm from "@/src/components/mix/rpg/RpgEssaiForm";

const METHOD_LABELS: Record<string, string> = {
  dosage_cw: "Dosage selon Cw (%)",
  wb: "Rapport eau/ciment (W/C)",
  slump: "Ajustement pour slump",
  essai: "Méthode essai-erreur",
};

const RESULTS_MIN = 280;
const RESULTS_MAX = 780;
const RESULTS_DEFAULT = 440;

export default function MixPage() {
  const { category, method } = useStore();

  /* ── Resizable results panel ── */
  const [resultsWidth, setResultsWidth] = useState(RESULTS_DEFAULT);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(RESULTS_DEFAULT);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      setResultsWidth(
        Math.max(RESULTS_MIN, Math.min(RESULTS_MAX, dragStartWidth.current + delta))
      );
    };
    const onUp = () => { isDragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = resultsWidth;
    e.preventDefault();
  };

  const renderForm = () => {
    if (category === "RRC") {
      return (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--muted-foreground)",
          }}
        >
            <p style={{ fontWeight: 600, fontSize: 15, color: "#374151" }}>Module RRC — à venir</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Les formulaires pour la catégorie <strong>RRC</strong> seront disponibles dans une prochaine version.
          </p>
        </div>
      );
    }

    if (category === "RPG" && method === "slump") {
      return (
        <div
          style={{
            background: "var(--warning-light)",
            border: "1px solid #fcd34d",
            borderRadius: 10,
            padding: "20px 24px",
            color: "var(--warning)",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Méthode non disponible pour RPG</p>
          <p style={{ fontSize: 13 }}>
            L&apos;ajustement par slump est une méthode empirique spécifique à <strong>RPC</strong>.
            Utilisez <strong>Essai-erreur</strong> pour appliquer des ajustements manuels en RPG.
          </p>
        </div>
      );
    }

    if (category === "RPG") {
      switch (method) {
        case "dosage_cw": return <RpgCwForm />;
        case "wb":        return <RpgWbForm />;
        case "essai":     return <RpgEssaiForm />;
        default:          return null;
      }
    }

    switch (method) {
      case "dosage_cw":
        return <CwForm />;
      case "wb":
        return <WbForm />;
      case "slump":
        return category === "RPC" ? <SlumpForm /> : null;
      case "essai":
        return category === "RPC" ? <EssaiForm /> : null;
      default:
        return (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "40px 24px",
              textAlign: "center",
              color: "var(--muted-foreground)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
              Sélectionnez une catégorie et une méthode dans le panneau de gauche.
            </p>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        flex: 1,
        background: "var(--background)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Body: sidebar + form + results ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Left sidebar — hidden when maximized */}
        {!isMaximized && (
          <aside
            style={{
              width: 240,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              background: "#fff",
              overflowY: "auto",
            }}
          >
            <LeftPane />
          </aside>
        )}

        {/* Center: form — hidden when maximized */}
        {!isMaximized && (
          <main
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 28px",
              minWidth: 0,
            }}
          >
            {/* Method breadcrumb */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {category || "—"} · {METHOD_LABELS[method] || "Sélectionner une méthode"}
              </div>
              {category === "RPG" && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "#92400e",
                    marginBottom: 12,
                  }}
                >
                  Mode RPG — méthodes Cw% et W/C uniquement
                </div>
              )}
            </div>
            {renderForm()}
          </main>
        )}

        {/* Drag handle — hidden when maximized */}
        {!isMaximized && (
          <div
            onMouseDown={startDrag}
            title="Glisser pour redimensionner"
            style={{
              width: 5,
              flexShrink: 0,
              cursor: "col-resize",
              background: "var(--border)",
              transition: "background 0.15s",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--border)";
            }}
          />
        )}

        {/* Right: results */}
        <aside
          style={{
            width: isMaximized ? undefined : resultsWidth,
            flex: isMaximized ? 1 : undefined,
            flexShrink: 0,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Sticky header with fullscreen toggle */}
          <div
            style={{
              borderBottom: "1px solid #f1f5f9",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Résultats
            </span>
            <button
              onClick={() => setIsMaximized((v) => !v)}
              title={isMaximized ? "Réduire le panneau" : "Afficher en plein écran"}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                background: isMaximized ? "#eff6ff" : "#f8fafc",
                padding: "4px 9px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11.5,
                fontWeight: 600,
                color: isMaximized ? "#2563eb" : "#64748b",
              }}
            >
              {isMaximized ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M5 1v4H1M8 5V1h4M8 12V8h4M5 8v4H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Réduire
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M1 5V1h4M8 1h4v4M12 8v4h-4M5 12H1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Plein écran
                </>
              )}
            </button>
          </div>
          {/* Scrollable results content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ResultsPanel isMaximized={isMaximized} />
          </div>
        </aside>
      </div>
    </div>
  );
}
