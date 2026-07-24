"use client";

// Échantillon illustratif : un moule cylindrique (SVG) rempli de bandes
// colorées proportionnelles aux fractions VOLUMIQUES de chaque phase, empilées
// du bas (solides) vers le haut (eau puis air). Purement pédagogique — les
// phases d'une pâte sont en réalité mélangées ; l'empilement « décanté » aide
// juste à « voir » les proportions. Base : volume.

import React from "react";
import type { Recipe } from "@/lib/types";
import { phases, fractions } from "@/lib/composition";

const CX = 92;
const R = 64;
const RY = 16; // demi-hauteur des ellipses (perspective)
const TOP = 34;
const BOTTOM = 272;
const HB = BOTTOM - TOP; // hauteur du corps

function pct(f: number): string {
  return (f * 100).toLocaleString("fr-CA", { maximumFractionDigits: 1 }) + " %";
}

export default function EchantillonCylindre({ recipe }: { recipe: Recipe }) {
  const fr = fractions(phases(recipe, "volume"));
  if (fr.length === 0) return null;

  // Positions cumulées (0 = bas, 1 = haut) sans mutation (React Compiler).
  const bandes = fr.map((p, i) => {
    const f0 = fr.slice(0, i).reduce((s, q) => s + q.frac, 0);
    return { ...p, f0, f1: f0 + p.frac };
  });
  const y = (f: number) => BOTTOM - f * HB;

  return (
    <svg viewBox="0 0 320 300" width="100%" style={{ height: "auto", maxWidth: 340, display: "block", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
      role="img" aria-label="Échantillon cylindrique par phases">
      <defs>
        {/* Silhouette du cylindre (corps + calottes) — l'union arrondit les bords. */}
        <clipPath id="cyl-clip">
          <rect x={CX - R} y={TOP} width={2 * R} height={HB} />
          <ellipse cx={CX} cy={TOP} rx={R} ry={RY} />
          <ellipse cx={CX} cy={BOTTOM} rx={R} ry={RY} />
        </clipPath>
        {/* Reflet cylindrique (arrondi) */}
        <linearGradient id="cyl-reflet" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(0,0,0,0.16)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.16)" />
        </linearGradient>
      </defs>

      {/* Bandes de phases, clippées à la silhouette */}
      <g clipPath="url(#cyl-clip)">
        {bandes.map((p, i) => {
          const yHaut = i === bandes.length - 1 ? TOP - RY : y(p.f1);
          const yBas = i === 0 ? BOTTOM + RY : y(p.f0);
          return <rect key={p.cle} x={CX - R} y={yHaut} width={2 * R} height={Math.max(0, yBas - yHaut)} fill={p.couleur} />;
        })}
        <rect x={CX - R} y={TOP - RY} width={2 * R} height={HB + 2 * RY} fill="url(#cyl-reflet)" />
      </g>

      {/* Contours */}
      <ellipse cx={CX} cy={TOP} rx={R} ry={RY} fill="none" stroke="#64748b" strokeWidth={1.2} />
      <line x1={CX - R} y1={TOP} x2={CX - R} y2={BOTTOM} stroke="#64748b" strokeWidth={1.2} />
      <line x1={CX + R} y1={TOP} x2={CX + R} y2={BOTTOM} stroke="#64748b" strokeWidth={1.2} />
      <path d={`M ${CX - R} ${BOTTOM} A ${R} ${RY} 0 0 0 ${CX + R} ${BOTTOM}`} fill="none" stroke="#64748b" strokeWidth={1.2} />

      {/* Légende à droite (du haut vers le bas) */}
      {[...bandes].reverse().map((p, i) => (
        <g key={p.cle} transform={`translate(180 ${TOP + 6 + i * 22})`}>
          <rect x={0} y={-9} width={12} height={12} rx={3} fill={p.couleur} stroke="rgba(0,0,0,0.1)" />
          <text x={18} y={1} fontSize={12} fill="#374151">{p.label} — {pct(p.frac)}</text>
        </g>
      ))}
    </svg>
  );
}
