"use client";

// Enveloppe une figure SVG et ajoute un petit bouton « PNG » (coin haut droit,
// révélé au survol pour ne pas gêner la lecture) qui exporte le <svg> contenu
// en image PNG — pour coller une figure dans un rapport. Aucune dépendance
// (conversion SVG -> canvas -> PNG). Le bouton n'étant pas un enfant du <svg>,
// il n'apparaît jamais dans le PNG exporté.
//
// Agrandir (2026-10-30, demande de l'utilisateur : « mieux apprécier les
// courbes » de l'Analyse) : avec `agrandi`, un second bouton ouvre la figure
// presque en plein écran, dans une Feuille large. `ratio` (largeur / hauteur
// de la figure agrandie) borne sa largeur pour qu'elle tienne en hauteur sans
// bandes vides : la bulle de survol de CourbeSvg reste alignée sur le curseur.

import React, { useRef, useState } from "react";
import { svgVersPng, nomFichier } from "@/lib/export-fig";
import Feuille from "@/components/ui/Feuille";

export default function FigurePng({ nom, children, desactive = false, motif, agrandi, titre, ratio }: {
  nom: string;
  children?: React.ReactNode;
  /** Figure périmée : estompée, export PNG désactivé (avec le motif en info-bulle). */
  desactive?: boolean;
  motif?: string;
  /** Rendu de la figure agrandie ; sans lui, pas de bouton « Agrandir ». */
  agrandi?: React.ReactNode;
  /** Titre de la figure agrandie (et sa légende, s'il y en a une). */
  titre?: React.ReactNode;
  /** Largeur / hauteur de la figure agrandie. */
  ratio?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [grande, setGrande] = useState(false);

  // Le bouton apparaît au survol ou au focus clavier (CSS .ui-figure), et
  // reste visible sur les écrans tactiles, qui n'ont pas de survol.
  return (
    <div ref={ref} className={desactive ? "ui-figure ui-figure-perime" : "ui-figure"}>
      {children}
      {agrandi && (
        <button type="button" className="ui-figure-agrandir" title="Afficher cette figure en grand" onClick={() => setGrande(true)}>
          Agrandir
        </button>
      )}
      <button
        type="button"
        disabled={desactive}
        title={desactive ? motif ?? "Figure périmée" : "Exporter cette figure en PNG"}
        onClick={() => {
          const svg = ref.current?.querySelector("svg");
          if (!svg) {
            window.alert("Figure introuvable. Réessayez après l'affichage.");
            return;
          }
          svgVersPng(svg as SVGSVGElement, nomFichier(nom, "png"), 2, () =>
            window.alert("Export PNG impossible dans ce navigateur. Utilisez plutôt l'export CSV ou JSON."),
          );
        }}
        className="ui-figure-png"
      >
        PNG
      </button>
      {agrandi && grande && (
        <Feuille large ouverte onFermer={() => setGrande(false)} titre={titre ?? "Figure"}>
          <div className="ui-figure-agrandie" style={ratio ? { maxWidth: `calc((94dvh - 170px) * ${ratio})` } : undefined}>
            {agrandi}
          </div>
        </Feuille>
      )}
    </div>
  );
}
