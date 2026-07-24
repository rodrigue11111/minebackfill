// frontend/src/lib/gachee.ts
// Modèle « gâchée réelle » : ce que l'étudiant a VRAIMENT préparé au laboratoire
// (pesées réelles, lots, humidité mesurée, mesures fraîches, ajustements), relié
// à une formulation théorique. C'est le maillon manquant entre la recette
// calculée et les éprouvettes/essais (phases suivantes). Types + helpers PURS.

import type { Recipe } from "./types";
import type { Eprouvette } from "./eprouvette";

export type StatutGachee = "brouillon" | "terminee";

/**
 * Instantané des paramètres de la formulation d'origine (traçabilité et axes
 * des résultats UCS mesurés). Capturé à la création de la gâchée pour rester
 * stable même si la formulation source est modifiée ou supprimée.
 */
export interface ParametresFormulation {
  cwPct?: number; // concentration solide Cw (solids_mass_pct)
  wcRatio?: number; // rapport eau/liant (wc_ratio)
  bwPct?: number; // dosage en liant Bw (bw_mass_pct)
  wPct?: number; // teneur en eau w (w_mass_pct)
}

/** Un composant à peser : masse CIBLE (théorique) vs masse RÉELLEMENT pesée. */
export interface ComposantPese {
  cle: string; // "residu" | "granulat" | "liant" | "liant:0" | "eau"
  label: string;
  cibleKg: number;
  peseeKg?: number;
}

export interface Ajustement {
  id: string;
  type: "eau" | "residu" | "granulat" | "liant";
  masseKg: number;
  note?: string;
}

export interface Gachee {
  id: string;
  code: string; // auto « G-AAAAMMJJ-NN »
  creeLe: string; // ISO
  statut: StatutGachee;

  // Formulation d'origine (instantané minimal — traçabilité).
  formulationLabel: string;
  formulationId?: string; // id d'un SavedResult, si issu d'une sauvegarde
  categorie: string; // RPC | RPG | RRC
  recetteIndex: number; // n° de recette dans la formulation (0-indexé)
  solverVersion?: string;

  // Pesées cibles vs réelles + seuil de tolérance (%).
  composants: ComposantPese[];
  tolerancePct: number;

  // Lots de matériaux (traçabilité).
  lotResidu?: string;
  lotGranulat?: string;
  lotLiant?: string;

  // Mesures au labo.
  w0MesurePct?: number; // humidité réelle du résidu
  slumpMesureMm?: number;
  temperatureC?: number;
  wMesurePct?: number;
  cwMesurePct?: number;

  // Essai-erreur : ce qui a été ajouté après le premier malaxage.
  ajustements: Ajustement[];
  observations?: string;

  // Éprouvettes moulées à partir de cette gâchée (mise en cure, écrasement).
  eprouvettes: Eprouvette[];

  // Instantané des paramètres de la recette (Cw, W/C, Bw, w) — traçabilité.
  parametres?: ParametresFormulation;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Écart pesée − cible (kg et %), ou null si rien de pesé. */
export function ecart(c: ComposantPese): { kg: number; pct: number } | null {
  if (c.peseeKg === undefined || !Number.isFinite(c.peseeKg)) return null;
  const kg = c.peseeKg - c.cibleKg;
  const pct = c.cibleKg !== 0 ? (kg / Math.abs(c.cibleKg)) * 100 : 0;
  return { kg, pct };
}

/** Vrai si l'écart d'un composant dépasse la tolérance (en valeur absolue). */
export function horsTolerance(c: ComposantPese, tolerancePct: number): boolean {
  const e = ecart(c);
  return e !== null && Math.abs(e.pct) > tolerancePct;
}

/** Nombre de composants pesés hors tolérance. */
export function nbHorsTolerance(g: Gachee): number {
  return g.composants.filter((c) => horsTolerance(c, g.tolerancePct)).length;
}

/**
 * Code de gâchée « G-AAAAMMJJ-NN » : NN incrémente parmi les gâchées du même
 * jour (déduit des codes existants), pour rester lisible et unique localement.
 */
export function genererCode(existantes: Gachee[], date: Date): string {
  const jour = date.toISOString().slice(0, 10).replace(/-/g, "");
  const prefixe = `G-${jour}-`;
  const max = existantes
    .filter((g) => g.code.startsWith(prefixe))
    .map((g) => parseInt(g.code.slice(prefixe.length), 10))
    .filter((n) => Number.isInteger(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefixe}${String(max + 1).padStart(2, "0")}`;
}

/**
 * Composants à peser déduits d'une recette calculée : résidu HUMIDE (ce qu'on
 * pèse réellement), granulat sec, liant(s) — détaillés si plusieurs ciments —,
 * et eau à ajouter. Les composants nuls sont omis.
 */
export function composantsDepuisRecette(r: Recipe, nomLiant: (i: number) => string): ComposantPese[] {
  const c = r.components ?? {};
  const out: ComposantPese[] = [];

  const rh = num(c.residue_wet_mass_kg);
  if (rh > 0) out.push({ cle: "residu", label: "Résidu humide", cibleKg: rh });

  const g = num(c.aggregate_dry_mass_kg);
  if (g > 0) out.push({ cle: "granulat", label: "Granulat", cibleKg: g });

  const masses = (c.binder_masses_kg ?? []).map(num);
  if (masses.filter((m) => m > 0).length > 1) {
    // Détail par ciment. On garde l'indice RÉEL dans le système de liant : ne
    // pas ré-indexer après avoir sauté les masses nulles, sinon l'étiquette et
    // la clé se décalent par rapport au vrai liant.
    masses.forEach((m, i) => {
      if (m > 0) out.push({ cle: `liant:${i}`, label: nomLiant(i + 1), cibleKg: m });
    });
  } else {
    const b = num(c.binder_total_mass_kg);
    if (b > 0) out.push({ cle: "liant", label: "Liant", cibleKg: b });
  }

  // Eau : uniquement ce qu'il faut AJOUTER. Une valeur négative signifie « eau à
  // retirer » (résidu livré plus humide que le Cw cible) — ce n'est pas une
  // pesée, on l'omet donc de la liste des composants à peser.
  const eau = num(c.water_to_add_mass_kg);
  if (eau > 0) out.push({ cle: "eau", label: "Eau à ajouter", cibleKg: eau });

  return out;
}

/** Instantané des paramètres (Cw, W/C, Bw, w) d'une recette calculée. */
export function parametresDepuisRecette(r: Recipe): ParametresFormulation {
  const val = (v: number | null | undefined): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  return {
    cwPct: val(r.solids_mass_pct),
    wcRatio: val(r.wc_ratio),
    bwPct: val(r.bw_mass_pct),
    wPct: val(r.w_mass_pct),
  };
}
