// frontend/src/lib/analyse-instantane.ts
// Instantané de provenance d'une analyse : tout ce qui permet de REPRODUIRE et
// de TRACER une figure (recette, matériaux, constantes, pack de conventions,
// version du solveur, date). Formatage PUR ; la collecte des valeurs depuis le
// store se fait dans la page.

import { libelleContenant } from "./contenant";
import { nombreFr } from "./format";
import { libelleVersion } from "./conventions";

export interface InstantaneAnalyse {
  date: string; // ISO
  categorie: string; // "RPC" | "RPG"
  methode: string; // méthode d'ANALYSE : « Balayage selon la méthode Cw » (avant 2026-10-25 : « Dosage selon Cw »)
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

  // ── Ajouts 2026-09-27, tous OPTIONNELS (additif : un instantané écrit avant
  // cette date reste lisible et lignesResume les omet proprement). ──
  /** Libellés des grandeurs tracées au moment du calcul. */
  sorties?: string[];
  /** Géométrie du contenant : indispensable dès qu'on trace des MASSES. */
  contenant?: { type: string; description?: string };
  /** Nombre de contenants et facteur de sécurité : les masses sont extensives,
   *  comparer des kg entre deux balayages sans eux n'a aucun sens. */
  contenants?: number;
  facteurSecurite?: number;
  /** Recettes comparées sur un même balayage (vide ou absent si une seule). */
  variantes?: string[];

  // ── Ajouts 2026-10-25 (additifs) : l'analyse part d'un calcul sauvegardé. ──
  /** Volume analysé (m³) : le volume total de la recette sauvegardée. */
  volumeM3?: number;
  /** Calcul sauvegardé d'origine : sa méthode et sa version, distinctes de celles de l'analyse. */
  source?: {
    id: string;
    libelle: string;
    sauveLe: string;
    /** Méthode d'origine (libellé long). */
    methode: string;
    /** Recette analysée (absente en composition : toutes les recettes). */
    recette?: number;
    nbRecettes: number;
    versionCalcul?: string;
    /** Valeurs absentes de la sauvegarde et reconstituées. */
    reconstitutions?: string[];
  };
}

function f(n: number, dec = 3): string {
  return nombreFr(n, dec);
}

/**
 * Instantané d'un export : les grandeurs nommées sont celles des colonnes
 * réellement exportées (le reste de la provenance, figé au tracé, ne change pas).
 */
export function instantanePourExport(inst: InstantaneAnalyse, sorties: string[]): InstantaneAnalyse {
  return { ...inst, sorties };
}

/** Lignes lisibles décrivant l'instantané (réutilisées pour l'UI et le CSV). */
export function lignesResume(inst: InstantaneAnalyse): string[] {
  const r = inst.recette;
  const lignes = [
    "MineBackfill : analyse (reproductibilité)",
    `Date : ${inst.date}`,
  ];
  const s = inst.source;
  if (s) {
    const ou = s.recette !== undefined ? `recette ${s.recette} sur ${s.nbRecettes}` : `${s.nbRecettes} recette${s.nbRecettes > 1 ? "s" : ""}`;
    lignes.push(`Calcul d'origine : « ${s.libelle} » (${s.methode}, ${ou}, sauvegardé le ${s.sauveLe})`);
    lignes.push(`Catégorie : ${inst.categorie} · Analyse : ${inst.methode}`);
  } else {
    lignes.push(`Catégorie : ${inst.categorie} · Méthode : ${inst.methode}`);
  }
  if (inst.parametre) {
    const p = inst.parametre;
    lignes.push(`Paramètre balayé : ${p.label} de ${f(p.min)} à ${f(p.max)} (${p.points} points)`);
  }
  const rec = [
    `Gs résidu ${f(r.gsResidu)}`, `w0 ${f(r.w0Pct, 1)} %`, `Cw ${f(r.cwPct, 1)} %`,
    `Sr ${f(r.srPct, 0)} %`, `Bw ${f(r.bwPct, 2)} %`,
  ];
  if (r.amPct !== undefined) rec.push(`Am ${f(r.amPct, 1)} %`);
  if (r.gsAgregat !== undefined) rec.push(`Gs granulat ${f(r.gsAgregat)}`);
  lignes.push(`${s ? "Valeurs de départ" : "Recette de base"} : ${rec.join(" · ")}`);
  if (inst.volumeM3 !== undefined) {
    lignes.push(`Volume analysé : ${inst.volumeM3 < 1 ? `${f(inst.volumeM3 * 1000)} L` : `${f(inst.volumeM3)} m³`} (volume total de la recette sauvegardée)`);
  }
  lignes.push(
    "Liants : " + (inst.liants.length
      ? inst.liants.map((l) => `${l.code || "?"} (Gs ${f(l.gs)} · ${f(l.fractionPct, 1)} %)`).join(", ")
      : "aucun"),
  );
  const c = inst.constantes;
  lignes.push(`Pack de conventions : ${c.packLabel} · convention Gs « ${c.conventionGs} » · règle liant « ${c.regleLiant} »`);
  lignes.push(`Constantes : ρ_eau ${f(c.masseVolEau, 0)} · g ${f(c.gravite)} · facteur cône ${f(c.facteurCone)} · coeff. du dosage selon le slump ${f(c.coeffSlump, 0)} · constante du dosage selon le slump ${f(c.constSlump)}`);
  if (inst.contenant) {
    const geo = [libelleContenant(inst.contenant.type)];
    if (inst.contenant.description) geo.push(inst.contenant.description);
    if (inst.contenants !== undefined) geo.push(`${f(inst.contenants, 0)} moule(s)`);
    if (inst.facteurSecurite !== undefined) geo.push(`facteur de perte κ ${f(inst.facteurSecurite)}`);
    lignes.push(`Moule : ${geo.join(" · ")}`);
  }
  if (inst.variantes?.length) {
    lignes.push(`Recettes comparées : ${inst.variantes.join(" · ")}`);
  }
  if (inst.sorties?.length) {
    lignes.push(`Grandeurs tracées : ${inst.sorties.join(", ")}`);
  }
  if (inst.parametre) {
    // Le sous-mode « écart % » est choisi APRÈS le calcul, alors que cet
    // instantané est figé AU calcul : il n'a donc pas sa place ci-dessus. Ce
    // que l'on peut affirmer sans mentir, c'est ce que contient l'export.
    lignes.push("Export en valeurs absolues (le mode « écart % » est un affichage).");
  }
  if (s?.reconstitutions?.length) lignes.push(`Valeurs reconstituées : ${s.reconstitutions.join(" ")}`);
  lignes.push(s
    ? `Version des formules de l'analyse : ${libelleVersion(inst.versionSolveur)} · du calcul d'origine : ${s.versionCalcul ? libelleVersion(s.versionCalcul) : "inconnue"}`
    : `Version du solveur : ${libelleVersion(inst.versionSolveur)}`);
  return lignes;
}

/** En-tête CSV commenté (une ligne « # … » par ligne de résumé). */
export function lignesMetaCsv(inst: InstantaneAnalyse): string[] {
  return lignesResume(inst).map((l) => "# " + l);
}
