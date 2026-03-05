"use client";

import { create } from "zustand";

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
    | null;
  container_section?: number | null;
  container_height?: number | null;
  container_radius?: number | null;
  container_length?: number | null;
  container_width?: number | null;

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

export type RpcCwResponse = any;

export interface SavedResult {
  id: string;
  savedAt: string;
  label: string;
  category: Category;
  method: RpcMethod;
  general: GeneralInfo;
  recipes: any[];
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

function persistSaved(items: SavedResult[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  } catch { /* storage full — silently ignore */ }
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
  wbResult: any | null;
  setWbResult: (res: any | null) => void;

  slump: SlumpState;
  setSlump: (patch: Partial<SlumpState>) => void;
  setSlumpRecipe: (index: number, patch: { binder_pct?: number }) => void;
  slumpResult: any | null;
  setSlumpResult: (res: any | null) => void;

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
  essaiResult: any | null;
  setEssaiResult: (res: any | null) => void;

  rpgCw: RpgCwState;
  setRpgCw: (patch: Partial<RpgCwState>) => void;
  setRpgCwRecipe: (index: number, patch: { binder_pct?: number }) => void;
  rpgCwResult: any | null;
  setRpgCwResult: (res: any | null) => void;

  rpgWb: RpgWbState;
  setRpgWb: (patch: Partial<RpgWbState>) => void;
  setRpgWbRecipe: (index: number, patch: { binder_pct?: number; wc_ratio?: number }) => void;
  rpgWbResult: any | null;
  setRpgWbResult: (res: any | null) => void;

  rpgEssai: RpgEssaiState;
  setRpgEssai: (patch: Partial<RpgEssaiState>) => void;
  setRpgEssaiAjustement: (index: number, patch: RpgEssaiAdjustment) => void;
  rpgEssaiResult: any | null;
  setRpgEssaiResult: (res: any | null) => void;

  fillTestData: () => void;

  savedResults: SavedResult[];
  saveCurrentResult: (label: string) => void;
  deleteSavedResult: (id: string) => void;
  loadSavedResults: () => void;
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

export const useStore = create<AppState>((set) => ({
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

  fillTestData: () => {
    const rf = (min: number, max: number, dec: number) =>
      parseFloat((min + Math.random() * (max - min)).toFixed(dec));
    const numR = [2, 3, 4][Math.floor(Math.random() * 3)] as 2 | 3 | 4;
    const gs = rf(3.2, 3.6, 2);
    const w0 = rf(18, 30, 1);
    const cwPct = rf(74, 82, 1);
    const qty = Math.floor(rf(20, 100, 0));
    const makeBw = () => Array.from({ length: 4 }, (_, i) => rf(3 + i * 1.5, 5 + i * 1.5, 1));
    const makeWc = () => Array.from({ length: 4 }, () => rf(4, 10, 1));
    const aggSg = rf(2.5, 2.9, 2);
    const aggPct = rf(15, 35, 1);
    const radius = rf(4.5, 6, 4);
    const height = rf(18, 23, 1);
    const newGeneral: GeneralInfo = {
      operator_name: "Test Operateur",
      project_name: "Projet Test",
      residue_id: `R-${new Date().getFullYear()}-T`,
      mix_date: new Date().toISOString().slice(0, 10),
      container_type: "rayon_hauteur",
      container_radius: radius,
      container_height: height,
      binder_count: 2,
      binder1_type: "CP10",
      binder2_type: "SLAG",
      binder3_type: null,
      binder1_fraction_pct: 60,
      binder2_fraction_pct: 40,
      binder3_fraction_pct: 0,
    };
    const newCw: CwState = { solid_mass_pct: cwPct, saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: numR, desired_qty: qty, safety_factor: 1, binder_pct: makeBw() };
    const newWb: WbState = { saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: numR, desired_qty: qty, safety_factor: 1, binder_pct: makeBw(), wc_ratio: makeWc() };
    const newSlump: SlumpState = { cone_type: "mini", slump_mm: Math.floor(rf(100, 250, 0)), saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, num_recipes: numR, desired_qty: qty, safety_factor: 1, binder_pct: makeBw() };
    const newRpgCw: RpgCwState = { solid_mass_pct: cwPct, saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, aggregate_sg: aggSg, aggregate_fraction_pct: aggPct, num_recipes: numR, desired_qty: qty, safety_factor: 1, binder_pct: makeBw() };
    const newRpgWb: RpgWbState = { saturation_pct: 100, residue_sg: gs, residue_w_pct: w0, aggregate_sg: aggSg, aggregate_fraction_pct: aggPct, num_recipes: numR, desired_qty: qty, safety_factor: 1, binder_pct: makeBw(), wc_ratio: makeWc() };
    console.log("[fillTestData] Setting test values — Cw:", cwPct, "Gs:", gs, "w0:", w0, "recipes:", numR);
    set({ general: newGeneral, cw: newCw, wb: newWb, slump: newSlump, rpgCw: newRpgCw, rpgWb: newRpgWb });
  },

  savedResults: [],
  loadSavedResults: () => set({ savedResults: loadSavedFromStorage() }),
  saveCurrentResult: (label) =>
    set((state) => {
      const isRpg = state.category === "RPG";
      const m = state.method;
      const result = isRpg
        ? m === "wb" ? state.rpgWbResult : m === "essai" ? state.rpgEssaiResult : state.rpgCwResult
        : m === "wb" ? state.wbResult : m === "slump" ? state.slumpResult : m === "essai" ? state.essaiResult : state.cwResult;
      if (!result?.recipes?.length) return {};
      const entry: SavedResult = {
        id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        savedAt: new Date().toISOString(),
        label,
        category: state.category,
        method: state.method,
        general: { ...state.general },
        recipes: result.recipes,
      };
      const updated = [entry, ...state.savedResults];
      persistSaved(updated);
      return { savedResults: updated };
    }),
  deleteSavedResult: (id) =>
    set((state) => {
      const updated = state.savedResults.filter((s) => s.id !== id);
      persistSaved(updated);
      return { savedResults: updated };
    }),
}));

export default useStore;
