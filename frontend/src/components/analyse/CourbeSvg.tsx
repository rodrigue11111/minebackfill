"use client";

// Graphe de courbes paramétriques, en SVG pur (aucune dépendance). Axes,
// graduations rondes, légende, survol (guide vertical + infobulle). Option
// « normaliser » : chaque série est ramenée à [0, 1] par ses propres bornes
// pour comparer les FORMES malgré des échelles différentes ; l'infobulle
// affiche toujours les valeurs RÉELLES.

import React, { useState } from "react";
import { bornes, echelle, graduations, decimalesTick, chemin } from "@/lib/courbe-utils";

export interface SerieTrace {
  cle: string;
  label: string;
  couleur: string;
  unite: string;
  valeurs: (number | null)[];
}

const W = 760;
const H = 430;
const M = { gauche: 60, droite: 16, haut: 16, bas: 54 };
const PX: [number, number] = [M.gauche, W - M.droite];
const PY: [number, number] = [H - M.bas, M.haut];

function fmtVal(v: number | null, unite: string): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const d = unite === "kg/m³" ? 0 : unite === "%" ? 2 : 3;
  return v.toLocaleString("fr-CA", { maximumFractionDigits: d });
}

function bornesSerie(valeurs: (number | null)[]): [number, number] {
  return bornes([valeurs]);
}

