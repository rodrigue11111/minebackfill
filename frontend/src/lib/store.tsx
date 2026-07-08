"use client";

import { create } from "zustand";
import { type UnitPreferences, DEFAULT_UNITS } from "./units";
import type { MixResult, Recipe, RrcResultat } from "./types";

// Version des solveurs : estampillée sur chaque résultat sauvegardé.
// À incrémenter quand les formules changent (voir Issues.md).
export const SOLVER_VERSION = "intra2017-1.0";

export type Category = "RPC" | "RPG" | "RRC";
export type RpcMethod = "dosage_cw" | "wb" | "slump" | "essai";

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

  binder_count?: 1 | 2 | 3 | null;
  binder1_type?: string | null;
  binder2_type?: string | null;
  binder3_type?: string | null;

  binder1_fraction_pct?: number;
  binder2_fraction_pct?: number;
  binder3_fraction_pct?: number;
}

export interface ConstantesCalcul {
  masse_volumique_eau_kg_m3: number;
  gravite_m_s2: number;
  facteur_petit_cone_vers_grand_cone: number;
  coefficient_modele_slump: number;
  constante_modele_slump: number;
}

export interface LiantCatalogueItem {
  id: string;
  code: string;
  nom: string;
  gs: number;
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
  code: string;
  price_per_kg: number;
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
  method: RpcMethod;
  general: GeneralInfo;
  recipes: Recipe[];
  /** Entrées du formulaire au moment du calcul — permet « Recharger ». */
  inputs?: unknown;
  /** Version des solveurs qui a produit ces résultats. */
  solverVersion?: string;
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

  catalogue_liants: LiantCatalogueItem[];
  ajouterLiant: () => void;
  modifierLiant: (index: number, patch: Partial<LiantCatalogueItem>) => void;
  supprimerLiant: (index: number) => void;

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

  savedResults: SavedResult[];
  saveCurrentResult: (label: string) => boolean;
  deleteSavedResult: (id: string) => void;
  loadSavedResults: () => void;
  restoreSavedResult: (id: string) => boolean;

  industrie: IndustrieState;
  setIndustrie: (patch: Partial<IndustrieState>) => void;

  binderPrices: BinderPrice[];
  setBinderPrice: (code: string, price_per_kg: number) => void;
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
  { id: "liant_cp10", code: "CP10", nom: "Ciment CP10", gs: 3.1543 },
  { id: "liant_cp50", code: "CP50", nom: "Ciment CP50", gs: 3.1887 },
  { id: "liant_slag", code: "SLAG", nom: "Laitier", gs: 2.8426 },
  { id: "liant_fly_ash", code: "FLY_ASH", nom: "Fly Ash", gs: 2.6114 },
  { id: "liant_chaux", code: "CHAUX", nom: "Chaux", gs: 2.6 },
];

