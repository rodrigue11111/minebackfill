"use client";

import { create } from "zustand";
import { type UnitPreferences, DEFAULT_UNITS } from "./units";
import type { MixResult, Recipe, RrcResultat } from "./types";
import { loadVersioned, persistVersioned } from "./persisted";
import { descriptorFor } from "./method-registry";
import { solverVersionActive, CONVENTION_PACKS } from "./conventions";
import type { CloudSession } from "./supabase";
import {
  type MaterialOrigine, type MaterialKind, type MaterialItem,
  type ResiduItem, type GranulatItem, type RetardateurItem,
  residusDefaut, granulatsDefaut, retardateursDefaut,
  nouveauResidu, nouveauGranulat, nouveauRetardateur, estOfficiel,
} from "./materials";

// Version de référence des formules (pack par défaut). L'estampille réelle de
// chaque résultat sauvegardé vient de solverVersionActive(constantes) — elle
// suit le pack de convention actif (« gramme-1.0 », « ...-personnalise »).
// À incrémenter quand les formules changent (voir Issues.md).
export const SOLVER_VERSION = "intra2017-1.0";

export type Category = "RPC" | "RPG" | "RRC";
export type RpcMethod = "dosage_cw" | "wb" | "slump" | "essai";
// Méthode telle qu'enregistrée dans l'historique : les méthodes RPC/RPG plus
// le cas RRC (le RRC n'a pas de sous-méthode, on l'étiquette « rrc »). On ne
// pollue pas RpcMethod avec une valeur qui n'est pas une méthode RPC.
export type SavedMethod = RpcMethod | "rrc";

export interface GeneralInfo {
  operator_name?: string | null;
  project_name?: string | null;
  residue_id?: string | null;
  mix_date?: string | null;

  container_type?:
    | "section_hauteur"
    | "rayon_hauteur"
    | "longueur_largeur_hauteur"
    | "volume"
    | null;
  container_section?: number | null;
  container_height?: number | null;
  container_radius?: number | null;
  container_length?: number | null;
  container_width?: number | null;
  container_volume_m3?: number | null;   // volume saisi directement (store: m³)

  binder_count?: number | null;

  // Source de vérité N-aire : la liste ordonnée des composants du liant.
  // Additif : binderN_type/id/fraction_pct ci-dessous restent renseignés en
  // miroir des 3 premiers (payload backend écho, anciennes sauvegardes,
  // consommateurs legacy). Utiliser lireBinders()/patchBinders() plutôt que
  // ces champs directement.
  binders?: BinderRef[];

  binder1_type?: string | null;
  binder2_type?: string | null;
  binder3_type?: string | null;

  // Identité du liant : l'id du catalogue (stable). Le code (binderN_type)
  // reste pour l'affichage, le payload backend et la rétro-compatibilité.
  binder1_id?: string | null;
  binder2_id?: string | null;
  binder3_id?: string | null;

  binder1_fraction_pct?: number;
  binder2_fraction_pct?: number;
  binder3_fraction_pct?: number;
}

/** Un composant du système de liant (identité par id, repli par code). */
export interface BinderRef {
  id?: string | null;
  code?: string | null;
  fraction_pct?: number;
}

/** Nombre maximal de composants de liant (aligné sur le backend). */
export const MAX_BINDERS = 8;

/**
 * Liste ordonnée des composants du liant. Source de vérité = `general.binders` ;
 * pour les anciennes sauvegardes (avant la liste), reconstruit depuis
 * binder1/2/3_* selon binder_count.
 */
export function lireBinders(general: GeneralInfo): BinderRef[] {
  if (general.binders && general.binders.length > 0) return general.binders;
  const legacy: BinderRef[] = [
    { id: general.binder1_id, code: general.binder1_type, fraction_pct: general.binder1_fraction_pct },
    { id: general.binder2_id, code: general.binder2_type, fraction_pct: general.binder2_fraction_pct },
    { id: general.binder3_id, code: general.binder3_type, fraction_pct: general.binder3_fraction_pct },
  ];
  // Nombre de composants : binder_count s'il est fixé, sinon le nombre de
  // composants legacy renseignés (un code) — au minimum 1, au plus 3 (le
  // schéma legacy n'a que binder1/2/3).
  const n = general.binder_count ?? Math.max(1, legacy.filter((b) => b.code).length);
  return legacy.slice(0, Math.min(Math.max(n, 1), 3));
}

/**
 * Patch de `general` à partir d'une nouvelle liste de composants : met à jour
 * `binders` + `binder_count`, et maintient le miroir legacy des 3 premiers
 * (les indices absents sont remis à null pour ne pas laisser de résidu).
 */
export function patchBinders(binders: BinderRef[]): Partial<GeneralInfo> {
  const b = binders.slice(0, MAX_BINDERS);
  const at = (i: number) => b[i] ?? { id: null, code: null, fraction_pct: undefined };
  return {
    binders: b,
    binder_count: b.length,
    binder1_id: at(0).id ?? null,
    binder1_type: at(0).code ?? null,
    binder1_fraction_pct: at(0).fraction_pct,
    binder2_id: at(1).id ?? null,
    binder2_type: at(1).code ?? null,
    binder2_fraction_pct: at(1).fraction_pct,
    binder3_id: at(2).id ?? null,
    binder3_type: at(2).code ?? null,
    binder3_fraction_pct: at(2).fraction_pct,
  };
}

export type EssaiGsConvention = "base" | "recalcule";
export type EssaiBinderRule = "solides_totaux" | "residu_ajoute";
export type ConventionPackId = "intra2017" | "gramme" | "personnalise";

export interface ConstantesCalcul {
  masse_volumique_eau_kg_m3: number;
  gravite_m_s2: number;
  facteur_petit_cone_vers_grand_cone: number;
  coefficient_modele_slump: number;
  constante_modele_slump: number;
  // Drapeaux de convention de calcul (défaut = feuille « Intra 2017 »).
  essai_gs_convention: EssaiGsConvention;
  essai_binder_rule: EssaiBinderRule;
  // Pack de convention actif (preset UI ; « personnalise » = valeurs déviées).
  // Non envoyé au backend — le payload porte les drapeaux explicites.
  pack_id: ConventionPackId;
}

/** Clés numériques (assainies > 0) vs clés chaîne (liste blanche) des constantes. */
const CONSTANTES_NUM_KEYS = [
  "masse_volumique_eau_kg_m3", "gravite_m_s2",
  "facteur_petit_cone_vers_grand_cone", "coefficient_modele_slump",
  "constante_modele_slump",
] as const;
const ESSAI_GS_VALUES: EssaiGsConvention[] = ["base", "recalcule"];
const ESSAI_BINDER_VALUES: EssaiBinderRule[] = ["solides_totaux", "residu_ajoute"];
const PACK_ID_VALUES: ConventionPackId[] = ["intra2017", "gramme", "personnalise"];

export interface LiantCatalogueItem {
  id: string;
  code: string;
  nom: string;
  gs: number;
  /** « officiel » = référence verrouillée ; absent/« perso » = modifiable. */
  origine?: MaterialOrigine;
}

export interface CwState {
  solid_mass_pct: number;
  saturation_pct: number;
  residue_sg: number;
  residue_w_pct: number;
  num_recipes: 1 | 2 | 3 | 4;
  desired_qty: number;
  safety_factor: number;
  binder_pct: number[];
}

export interface WbState {
  saturation_pct: number;
  residue_sg: number;
  residue_w_pct: number;
  num_recipes: 1 | 2 | 3 | 4;
  desired_qty: number;
  safety_factor: number;
  binder_pct: number[];
  wc_ratio: number[];
}

export interface SlumpState {
  cone_type: "mini" | "grand";
  slump_mm: number;
  saturation_pct: number;
  residue_sg: number;
  residue_w_pct: number;
  num_recipes: 1 | 2 | 3 | 4;
  desired_qty: number;
  safety_factor: number;
  binder_pct: number[];
}

