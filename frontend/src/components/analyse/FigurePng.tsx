"use client";

// Enveloppe une figure SVG et ajoute un petit bouton « PNG » (coin haut droit,
// révélé au survol pour ne pas gêner la lecture) qui exporte le <svg> contenu
// en image PNG — pour coller une figure dans un rapport. Aucune dépendance
// (conversion SVG -> canvas -> PNG). Le bouton n'étant pas un enfant du <svg>,
// il n'apparaît jamais dans le PNG exporté.

import React, { useRef } from "react";
import { svgVersPng, nomFichier } from "@/lib/export-fig";

export default function FigurePng({ nom, children }: { nom: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Le bouton apparaît au survol ou au focus clavier (CSS .ui-figure), et
  // reste visible sur les écrans tactiles, qui n'ont pas de survol.
  return (
    <div ref={ref} className="ui-figure">
      {children}
      <button
        type="button"
        title="Exporter cette figure en PNG"
        onClick={() => {
          const svg = ref.current?.querySelector("svg");
          if (!svg) {
            window.alert("Figure introuvable. Réessaie après l'affichage.");
            return;
          }
          svgVersPng(svg as SVGSVGElement, nomFichier(nom, "png"), 2, () =>
            window.alert("Export PNG impossible dans ce navigateur. Utilise plutôt l'export CSV ou JSON."),
          );
        }}
        className="ui-figure-png"
      >
        PNG
      </button>
    </div>
  );
}
