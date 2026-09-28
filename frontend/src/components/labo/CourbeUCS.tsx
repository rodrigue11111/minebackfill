"use client";

// Graphique « UCS MESURÉE » en SVG pur (aucune dépendance).
// Points = moyennes mesurées, avec barres d'incertitude ± écart-type.
// AUCUNE valeur calculée ou prédite n'est tracée : le programme ne dispose
// d'aucun modèle de prédiction validé.
//
// Deux usages, un seul composant (il n'avait qu'un appelant, et le cloner
// aurait dupliqué ~90 lignes de dessin — donc deux corrections
// d'accessibilité à faire au lieu d'une) :
//   - COURBE « UCS vs âge de cure » : une gâchée = une série, points reliés,
//     graduations aux âges réels ;
//   - NUAGE « UCS vs paramètre de formulation » : un point par gâchée,
//     `relier={false}`. Aucune ligne ne joint les points : relier deux
//     gâchées suggérerait une tendance, qui n'est pas mesurée.
// Au-delà de ces trois drapeaux, scinder plutôt qu'ajouter.

import React, { useId } from "react";
import { echelle, graduations, decimalesTick, chemin } from "@/lib/courbe-utils";

export interface SerieUCS {
  cle: string;
  label: string;
  couleur: string;
  /** `x` = âge de cure (j) en mode courbe, paramètre de formulation en nuage. */
  points: { x: number; moyenne: number; ecartType: number | null; n: number }[];
}

const W = 760;
const M = { gauche: 64, droite: 16, haut: 14, bas: 52 };

function fmtKpa(v: number): string {
  return Math.round(v).toLocaleString("fr-CA");
}

