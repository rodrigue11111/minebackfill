// frontend/src/lib/courbe-analyse.ts
// Transformations PURES des séries d'un balayage : écart relatif à une recette
// de référence, index du point de référence, et résumé statistique. Séparé du
// composant pour être testé sans DOM.

/** Index du point de x le plus proche d'une valeur cible (x supposé trié). */
export function indexProche(x: number[], cible: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < x.length; i++) {
    const d = Math.abs(x[i] - cible);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Écart RELATIF (%) de chaque point par rapport à la valeur de référence
 * (au point d'index iRef) : (v − vRef) / vRef × 100. Comparaison qui a un
 * SENS entre grandeurs d'échelles différentes — contrairement au min-max, une
 * grandeur quasi constante reste plate. Renvoie tout null si la référence est
 * nulle/absente/zéro (écart relatif indéfini).
 */
export function ecartPct(valeurs: (number | null)[], iRef: number): (number | null)[] {
  const ref = valeurs[iRef];
  if (ref === null || ref === undefined || !Number.isFinite(ref) || ref === 0) {
    return valeurs.map(() => null);
  }
  return valeurs.map((v) => (v === null || !Number.isFinite(v) ? null : ((v - ref) / ref) * 100));
}

export interface StatsSerie {
  min: number;
  max: number;
  /** Variation absolue entre le premier et le dernier point valides. */
  variation: number;
  /** Pente moyenne = variation / (x_dernier − x_premier). */
  pente: number;
}

/** Résumé d'une série (points nuls ignorés) ; null si aucun point valide. */
export function statsSerie(x: number[], valeurs: (number | null)[]): StatsSerie | null {
  const pts: { xi: number; v: number }[] = [];
  for (let i = 0; i < x.length; i++) {
    const v = valeurs[i];
    if (v !== null && Number.isFinite(v)) pts.push({ xi: x[i], v });
  }
  if (pts.length === 0) return null;
  const vs = pts.map((p) => p.v);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const variation = last.v - first.v;
  const dx = last.xi - first.xi;
  return {
    min: Math.min(...vs),
    max: Math.max(...vs),
    variation,
    pente: dx !== 0 ? variation / dx : 0,
  };
}