export interface RpgCwState {
  solid_mass_pct: number;
  saturation_pct: number;
  residue_sg: number;
  residue_w_pct: number;
  aggregate_fraction_pct: number;  // A_m%
  aggregate_sg: number;            // Gs agrégat
  num_recipes: 1 | 2 | 3 | 4;
  desired_qty: number;
  safety_factor: number;
  binder_pct: number[];
}

export interface RpgWbState {
  saturation_pct: number;
  residue_sg: number;
  residue_w_pct: number;
  aggregate_fraction_pct: number;
  aggregate_sg: number;
  num_recipes: 1 | 2 | 3 | 4;
  desired_qty: number;
  safety_factor: number;
  binder_pct: number[];
  wc_ratio: number[];
}

export interface EssaiInputsState {
  base_method: "dosage_cw" | "wb";
  base_cw?: CwState;
  base_wb?: WbState;
  ajustements: {
    ajout_residu_sec?: number;
    ajout_residu_humide?: number;
    ajout_eau?: number;
  }[];
}

export interface RpgEssaiAdjustment {
  ajout_residu_sec?: number;
  ajout_residu_humide?: number;
  ajout_agregat?: number;
  w0_agregat?: number;
  ajout_eau?: number;
}

export interface RpgEssaiState {
  base_method: "dosage_cw" | "wb";
  base_cw?: RpgCwState;
  base_wb?: RpgWbState;
  ajustements: RpgEssaiAdjustment[];
}

export interface RrcState {
  quantity_mode: "volume" | "masse";
  volume_m3: number;
  wet_density_kg_m3: number;
  total_mass_kg: number;
  num_recipes: 1 | 2 | 3 | 4;
  binder_pct: number[];   // Bw% par recette
  wc_ratio: number[];     // W/C par recette
  cement_sg: number;
  retarder_d0: number;    // ml/100 kg de ciment
  retarder_density: number; // g/ml
}

export type RpcCwResponse = MixResult;

/* ── Industrie types ── */
export interface BinderPrice {
  /** Id du liant du catalogue (clé stable, résiste au renommage du code). */
  id?: string;
  code: string;
  price_per_kg: number;
}

/** Prix d'un liant : correspondance par id d'abord, repli par code.
    Deux passes distinctes : une entrée qui matche par code plus tôt dans le
    tableau ne doit jamais battre une correspondance par id plus loin. Et si
    le liant a un id, le repli code ignore les entrées portant un AUTRE id
    (code périmé d'un autre liant renommé). */
export function trouverPrixLiant(
  prices: BinderPrice[],
  liant: { id?: string; code?: string | null } | undefined,
): BinderPrice | undefined {
  if (!liant) return undefined;
  if (liant.id) {
    const parId = prices.find((p) => !!p.id && p.id === liant.id);
    if (parId) return parId;
    return liant.code ? prices.find((p) => !p.id && p.code === liant.code) : undefined;
  }
  return liant.code ? prices.find((p) => p.code === liant.code) : undefined;
}
export function prixPourLiant(
  prices: BinderPrice[],
  liant: { id?: string; code?: string | null } | undefined,
): number {
  return trouverPrixLiant(prices, liant)?.price_per_kg ?? 0;
}

export interface IndustrieState {
  category: Category;
  residue_sg: number;
  residue_w_pct: number;
  saturation_pct: number;
  solids_mass_pct: number;
  aggregate_sg: number;
  aggregate_w_pct: number;
  aggregate_fraction_pct: number;
  slump_measured_mm: number;
  bw_levels: number[];
  desired_qty: number;
  safety_factor: number;
}

export interface IndustrieCostResult {
  bw_pct: number;
  recipe: Recipe;
  binder_cost: number;
  cost_per_m3: number;
  cost_per_tonne: number;
}

export interface ProductionLogEntry {
  id: string;
  date: string;
  savedAt: string;
  notes: string;
  category: Category;
  residue_sg: number;
  residue_w_pct: number;
  aggregate_sg?: number;
  aggregate_fraction_pct?: number;
  bw_pct: number;
  recipe: Recipe;
  binder_prices: BinderPrice[];
  binder_cost: number;
  cost_per_m3: number;
  cost_per_tonne: number;
}

export interface SavedResult {
  id: string;
  savedAt: string;
  label: string;
  category: Category;
  method: SavedMethod;
  general: GeneralInfo;
  /** Recettes RPC/RPG. Vide pour un résultat RRC (voir `rrc`). */
  recipes: Recipe[];
  /** Résultat RRC : entrées + sortie (types distincts des recettes RPC/RPG). */
  rrc?: { inputs: RrcState; result: RrcResultat };
  /** Entrées du formulaire au moment du calcul — permet « Recharger ». */
  inputs?: unknown;
  /** Version des solveurs qui a produit ces résultats. */
  solverVersion?: string;
  /** Instantané des réglages au moment du calcul (reproductibilité exacte). */
  catalogue_liants?: LiantCatalogueItem[];
  constantes?: ConstantesCalcul;
  /** Ids des matériaux (préréglages) utilisés — traçabilité. */
  selectedMaterials?: { residueId?: string; aggregateId?: string; retarderId?: string };
  /**
   * Propriétaire cloud (auth.users.id) : estampillé à la sauvegarde quand une
   * session existe, et sur les résultats reçus du cloud à la fusion. Empêche
   * de pousser sous SON compte le résultat d'un autre (navigateur partagé,
   * import de sauvegarde, revue du prof). Absent = résultat local anonyme.
   */
  ownerId?: string;
}

/* ── localStorage helpers (SSR-safe) ── */
const SAVED_KEY = "minebackfill_saved_results";

function loadSavedFromStorage(): SavedResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(items: SavedResult[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
    return true;
  } catch {
    // quota atteint ou stockage bloqué (navigation privée)
    return false;
  }
}

const UNITS_KEY = "minebackfill_unit_prefs";

function loadUnitsFromStorage(): UnitPreferences {
  if (typeof window === "undefined") return DEFAULT_UNITS;
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    return raw ? { ...DEFAULT_UNITS, ...JSON.parse(raw) } : DEFAULT_UNITS;
  } catch {
    return DEFAULT_UNITS;
  }
}

function persistUnits(prefs: UnitPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(prefs));
  } catch { /* silently ignore */ }
}

const BINDER_PRICES_KEY = "minebackfill_binder_prices";

function loadBinderPricesFromStorage(): BinderPrice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BINDER_PRICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistBinderPrices(items: BinderPrice[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BINDER_PRICES_KEY, JSON.stringify(items));
  } catch { /* silently ignore */ }
}

const PRODUCTION_LOG_KEY = "minebackfill_production_log";

function loadProductionLogFromStorage(): ProductionLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRODUCTION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistProductionLog(items: ProductionLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRODUCTION_LOG_KEY, JSON.stringify(items));
  } catch { /* silently ignore */ }
}

interface AppState {
  API: string;

  category: Category;
  method: RpcMethod;
  setCategory: (c: Category) => void;
  setMethod: (m: RpcMethod) => void;

  general: GeneralInfo;
  setGeneral: (patch: Partial<GeneralInfo>) => void;
  loadGeneral: () => Promise<void>;

  constantes: ConstantesCalcul;
  setConstantes: (patch: Partial<ConstantesCalcul>) => void;
  loadConstantes: () => void;

  catalogue_liants: LiantCatalogueItem[];
  loadCatalogue: () => void;
  ajouterLiant: () => void;
  modifierLiant: (index: number, patch: Partial<LiantCatalogueItem>, admin?: boolean) => void;
  supprimerLiant: (index: number, admin?: boolean) => void;
  restaurerLiantsOfficiels: () => void;

  catalogue_residus: ResiduItem[];
  catalogue_granulats: GranulatItem[];
  catalogue_retardateurs: RetardateurItem[];
  loadMaterials: () => void;
  addMaterial: (kind: MaterialKind, admin?: boolean) => void;
  updateMaterial: (kind: MaterialKind, index: number, patch: Partial<MaterialItem>, admin?: boolean) => void;
  deleteMaterial: (kind: MaterialKind, index: number, admin?: boolean) => void;
  restoreOfficialMaterials: (kind: MaterialKind) => void;
  importMaterials: (kind: MaterialKind, items: MaterialItem[]) => void;

