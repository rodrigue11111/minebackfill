// frontend/src/lib/report-schema.ts
// SCHÉMA DE RAPPORT UNIQUE : la liste des lignes de résultats (52 lignes,
// 6 sections) définie UNE seule fois et consommée par le tableau à l'écran
// (ResultsPanel), l'export Excel et le rapport PDF. Avant ce module, la même
// liste existait en trois copies quasi identiques qui divergeaient déjà
// (libellés, décimales). Un nouveau champ de solveur = une ligne ici, visible
// partout. Les libellés adoptés sont la forme longue des exports ; les
// décimales sont celles des exports (plus précises que l'écran historique).
//
// Le RRC (RrcRecipe, forme distincte) a sa propre liste RRC_ROWS, consommée
// par la vue écran et les exports RRC.

import type { Recipe, RecipeComponents, RrcRecipe } from "./types";
import type { UnitPreferences } from "./units";
import { fromStoreMass, fromStoreVolume, fromStoreDensity } from "./units";
import {
  masseRejetSecTotaleKg, masseSolidesTotaleKg, masseRemblaiTotaleKg,
  masseEauDansResidusKg, volumeAirM3, cwCalculePct, cvCalculePct,
  rhoSolideKgM3, gammaSolideKNM3,
} from "./derived";
import { libelle } from "./glossaire";

/* ── Contexte de rendu (identique pour écran, Excel et PDF) ── */

export interface ReportCtx {
  units: UnitPreferences;
  massLabel: string;
  volLabel: string;
  densLabel: string;
  /** Nom du composant de liant n (1-indexé), pour un nombre N quelconque. */
  binderName: (n: number) => string;
  isEssai: boolean;
  isRpg: boolean;
  bcount: number;
}

/** Nombre maximal de composants de liant affichés (aligné sur le backend). */
export const MAX_BINDER_ROWS = 8;

/** Masse du composant n (1-indexé) : liste N-aire, repli legacy c1/2/3. */
function masseComposant(c: RecipeComponents | null | undefined, i: number): number | null | undefined {
  const liste = c?.binder_masses_kg;
  if (liste && liste.length > i) return liste[i];
  return [c?.binder_c1_mass_kg, c?.binder_c2_mass_kg, c?.binder_c3_mass_kg][i];
}

/** Masse « à ajouter » du composant n (essai) : liste N-aire, repli legacy. */
function masseAjoutComposant(c: RecipeComponents | null | undefined, i: number): number | null | undefined {
  const liste = c?.binder_to_add_masses_kg;
  if (liste && liste.length > i) return liste[i];
  return [c?.binder_c1_to_add_mass_kg, c?.binder_c2_to_add_mass_kg, c?.binder_c3_to_add_mass_kg][i];
}

export type ReportSectionId = 1 | 2 | 3 | 4 | 5 | 6;

export interface ReportRow {
  section: ReportSectionId;
  label: (ctx: ReportCtx) => string;
  /** Libellé d'unité déjà résolu ("" = sans unité). */
  unit: (ctx: ReportCtx) => string;
  getter: (r: Recipe, ctx: ReportCtx) => number | null | undefined;
  digits: number;
  bold?: boolean;
  /** Condition d'affichage (remplace les gardes isRpg/isEssai/bcount). */
  when?: (ctx: ReportCtx) => boolean;
  /** Formules liées (popover de l'écran). */
  formulaIds?: string[];
}

export const REPORT_SECTIONS: {
  id: ReportSectionId;
  title: (ctx: ReportCtx) => string;
  sub: (ctx: ReportCtx) => string;
}[] = [
  { id: 1, title: (c) => (c.isEssai ? "Données du mélange ajusté" : "Données du mélange"), sub: (c) => `masses en ${c.massLabel}` },
  { id: 2, title: () => "Paramètres géotechniques", sub: () => "pourcentages et rapports" },
  { id: 3, title: () => "Masses et poids volumiques", sub: (c) => `masses volumiques en ${c.densLabel}, poids volumiques en kN/m3` },
  { id: 4, title: () => "Indice des vides et structure", sub: () => "indice des vides, porosité, densités relatives" },
  { id: 5, title: () => "Volumes", sub: (c) => `en ${c.volLabel}` },
  { id: 6, title: () => "Résultats complets", sub: (c) => `masses en ${c.massLabel}, volumes en ${c.volLabel}` },
];

