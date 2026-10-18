// Essai de teneur en eau au laboratoire — formules des cellules D76/D77 de
// la feuille Intra 2017 (masses en grammes, tare incluse) :
//
//   w mesuré  = (m_h − m_s) / (m_s − tare)
//   Cw mesuré = (m_s − tare) / (m_h − tare)
//
// Fonction pure, testée (mesures.test.ts) contre l'exemple de tare du
// classeur (2278.8 / 2947.3 / 2831.8 g).

export interface MesureLabo {
  slump?: number;  // mm (enregistré, pas utilisé dans le calcul)
  tare?: number;   // g
  mh?: number;     // tare + pâte humide (g)
  ms?: number;     // tare + pâte sèche (g)
}

export function calculeMesures(m: MesureLabo): { w: number | null; cw: number | null } {
  const { tare, mh, ms } = m;
  if (tare === undefined || mh === undefined || ms === undefined) return { w: null, cw: null };
  if (!(mh > ms && ms > tare)) return { w: null, cw: null };
  return {
    w: ((mh - ms) / (ms - tare)) * 100.0,   // [D76]
    cw: ((ms - tare) / (mh - tare)) * 100.0, // [D77]
  };
}

/** Une ligne de rapport : une valeur par recette (null : pas de mesure). */
export interface LigneMesure {
  libelle: string;
  unite: string;
  valeurs: (number | null)[];
  decimales: number;
}

/**
 * Lignes « Mesures au laboratoire » des rapports (PDF, Excel) : affaissement,
 * w et Cw mesurés, la valeur calculée en regard et l'écart (en points).
 * Vide si aucune recette n'a de mesure : le rapport n'ajoute rien.
 */
export function lignesMesures(
  recipes: { w_mass_pct?: number | null; solids_mass_pct?: number | null }[],
  mesures: MesureLabo[] | undefined,
): LigneMesure[] {
  const n = recipes.length;
  const m = Array.from({ length: n }, (_, i) => mesures?.[i] ?? {});
  const calc = m.map(calculeMesures);
  const aucune = m.every((x) => x.slump === undefined) && calc.every((c) => c.w === null);
  if (aucune) return [];
  const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const ecart = (a: number | null, b: number | null) => (a !== null && b !== null ? a - b : null);
  const wCalc = recipes.map((r) => num(r.w_mass_pct));
  const cwCalc = recipes.map((r) => num(r.solids_mass_pct));
  return [
    { libelle: "Affaissement mesuré", unite: "mm", valeurs: m.map((x) => num(x.slump)), decimales: 0 },
    { libelle: "w mesuré", unite: "%", valeurs: calc.map((c) => c.w), decimales: 2 },
    { libelle: "w calculé", unite: "%", valeurs: wCalc, decimales: 2 },
    { libelle: "Écart w (mesuré − calculé)", unite: "pt", valeurs: calc.map((c, i) => ecart(c.w, wCalc[i])), decimales: 2 },
    { libelle: "Cw mesuré", unite: "%", valeurs: calc.map((c) => c.cw), decimales: 2 },
    { libelle: "Cw calculé", unite: "%", valeurs: cwCalc, decimales: 2 },
    { libelle: "Écart Cw (mesuré − calculé)", unite: "pt", valeurs: calc.map((c, i) => ecart(c.cw, cwCalc[i])), decimales: 2 },
  ];
}