  // Cloud : remplace la couche OFFICIELLE d'un catalogue par celle publiée par
  // l'enseignant (la couche perso locale est intégralement conservée).
  hydraterLiantsOfficielsCloud: (officiels: LiantCatalogueItem[]) => void;
  hydraterMateriauxOfficielsCloud: (kind: MaterialKind, officiels: MaterialItem[]) => void;
  // Cloud : remplace l'historique local par la fusion locale+cloud déjà calculée.
  remplacerResultats: (resultats: SavedResult[]) => void;

  // Traçabilité : id du matériau choisi via un préréglage (snapshoté par résultat).
  selectedMaterials: { residueId?: string; aggregateId?: string; retarderId?: string };
  setSelectedMaterial: (role: "residueId" | "aggregateId" | "retarderId", id: string | undefined) => void;

  cw: CwState;
  setCw: (patch: Partial<CwState>) => void;
  setCwRecipe: (index: number, patch: { binder_pct?: number }) => void;
  cwResult: RpcCwResponse | null;
  setCwResult: (res: RpcCwResponse | null) => void;

  wb: WbState;
  setWb: (patch: Partial<WbState>) => void;
  setWbRecipe: (
    index: number,
    patch: { binder_pct?: number; wc_ratio?: number }
  ) => void;
  wbResult: MixResult | null;
  setWbResult: (res: MixResult | null) => void;

  slump: SlumpState;
  setSlump: (patch: Partial<SlumpState>) => void;
  setSlumpRecipe: (index: number, patch: { binder_pct?: number }) => void;
  slumpResult: MixResult | null;
  setSlumpResult: (res: MixResult | null) => void;

  essai: EssaiInputsState;
  setEssai: (patch: Partial<EssaiInputsState>) => void;
  setEssaiAjustement: (
    index: number,
    patch: {
      ajout_residu_sec?: number;
      ajout_residu_humide?: number;
      ajout_eau?: number;
    }
  ) => void;
  essaiResult: MixResult | null;
  setEssaiResult: (res: MixResult | null) => void;

  rpgCw: RpgCwState;
  setRpgCw: (patch: Partial<RpgCwState>) => void;
  setRpgCwRecipe: (index: number, patch: { binder_pct?: number }) => void;
  rpgCwResult: MixResult | null;
  setRpgCwResult: (res: MixResult | null) => void;

  rpgWb: RpgWbState;
  setRpgWb: (patch: Partial<RpgWbState>) => void;
  setRpgWbRecipe: (index: number, patch: { binder_pct?: number; wc_ratio?: number }) => void;
  rpgWbResult: MixResult | null;
  setRpgWbResult: (res: MixResult | null) => void;

  rpgEssai: RpgEssaiState;
  setRpgEssai: (patch: Partial<RpgEssaiState>) => void;
  setRpgEssaiAjustement: (index: number, patch: RpgEssaiAdjustment) => void;
  rpgEssaiResult: MixResult | null;
  setRpgEssaiResult: (res: MixResult | null) => void;

  rrc: RrcState;
  setRrc: (patch: Partial<RrcState>) => void;
  setRrcRecipe: (index: number, patch: { binder_pct?: number; wc_ratio?: number }) => void;
  rrcResult: RrcResultat | null;
  setRrcResult: (res: RrcResultat | null) => void;

  fillTestData: () => void;

  units: UnitPreferences;
  setUnits: (patch: Partial<UnitPreferences>) => void;
  loadUnits: () => void;

  // Session cloud (Supabase). null = déconnecté ou synchronisation non
  // configurée. Alimenté par CloudSync ; les actions locales n'en dépendent pas.
  session: CloudSession | null;
  setSession: (session: CloudSession | null) => void;

  savedResults: SavedResult[];
  saveCurrentResult: (label: string) => boolean;
  deleteSavedResult: (id: string) => void;
  loadSavedResults: () => void;
  restoreSavedResult: (id: string) => boolean;

  industrie: IndustrieState;
  setIndustrie: (patch: Partial<IndustrieState>) => void;

  binderPrices: BinderPrice[];
  setBinderPrice: (code: string, price_per_kg: number, liantId?: string) => void;
  loadBinderPrices: () => void;

  industrieResults: IndustrieCostResult[];
  setIndustrieResults: (results: IndustrieCostResult[]) => void;

  productionLog: ProductionLogEntry[];
  addProductionLogEntry: (entry: Omit<ProductionLogEntry, "id" | "savedAt">) => void;
  deleteProductionLogEntry: (id: string) => void;
  loadProductionLog: () => void;
}

const zeros4 = () => [0, 0, 0, 0];
const makeLiantId = () =>
  `liant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const catalogueLiantsDefaut: LiantCatalogueItem[] = [
  { id: "liant_cp10", code: "CP10", nom: "Ciment CP10", gs: 3.1543, origine: "officiel" },
  { id: "liant_cp50", code: "CP50", nom: "Ciment CP50", gs: 3.1887, origine: "officiel" },
  { id: "liant_slag", code: "SLAG", nom: "Laitier", gs: 2.8426, origine: "officiel" },
  { id: "liant_fly_ash", code: "FLY_ASH", nom: "Fly Ash", gs: 2.6114, origine: "officiel" },
  { id: "liant_chaux", code: "CHAUX", nom: "Chaux", gs: 2.6, origine: "officiel" },
];
const CODES_LIANTS_OFFICIELS = new Set(catalogueLiantsDefaut.map((l) => l.code));

const generalDefaut: GeneralInfo = {
  binder_count: 2,
  binder1_type: "CP10",
  binder2_type: "SLAG",
  binder3_type: null,
  binder1_id: "liant_cp10",
  binder2_id: "liant_slag",
  binder3_id: null,
};

const constantesDefaut: ConstantesCalcul = {
  masse_volumique_eau_kg_m3: 1000.0,
  gravite_m_s2: 9.81,
  facteur_petit_cone_vers_grand_cone: 2.335,
  coefficient_modele_slump: 4.95e6,
  constante_modele_slump: 235.5122,
  essai_gs_convention: "base",
  essai_binder_rule: "solides_totaux",
  pack_id: "intra2017",
};

/* ── Persistance versionnée des réglages (catalogue, constantes, projet) ──
   Contrairement aux 4 clés historiques (résultats, unités, prix, journal),
   ces réglages sont enveloppés dès l'origine par persisted.ts : ils pourront
   être migrés proprement quand leur schéma évoluera (P2 : bibliothèques). */
const CATALOGUE_KEY = "minebackfill_catalogue_liants";
export const CATALOGUE_VERSION = 2; // v2 : ajout du champ `origine`
const CONSTANTES_KEY = "minebackfill_constantes";
const GENERAL_KEY = "minebackfill_general";
// Versions scindées (elles partageaient SETTINGS_VERSION) : les constantes
// gagnent les drapeaux de convention (v2), general reste stable (v1). La
// migration des constantes est implicite — loadConstantesFromStorage remplit
// les défauts (intra2017) pour les clés absentes des anciennes sauvegardes.
export const CONSTANTES_VERSION = 2;
const GENERAL_VERSION = 1;
const RESIDUS_KEY = "minebackfill_catalogue_residus";
const GRANULATS_KEY = "minebackfill_catalogue_granulats";
const RETARDATEURS_KEY = "minebackfill_catalogue_retardateurs";
export const MATERIALS_VERSION = 1;
const identityMigration = (d: unknown) => d;

// v0/v1 -> v2 : les liants sans `origine` reçoivent « officiel » pour les codes
// par défaut du professeur, « perso » sinon.
const migrationCatalogueLiants = (d: unknown): unknown => {
  if (!Array.isArray(d)) return d;
  return d.map((item) => {
    const it = item as LiantCatalogueItem;
    if (it.origine) return it;
    return { ...it, origine: CODES_LIANTS_OFFICIELS.has(it.code) ? "officiel" : "perso" };
  });
};

function loadCatalogueFromStorage(): LiantCatalogueItem[] {
  return loadVersioned(CATALOGUE_KEY, CATALOGUE_VERSION, migrationCatalogueLiants, catalogueLiantsDefaut);
}
function persistCatalogue(items: LiantCatalogueItem[]) {
  persistVersioned(CATALOGUE_KEY, CATALOGUE_VERSION, items);
}

function loadResidusFromStorage(): ResiduItem[] {
  return loadVersioned(RESIDUS_KEY, MATERIALS_VERSION, identityMigration, residusDefaut);
}
function loadGranulatsFromStorage(): GranulatItem[] {
  return loadVersioned(GRANULATS_KEY, MATERIALS_VERSION, identityMigration, granulatsDefaut);
}
function loadRetardateursFromStorage(): RetardateurItem[] {
  return loadVersioned(RETARDATEURS_KEY, MATERIALS_VERSION, identityMigration, retardateursDefaut);
}
// Table de correspondance kind -> clé/défauts/fabrique, pour les actions génériques.
const MATERIAL_CONFIG = {
  residus: { key: RESIDUS_KEY, defauts: residusDefaut as MaterialItem[], neuf: (id: string) => nouveauResidu(id) as MaterialItem, load: loadResidusFromStorage as () => MaterialItem[] },
  granulats: { key: GRANULATS_KEY, defauts: granulatsDefaut as MaterialItem[], neuf: (id: string) => nouveauGranulat(id) as MaterialItem, load: loadGranulatsFromStorage as () => MaterialItem[] },
  retardateurs: { key: RETARDATEURS_KEY, defauts: retardateursDefaut as MaterialItem[], neuf: (id: string) => nouveauRetardateur(id) as MaterialItem, load: loadRetardateursFromStorage as () => MaterialItem[] },
} as const;
const SLICE_OF_KIND: Record<MaterialKind, "catalogue_residus" | "catalogue_granulats" | "catalogue_retardateurs"> = {
  residus: "catalogue_residus",
  granulats: "catalogue_granulats",
  retardateurs: "catalogue_retardateurs",
};
const makeMaterialId = (kind: MaterialKind) =>
  `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
