"use client";

// Diagramme ternaire (triangle des mélanges), en SVG. Chaque recette est un
// point placé selon ses trois fractions barycentriques (sommet haut = a,
// bas-gauche = b, bas-droite = c). Base « phases » (solides/eau/air, volume)
// ou « solides » (résidu/granulat/liant, masse) — voir lib/composition.ts.

import React from "react";
import type { Recipe } from "@/lib/types";
import { ternaire, type BaseTernaire } from "@/lib/composition";
import { RECIPE_COLORS } from "@/lib/recipe-theme";

const W = 430;
const H = 360;
// Sommets du triangle (A haut, B bas-gauche, C bas-droite).
const A: [number, number] = [215, 26];
const B: [number, number] = [44, 320];
const C: [number, number] = [386, 320];

function xy(a: number, b: number, c: number): [number, number] {
  return [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1]];
}
function pct(f: number): string {
  return (f * 100).toLocaleString("fr-CA", { maximumFractionDigits: 1 }) + " %";
}

export default function DiagrammeTernaire({
  recipes,
  base,
  titres,
}: {
  recipes: Recipe[];
  base: BaseTernaire;
  titres?: string[];
}) {
  if (recipes.length === 0) return null;
  const meta = ternaire(recipes[0], base); // sommets/couleurs identiques pour toutes
  const niveaux = [0.2, 0.4, 0.6, 0.8];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", maxWidth: 460, display: "block" }}
      role="img" aria-label={`Diagramme ternaire ${meta.sommets.join(" / ")}`}>
      {/* Grille : lignes à a/b/c constants */}
      {niveaux.map((t, i) => {
        const la = [xy(t, 1 - t, 0), xy(t, 0, 1 - t)] as const;   // a constant
        const lb = [xy(1 - t, t, 0), xy(0, t, 1 - t)] as const;   // b constant
        const lc = [xy(1 - t, 0, t), xy(0, 1 - t, t)] as const;   // c constant
        return (
          <g key={i} stroke="#eef2f7" strokeWidth={1}>
            <line x1={la[0][0]} y1={la[0][1]} x2={la[1][0]} y2={la[1][1]} />
            <line x1={lb[0][0]} y1={lb[0][1]} x2={lb[1][0]} y2={lb[1][1]} />
            <line x1={lc[0][0]} y1={lc[0][1]} x2={lc[1][0]} y2={lc[1][1]} />
          </g>
        );
      })}

      {/* Contour du triangle */}
      <polygon points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`} fill="#fbfdff" stroke="#94a3b8" strokeWidth={1.3} />

      {/* Sommets */}
      <text x={A[0]} y={A[1] - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={meta.couleurs[0]}>{meta.sommets[0]}</text>
      <text x={B[0] - 4} y={B[1] + 18} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={meta.couleurs[1]}>{meta.sommets[1]}</text>
      <text x={C[0] + 4} y={C[1] + 18} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={meta.couleurs[2]}>{meta.sommets[2]}</text>

      {/* Points (une recette = un point) */}
      {recipes.map((r, i) => {
        const p = ternaire(r, base);
        const [px, py] = xy(p.a, p.b, p.c);
        const coul = RECIPE_COLORS[i] ?? "#0f172a";
        const nom = titres?.[i] ?? `R${i + 1}`;
        return (
          <g key={i}>
            <title>{`${nom} — ${meta.sommets[0]} ${pct(p.a)}, ${meta.sommets[1]} ${pct(p.b)}, ${meta.sommets[2]} ${pct(p.c)}`}</title>
            <circle cx={px} cy={py} r={5} fill={coul} stroke="#fff" strokeWidth={1.5} />
            <text x={px + 8} y={py + 4} fontSize={11} fontWeight={700} fill={coul}>{nom}</text>
          </g>
        );
      })}
    </svg>
  );
}
