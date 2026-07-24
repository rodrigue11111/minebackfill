// frontend/src/lib/analyse-instantane.ts
// Instantané de provenance d'une analyse : tout ce qui permet de REPRODUIRE et
// de TRACER une figure (recette, matériaux, constantes, pack de conventions,
// version du solveur, date). Formatage PUR ; la collecte des valeurs depuis le
// store se fait dans la page.

export interface InstantaneAnalyse {
  date: string; // ISO
  categorie: string; // "RPC" | "RPG"
  methode: string; // "Cw%"
  /** Balayage (mode courbes) — absent en composition. */
  parametre?: { label: string; min: number; max: number; points: number };
  recette: {
    gsResidu: number; w0Pct: number; cwPct: number; srPct: number; bwPct: number;
    amPct?: number; gsAgregat?: number;
  };
  liants: { code: string; gs: number; fractionPct: number }[];
  constantes: {
    packLabel: string;
    masseVolEau: number; gravite: number; facteurCone: number;
    coeffSlump: number; constSlump: number;
    conventionGs: string; regleLiant: string;
  };
  versionSolveur: string;
}

function f(n: number, dec = 3): string {
  return n.toLocaleString("fr-CA", { maximumFractionDigits: dec });
}

/** Lignes lisibles décrivant l'instantané (réutilisées pour l'UI et le CSV). */
export function lignesResume(inst: InstantaneAnalyse): string[] {
  const r = inst.recette;
  const lignes = [
    "MineBackfill — Analyse (reproductibilité)",
    `Date : ${inst.date}`,
    `Catégorie : ${inst.categorie} · Méthode : ${inst.methode}`,
  ];
  if (inst.parametre) {
    const p = inst.parametre;
    lignes.push(`Paramètre balayé : ${p.label} de ${f(p.min)} à ${f(p.max)} (${p.points} points)`);
  }
  const rec = [
    `Gs résidu ${f(r.gsResidu)}`, `w0 ${f(r.w0Pct, 1)} %`, `Cw ${f(r.cwPct, 1)} %`,
    `Sr ${f(r.srPct, 0)} %`, `Bw ${f(r.bwPct, 2)} %`,
  ];
  if (r.amPct !== undefined) rec.push(`Am ${f(r.amPct, 1)} %`);
  if (r.gsAgregat !== undefined) rec.push(`Gs agrégat ${f(r.gsAgregat)}`);
  lignes.push(`Recette de base : ${rec.join(" · ")}`);
  lignes.push(
    "Liants : " + (inst.liants.length
      ? inst.liants.map((l) => `${l.code || "?"} (Gs ${f(l.gs)} · ${f(l.fractionPct, 1)} %)`).join(", ")
      : "aucun"),
  );
  const c = inst.constantes;
  lignes.push(`Pack de conventions : ${c.packLabel} · convention Gs « ${c.conventionGs} » · règle liant « ${c.regleLiant} »`);
  lignes.push(`Constantes : ρ_eau ${f(c.masseVolEau, 0)} · g ${f(c.gravite)} · facteur cône ${f(c.facteurCone)} · coeff slump ${f(c.coeffSlump, 0)} · const slump ${f(c.constSlump)}`);
  lignes.push(`Version du solveur : ${inst.versionSolveur}`);
  return lignes;
}

/** En-tête CSV commenté (une ligne « # … » par ligne de résumé). */
export function lignesMetaCsv(inst: InstantaneAnalyse): string[] {
  return lignesResume(inst).map((l) => "# " + l);
}
