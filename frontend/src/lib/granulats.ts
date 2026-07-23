// frontend/src/lib/granulats.ts
// Conversion entre la fraction MASSIQUE de granulats Am (l'entrée du backend,
// « A_m% — Ma/(Ma+Mr)×100 ») et la fraction VOLUMIQUE Av (« %v/v », la
// grandeur pilotée par l'article de référence du RPG).
//
// Référence : BELEM, HANE, BENZAAZOUA & MAQSOUD (2018), « Reuse of crushed
// waste rocks in mine backfill », Symposium Rouyn-Noranda — équation [3] :
//   Am = Av·Gs_a / (Av·Gs_a + (1−Av)·Gs_t)      (et l'inverse)
// où Gs_a = densité des grains du granulat, Gs_t = celle des résidus.
//
// Pourquoi c'est important : la physique du mélange (squelette granulaire,
// ségrégation, gain de résistance) est gouvernée par Av, mais on PÈSE des
// masses — spécifier en volume et convertir avec les Gs du jour évite la
// dérive silencieuse de la recette quand le Gs des résidus varie.

/** Av (%) -> Am (%). Renvoie null si les Gs sont invalides. */
export function amDepuisAv(
  avPct: number,
  gsResidu: number,
  gsGranulat: number,
): number | null {
  if (!Number.isFinite(avPct) || !(gsResidu > 0) || !(gsGranulat > 0)) return null;
  const av = avPct / 100;
  const den = av * gsGranulat + (1 - av) * gsResidu;
  if (den <= 0) return null;
  return (100 * (av * gsGranulat)) / den;
}

/** Am (%) -> Av (%). Renvoie null si les Gs sont invalides. */
export function avDepuisAm(
  amPct: number,
  gsResidu: number,
  gsGranulat: number,
): number | null {
  if (!Number.isFinite(amPct) || !(gsResidu > 0) || !(gsGranulat > 0)) return null;
  const am = amPct / 100;
  const den = am / gsGranulat + (1 - am) / gsResidu;
  if (den <= 0) return null;
  return (100 * (am / gsGranulat)) / den;
}
