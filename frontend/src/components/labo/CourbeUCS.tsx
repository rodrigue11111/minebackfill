"use client";

// Courbe « UCS MESURÉE vs âge de cure » en SVG pur (aucune dépendance).
// Points = moyennes mesurées par âge, avec barres d'incertitude ± écart-type,
// reliés par série (une gâchée = une série). AUCUNE valeur calculée/prédite
// n'est tracée : le programme ne dispose d'aucun modèle de prédiction validé.

import React, { useId } from "react";
import { echelle, graduations, decimalesTick, chemin } from "@/lib/courbe-utils";

export interface SerieUCS {
  cle: string;
  label: string;
  couleur: string;
  points: { age: number; moyenne: number; ecartType: number | null; n: number }[];
}

const W = 760;
const M = { gauche: 64, droite: 16, haut: 14, bas: 52 };

function fmtKpa(v: number): string {
  return Math.round(v).toLocaleString("fr-CA");
}

export default function CourbeUCS({ series, hauteur = 380 }: { series: SerieUCS[]; hauteur?: number }) {
  const clipId = useId();
  const H = hauteur;
  const PX: [number, number] = [M.gauche, W - M.droite];
  const PY: [number, number] = [H - M.bas, M.haut];

  const tousPoints = series.flatMap((s) => s.points);
  if (series.length === 0 || tousPoints.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        Aucune mesure UCS pour l&apos;instant. Écrase une éprouvette et saisis sa charge (ou sa contrainte).
      </div>
    );
  }

  const ages = [...new Set(tousPoints.map((p) => p.age))].sort((a, b) => a - b);
  const xmin = ages[0];
  const xmax = ages[ages.length - 1];
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

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: "100%", height: "auto" }}
        role="img" aria-label="Courbe de la résistance UCS mesurée en fonction de l'âge de cure">
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

        {/* Axe X : graduations aux âges réels */}
        {ages.map((a) => {
          const x = sx(a);
          return (
            <g key={`x${a}`}>
              <line x1={x} y1={PY[0]} x2={x} y2={PY[0] + 4} stroke="#94a3b8" strokeWidth={1} />
              <text x={x} y={PY[0] + 17} textAnchor="middle" fontSize={10.5} fill="#64748b">{a}</text>
            </g>
          );
        })}
        <line x1={PX[0]} y1={PY[0]} x2={PX[1]} y2={PY[0]} stroke="#cbd5e1" strokeWidth={1} />

        {/* Légendes d'axes */}
        <text x={(PX[0] + PX[1]) / 2} y={H - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">Âge de cure (j)</text>
        <text x={15} y={(PY[0] + PY[1]) / 2} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#374151"
          transform={`rotate(-90 15 ${(PY[0] + PY[1]) / 2})`}>UCS mesurée (kPa)</text>

        {/* Séries */}
        <g clipPath={`url(#${clipId})`}>
          {series.map((s) => {
            const pts = [...s.points].sort((a, b) => a.age - b.age);
            const chemPts = pts.map((p) => ({ x: sx(p.age), y: sy(p.moyenne) }));
            return (
              <path key={`l${s.cle}`} d={chemin(chemPts, chemPts.map(() => false))}
                fill="none" stroke={s.couleur} strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
            );
          })}
          {series.map((s) =>
            s.points.map((p) => {
              const x = sx(p.age);
              const y = sy(p.moyenne);
              const sd = p.ecartType;
              return (
                <g key={`p${s.cle}-${p.age}`}>
                  {sd !== null && sd > 0 && (
                    <g stroke={s.couleur} strokeWidth={1.3} opacity={0.8}>
                      <line x1={x} y1={sy(p.moyenne - sd)} x2={x} y2={sy(p.moyenne + sd)} />
                      <line x1={x - 4} y1={sy(p.moyenne + sd)} x2={x + 4} y2={sy(p.moyenne + sd)} />
                      <line x1={x - 4} y1={sy(p.moyenne - sd)} x2={x + 4} y2={sy(p.moyenne - sd)} />
                    </g>
                  )}
                  <circle cx={x} cy={y} r={3.6} fill={s.couleur} stroke="#fff" strokeWidth={1.2}>
                    <title>{`${s.label} — ${p.age} j : ${fmtKpa(p.moyenne)} kPa (n = ${p.n}${sd !== null ? `, ± ${fmtKpa(sd)}` : ""})`}</title>
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