const cst = (s: string) => () => s;
const sansUnite = () => "";
const masse = (c: ReportCtx) => c.massLabel;
const volume = (c: ReportCtx) => c.volLabel;
const densite = (c: ReportCtx) => c.densLabel;

export const REPORT_ROWS: ReportRow[] = [
  /* ── 1. Données du mélange ── */
  // En essai, bw_mass_pct est le Bw ATTEINT (D89) : égal à la cible sous
  // Intra 2017, dilué par un ajout de granulat sous la règle « gramme ».
  { section: 1, label: (c) => (c.isEssai ? `${libelle("bw")} atteint` : libelle("bw")), unit: cst("%"), getter: (r) => r.bw_mass_pct, digits: 2, bold: true, formulaIds: ["F016"] },
  { section: 1, label: cst(libelle("bv")), unit: cst("%"), getter: (r) => r.bv_vol_pct, digits: 2, formulaIds: ["F022"] },
  { section: 1, label: (c) => (c.isEssai ? "Résidu sec total Mr" : "Résidu sec Mr"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.residue_dry_mass_kg, c.units.mass), digits: 3, bold: true },
  { section: 1, label: cst("Granulat sec Ma"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.aggregate_dry_mass_kg, c.units.mass), digits: 3, bold: true, when: (c) => c.isRpg },
  { section: 1, label: (c) => (c.isEssai ? "Liant total Mb" : "Liant Mb"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_total_mass_kg, c.units.mass), digits: 3, bold: true },
  { section: 1, label: cst("Résidu humide Mr-hum"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.residue_wet_mass_kg, c.units.mass), digits: 3 },
  { section: 1, label: cst("Eau totale Mw"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_total_mass_kg, c.units.mass), digits: 3 },
  { section: 1, label: cst("Eau à ajouter/retirer Mw-aj"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_to_add_mass_kg, c.units.mass), digits: 3 },
  // Masses par composant de liant (N composants) — générées par index.
  ...Array.from({ length: MAX_BINDER_ROWS }, (_, i): ReportRow => ({
    section: 1,
    label: (c) => `${c.binderName(i + 1)} Mc${i + 1}`,
    unit: masse,
    getter: (r, c) => fromStoreMass(masseComposant(r.components, i), c.units.mass),
    digits: 3,
    when: (c) => c.bcount >= i + 1,
  })),
  { section: 1, label: cst("Liant à ajouter/retirer Mb-ad"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_to_add_mass_kg, c.units.mass), digits: 3, when: (c) => c.isEssai },
  // Masses « à ajouter » par composant (essai) — générées par index.
  ...Array.from({ length: MAX_BINDER_ROWS }, (_, i): ReportRow => ({
    section: 1,
    label: (c) => `${c.binderName(i + 1)} à ajouter/retirer Mc${i + 1}-ad`,
    unit: masse,
    getter: (r, c) => fromStoreMass(masseAjoutComposant(r.components, i), c.units.mass),
    digits: 3,
    when: (c) => c.isEssai && c.bcount >= i + 1,
  })),

  /* ── 2. Paramètres géotechniques ── */
  { section: 2, label: cst(libelle("bw")), unit: cst("%"), getter: (r) => r.bw_mass_pct, digits: 2, bold: true, formulaIds: ["F016"] },
  { section: 2, label: cst(libelle("cw")), unit: cst("%"), getter: (r) => r.solids_mass_pct, digits: 2, formulaIds: ["F009"] },
  { section: 2, label: cst(libelle("cv")), unit: cst("%"), getter: (r) => r.cv_vol_pct, digits: 2, formulaIds: ["F010"] },
  { section: 2, label: cst(libelle("w")), unit: cst("%"), getter: (r) => r.w_mass_pct, digits: 2, formulaIds: ["F001"] },
  { section: 2, label: cst(libelle("el")), unit: sansUnite, getter: (r) => r.wc_ratio, digits: 3, formulaIds: ["F028"] },
  { section: 2, label: cst(libelle("sr")), unit: cst("%"), getter: (r) => r.saturation_pct, digits: 1, formulaIds: ["F003"] },
  { section: 2, label: cst(libelle("am")), unit: cst("%"), getter: (r) => r.aggregate_mass_pct, digits: 2, when: (c) => c.isRpg },
  { section: 2, label: cst("Fraction volumique de granulat / résidu"), unit: cst("%"), getter: (r) => r.aggregate_vol_pct_of_residue, digits: 2, when: (c) => c.isRpg },
  { section: 2, label: cst("Fraction volumique de granulat / remblai"), unit: cst("%"), getter: (r) => r.aggregate_vol_pct_of_backfill, digits: 2, when: (c) => c.isRpg },

  /* ── 3. Masses et poids volumiques ── */
  { section: 3, label: cst("Masse volumique humide ρh"), unit: densite, getter: (r, c) => fromStoreDensity(r.bulk_density_kg_m3, c.units.density), digits: 4, bold: true, formulaIds: ["F023", "F024"] },
  { section: 3, label: cst("Masse volumique sèche ρd"), unit: densite, getter: (r, c) => fromStoreDensity(r.dry_density_kg_m3, c.units.density), digits: 4, bold: true, formulaIds: ["F007"] },
  { section: 3, label: cst("Poids volumique humide γh"), unit: cst("kN/m3"), getter: (r) => r.bulk_unit_weight_kN_m3, digits: 2, formulaIds: ["F027"] },
  { section: 3, label: cst("Poids volumique sec γd"), unit: cst("kN/m3"), getter: (r) => r.dry_unit_weight_kN_m3, digits: 2 },
  { section: 3, label: cst("Masse volumique des grains ρs"), unit: densite, getter: (r, c) => fromStoreDensity(rhoSolideKgM3(r), c.units.density), digits: 4 },
  { section: 3, label: cst("Poids volumique des grains γs"), unit: cst("kN/m3"), getter: (r) => gammaSolideKNM3(r), digits: 2 },

  /* ── 4. Indice des vides et structure ── */
  { section: 4, label: cst(libelle("e")), unit: sansUnite, getter: (r) => r.void_ratio, digits: 5, bold: true, formulaIds: ["F004"] },
  { section: 4, label: cst(libelle("n")), unit: sansUnite, getter: (r) => r.porosity, digits: 5, formulaIds: ["F005"] },
  { section: 4, label: cst(libelle("theta")), unit: cst("%"), getter: (r) => r.theta_pct, digits: 2, formulaIds: ["F002"] },
  { section: 4, label: cst("Densité relative Gs du remblai"), unit: sansUnite, getter: (r) => r.gs_backfill, digits: 5, formulaIds: ["F026"] },
  { section: 4, label: cst("Densité relative Gs du liant"), unit: sansUnite, getter: (r) => r.gs_binder, digits: 4, formulaIds: ["F008"] },

  /* ── 5. Volumes ── */
  { section: 5, label: cst("Volume du moule"), unit: volume, getter: (r, c) => fromStoreVolume(r.container_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume total VT"), unit: volume, getter: (r, c) => fromStoreVolume(r.total_backfill_volume_m3, c.units.volume), digits: 4, bold: true },
  { section: 5, label: cst("Volume des solides Vs"), unit: volume, getter: (r, c) => fromStoreVolume(r.solid_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume des vides Vv"), unit: volume, getter: (r, c) => fromStoreVolume(r.void_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume du résidu Vr"), unit: volume, getter: (r, c) => fromStoreVolume(r.residue_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume du liant Vb"), unit: volume, getter: (r, c) => fromStoreVolume(r.binder_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume d'eau Vw"), unit: volume, getter: (r, c) => fromStoreVolume(r.water_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume du granulat Vg"), unit: volume, getter: (r, c) => fromStoreVolume(r.aggregate_volume_m3, c.units.volume), digits: 4, when: (c) => c.isRpg },

  /* ── 6. Résultats complets ── */
  { section: 6, label: (c) => (c.isRpg ? "Masse sèche de résidu et de granulat" : "Masse sèche totale de résidu"), unit: masse, getter: (r, c) => fromStoreMass(masseRejetSecTotaleKg(r), c.units.mass), digits: 4, bold: true },
  { section: 6, label: cst("Masse totale des solides Ms"), unit: masse, getter: (r, c) => fromStoreMass(masseSolidesTotaleKg(r), c.units.mass), digits: 4, bold: true },
  { section: 6, label: cst("Masse totale d'eau Mw"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_total_mass_kg, c.units.mass), digits: 4 },
  { section: 6, label: cst("Masse totale du remblai"), unit: masse, getter: (r, c) => fromStoreMass(masseRemblaiTotaleKg(r), c.units.mass), digits: 4 },
  { section: 6, label: cst("Eau contenue dans le résidu"), unit: masse, getter: (r, c) => fromStoreMass(masseEauDansResidusKg(r), c.units.mass), digits: 4 },
  { section: 6, label: cst("Eau à ajouter/retirer Mw-aj"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_to_add_mass_kg, c.units.mass), digits: 4 },
  { section: 6, label: cst("Volume d'air Va"), unit: volume, getter: (r, c) => fromStoreVolume(volumeAirM3(r), c.units.volume), digits: 4 },
  { section: 6, label: cst("Cw calculé à partir des masses"), unit: cst("%"), getter: (r) => cwCalculePct(r), digits: 4, formulaIds: ["F009"] },
  { section: 6, label: cst("Cv calculé à partir des volumes"), unit: cst("%"), getter: (r) => cvCalculePct(r), digits: 4, formulaIds: ["F010"] },
];

/** Lignes visibles d'une section pour un contexte donné. */
export function rowsForSection(section: ReportSectionId, ctx: ReportCtx): ReportRow[] {
  return REPORT_ROWS.filter((row) => row.section === section && (!row.when || row.when(ctx)));
}

/* ── RRC : liste unique (écran + exports) ── */

export interface RrcReportRow {
  label: (massLabel: string) => string;
  getter: (r: RrcRecipe, toMass: (kg: number | null | undefined) => number | null) => number | null;
  digits: number;
  bold?: boolean;
}

export const RRC_ROWS: RrcReportRow[] = [
  { label: () => "Taux massique de liant Bw (ciment / roches stériles) (%)", getter: (r) => r.bw_mass_pct ?? null, digits: 2, bold: true },
  { label: () => "Rapport E/L du coulis (W/C)", getter: (r) => r.wc_ratio ?? null, digits: 3 },
  { label: () => "Teneur en eau massique w (%)", getter: (r) => r.w_mass_pct ?? null, digits: 3 },
  { label: () => "Pourcentage solide massique Cw (%)", getter: (r) => r.solids_mass_pct ?? null, digits: 3 },
  { label: (m) => `Masse totale de RRC (${m})`, getter: (r, toMass) => toMass(r.total_mass_kg), digits: 3, bold: true },
  { label: () => "Volume de RRC (m3)", getter: (r) => r.crf_volume_m3 ?? null, digits: 2 },
  { label: (m) => `Roches stériles M_WR (${m})`, getter: (r, toMass) => toMass(r.waste_rock_mass_kg), digits: 3, bold: true },
  { label: (m) => `Ciment M_c (${m})`, getter: (r, toMass) => toMass(r.cement_mass_kg), digits: 3, bold: true },
  { label: (m) => `Eau M_w (${m})`, getter: (r, toMass) => toMass(r.water_mass_kg), digits: 3 },
  { label: (m) => `Fluide (eau + retardateur) M* (${m})`, getter: (r, toMass) => toMass(r.fluid_mass_kg), digits: 3 },
  { label: (m) => `Retardateur de prise M_SR (${m})`, getter: (r, toMass) => toMass(r.retarder_mass_kg), digits: 3 },
  { label: () => "Retardateur de prise V_SR (L)", getter: (r) => r.retarder_volume_l ?? null, digits: 2 },
  { label: () => "Dosage en retardateur D_m (% de M_c)", getter: (r) => r.retarder_dosage_mass_pct ?? null, digits: 3 },
  { label: (m) => `Coulis de ciment (${m})`, getter: (r, toMass) => toMass(r.slurry_mass_kg), digits: 3 },
  { label: () => "Volume de coulis (m3)", getter: (r) => r.slurry_volume_m3 ?? null, digits: 3 },
];
