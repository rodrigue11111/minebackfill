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

import type { Recipe, RrcRecipe } from "./types";
import type { UnitPreferences } from "./units";
import { fromStoreMass, fromStoreVolume, fromStoreDensity } from "./units";
import {
  masseRejetSecTotaleKg, masseSolidesTotaleKg, masseRemblaiTotaleKg,
  masseEauDansResidusKg, volumeAirM3, cwCalculePct, cvCalculePct,
  rhoSolideKgM3, gammaSolideKNM3,
} from "./derived";

/* ── Contexte de rendu (identique pour écran, Excel et PDF) ── */

export interface ReportCtx {
  units: UnitPreferences;
  massLabel: string;
  volLabel: string;
  densLabel: string;
  binderName: (n: 1 | 2 | 3) => string;
  isEssai: boolean;
  isRpg: boolean;
  bcount: number;
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
  { id: 2, title: () => "Paramètres géotechniques", sub: () => "pourcentages & rapports" },
  { id: 3, title: () => "Masses volumiques", sub: (c) => `densités en ${c.densLabel}` },
  { id: 4, title: () => "Indices des vides & structure", sub: () => "indice des vides, porosité, Gs" },
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
  { section: 1, label: (c) => (c.isEssai ? "Bw% cible" : "Liant Bw%"), unit: cst("%"), getter: (r) => r.bw_mass_pct, digits: 2, bold: true, formulaIds: ["F016"] },
  { section: 1, label: cst("Liant Bv%"), unit: cst("% vol."), getter: (r) => r.bv_vol_pct, digits: 2, formulaIds: ["F022"] },
  { section: 1, label: (c) => (c.isEssai ? "Résidu sec (tot.)" : "Résidu sec Mr"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.residue_dry_mass_kg, c.units.mass), digits: 3, bold: true },
  { section: 1, label: cst("Agrégat sec Ma"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.aggregate_dry_mass_kg, c.units.mass), digits: 3, bold: true, when: (c) => c.isRpg },
  { section: 1, label: (c) => (c.isEssai ? "Liant (tot.)" : "Liant Mb"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_total_mass_kg, c.units.mass), digits: 3, bold: true },
  { section: 1, label: cst("Résidu humide Mr-hum"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.residue_wet_mass_kg, c.units.mass), digits: 3 },
  { section: 1, label: cst("Eau totale Mw"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_total_mass_kg, c.units.mass), digits: 3 },
  { section: 1, label: cst("Eau à ajouter/retirer Mw-aj"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_to_add_mass_kg, c.units.mass), digits: 3 },
  { section: 1, label: (c) => `${c.binderName(1)} Mc1`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c1_mass_kg, c.units.mass), digits: 3, when: (c) => c.bcount >= 1 },
  { section: 1, label: (c) => `${c.binderName(2)} Mc2`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c2_mass_kg, c.units.mass), digits: 3, when: (c) => c.bcount >= 2 },
  { section: 1, label: (c) => `${c.binderName(3)} Mc3`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c3_mass_kg, c.units.mass), digits: 3, when: (c) => c.bcount >= 3 },
  { section: 1, label: cst("Liant à ajouter/retirer Mb-ad"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_to_add_mass_kg, c.units.mass), digits: 3, when: (c) => c.isEssai },
  { section: 1, label: (c) => `${c.binderName(1)} à ajouter/retirer Mc1-ad`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c1_to_add_mass_kg, c.units.mass), digits: 3, when: (c) => c.isEssai },
  { section: 1, label: (c) => `${c.binderName(2)} à ajouter/retirer Mc2-ad`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c2_to_add_mass_kg, c.units.mass), digits: 3, when: (c) => c.isEssai && c.bcount >= 2 },
  { section: 1, label: (c) => `${c.binderName(3)} à ajouter/retirer Mc3-ad`, unit: masse, getter: (r, c) => fromStoreMass(r.components?.binder_c3_to_add_mass_kg, c.units.mass), digits: 3, when: (c) => c.isEssai && c.bcount >= 3 },

  /* ── 2. Paramètres géotechniques ── */
  { section: 2, label: cst("Liant Bw%"), unit: cst("%"), getter: (r) => r.bw_mass_pct, digits: 2, bold: true, formulaIds: ["F016"] },
  { section: 2, label: cst("Solides Cw%"), unit: cst("% mass."), getter: (r) => r.solids_mass_pct, digits: 2, formulaIds: ["F009"] },
  { section: 2, label: cst("Solides Cv%"), unit: cst("% vol."), getter: (r) => r.cv_vol_pct, digits: 2, formulaIds: ["F010"] },
  { section: 2, label: cst("Teneur en eau w"), unit: cst("%"), getter: (r) => r.w_mass_pct, digits: 2, formulaIds: ["F001"] },
  { section: 2, label: cst("Rapport E/C"), unit: sansUnite, getter: (r) => r.wc_ratio, digits: 3, formulaIds: ["F028"] },
  { section: 2, label: cst("Saturation Sr"), unit: cst("%"), getter: (r) => r.saturation_pct, digits: 1, formulaIds: ["F003"] },
  { section: 2, label: cst("Granulat massique Am"), unit: cst("%"), getter: (r) => r.aggregate_mass_pct, digits: 2, when: (c) => c.isRpg },
  { section: 2, label: cst("Granulat vol. / résidus"), unit: cst("% vol."), getter: (r) => r.aggregate_vol_pct_of_residue, digits: 2, when: (c) => c.isRpg },
  { section: 2, label: cst("Granulat vol. / remblai"), unit: cst("% vol."), getter: (r) => r.aggregate_vol_pct_of_backfill, digits: 2, when: (c) => c.isRpg },

  /* ── 3. Masses volumiques ── */
  { section: 3, label: cst("Masse vol. humide rho_h"), unit: densite, getter: (r, c) => fromStoreDensity(r.bulk_density_kg_m3, c.units.density), digits: 4, bold: true, formulaIds: ["F023", "F024"] },
  { section: 3, label: cst("Masse vol. sèche rho_d"), unit: densite, getter: (r, c) => fromStoreDensity(r.dry_density_kg_m3, c.units.density), digits: 4, bold: true, formulaIds: ["F007"] },
  { section: 3, label: cst("Poids vol. humide gamma_h"), unit: cst("kN/m3"), getter: (r) => r.bulk_unit_weight_kN_m3, digits: 2, formulaIds: ["F027"] },
  { section: 3, label: cst("Poids vol. sec gamma_d"), unit: cst("kN/m3"), getter: (r) => r.dry_unit_weight_kN_m3, digits: 2 },
  { section: 3, label: cst("Masse vol. solide rho_s"), unit: densite, getter: (r, c) => fromStoreDensity(rhoSolideKgM3(r), c.units.density), digits: 4 },
  { section: 3, label: cst("Poids vol. solide gamma_s"), unit: cst("kN/m3"), getter: (r) => gammaSolideKNM3(r), digits: 2 },

  /* ── 4. Indices des vides & structure ── */
  { section: 4, label: cst("Indice des vides e"), unit: sansUnite, getter: (r) => r.void_ratio, digits: 5, bold: true, formulaIds: ["F004"] },
  { section: 4, label: cst("Porosité n"), unit: sansUnite, getter: (r) => r.porosity, digits: 5, formulaIds: ["F005"] },
  { section: 4, label: cst("Teneur eau vol. theta"), unit: cst("%"), getter: (r) => r.theta_pct, digits: 2, formulaIds: ["F002"] },
  { section: 4, label: cst("Gs remblai"), unit: sansUnite, getter: (r) => r.gs_backfill, digits: 5, formulaIds: ["F026"] },
  { section: 4, label: cst("Gs liant"), unit: sansUnite, getter: (r) => r.gs_binder, digits: 4, formulaIds: ["F008"] },

  /* ── 5. Volumes ── */
  { section: 5, label: cst("Volume moule V_moule"), unit: volume, getter: (r, c) => fromStoreVolume(r.container_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume total V_T"), unit: volume, getter: (r, c) => fromStoreVolume(r.total_backfill_volume_m3, c.units.volume), digits: 4, bold: true },
  { section: 5, label: cst("Volume solide V_s"), unit: volume, getter: (r, c) => fromStoreVolume(r.solid_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume vides V_v"), unit: volume, getter: (r, c) => fromStoreVolume(r.void_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume résidu V_r"), unit: volume, getter: (r, c) => fromStoreVolume(r.residue_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume liant V_b"), unit: volume, getter: (r, c) => fromStoreVolume(r.binder_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume eau V_w"), unit: volume, getter: (r, c) => fromStoreVolume(r.water_volume_m3, c.units.volume), digits: 4 },
  { section: 5, label: cst("Volume granulat V_g"), unit: volume, getter: (r, c) => fromStoreVolume(r.aggregate_volume_m3, c.units.volume), digits: 4, when: (c) => c.isRpg },

  /* ── 6. Résultats complets ── */
  { section: 6, label: cst("Masse rejet sec totale M_r_sec_tot"), unit: masse, getter: (r, c) => fromStoreMass(masseRejetSecTotaleKg(r), c.units.mass), digits: 4, bold: true },
  { section: 6, label: cst("Masse solides totale M_s"), unit: masse, getter: (r, c) => fromStoreMass(masseSolidesTotaleKg(r), c.units.mass), digits: 4, bold: true },
  { section: 6, label: cst("Masse eau totale M_w"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_total_mass_kg, c.units.mass), digits: 4 },
  { section: 6, label: cst("Masse remblai totale M_t"), unit: masse, getter: (r, c) => fromStoreMass(masseRemblaiTotaleKg(r), c.units.mass), digits: 4 },
  { section: 6, label: cst("Eau dans résidu M_w-res"), unit: masse, getter: (r, c) => fromStoreMass(masseEauDansResidusKg(r), c.units.mass), digits: 4 },
  { section: 6, label: cst("Eau à ajouter/retirer M_w-aj"), unit: masse, getter: (r, c) => fromStoreMass(r.components?.water_to_add_mass_kg, c.units.mass), digits: 4 },
  { section: 6, label: cst("Volume air V_air"), unit: volume, getter: (r, c) => fromStoreVolume(volumeAirM3(r), c.units.volume), digits: 4 },
  { section: 6, label: cst("Cw calcule (depuis masses)"), unit: cst("%"), getter: (r) => cwCalculePct(r), digits: 4, formulaIds: ["F009"] },
  { section: 6, label: cst("Cv calcule (depuis volumes)"), unit: cst("%"), getter: (r) => cvCalculePct(r), digits: 4, formulaIds: ["F010"] },
];

/** Lignes visibles d'une section pour un contexte donné. */
export function rowsForSection(section: ReportSectionId, ctx: ReportCtx): ReportRow[] {
  return REPORT_ROWS.filter((row) => row.section === section && (!row.when || row.when(ctx)));
}

/* ── RRC / CRF : liste unique (écran + exports) ── */

export interface RrcReportRow {
  label: (massLabel: string) => string;
  getter: (r: RrcRecipe, toMass: (kg: number | null | undefined) => number | null) => number | null;
  digits: number;
  bold?: boolean;
}

export const RRC_ROWS: RrcReportRow[] = [
  { label: () => "Bw (liant/roches) (%)", getter: (r) => r.bw_mass_pct ?? null, digits: 2, bold: true },
  { label: () => "W/C du coulis", getter: (r) => r.wc_ratio ?? null, digits: 3 },
  { label: () => "Teneur en eau w (%)", getter: (r) => r.w_mass_pct ?? null, digits: 3 },
  { label: () => "Solides Cw (%)", getter: (r) => r.solids_mass_pct ?? null, digits: 3 },
  { label: (m) => `Masse totale M_CRF (${m})`, getter: (r, toMass) => toMass(r.total_mass_kg), digits: 3, bold: true },
  { label: () => "Volume CRF V_CRF (m3)", getter: (r) => r.crf_volume_m3 ?? null, digits: 2 },
  { label: (m) => `Roches stériles M_WR (${m})`, getter: (r, toMass) => toMass(r.waste_rock_mass_kg), digits: 3, bold: true },
  { label: (m) => `Ciment M_c (${m})`, getter: (r, toMass) => toMass(r.cement_mass_kg), digits: 3, bold: true },
  { label: (m) => `Eau M_w (${m})`, getter: (r, toMass) => toMass(r.water_mass_kg), digits: 3 },
  { label: (m) => `Fluide (eau + SR) M* (${m})`, getter: (r, toMass) => toMass(r.fluid_mass_kg), digits: 3 },
  { label: (m) => `Retardateur M_SR (${m})`, getter: (r, toMass) => toMass(r.retarder_mass_kg), digits: 3 },
  { label: () => "Retardateur V_SR (L)", getter: (r) => r.retarder_volume_l ?? null, digits: 2 },
  { label: () => "Dosage retardateur D_m (% de Mc)", getter: (r) => r.retarder_dosage_mass_pct ?? null, digits: 3 },
  { label: (m) => `Coulis M_c-slurry (${m})`, getter: (r, toMass) => toMass(r.slurry_mass_kg), digits: 3 },
  { label: () => "Coulis V_c-slurry (m3)", getter: (r) => r.slurry_volume_m3 ?? null, digits: 3 },
];
