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