function persistMaterials(kind: MaterialKind, items: MaterialItem[]) {
  persistVersioned(MATERIAL_CONFIG[kind].key, MATERIALS_VERSION, items);
}
/**
 * Complète/assainit un objet constantes partiel (ancienne sauvegarde, snapshot
 * pré-P4, champ vidé) en un ConstantesCalcul valide :
 * - les 5 nombres doivent être finis et > 0, sinon défaut (un champ vidé dans
 *   Réglages persiste 0 — on ne bloque pas durablement les calculs en 422) ;
 * - les 2 drapeaux sont validés par liste blanche (absents = « intra2017 ») ;
 * - `pack_id` absent (données pré-P4) n'est PAS présumé : on le DÉTECTE en
 *   comparant aux packs connus — des valeurs personnalisées d'avant P4 donnent
 *   « personnalise », pas une fausse étiquette « intra2017 ».
 */
function completerConstantes(brut: Partial<ConstantesCalcul> | null | undefined): ConstantesCalcul {
  const c: ConstantesCalcul = { ...constantesDefaut };
  for (const k of CONSTANTES_NUM_KEYS) {
    const v = brut?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) c[k] = v;
  }
  if (brut?.essai_gs_convention && ESSAI_GS_VALUES.includes(brut.essai_gs_convention))
    c.essai_gs_convention = brut.essai_gs_convention;
  if (brut?.essai_binder_rule && ESSAI_BINDER_VALUES.includes(brut.essai_binder_rule))
    c.essai_binder_rule = brut.essai_binder_rule;
  if (brut?.pack_id && PACK_ID_VALUES.includes(brut.pack_id)) {
    c.pack_id = brut.pack_id;
  } else {
    c.pack_id = detecterPackId(c);
  }
  return c;
}

/** Pack dont les valeurs (5 nombres + 2 drapeaux) correspondent exactement. */
function detecterPackId(c: ConstantesCalcul): ConventionPackId {
  const detecte = CONVENTION_PACKS.find((p) =>
    CONSTANTES_NUM_KEYS.every((k) => p.constantes[k] === c[k]) &&
    p.constantes.essai_gs_convention === c.essai_gs_convention &&
    p.constantes.essai_binder_rule === c.essai_binder_rule);
  return detecte ? detecte.id : "personnalise";
}

function loadConstantesFromStorage(): ConstantesCalcul {
  const brut = loadVersioned<Partial<ConstantesCalcul>>(
    CONSTANTES_KEY, CONSTANTES_VERSION, identityMigration, constantesDefaut,
  );
  return completerConstantes(brut);
}
function persistConstantes(c: ConstantesCalcul) {
  persistVersioned(CONSTANTES_KEY, CONSTANTES_VERSION, c);
}
function loadGeneralFromStorage(): GeneralInfo {
  return loadVersioned(GENERAL_KEY, GENERAL_VERSION, identityMigration, generalDefaut);
}
function persistGeneral(g: GeneralInfo) {
  persistVersioned(GENERAL_KEY, GENERAL_VERSION, g);
}

/**
 * Valide et migre l'enveloppe {v,data} d'un catalogue de liants publiée en
 * ligne. Renvoie null si l'enveloppe est inutilisable : version future
 * (publieur plus récent que ce client), données non-tableau/malformées, ou
 * tableau vide (une publication vide est presque sûrement une erreur — on ne
 * vide pas la couche officielle des étudiants pour ça).
 */
export function migrerCatalogueLiantsCloud(env: { v: number; data: unknown } | null | undefined): LiantCatalogueItem[] | null {
  if (!env || typeof env.v !== "number" || env.v > CATALOGUE_VERSION) return null;
  const data = env.v < CATALOGUE_VERSION ? migrationCatalogueLiants(env.data) : env.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  if (!data.every((i) => i && typeof (i as { id?: unknown }).id === "string")) return null;
  return data as LiantCatalogueItem[];
}

/** Équivalent pour les bibliothèques de matériaux (v1, migration identité). */
export function migrerMateriauxCloud(env: { v: number; data: unknown } | null | undefined): MaterialItem[] | null {
  if (!env || typeof env.v !== "number" || env.v > MATERIALS_VERSION) return null;
  const data = env.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  if (!data.every((i) => i && typeof (i as { id?: unknown }).id === "string")) return null;
  return data as MaterialItem[];
}

// Écritures cloud fire-and-forget : n'ont lieu que si une session existe ET que
// le client Supabase est configuré. Toute erreur réseau est avalée (le
// localStorage reste la vérité UI). Import paresseux pour ne pas coupler le
// store au module cloud au chargement.
function pousserResultatCloud(session: CloudSession | null, entry: SavedResult) {
  if (!session) return;
  Promise.all([import("./supabase"), import("./cloud")])
    .then(([{ getSupabase }, { upsertResultatCloud }]) => {
      const sb = getSupabase();
      if (sb) return upsertResultatCloud(sb, session.userId, entry);
    })
    .catch(() => {});
}
function retirerResultatCloud(session: CloudSession | null, id: string) {
  if (!session) return;
  Promise.all([import("./supabase"), import("./cloud")])
    .then(([{ getSupabase }, { supprimerResultatCloud }]) => {
      const sb = getSupabase();
      if (sb) return supprimerResultatCloud(sb, id);
    })
    .catch(() => {});
}

