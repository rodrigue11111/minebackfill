"use client";

// Enveloppe une figure SVG et ajoute un petit bouton « PNG » (coin haut droit,
// révélé au survol pour ne pas gêner la lecture) qui exporte le <svg> contenu
// en image PNG — pour coller une figure dans un rapport. Aucune dépendance
// (conversion SVG -> canvas -> PNG). Le bouton n'étant pas un enfant du <svg>,
// il n'apparaît jamais dans le PNG exporté.

import React, { useRef, useState } from "react";
import { svgVersPng, nomFichier } from "@/lib/export-fig";

export default function FigurePng({ nom, children }: { nom: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [survol, setSurvol] = useState(false);

  return (
    <div
      ref={ref}
      style={{ position: "relative" }}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
    >
      {children}
      <button
        type="button"
        title="Exporter cette figure en PNG"
        onClick={() => {
          const svg = ref.current?.querySelector("svg");
          if (!svg) {
            window.alert("Figure introuvable — réessaie après l'affichage.");
            return;
          }
          svgVersPng(svg as SVGSVGElement, nomFichier(nom, "png"), 2, () =>
            window.alert("Export PNG impossible dans ce navigateur — utilise plutôt l'export CSV ou JSON."),
          );
        }}
        style={{
          position: "absolute", top: 4, right: 4, padding: "2px 8px", borderRadius: 6,
          fontSize: 10.5, fontWeight: 700, cursor: "pointer",
          border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.95)", color: "#64748b",
          opacity: survol ? 1 : 0, transition: "opacity 0.15s", pointerEvents: survol ? "auto" : "none",
        }}
      >
        PNG
      </button>
    </div>
  );
}