export default function CourbeUCS({
  series,
  hauteur = 380,
  xLabel = "Âge de cure (j)",
  relier = true,
  ticksX = "valeurs",
  formatX = (x: number) => `${x} j`,
  messageVide = "Aucune mesure UCS pour l'instant. Écrase une éprouvette et saisis sa charge (ou sa contrainte).",
}: {
  series: SerieUCS[];
  hauteur?: number;
  xLabel?: string;
  /** false = nuage de points, sans polyligne. */
  relier?: boolean;
  /** « valeurs » : une graduation par abscisse réelle (les âges de cure sont
   *  des valeurs exactes) ; « rondes » : graduations calculées. */
  ticksX?: "valeurs" | "rondes";
  formatX?: (x: number) => string;
  messageVide?: string;
}) {
  const clipId = useId();
  const H = hauteur;
  const PX: [number, number] = [M.gauche, W - M.droite];
  const PY: [number, number] = [H - M.bas, M.haut];

  const tousPoints = series.flatMap((s) => s.points);
  if (series.length === 0 || tousPoints.length === 0) {
    // #64748b : 4,76:1 sur blanc. #94a3b8 tombe à 2,56:1, sous le seuil AA.
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>
        {messageVide}
      </div>
    );
  }

  const xs = [...new Set(tousPoints.map((p) => p.x))].sort((a, b) => a - b);
  const xmin = xs[0];
  const xmax = xs[xs.length - 1];
  const xspan = xmax - xmin || 1;
  const xDom: [number, number] = [xmin - xspan * 0.06, xmax + xspan * 0.06];

  const hauts = tousPoints.map((p) => p.moyenne + (p.ecartType ?? 0));
  const ymax = Math.max(...hauts);
  const yDom: [number, number] = [0, ymax > 0 ? ymax * 1.08 : 1];

  const sx = echelle(xDom, PX);
  const sy = echelle(yDom, PY);

  const ticksY = graduations(yDom[0], yDom[1], 5);
  const pasY = ticksY.length > 1 ? ticksY[1] - ticksY[0] : 1;
  const decY = decimalesTick(pasY);

  const tX = ticksX === "valeurs" ? xs : graduations(xDom[0], xDom[1], 6);
  const pasX = tX.length > 1 ? tX[1] - tX[0] : 1;
  const decX = ticksX === "valeurs" ? 0 : decimalesTick(pasX);

  const etiquette = relier
    ? `Courbe de la résistance UCS mesurée en fonction de ${xLabel}`
    : `Nuage de la résistance UCS mesurée en fonction de ${xLabel}, un point par gâchée`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: "100%", height: "auto" }}
        role="img" aria-label={etiquette}>
        <title>{etiquette}</title>
        <defs>
          <clipPath id={clipId}><rect x={PX[0]} y={PY[1]} width={PX[1] - PX[0]} height={PY[0] - PY[1]} /></clipPath>
        </defs>

        {/* Grille + axe Y */}
        {ticksY.map((t) => {
          const y = sy(t);
          return (
            <g key={`y${t}`}>
              <line x1={PX[0]} y1={y} x2={PX[1]} y2={y} stroke="#eef2f7" strokeWidth={1} />
              <text x={PX[0] - 8} y={y + 3.5} textAnchor="end" fontSize={10.5} fill="#64748b">
                {t.toLocaleString("fr-CA", { minimumFractionDigits: decY, maximumFractionDigits: decY })}
              </text>
            </g>
          );
        })}

        {/* Axe X */}
        {tX.map((a) => {
          const x = sx(a);
          if (x < PX[0] - 0.5 || x > PX[1] + 0.5) return null;
          return (
            <g key={`x${a}`}>
              <line x1={x} y1={PY[0]} x2={x} y2={PY[0] + 4} stroke="#94a3b8" strokeWidth={1} />
              <text x={x} y={PY[0] + 17} textAnchor="middle" fontSize={10.5} fill="#64748b">
                {a.toLocaleString("fr-CA", { minimumFractionDigits: decX, maximumFractionDigits: decX })}
              </text>
            </g>
          );
        })}
        <line x1={PX[0]} y1={PY[0]} x2={PX[1]} y2={PY[0]} stroke="#cbd5e1" strokeWidth={1} />

        {/* Légendes d'axes */}
        <text x={(PX[0] + PX[1]) / 2} y={H - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">{xLabel}</text>
        <text x={15} y={(PY[0] + PY[1]) / 2} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#374151"
          transform={`rotate(-90 15 ${(PY[0] + PY[1]) / 2})`}>UCS mesurée (kPa)</text>

        {/* Séries */}
        <g clipPath={`url(#${clipId})`}>
          {relier && series.map((s) => {
            const pts = [...s.points].sort((a, b) => a.x - b.x);
            const chemPts = pts.map((p) => ({ x: sx(p.x), y: sy(p.moyenne) }));
            return (
              <path key={`l${s.cle}`} d={chemin(chemPts, chemPts.map(() => false))}
                fill="none" stroke={s.couleur} strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
            );
          })}
          {series.map((s) =>
            s.points.map((p) => {
              const x = sx(p.x);
              const y = sy(p.moyenne);
              const sd = p.ecartType;
              return (
                <g key={`p${s.cle}-${p.x}`}>
                  {sd !== null && sd > 0 && (
                    <g stroke={s.couleur} strokeWidth={1.3} opacity={0.8}>
                      <line x1={x} y1={sy(p.moyenne - sd)} x2={x} y2={sy(p.moyenne + sd)} />
                      <line x1={x - 4} y1={sy(p.moyenne + sd)} x2={x + 4} y2={sy(p.moyenne + sd)} />
                      <line x1={x - 4} y1={sy(p.moyenne - sd)} x2={x + 4} y2={sy(p.moyenne - sd)} />
                    </g>
                  )}
                  <circle cx={x} cy={y} r={3.6} fill={s.couleur} stroke="#fff" strokeWidth={1.2}>
                    <title>{`${s.label} — ${formatX(p.x)} : ${fmtKpa(p.moyenne)} kPa (n = ${p.n}${sd !== null ? `, ± ${fmtKpa(sd)}` : ""})`}</title>
                  </circle>
                </g>
              );
            }),
          )}
        </g>
      </svg>

      {/* Légende des séries */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, padding: "0 8px" }}>
        {series.map((s) => (
          <span key={s.cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
            <span style={{ width: 12, height: 3, background: s.couleur, borderRadius: 2 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