export const useStore = create<AppState>((set, get) => ({
  // Par défaut on appelle l'API en relatif (/rpc, /rpg) via le proxy Next.js
  API: process.env.NEXT_PUBLIC_API_URL?.trim() || "",

  category: "RPC",
  method: "dosage_cw",
  setCategory: (c) => set({ category: c }),
  setMethod: (m) => set({ method: m }),

  general: {
    binder_count: 2,
    binder1_type: "CP10",
    binder2_type: "SLAG",
    binder3_type: null,
  },
  setGeneral: (patch) =>
    set((state) => ({
      general: {
        ...state.general,
        ...patch,
      },
    })),
  loadGeneral: async () => {
    return;
  },

  constantes: {
    masse_volumique_eau_kg_m3: 1000.0,
    gravite_m_s2: 9.81,
    facteur_petit_cone_vers_grand_cone: 2.335,
    coefficient_modele_slump: 4.95e6,
    constante_modele_slump: 235.5122,
  },
  setConstantes: (patch) =>
    set((state) => ({
      constantes: {
        ...state.constantes,
        ...patch,
      },
    })),

  catalogue_liants: catalogueLiantsDefaut,
  ajouterLiant: () =>
    set((state) => {
      const index = state.catalogue_liants.length + 1;
      const nouveau: LiantCatalogueItem = {
        id: makeLiantId(),
        code: `LIANT_${index}`,
        nom: `Liant ${index}`,
        gs: 3.0,
      };
      return { catalogue_liants: [...state.catalogue_liants, nouveau] };
    }),
  modifierLiant: (index, patch) =>
    set((state) => {
      if (index < 0 || index >= state.catalogue_liants.length) return {};
      const catalogue = [...state.catalogue_liants];
      const ancienCode = catalogue[index].code;
      catalogue[index] = { ...catalogue[index], ...patch };
      const nouveauCode = catalogue[index].code;
      const doitRenommer = ancienCode !== nouveauCode && !!nouveauCode;

      if (!doitRenommer) {
        return { catalogue_liants: catalogue };
      }

      const renommer = (code?: string | null) =>
        code === ancienCode ? nouveauCode : code;

      return {
        catalogue_liants: catalogue,
        general: {
          ...state.general,
          binder1_type: renommer(state.general.binder1_type),
          binder2_type: renommer(state.general.binder2_type),
          binder3_type: renommer(state.general.binder3_type),
        },
      };
    }),
  supprimerLiant: (index) =>
    set((state) => {
      if (state.catalogue_liants.length <= 1) return {};
      if (index < 0 || index >= state.catalogue_liants.length) return {};

      const codeSupprime = state.catalogue_liants[index].code;
      const catalogue = state.catalogue_liants.filter((_, i) => i !== index);
      const codeFallback = catalogue[0]?.code ?? null;

      const nettoyerCode = (code?: string | null) =>
        code === codeSupprime ? codeFallback : code;

      return {
        catalogue_liants: catalogue,
        general: {
          ...state.general,
          binder1_type: nettoyerCode(state.general.binder1_type),
          binder2_type: nettoyerCode(state.general.binder2_type),
          binder3_type: nettoyerCode(state.general.binder3_type),
        },
      };
    }),

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
      persistBinderPrices(testBinderPrices);

      console.log("[fillTestData] Valeurs Intra 2017 chargées — Cw:", cwPct, "Gs:", gs, "w0:", w0, "Bw:", bwLevels[0]);
      return { general: newGeneral, catalogue_liants: catalogue, cw: newCw, wb: newWb, slump: newSlump, rpgCw: newRpgCw, rpgWb: newRpgWb, industrie: newIndustrie, binderPrices: testBinderPrices };
    }),

  units: DEFAULT_UNITS,
  setUnits: (patch) =>
    set((state) => {
      const updated = { ...state.units, ...patch };
      persistUnits(updated);
      return { units: updated };
    }),
  loadUnits: () => set({ units: loadUnitsFromStorage() }),

  savedResults: [],
  loadSavedResults: () => set({ savedResults: loadSavedFromStorage() }),
  saveCurrentResult: (label) => {
    const state = get();
    const isRpg = state.category === "RPG";
    const m = state.method;
    const result = isRpg
      ? m === "wb" ? state.rpgWbResult : m === "essai" ? state.rpgEssaiResult : state.rpgCwResult
      : m === "wb" ? state.wbResult : m === "slump" ? state.slumpResult : m === "essai" ? state.essaiResult : state.cwResult;
    if (!result?.recipes?.length) return false;
    // Instantané des entrées du formulaire actif (pour « Recharger »)
    const inputs = isRpg
      ? m === "wb" ? state.rpgWb : m === "essai" ? state.rpgEssai : state.rpgCw
      : m === "wb" ? state.wb : m === "slump" ? state.slump : m === "essai" ? state.essai : state.cw;
    const entry: SavedResult = {
      id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      savedAt: new Date().toISOString(),
      label,
      category: state.category,
      method: state.method,
      general: { ...state.general },
      recipes: result.recipes,
      inputs: JSON.parse(JSON.stringify(inputs)),
      solverVersion: SOLVER_VERSION,
    };
    const updated = [entry, ...state.savedResults];
    const persisted = persistSaved(updated);
    set({ savedResults: updated });
    return persisted;
  },
  restoreSavedResult: (id) => {
    const state = get();
    const entry = state.savedResults.find((s) => s.id === id);
    if (!entry) return false;
    const result: MixResult = {
      category: entry.category,
      method: entry.method,
      general: entry.general as Record<string, unknown>,
      recipes: entry.recipes,
    };
    const patch: Partial<AppState> = {
      category: entry.category,
      method: entry.method,
      general: { ...entry.general },
    };
    const isRpg = entry.category === "RPG";
    const m = entry.method;
    if (isRpg) {
      if (m === "wb") { patch.rpgWbResult = result; if (entry.inputs) patch.rpgWb = entry.inputs as RpgWbState; }
      else if (m === "essai") { patch.rpgEssaiResult = result; if (entry.inputs) patch.rpgEssai = entry.inputs as RpgEssaiState; }
      else { patch.rpgCwResult = result; if (entry.inputs) patch.rpgCw = entry.inputs as RpgCwState; }
    } else {
      if (m === "wb") { patch.wbResult = result; if (entry.inputs) patch.wb = entry.inputs as WbState; }
      else if (m === "slump") { patch.slumpResult = result; if (entry.inputs) patch.slump = entry.inputs as SlumpState; }
      else if (m === "essai") { patch.essaiResult = result; if (entry.inputs) patch.essai = entry.inputs as EssaiInputsState; }
      else { patch.cwResult = result; if (entry.inputs) patch.cw = entry.inputs as CwState; }
    }
    set(patch);
    return true;
  },
  deleteSavedResult: (id) =>
    set((state) => {
      const updated = state.savedResults.filter((s) => s.id !== id);
      persistSaved(updated);
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
  setBinderPrice: (code, price_per_kg) =>
    set((state) => {
      const existing = state.binderPrices.filter((p) => p.code !== code);
      const updated = [...existing, { code, price_per_kg }];
      persistBinderPrices(updated);
      return { binderPrices: updated };
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
