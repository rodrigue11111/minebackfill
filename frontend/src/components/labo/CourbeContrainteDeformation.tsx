"use client";

// Courbe contrainte-déformation d'un essai de presse, en SVG pur (même
// facture que CourbeUCS). Les points sont ceux RÉELLEMENT mesurés et gardés à
// l'import (jamais de lissage) ; le point de contrainte maximale est marqué.

import { useId } from "react";
import { bornes, chemin, decimalesTick, echelle, graduations } from "@/lib/courbe-utils";
import type { PointCourbe } from "@/lib/presse-urstm";

const W = 760;
const H = 340;
const M = { gauche: 64, droite: 18, haut: 16, bas: 50 };

export default function CourbeContrainteDeformation({ points, titre }: { points: PointCourbe[]; titre: string }) {
  const clipId = useId();
  const valides = points.filter((p) => Number.isFinite(p.deformationPct) && Number.isFinite(p.contrainteKpa));
  if (valides.length < 2) {
    return <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Courbe sans points exploitables.</div>;
  }
  const PX: [number, number] = [M.gauche, W - M.droite];
  const PY: [number, number] = [H - M.bas, M.haut];
  const [x0, x1] = bornes([valides.map((p) => p.deformationPct)]);
  const [, y1] = bornes([valides.map((p) => p.contrainteKpa)]);
  const xDom: [number, number] = [Math.min(0, x0), x1 + (x1 - Math.min(0, x0)) * 0.04];
  const yDom: [number, number] = [0, y1 > 0 ? y1 * 1.08 : 1];
  const sx = echelle(xDom, PX);
  const sy = echelle(yDom, PY);
  const tX = graduations(xDom[0], xDom[1], 6);
  const tY = graduations(yDom[0], yDom[1], 5);
  const decX = decimalesTick(tX.length > 1 ? tX[1] - tX[0] : 1);
  const decY = decimalesTick(tY.length > 1 ? tY[1] - tY[0] : 1);
  const max = valides.reduce((a, p) => (p.contrainteKpa > a.contrainteKpa ? p : a), valides[0]);
  const d = chemin(valides.map((p) => ({ x: sx(p.deformationPct), y: sy(p.contrainteKpa) })), valides.map(() => false));
  // « + 0 » : une graduation calculée à -0 s'afficherait « -0 ».
  const fmt = (v: number, dec: number) => (v + 0).toLocaleString("fr-CA", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const etiquette = `${titre} : contrainte en fonction de la déformation, ${valides.length} points mesurés, contrainte maximale ${fmt(max.contrainteKpa, 0)} kPa à ${fmt(max.deformationPct, 2)} %`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: "100%", height: "auto", background: "#fff" }}
      role="img" aria-label={etiquette}>
      <title>{etiquette}</title>
      <defs>
        <clipPath id={clipId}><rect x={PX[0]} y={PY[1]} width={PX[1] - PX[0]} height={PY[0] - PY[1]} /></clipPath>
      </defs>
      {tY.map((t) => (
        <g key={`y${t}`}>
          <line x1={PX[0]} y1={sy(t)} x2={PX[1]} y2={sy(t)} stroke="#eef2f7" strokeWidth={1} />
          <text x={PX[0] - 8} y={sy(t) + 3.5} textAnchor="end" fontSize={10.5} fill="#64748b">{fmt(t, decY)}</text>
        </g>
      ))}
      {tX.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} y1={PY[0]} x2={sx(t)} y2={PY[0] + 4} stroke="#94a3b8" strokeWidth={1} />
          <text x={sx(t)} y={PY[0] + 17} textAnchor="middle" fontSize={10.5} fill="#64748b">{fmt(t, decX)}</text>
        </g>
      ))}
      <line x1={PX[0]} y1={PY[0]} x2={PX[1]} y2={PY[0]} stroke="#94a3b8" strokeWidth={1} />
      <line x1={PX[0]} y1={PY[0]} x2={PX[0]} y2={PY[1]} stroke="#94a3b8" strokeWidth={1} />
      <text x={(PX[0] + PX[1]) / 2} y={H - 10} textAnchor="middle" fontSize={11.5} fill="#334155">Déformation (%)</text>
      <text x={16} y={(PY[0] + PY[1]) / 2} textAnchor="middle" fontSize={11.5} fill="#334155"
        transform={`rotate(-90 16 ${(PY[0] + PY[1]) / 2})`}>Contrainte (kPa)</text>
      <path d={d} fill="none" stroke="#2563eb" strokeWidth={1.8} clipPath={`url(#${clipId})`} />
      <circle cx={sx(max.deformationPct)} cy={sy(max.contrainteKpa)} r={4} fill="#dc2626" />
      <text x={Math.min(sx(max.deformationPct) + 8, PX[1] - 4)} y={Math.max(sy(max.contrainteKpa) - 8, PY[1] + 10)}
        textAnchor={sx(max.deformationPct) + 8 > PX[1] - 140 ? "end" : "start"} fontSize={11} fill="#991b1b">
        Maximum : {fmt(max.contrainteKpa, 0)} kPa à {fmt(max.deformationPct, 2)} %
      </text>
    </svg>
  );
}