export default function CourbeSvg({
  x,
  xLabel,
  series,
  normaliser = false,
}: {
  x: number[];
  xLabel: string;
  series: SerieTrace[];
  normaliser?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (x.length === 0 || series.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        Sélectionnez au moins une grandeur à tracer, puis lancez le calcul.
      </div>
    );
  }

  const xmin = Math.min(...x);
  const xmax = Math.max(...x);
  const xDomaine: [number, number] = xmin === xmax ? [xmin - 1, xmin + 1] : [xmin, xmax];
  const sx = echelle(xDomaine, PX);

  // Domaine Y : normalisé -> [0,1] ; sinon bornes communes des séries affichées.
  const yDomaine: [number, number] = normaliser
    ? [0, 1]
    : bornes(series.map((s) => s.valeurs));
  const sy = echelle(yDomaine, PY);

  // En mode normalisé, chaque série a sa propre échelle interne.
  const normBornes = normaliser ? series.map((s) => bornesSerie(s.valeurs)) : null;
  const yTrace = (valeur: number, iSerie: number): number => {
    if (!normaliser) return sy(valeur);
    const [a, b] = normBornes![iSerie];
    const t = b === a ? 0.5 : (valeur - a) / (b - a);
    return sy(t);
  };

  const ticksX = graduations(xDomaine[0], xDomaine[1], 6);
  const pasX = ticksX.length > 1 ? ticksX[1] - ticksX[0] : 1;
  const ticksY = graduations(yDomaine[0], yDomaine[1], 5);
  const pasY = ticksY.length > 1 ? ticksY[1] - ticksY[0] : 1;

  // Unité commune sur l'axe Y (si toutes les séries partagent la même, hors
  // mode normalisé) — sinon rien (les unités sont dans la légende/infobulle).
  const uniteCommune =
    !normaliser && series.every((s) => s.unite === series[0].unite) ? series[0].unite : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const clamp = Math.max(PX[0], Math.min(PX[1], px));
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < x.length; i++) {
      const d = Math.abs(sx(x[i]) - clamp);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  // Index de survol borné : x peut avoir changé de longueur depuis le dernier
  // survol (nouveau balayage moins dense) — on évite x[hover] = undefined -> NaN.
  const h = hover !== null && hover >= 0 && hover < x.length ? hover : null;

  // Infobulle : dimensions et position (bascule à gauche près du bord droit).
  const hx = h !== null ? sx(x[h]) : 0;
  const tipLignes = h !== null
    ? [
        { t: `${xLabel.split(" — ")[0]} = ${fmtVal(x[h], "%")}`, c: "#0f172a", gras: true },
        ...series.map((s) => ({ t: `${s.label} : ${fmtVal(s.valeurs[h], s.unite)} ${s.unite === "—" ? "" : s.unite}`.trim(), c: s.couleur, gras: false })),
      ]
    : [];
  const tipW = 210;
  const tipH = 16 + tipLignes.length * 15;
  const tipX = hx > W - M.droite - tipW - 8 ? hx - tipW - 8 : hx + 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ height: "auto", maxWidth: "100%", display: "block", userSelect: "none" }}
      role="img"
      aria-label={`Courbe de réponse en fonction de ${xLabel}`}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {/* Fond de zone de tracé */}
      <rect x={PX[0]} y={PY[1]} width={PX[1] - PX[0]} height={PY[0] - PY[1]} fill="#fbfdff" stroke="none" />

      {/* Grille + graduations Y */}
      {ticksY.map((t, i) => {
        const y = sy(t);
        if (y < PY[1] - 0.5 || y > PY[0] + 0.5) return null;
        return (
          <g key={`y${i}`}>
            <line x1={PX[0]} y1={y} x2={PX[1]} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text x={PX[0] - 7} y={y + 3.5} textAnchor="end" fontSize={10.5} fill="#64748b">
              {t.toLocaleString("fr-CA", { maximumFractionDigits: decimalesTick(pasY) })}
            </text>
          </g>
        );
      })}

      {/* Grille + graduations X */}
      {ticksX.map((t, i) => {
        const xp = sx(t);
        if (xp < PX[0] - 0.5 || xp > PX[1] + 0.5) return null;
        return (
          <g key={`x${i}`}>
            <line x1={xp} y1={PY[1]} x2={xp} y2={PY[0]} stroke="#f1f5f9" strokeWidth={1} />
            <text x={xp} y={PY[0] + 16} textAnchor="middle" fontSize={10.5} fill="#64748b">
              {t.toLocaleString("fr-CA", { maximumFractionDigits: decimalesTick(pasX) })}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PX[0]} y1={PY[0]} x2={PX[1]} y2={PY[0]} stroke="#94a3b8" strokeWidth={1.2} />
      <line x1={PX[0]} y1={PY[1]} x2={PX[0]} y2={PY[0]} stroke="#94a3b8" strokeWidth={1.2} />

      {/* Étiquette X */}
      <text x={(PX[0] + PX[1]) / 2} y={H - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="#374151">
        {xLabel}
      </text>
      {/* Étiquette Y (unité commune ou « normalisé ») */}
      <text x={16} y={(PY[0] + PY[1]) / 2} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#374151"
        transform={`rotate(-90 16 ${(PY[0] + PY[1]) / 2})`}>
        {normaliser ? "Valeurs normalisées (0–1)" : uniteCommune ?? "Valeur"}
      </text>

      {/* Courbes */}
      {series.map((s, iS) => {
        const pts = x.map((xv, i) => ({ x: sx(xv), y: yTrace((s.valeurs[i] ?? 0) as number, iS) }));
        const nul = s.valeurs.map((v) => v === null || !Number.isFinite(v));
        return <path key={s.cle} d={chemin(pts, nul)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinejoin="round" />;
      })}

      {/* Survol */}
      {h !== null && (
        <g>
          <line x1={hx} y1={PY[1]} x2={hx} y2={PY[0]} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          {series.map((s, iS) => {
            const v = s.valeurs[h];
            if (v === null || !Number.isFinite(v)) return null;
            return <circle key={s.cle} cx={hx} cy={yTrace(v as number, iS)} r={3.2} fill={s.couleur} stroke="#fff" strokeWidth={1} />;
          })}
          <g>
            <defs>
              <clipPath id="infobulle-clip">
                <rect x={tipX} y={PY[1] + 4} width={tipW} height={tipH} rx={6} />
              </clipPath>
            </defs>
            <rect x={tipX} y={PY[1] + 4} width={tipW} height={tipH} rx={6} fill="#ffffff" stroke="#e2e8f0" strokeWidth={1} opacity={0.97} />
            <g clipPath="url(#infobulle-clip)">
              {tipLignes.map((l, i) => (
                <text key={i} x={tipX + 9} y={PY[1] + 4 + 15 + i * 15} fontSize={10.5} fontWeight={l.gras ? 700 : 500} fill={l.c}>
                  {l.t}
                </text>
              ))}
            </g>
          </g>
        </g>
      )}
    </svg>
  );
}
