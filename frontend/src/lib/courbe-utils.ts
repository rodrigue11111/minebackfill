// frontend/src/lib/courbe-utils.ts
// Petits utilitaires PURS de tracé (échelles, bornes, graduations, chemin SVG)
// pour le graphe des courbes paramétriques. Séparés du composant pour être
// testés sans DOM. Aucune dépendance.

/** Bornes [min, max] sur plusieurs séries, en ignorant les valeurs nulles. */
export function bornes(series: (number | null)[][]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const serie of series) {
    for (const v of serie) {
      if (v !== null && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1]; // série plate : marge symétrique
  return [min, max];
}

/** Échelle linéaire domaine -> plage (pixels). */
export function echelle(
  domaine: [number, number],
  plage: [number, number],
): (v: number) => number {
  const [d0, d1] = domaine;
  const [p0, p1] = plage;
  const k = d1 === d0 ? 0 : (p1 - p0) / (d1 - d0);
  return (v) => p0 + (v - d0) * k;
}

/** Graduations « rondes » (1/2/5·10^n) dans [min, max], ~`cible` ticks. */
export function graduations(min: number, max: number, cible = 5): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [min];
  const span = max - min;
  const pas0 = span / Math.max(1, cible);
  const mag = Math.pow(10, Math.floor(Math.log10(pas0)));
  const norm = pas0 / mag;
  // Nombre « rond » le PLUS PROCHE de {1,2,5,10} (et non arrondi vers le bas,
  // qui doublait la densité de graduations autour de la mantisse 4).
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const pas = nice * mag;
  const debut = Math.ceil(min / pas - 1e-9) * pas;
  const out: number[] = [];
  for (let t = debut; t <= max + pas * 1e-9; t += pas) {
    // re-quantifie pour éviter la dérive d'accumulation en virgule flottante
    out.push(Math.round(t / pas) * pas);
  }
  return out;
}

/** Nombre de décimales à afficher pour un tick, selon l'ordre de grandeur. */
export function decimalesTick(pas: number): number {
  if (!(pas > 0) || !Number.isFinite(pas)) return 0;
  const d = Math.ceil(-Math.log10(pas));
  return Math.min(6, Math.max(0, d));
}

/**
 * Chemin SVG d'une polyligne, coupé sur les points nuls (une valeur None
 * n'est pas reliée à ses voisines : la courbe présente un trou).
 */
export function chemin(points: { x: number; y: number }[], nul: boolean[]): string {
  let d = "";
  let crayon = false; // vrai si le dernier point était tracé (on relie L)
  for (let i = 0; i < points.length; i++) {
    if (nul[i]) {
      crayon = false;
      continue;
    }
    const { x, y } = points[i];
    d += `${crayon ? " L" : " M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    crayon = true;
  }
  return d.trim();
}