export const useStore = create<AppState>((set, get) => ({
  // Par défaut on appelle l'API en relatif (/rpc, /rpg) via le proxy Next.js
  API: process.env.NEXT_PUBLIC_API_URL?.trim() || "",

  category: "RPC",
  method: "dosage_cw",
  setCategory: (c) => set({ category: c }),
  setMethod: (m) => set({ method: m }),

  general: generalDefaut,
  setGeneral: (patch) =>
    set((state) => {
      const general = { ...state.general, ...patch };
      persistGeneral(general);
      return { general };
    }),
  loadGeneral: async () => set({ general: loadGeneralFromStorage() }),

  constantes: constantesDefaut,
  setConstantes: (patch) =>
    set((state) => {
      // Une application de pack fournit `pack_id` explicitement. Toute autre
      // édition passe par la DÉTECTION : si les valeurs résultantes égalent
      // exactement un pack, on garde son étiquette (retaper « 9,81 » ne rend
      // pas le jeu « personnalisé ») ; sinon « personnalise ».
      const fusion = { ...state.constantes, ...patch };
      const constantes = "pack_id" in patch
        ? fusion
        : { ...fusion, pack_id: detecterPackId(fusion) };
      persistConstantes(constantes);
      return { constantes };
    }),
  loadConstantes: () => set({ constantes: loadConstantesFromStorage() }),

  catalogue_liants: catalogueLiantsDefaut,
  loadCatalogue: () => set({ catalogue_liants: loadCatalogueFromStorage() }),
  ajouterLiant: () =>
    set((state) => {
      const index = state.catalogue_liants.length + 1;
      const nouveau: LiantCatalogueItem = {
        id: makeLiantId(),
        code: `LIANT_${index}`,
        nom: `Liant ${index}`,
        gs: 3.0,
      };
      const catalogue = [...state.catalogue_liants, nouveau];
      persistCatalogue(catalogue);
      return { catalogue_liants: catalogue };
    }),
  modifierLiant: (index, patch, admin) =>
    set((state) => {
      if (index < 0 || index >= state.catalogue_liants.length) return {};
      if (estOfficiel(state.catalogue_liants[index]) && !admin) return {}; // verrouillé (sauf prof)
      const catalogue = [...state.catalogue_liants];
      const ancienCode = catalogue[index].code;
      catalogue[index] = { ...catalogue[index], ...patch };
      const nouveauCode = catalogue[index].code;
      const doitRenommer = ancienCode !== nouveauCode && !!nouveauCode;

      persistCatalogue(catalogue);
      if (!doitRenommer) {
        return { catalogue_liants: catalogue };
      }

      // Un composant suit le renommage s'il pointe vers CE liant : par id
      // (source de vérité) ou, à défaut d'id (anciens états), par code. La
      // cascade passe par la liste N-aire (lireBinders) puis patchBinders,
      // qui maintient aussi le miroir legacy binder1/2/3 — l'ancien forEach
      // [1,2,3] ne touchait pas `general.binders[]`, laissant un code périmé.
      const idRenomme = catalogue[index].id;
      const bindersMaj = lireBinders(state.general).map((b) => {
        const vise = b.id ? b.id === idRenomme : b.code === ancienCode;
        return vise ? { ...b, id: idRenomme, code: nouveauCode } : b;
      });
      const general = { ...state.general, ...patchBinders(bindersMaj) };
      persistGeneral(general);
      return { catalogue_liants: catalogue, general };
    }),
  supprimerLiant: (index, admin) =>
    set((state) => {
      if (state.catalogue_liants.length <= 1) return {};
      if (index < 0 || index >= state.catalogue_liants.length) return {};
      if (estOfficiel(state.catalogue_liants[index]) && !admin) return {}; // verrouillé (sauf prof)

      const supprime = state.catalogue_liants[index];
      const catalogue = state.catalogue_liants.filter((_, i) => i !== index);
      const fallback = catalogue[0];

      // Un composant pointe vers le liant supprimé s'il matche par id (source
      // de vérité) ou, à défaut d'id (anciens états), par code. Cascade via la
      // liste N-aire + patchBinders (miroir legacy maintenu) — sinon le
      // composant garderait une référence pendante et le calcul retomberait
      // silencieusement sur Gs par défaut (3.15).
      const bindersMaj = lireBinders(state.general).map((b) => {
        const vise = b.id ? b.id === supprime.id : b.code === supprime.code;
        return vise ? { ...b, id: fallback?.id ?? null, code: fallback?.code ?? null } : b;
      });
      const general = { ...state.general, ...patchBinders(bindersMaj) };
      persistCatalogue(catalogue);
      persistGeneral(general);
      return { catalogue_liants: catalogue, general };
    }),
  restaurerLiantsOfficiels: () =>
    set((state) => {
      const perso = state.catalogue_liants.filter((l) => l.origine !== "officiel");
      const catalogue = [...catalogueLiantsDefaut.map((l) => ({ ...l })), ...perso];
      persistCatalogue(catalogue);
      return { catalogue_liants: catalogue };
    }),

  /* ── Bibliothèque de matériaux (résidus / granulats / retardateurs) ──
     Actions génériques pilotées par `kind` pour éviter de tripler le CRUD.
     Les entrées « officiel » sont verrouillées (modif/suppr refusées). */
  catalogue_residus: residusDefaut,
  catalogue_granulats: granulatsDefaut,
  catalogue_retardateurs: retardateursDefaut,
  loadMaterials: () =>
    set({
      catalogue_residus: loadResidusFromStorage(),
      catalogue_granulats: loadGranulatsFromStorage(),
      catalogue_retardateurs: loadRetardateursFromStorage(),
    }),
  addMaterial: (kind, admin) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      const neuf = MATERIAL_CONFIG[kind].neuf(makeMaterialId(kind));
      // En mode enseignant, la nouvelle entrée est « officielle » (destinée à
      // être publiée) ; sinon « perso » (défaut de la fabrique).
      const item = admin ? { ...neuf, origine: "officiel" as MaterialOrigine } : neuf;
      const items = [...(state[slice] as MaterialItem[]), item];
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),
  updateMaterial: (kind, index, patch, admin) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      const current = state[slice] as MaterialItem[];
      if (index < 0 || index >= current.length) return {};
      if (estOfficiel(current[index]) && !admin) return {}; // verrouillé (sauf prof)
      const items = [...current];
      items[index] = { ...items[index], ...patch } as MaterialItem;
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),
  deleteMaterial: (kind, index, admin) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      const current = state[slice] as MaterialItem[];
      if (index < 0 || index >= current.length) return {};
      if (estOfficiel(current[index]) && !admin) return {}; // verrouillé (sauf prof)
      const items = current.filter((_, i) => i !== index);
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),
  restoreOfficialMaterials: (kind) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      // Une entrée perso portant l'id d'un officiel (données héritées d'avant
      // le verrou d'import) est re-clée : jamais deux items avec le même id.
      const idsOfficiels = new Set(MATERIAL_CONFIG[kind].defauts.map((m) => m.id));
      const perso = (state[slice] as MaterialItem[])
        .filter((m) => m.origine !== "officiel")
        .map((m) => (idsOfficiels.has(m.id) ? { ...m, id: makeMaterialId(kind) } : m));
      const items = [...MATERIAL_CONFIG[kind].defauts.map((m) => ({ ...m })), ...perso];
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),
  importMaterials: (kind, imported) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      const byId = new Map((state[slice] as MaterialItem[]).map((m) => [m.id, m] as const));
      for (const raw of imported) {
        // Import : toujours « perso », fusion par id — SAUF si l'id entrant
        // désigne une entrée officielle : le verrou tient aussi à l'import,
        // l'item importé est re-clé et ajouté à côté (l'officiel reste intact).
        const existant = raw.id ? byId.get(raw.id) : undefined;
        const id = !raw.id || (existant && estOfficiel(existant)) ? makeMaterialId(kind) : raw.id;
        byId.set(id, { ...raw, id, origine: "perso" as MaterialOrigine });
      }
      const items = [...byId.values()];
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),

  hydraterLiantsOfficielsCloud: (officiels) =>
    set((state) => {
      // Les officiels cloud remplacent la couche officielle locale (verrouillée,
      // aucun travail utilisateur) ; la couche perso locale est conservée.
      const perso = state.catalogue_liants.filter((l) => !estOfficiel(l));
      const items = [...officiels.map((l) => ({ ...l, origine: "officiel" as MaterialOrigine })), ...perso];
      persistCatalogue(items);
      return { catalogue_liants: items };
    }),
  hydraterMateriauxOfficielsCloud: (kind, officiels) =>
    set((state) => {
      const slice = SLICE_OF_KIND[kind];
      const perso = (state[slice] as MaterialItem[]).filter((m) => !estOfficiel(m));
      const items = [...officiels.map((m) => ({ ...m, origine: "officiel" as MaterialOrigine })), ...perso];
      persistMaterials(kind, items);
      return { [slice]: items } as Partial<AppState>;
    }),
  remplacerResultats: (resultats) =>
    set(() => {
      persistSaved(resultats);
      return { savedResults: resultats };
    }),

  selectedMaterials: {},
  setSelectedMaterial: (role, id) =>
    set((state) => ({ selectedMaterials: { ...state.selectedMaterials, [role]: id } })),

  cw: {
    solid_mass_pct: 0,
    saturation_pct: 0,
    residue_sg: 0,
    residue_w_pct: 0,
    num_recipes: 1,
    desired_qty: 1,
    safety_factor: 1,
    binder_pct: zeros4(),
  },
  setCw: (patch) =>
    set((state) => ({
      cw: {
        ...state.cw,
        ...patch,
      },
    })),
  setCwRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.cw.binder_pct];
      if (patch.binder_pct !== undefined) {
        binder_pct[index] = patch.binder_pct;
      }
      return {
        cw: {
          ...state.cw,
          binder_pct,
        },
      };
    }),
  cwResult: null,
  setCwResult: (res) => set({ cwResult: res }),

  wb: {
    saturation_pct: 0,
    residue_sg: 0,
    residue_w_pct: 0,
    num_recipes: 1,
    desired_qty: 1,
    safety_factor: 1,
    binder_pct: zeros4(),
    wc_ratio: zeros4(),
  },
  setWb: (patch) =>
    set((state) => ({
      wb: {
        ...state.wb,
        ...patch,
      },
    })),
  setWbRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.wb.binder_pct];
      const wc_ratio = [...state.wb.wc_ratio];
      if (patch.binder_pct !== undefined) binder_pct[index] = patch.binder_pct;
      if (patch.wc_ratio !== undefined) wc_ratio[index] = patch.wc_ratio;
      return {
        wb: {
          ...state.wb,
          binder_pct,
          wc_ratio,
        },
      };
    }),
  wbResult: null,
  setWbResult: (res) => set({ wbResult: res }),

  slump: {
    cone_type: "mini",
    slump_mm: 0,
    saturation_pct: 0,
    residue_sg: 0,
    residue_w_pct: 0,
    num_recipes: 1,
    desired_qty: 1,
    safety_factor: 1,
    binder_pct: zeros4(),
  },
  setSlump: (patch) =>
    set((state) => ({
      slump: {
        ...state.slump,
        ...patch,
      },
    })),
  setSlumpRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.slump.binder_pct];
      if (patch.binder_pct !== undefined) binder_pct[index] = patch.binder_pct;
      return {
        slump: {
          ...state.slump,
          binder_pct,
        },
      };
    }),
  slumpResult: null,
  setSlumpResult: (res) => set({ slumpResult: res }),

  essai: {
    base_method: "dosage_cw",
    base_cw: undefined,
    base_wb: undefined,
    ajustements: [],
  },
  setEssai: (patch) =>
    set((state) => ({
      essai: {
        ...state.essai,
        ...patch,
      },
    })),
  setEssaiAjustement: (index, patch) =>
    set((state) => {
      const ajustements = [...(state.essai.ajustements || [])];
      while (ajustements.length <= index) ajustements.push({});
      ajustements[index] = { ...ajustements[index], ...patch };
      return {
        essai: {
          ...state.essai,
          ajustements,
        },
      };
    }),
  essaiResult: null,
  setEssaiResult: (res) => set({ essaiResult: res }),

  rpgCw: {
    solid_mass_pct: 0,
    saturation_pct: 0,
    residue_sg: 0,
    residue_w_pct: 0,
    aggregate_fraction_pct: 0,
    aggregate_sg: 0,
    num_recipes: 1,
    desired_qty: 1,
    safety_factor: 1,
    binder_pct: zeros4(),
  },
  setRpgCw: (patch) =>
    set((state) => ({ rpgCw: { ...state.rpgCw, ...patch } })),
  setRpgCwRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.rpgCw.binder_pct];
      if (patch.binder_pct !== undefined) binder_pct[index] = patch.binder_pct;
      return { rpgCw: { ...state.rpgCw, binder_pct } };
    }),
  rpgCwResult: null,
  setRpgCwResult: (res) => set({ rpgCwResult: res }),

  rpgWb: {
    saturation_pct: 0,
    residue_sg: 0,
    residue_w_pct: 0,
    aggregate_fraction_pct: 0,
    aggregate_sg: 0,
    num_recipes: 1,
    desired_qty: 1,
    safety_factor: 1,
    binder_pct: zeros4(),
    wc_ratio: zeros4(),
  },
  setRpgWb: (patch) =>
    set((state) => ({ rpgWb: { ...state.rpgWb, ...patch } })),
  setRpgWbRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.rpgWb.binder_pct];
      const wc_ratio = [...state.rpgWb.wc_ratio];
      if (patch.binder_pct !== undefined) binder_pct[index] = patch.binder_pct;
      if (patch.wc_ratio !== undefined) wc_ratio[index] = patch.wc_ratio;
      return { rpgWb: { ...state.rpgWb, binder_pct, wc_ratio } };
    }),
  rpgWbResult: null,
  setRpgWbResult: (res) => set({ rpgWbResult: res }),

  rpgEssai: {
    base_method: "dosage_cw",
    base_cw: undefined,
    base_wb: undefined,
    ajustements: [],
  },
  setRpgEssai: (patch) =>
    set((state) => ({ rpgEssai: { ...state.rpgEssai, ...patch } })),
  setRpgEssaiAjustement: (index, patch) =>
    set((state) => {
      const ajustements = [...(state.rpgEssai.ajustements || [])];
      while (ajustements.length <= index) ajustements.push({});
      ajustements[index] = { ...ajustements[index], ...patch };
      return { rpgEssai: { ...state.rpgEssai, ajustements } };
    }),
  rpgEssaiResult: null,
  setRpgEssaiResult: (res) => set({ rpgEssaiResult: res }),

  // ── RRC / CRF ── valeurs par défaut prêtes pour la démo (Dias 66-70)
  rrc: {
    quantity_mode: "volume",
    volume_m3: 1000,
    wet_density_kg_m3: 2200,
    total_mass_kg: 0,
    num_recipes: 1,
    binder_pct: [5, 5, 6, 7],
    wc_ratio: [1, 1, 1, 1],
    cement_sg: 3.15,
    retarder_d0: 100,
    retarder_density: 1.2,
  },
  setRrc: (patch) => set((state) => ({ rrc: { ...state.rrc, ...patch } })),
  setRrcRecipe: (index, patch) =>
    set((state) => {
      const binder_pct = [...state.rrc.binder_pct];
      const wc_ratio = [...state.rrc.wc_ratio];
      if (patch.binder_pct !== undefined) binder_pct[index] = patch.binder_pct;
      if (patch.wc_ratio !== undefined) wc_ratio[index] = patch.wc_ratio;
      return { rrc: { ...state.rrc, binder_pct, wc_ratio } };
    }),
  rrcResult: null,
  setRrcResult: (res) => set({ rrcResult: res }),

  fillTestData: () =>
    set((state) => {
      // Jeu de valeurs DÉTERMINISTE : le « Mélange 1 » du classeur de référence
      // du professeur (Feuille calculs mélanges_tonne, Intra 2017). Avec ces
      // entrées, l'application reproduit le classeur cellule par cellule
      // (mêmes valeurs que les 215 tests d'or du backend).
      const gs = 3.05;                       // Gs résidus (Casa Berardi)
      const w0 = 31.5789;                    // teneur en eau = 1/0.76 - 1 (% solide humide 76 %)
      const cwPct = 70;                      // Cw initial
      const aggSg = 2.8;                     // Gs granulat (concassé LaRonde)
      const aggPct = 30;                     // Xg pour la démo RPG
      const bwLevels = [4.5, 3, 5, 6];       // Bw% par recette (recette 1 = 4.5 %, comme la feuille)
      const wcLevels = [9.9524, 7, 8, 10];   // W/C recette 1 = valeur D26 de la feuille

      // Liants de la feuille : 20 % GU (Gs 3.15) + 80 % Slag GGBFS (Gs 2.9).
      // On les AJOUTE au catalogue s'ils n'existent pas (sans toucher aux
      // entrées existantes de l'utilisateur).
      const catalogue = [...state.catalogue_liants];
      const upsert = (code: string, nom: string, gsLiant: number) => {
        if (!catalogue.some((l) => l.code === code)) {
          catalogue.push({ id: `liant_${code.toLowerCase()}`, code, nom, gs: gsLiant });
        }
      };
      upsert("GU", "Ciment GU (T10)", 3.15);
      upsert("GGBFS", "Slag (GGBFS)", 2.9);

      const newGeneral: GeneralInfo = {
        operator_name: "Démo Intra 2017",
        project_name: "Feuille de référence",
        residue_id: "Casa Berardi",
        mix_date: new Date().toISOString().slice(0, 10),
        // 55 m x 20 m x 10 m = 11 000 m³ (le « contenant » de la feuille)
        container_type: "longueur_largeur_hauteur",
        container_length: 5500,
        container_width: 2000,
        container_height: 1000,
        binder_count: 2,
        binder1_type: "GU",
        binder2_type: "GGBFS",
        binder3_type: null,
        // Ids résolus depuis le catalogue (l'upsert peut avoir réutilisé une
        // entrée existante de l'utilisateur portant déjà ce code).
        binder1_id: catalogue.find((l) => l.code === "GU")?.id ?? null,
        binder2_id: catalogue.find((l) => l.code === "GGBFS")?.id ?? null,
        binder3_id: null,
        binder1_fraction_pct: 20,
        binder2_fraction_pct: 80,
        binder3_fraction_pct: 0,
      };
      const newCw: CwState = { solid_mass_pct: cwPct, saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [...bwLevels] };
      const newWb: WbState = { saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [...bwLevels], wc_ratio: [...wcLevels] };
      const newSlump: SlumpState = { cone_type: "mini", slump_mm: 180, saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [...bwLevels] };
      const newRpgCw: RpgCwState = { solid_mass_pct: cwPct, saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, aggregate_sg: aggSg, aggregate_fraction_pct: aggPct, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [...bwLevels] };
      const newRpgWb: RpgWbState = { saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, aggregate_sg: aggSg, aggregate_fraction_pct: aggPct, num_recipes: 1, desired_qty: 1, safety_factor: 1, binder_pct: [...bwLevels], wc_ratio: [...wcLevels] };
      const newIndustrie: IndustrieState = {
        category: "RPC",
        residue_sg: gs,
        residue_w_pct: w0,
        saturation_pct: 100,
        solids_mass_pct: cwPct,
        aggregate_sg: 0,
        aggregate_w_pct: 0,
        aggregate_fraction_pct: 0,
        slump_measured_mm: 180,
        bw_levels: [3, 4.5, 5, 6, 7, 8],
        desired_qty: 1,
        safety_factor: 1,
      };
      // Coûts de liant de la feuille (K55/K56) : GU 195 $/t, Slag 210 $/t.
      const testBinderPrices: BinderPrice[] = [
        { code: "GU", price_per_kg: 0.195 },
        { code: "GGBFS", price_per_kg: 0.21 },
        { code: "CP10", price_per_kg: 0.195 },
        { code: "CP50", price_per_kg: 0.22 },
        { code: "SLAG", price_per_kg: 0.21 },
        { code: "FLY_ASH", price_per_kg: 0.06 },
        { code: "CHAUX", price_per_kg: 0.08 },
      ];
      persistCatalogue(catalogue);
      persistGeneral(newGeneral);

      // Prix de démonstration : NON persistés — les prix enregistrés de
      // l'utilisateur restent intacts. On demande confirmation avant de les
      // remplacer À L'ÉCRAN si des prix personnalisés différents existent déjà.
      const prixEnregistres = loadBinderPricesFromStorage();
      const memesPrix = JSON.stringify(prixEnregistres) === JSON.stringify(testBinderPrices);
      let binderPrices = testBinderPrices;
      if (prixEnregistres.length > 0 && !memesPrix && typeof window !== "undefined") {
        const ok = window.confirm(
          "Charger les prix de liants de la démonstration ? Vos prix affichés seront remplacés " +
          "(vos prix enregistrés ne sont pas modifiés).",
        );
        if (!ok) binderPrices = state.binderPrices;
      }

      return { general: newGeneral, catalogue_liants: catalogue, cw: newCw, wb: newWb, slump: newSlump, rpgCw: newRpgCw, rpgWb: newRpgWb, industrie: newIndustrie, binderPrices };
    }),

  units: DEFAULT_UNITS,
  setUnits: (patch) =>
    set((state) => {
      const updated = { ...state.units, ...patch };
      persistUnits(updated);
      return { units: updated };
    }),
  loadUnits: () => set({ units: loadUnitsFromStorage() }),

  session: null,
  setSession: (session) => set({ session }),

  savedResults: [],
  loadSavedResults: () => set({ savedResults: loadSavedFromStorage() }),
  saveCurrentResult: (label) => {
    const state = get();

    // Traçabilité honnête : on ne snapshote un id de matériau QUE si les
    // valeurs réellement utilisées par le calcul correspondent encore au
    // matériau référencé (sinon l'id mentirait — préréglage choisi puis
    // valeurs modifiées à la main, ou sélection faite dans un autre onglet).
    const materiauxUtilises = (): SavedResult["selectedMaterials"] => {
      const sm = state.selectedMaterials;
      const out: NonNullable<SavedResult["selectedMaterials"]> = {};
      if (state.category === "RRC") {
        const ret = sm.retarderId
          ? state.catalogue_retardateurs.find((m) => m.id === sm.retarderId)
          : undefined;
        if (ret && ret.densite_g_ml === state.rrc.retarder_density) out.retarderId = ret.id;
        return out;
      }
      const isRpg = state.category === "RPG";
      const m = state.method;
      // Valeurs de résidu/granulat effectivement envoyées au calcul (l'essai
      // réutilise l'état de la méthode de base Cw ou E/C) — via le registre.
      const methodeEffective = m === "essai"
        ? (isRpg ? state.rpgEssai : state.essai).base_method
        : m;
      const dVals = descriptorFor(state.category, methodeEffective);
      const vals = state[dVals?.stateKey ?? (isRpg ? "rpgCw" : "cw")] as {
        residue_sg: number; residue_w_pct: number; aggregate_sg?: number;
      };
      const res = sm.residueId ? state.catalogue_residus.find((x) => x.id === sm.residueId) : undefined;
      if (res && res.gs === vals.residue_sg && res.w0_pct === vals.residue_w_pct) out.residueId = res.id;
      if (isRpg) {
        const agg = sm.aggregateId ? state.catalogue_granulats.find((x) => x.id === sm.aggregateId) : undefined;
        if (agg && agg.gs === vals.aggregate_sg) out.aggregateId = agg.id;
      }
      return out;
    };

    // Champs communs à toutes les catégories (dont l'instantané de contexte).
    const commun = {
      id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      savedAt: new Date().toISOString(),
      label,
      general: { ...state.general },
      // Version estampillée selon le pack de convention actif (le snapshot
      // `constantes` reste la vraie garantie de reproductibilité).
      solverVersion: solverVersionActive(state.constantes),
      // Propriétaire cloud si connecté (anti-réattribution à la fusion).
      ownerId: state.session?.userId,
      catalogue_liants: state.catalogue_liants.map((l) => ({ ...l })),
      constantes: { ...state.constantes },
      selectedMaterials: materiauxUtilises(),
    };

    let entry: SavedResult;
    if (state.category === "RRC") {
      const result = state.rrcResult;
      if (!result?.recipes?.length) return false;
      entry = {
        ...commun,
        category: "RRC",
        method: "rrc",
        recipes: [],
        rrc: {
          inputs: JSON.parse(JSON.stringify(state.rrc)),
          result: JSON.parse(JSON.stringify(result)),
        },
      };
    } else {
      // Tranches d'état/résultat de la méthode active — via le registre.
      const d = descriptorFor(state.category, state.method);
      if (!d) return false;
      const result = state[d.resultKey] as MixResult | null;
      if (!result?.recipes?.length) return false;
      // Instantané des entrées du formulaire actif (pour « Recharger »)
      const inputs = state[d.stateKey];
      entry = {
        ...commun,
        category: state.category,
        method: state.method,
        recipes: result.recipes,
        inputs: JSON.parse(JSON.stringify(inputs)),
      };
    }
    // Fusion avec le stockage (pas seulement l'état mémoire, qui peut ne pas
    // avoir été hydraté si l'utilisateur n'est jamais passé par Historique),
    // en dédupliquant sur l'id pour ne pas écraser l'historique existant.
    const stored = loadSavedFromStorage();
    const updated = [entry, ...stored.filter((s) => s.id !== entry.id)];
    const persisted = persistSaved(updated);
    set({ savedResults: updated });
    // Écriture cloud fire-and-forget (le localStorage reste la vérité UI ; un
    // échec réseau est silencieux, jamais de perte).
    pousserResultatCloud(state.session, entry);
    return persisted;
  },
  restoreSavedResult: (id) => {
    const state = get();
    const entry = state.savedResults.find((s) => s.id === id);
    if (!entry) return false;
    const patch: Partial<AppState> = {
      category: entry.category,
      general: { ...entry.general },
    };
    // Restaurer et persister le contexte du résultat (reproductibilité) :
    // constantes du snapshot, et liants manquants réinjectés au catalogue
    // courant sans écraser les liants existants de l'utilisateur.
    persistGeneral(entry.general);
    if (entry.constantes) {
      // Les snapshots pré-P4 n'ont pas les drapeaux de convention : on les
      // complète (défauts intra2017 + détection du pack) — sans quoi le
      // sélecteur de pack et l'estampillage verraient des champs undefined.
      const completes = completerConstantes(entry.constantes);
      patch.constantes = completes;
      persistConstantes(completes);
    }
    if (entry.catalogue_liants?.length) {
      const courant = [...state.catalogue_liants];
      for (const l of entry.catalogue_liants) {
        // Injection par absence d'ID (source de vérité) : un code réutilisé
        // par un AUTRE liant (Gs différent) n'empêche plus de réinjecter le
        // liant exact du snapshot — la résolution du calcul se fait par id,
        // donc le recalcul retrouve le bon Gs. Jamais de doublon d'id.
        if (!courant.some((c) => c.id === l.id)) courant.push({ ...l });
      }
      patch.catalogue_liants = courant;
      persistCatalogue(courant);
    }
    if (entry.selectedMaterials) patch.selectedMaterials = { ...entry.selectedMaterials };

    if (entry.category === "RRC") {
      if (entry.rrc) {
        patch.rrc = entry.rrc.inputs;
        patch.rrcResult = entry.rrc.result;
      }
      set(patch);
      return true;
    }

    patch.method = entry.method as RpcMethod;
    const result: MixResult = {
      category: entry.category,
      method: entry.method,
      general: entry.general as Record<string, unknown>,
      recipes: entry.recipes,
    };
    // Tranches de la méthode sauvegardée — via le registre (les vieilles
    // entrées à méthode inconnue restaurent au moins catégorie/contexte).
    const d = descriptorFor(entry.category, entry.method);
    if (d) {
      const p = patch as Record<string, unknown>;
      p[d.resultKey] = result;
      if (entry.inputs) p[d.stateKey] = entry.inputs;
    }
    set(patch);
    return true;
  },
  deleteSavedResult: (id) =>
    set((state) => {
      // Relire le stockage avant de filtrer, pour la même raison que
      // saveCurrentResult : ne pas partir d'un état mémoire non hydraté.
      const stored = loadSavedFromStorage();
      const cible = stored.find((s) => s.id === id);
      const updated = stored.filter((s) => s.id !== id);
      persistSaved(updated);
      // Suppression cloud seulement pour SES résultats : celle d'un résultat
      // étranger (revue du prof) serait de toute façon refusée par la RLS, et
      // il réapparaîtra à la prochaine fusion (documenté, pas de tombstones).
      if (!cible?.ownerId || cible.ownerId === state.session?.userId) {
        retirerResultatCloud(state.session, id);
      }
      return { savedResults: updated };
    }),

  /* ── Industrie ── */
  industrie: {
    category: "RPC",
    residue_sg: 0,
    residue_w_pct: 0,
    saturation_pct: 100,
    solids_mass_pct: 78,
    aggregate_sg: 0,
    aggregate_w_pct: 0,
    aggregate_fraction_pct: 0,
    slump_measured_mm: 0,
    bw_levels: [3, 4, 5, 6, 7, 8],
    desired_qty: 1,
    safety_factor: 1,
  },
  setIndustrie: (patch) =>
    set((state) => ({ industrie: { ...state.industrie, ...patch } })),

  binderPrices: [],
  setBinderPrice: (code, price_per_kg, liantId) =>
    set((state) => {
      // On enregistre l'id du liant en plus du code : le prix reste rattaché
      // même si l'utilisateur renomme le code (plus de prix orphelin). L'id
      // explicite de l'appelant prime (codes dupliqués : find-par-code serait
      // ambigu) ; sinon on résout via le catalogue.
      const id = liantId ?? state.catalogue_liants.find((l) => l.code === code)?.id;
      // Entrée remplacée : même id, ou même code SANS id divergent. On ne
      // supprime jamais le prix rattaché par id à un AUTRE liant dont le code
      // périmé serait réutilisé.
      const remplace = (p: BinderPrice) =>
        id ? p.id === id || (p.code === code && !p.id) : p.code === code;
      const nouvelle = { id, code, price_per_kg };
      // La liste mémoire peut contenir des prix de démonstration (fillTestData,
      // non persistés) : on fusionne le changement dans la liste DU STOCKAGE,
      // jamais la liste mémoire entière — sinon la première modification de
      // prix écraserait les prix enregistrés de l'utilisateur avec la démo.
      const stored = [...loadBinderPricesFromStorage().filter((p) => !remplace(p)), nouvelle];
      persistBinderPrices(stored);
      const memoire = [...state.binderPrices.filter((p) => !remplace(p)), nouvelle];
      return { binderPrices: memoire };
    }),
  loadBinderPrices: () => set({ binderPrices: loadBinderPricesFromStorage() }),

  industrieResults: [],
  setIndustrieResults: (results) => set({ industrieResults: results }),

  productionLog: [],
  addProductionLogEntry: (entry) =>
    set((state) => {
      const full: ProductionLogEntry = {
        ...entry,
        id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        savedAt: new Date().toISOString(),
      };
      const updated = [full, ...state.productionLog];
      persistProductionLog(updated);
      return { productionLog: updated };
    }),
  deleteProductionLogEntry: (id) =>
    set((state) => {
      const updated = state.productionLog.filter((e) => e.id !== id);
      persistProductionLog(updated);
      return { productionLog: updated };
    }),
  loadProductionLog: () => set({ productionLog: loadProductionLogFromStorage() }),
}));

export default useStore;
