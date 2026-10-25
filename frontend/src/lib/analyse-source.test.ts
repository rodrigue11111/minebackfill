import { describe, expect, it } from "vitest";
import {
  baseDepuisCalcul, calculsAnalysables, choisirCalcul, constantesDuCalcul, instantaneDepuisSource,
  libelleCalcul, liantsDuCalcul, lireValeursRecette, notesSource, texteVolume,
} from "./analyse-source";
import { packById } from "./conventions";
import { construireSystemeLiant } from "./rpc_payload";
import { defautsCw, useStore, type GeneralInfo, type LiantCatalogueItem, type SavedResult } from "./store";
import type { Recipe } from "./types";

const recette = (p: Partial<Recipe> = {}): Recipe =>
  ({ solids_mass_pct: 75, saturation_pct: 100, bw_mass_pct: 5, total_backfill_volume_m3: 0.0123, ...p }) as Recipe;

const GENERAL = {
  container_type: "rayon_hauteur", container_radius: 5, container_height: 20,
  binders: [{ id: "l1", code: "GU", fraction_pct: 20 }, { id: "l2", code: "Slag", fraction_pct: 80 }],
} as GeneralInfo;
const CATALOGUE: LiantCatalogueItem[] = [{ id: "l1", code: "GU", nom: "GU", gs: 3.15 }, { id: "l2", code: "Slag", nom: "Laitier", gs: 2.9 }];
const MATERIAUX = { residue_sg: 3.05, residue_w_pct: 20, desired_qty: 6, safety_factor: 1.1, num_recipes: 2 };

const calcul = (p: Partial<SavedResult> = {}): SavedResult => ({
  id: "sr_1", savedAt: "2026-10-25T14:03:00.000Z", label: "Essai A", category: "RPC", method: "dosage_cw",
  general: GENERAL,
  recipes: [recette(), recette({ bw_mass_pct: 6 })],
  inputs: { ...defautsCw(), ...MATERIAUX, solid_mass_pct: 75, saturation_pct: 100, binder_pct: [5, 6, undefined, undefined] },
  solverVersion: "gramme-1.1",
  catalogue_liants: CATALOGUE,
  constantes: packById("gramme")!.constantes,
  ...p,
});

const essai = (p: Partial<SavedResult> = {}) => calcul({
  method: "essai",
  inputs: {
    base_method: "wb", ajustements: [],
    base_wb: { ...MATERIAUX, residue_sg: 2.9, wc_ratio: [7, 8.5] },
    base_cw: { ...MATERIAUX, residue_sg: 3.3 },
  },
  recipes: [recette({ total_backfill_volume_m3: 0.0141 }), recette({ bw_mass_pct: 6, total_backfill_volume_m3: 0.0138 })],
  ...p,
});

const base = (sr: SavedResult, i = 0, catalogue: LiantCatalogueItem[] = []) => {
  const l = baseDepuisCalcul(sr, i, catalogue);
  if (!l.ok) throw new Error(l.raison);
  return l;
};
const raison = (sr: SavedResult, i = 0, catalogue: LiantCatalogueItem[] = []) => {
  const l = baseDepuisCalcul(sr, i, catalogue);
  return l.ok ? "(accepté)" : l.raison;
};

describe("calculsAnalysables et choisirCalcul", () => {
  it("RPC et RPG avec recettes seulement, du plus récent au plus ancien", () => {
    const a = calcul({ id: "a", savedAt: "2026-10-01T10:00:00Z" });
    const b = calcul({ id: "b", savedAt: "2026-10-20T10:00:00Z", category: "RPG" });
    const rrc = calcul({ id: "rrc", category: "RRC", method: "rrc", recipes: [] });
    const vide = calcul({ id: "vide", recipes: [] });
    const nul = calcul({ id: "nul", recipes: [null as unknown as Recipe] });
    expect(calculsAnalysables([a, rrc, b, vide, nul]).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("le calcul demandé s'il existe ; sinon le plus récent, signalé introuvable", () => {
    const liste = [calcul({ id: "b" }), calcul({ id: "a" })];
    expect(choisirCalcul(liste, "a")).toMatchObject({ calcul: { id: "a" }, introuvable: false });
    expect(choisirCalcul(liste, "disparu")).toMatchObject({ calcul: { id: "b" }, introuvable: true });
    expect(choisirCalcul(liste, null)).toMatchObject({ calcul: { id: "b" }, introuvable: false });
    expect(choisirCalcul([], "a")).toEqual({ calcul: null, introuvable: true });
  });

  it("libellé : nom, catégorie, méthode et date de sauvegarde", () => {
    expect(libelleCalcul(calcul({ method: "wb" }))).toMatch(/^Essai A · RPC · .*E\/L.* · 2026-10-2\d, \d+ h \d\d$/);
  });
});

describe("baseDepuisCalcul : valeurs de la RECETTE sauvegardée, contexte du CALCUL", () => {
  it("selon Cw : recette 2, matériaux, liants de l'instantané, volume total, clé de source", () => {
    const l = base(calcul(), 1);
    expect(l.base.recette).toEqual({ cwPct: 75, srPct: 100, bwPct: 6, volumeM3: 0.0123 });
    expect(l.base.materiaux).toEqual({ gsResidu: 3.05, w0Pct: 20 });
    expect(l.base.liants.map((x) => [x.code, x.gs, x.fraction, x.origine])).toEqual([["GU", 3.15, 0.2, "calcul"], ["Slag", 2.9, 0.8, "calcul"]]);
    expect(l.base.cleSource).toBe("sr_1#1");
    expect(l.source).toMatchObject({ recette: 2, nbRecettes: 2, versionCalcul: "gramme-1.1", reconstitutions: [] });
  });

  it("les liants résolus valent ceux du calcul d'origine (même filtre, ordre, normalisation)", () => {
    const l = base(calcul());
    expect(l.base.liants.map((x) => ({ type: x.code, specific_gravity: x.gs, mass_fraction: x.fraction })))
      .toEqual(construireSystemeLiant(GENERAL, CATALOGUE).components);
  });

  it("selon E/L : la recette 2 donne SON Cw calculé (le formulaire E/L n'en a pas)", () => {
    const el = calcul({
      method: "wb",
      inputs: { ...MATERIAUX, saturation_pct: 100, binder_pct: [4.5, 6], wc_ratio: [7, 8.5] },
      recipes: [recette({ solids_mass_pct: 74.2, bw_mass_pct: 4.5 }), recette({ solids_mass_pct: 76.1, bw_mass_pct: 6 })],
    });
    expect(base(el, 1).base.recette.cwPct).toBe(76.1);
    expect(base(el, 0).base.recette.cwPct).toBe(74.2);
  });

  it("modèle prédictif : matériaux du formulaire d'affaissement", () => {
    const sl = calcul({ method: "slump", inputs: { ...MATERIAUX, residue_sg: 2.95, cone_type: "grand", slump_mm: 180, saturation_pct: 100, binder_pct: [5, 6] } });
    expect(base(sl).base.materiaux.gsResidu).toBe(2.95);
  });

  it("essai-erreur : matériaux de SA base (base_method), volume final de la recette", () => {
    expect(base(essai()).base.materiaux.gsResidu).toBe(2.9);
    expect(base(essai({ inputs: { base_method: "dosage_cw", base_cw: { ...MATERIAUX, residue_sg: 3.3 } } })).base.materiaux.gsResidu).toBe(3.3);
    expect(base(essai(), 1).base.recette.volumeM3).toBe(0.0138);
  });

  it("Sr à 100 % plus un bruit d'arrondi : ramené à 100", () => {
    expect(base(calcul({ recipes: [recette({ saturation_pct: 100 + 1e-12 })] })).base.recette.srPct).toBe(100);
  });

  it("RPG : Am de la recette, Gs du granulat du calcul ; Am absent : repris du formulaire hors essai-erreur", () => {
    const rpg = (p: Partial<SavedResult> = {}) => calcul({
      category: "RPG",
      inputs: { ...MATERIAUX, solid_mass_pct: 78, saturation_pct: 100, binder_pct: [4], aggregate_fraction_pct: 30, aggregate_sg: 2.65 },
      recipes: [recette({ aggregate_mass_pct: 30.2 })],
      ...p,
    });
    const l = base(rpg());
    expect(l.base.recette.amPct).toBe(30.2);
    expect(l.base.materiaux.gsGranulat).toBe(2.65);
    expect(base(rpg({ recipes: [recette()] })).base.recette.amPct).toBe(30);
  });
});

describe("baseDepuisCalcul : contexte préservé strictement", () => {
  it("constantes du calcul telles quelles, aucune convention imposée", () => {
    const intra = packById("intra2017")!.constantes;
    const l = base(calcul({ constantes: { ...intra, gravite_m_s2: 9.8 } }));
    expect(l.base.constantes).toMatchObject({ gravite_m_s2: 9.8, essai_binder_rule: "solides_totaux", essai_gs_convention: "base", pack_id: "intra2017" });
    expect(l.source.reconstitutions).toEqual([]);
  });

  it("constantes absentes : valeurs par défaut, signalées", () => {
    const { constantes, reconstituees } = constantesDuCalcul({ constantes: undefined });
    expect(constantes.masse_volumique_eau_kg_m3).toBe(1000);
    expect(reconstituees).toContain("masse volumique de l'eau");
    expect(base(calcul({ constantes: undefined })).source.reconstitutions[0]).toContain("masse volumique de l'eau");
  });

  it("liant absent de l'instantané : repris du catalogue actuel et signalé ; introuvable : refus, jamais le Gs par défaut", () => {
    const sansLaitier = calcul({ catalogue_liants: [CATALOGUE[0]] });
    const actuel: LiantCatalogueItem[] = [{ id: "l2", code: "Slag", nom: "Laitier", gs: 2.88 }];
    const l = base(sansLaitier, 0, actuel);
    expect(l.base.liants[1]).toMatchObject({ gs: 2.88, origine: "catalogue_actuel" });
    expect(l.source.reconstitutions.join(" ")).toContain("catalogue actuel");
    expect(raison(sansLaitier)).toContain("introuvable");
    expect(liantsDuCalcul({ general: GENERAL, catalogue_liants: [] }, [])).toMatchObject({ ok: false });
  });

  it("le formulaire en cours de Calculs n'a aucun effet", () => {
    const avant = base(calcul());
    const s = useStore.getState();
    useStore.setState({ cw: { ...s.cw, solid_mass_pct: 70, residue_sg: 2.5 }, general: { ...s.general, container_type: "volume", container_volume_m3: 9 } });
    try {
      expect(base(calcul())).toEqual(avant);
    } finally {
      useStore.setState({ cw: s.cw, general: s.general });
    }
  });
});

describe("baseDepuisCalcul : refus expliqués", () => {
  it.each<[string, SavedResult, string]>([
    ["RRC", calcul({ category: "RRC", method: "rrc" }), "RRC"],
    ["essai sous l'ancienne convention", essai({ constantes: { ...packById("gramme")!.constantes, essai_gs_convention: "base" } }), "ancienne convention"],
    ["essai sans instantané des constantes", essai({ constantes: undefined }), "ancienne convention"],
    ["essai sans sa base", essai({ inputs: { base_method: "dosage_cw", ajustements: [] } }), "sans sa recette de base"],
    ["sans entrées", calcul({ inputs: undefined }), "sans ses entrées"],
    ["Gs du résidu nul", calcul({ inputs: { ...MATERIAUX, residue_sg: 0 } }), "Gs du résidu"],
    ["w₀ absent", calcul({ inputs: { ...MATERIAUX, residue_w_pct: undefined } }), "w₀"],
    ["Sr 103 %", calcul({ recipes: [recette({ saturation_pct: 103 })] }), "Sr"],
    ["Cw 100 %", calcul({ recipes: [recette({ solids_mass_pct: 100 })] }), "Cw"],
    ["Bw non fini", calcul({ recipes: [recette({ bw_mass_pct: Number.NaN })] }), "manquent"],
    ["volume absent", calcul({ recipes: [recette({ total_backfill_volume_m3: undefined })] }), "volume total"],
    ["sans informations générales", calcul({ general: undefined as unknown as GeneralInfo }), "informations générales"],
    ["RPG essai sans Am final", essai({ category: "RPG", inputs: { base_method: "dosage_cw", base_cw: { ...MATERIAUX, aggregate_sg: 2.65, aggregate_fraction_pct: 30 } } }), "Am"],
    ["RPG sans Gs du granulat", calcul({ category: "RPG", inputs: { ...MATERIAUX, aggregate_fraction_pct: 30 } }), "granulat"],
  ])("%s", (_nom, sr, attendu) => {
    expect(raison(sr)).toContain(attendu);
  });

  it("lireValeursRecette : recette absente", () => {
    expect(lireValeursRecette(calcul(), 5)).toMatchObject({ ok: false, raison: "La recette 6 est absente de ce calcul." });
  });
});

describe("notesSource : méthode d'origine distincte de la méthode d'analyse", () => {
  const src = (p: Partial<SavedResult> = {}) => base(calcul(p)).source;

  it("dit ce qui reste fixe, sans jamais « à Cw constant » quand l'axe est Cw", () => {
    const enCw = notesSource("RPC", src(), "solids_mass_pct").map((n) => n.texte).join(" ");
    expect(enCw).toContain("balayage selon la méthode Cw");
    expect(enCw).toContain("garde fixes Sr, Bw");
    expect(enCw).not.toMatch(/Cw constant|fixes Cw/);
    expect(notesSource("RPC", src(), "binder_mass_pct")[0].texte).toContain("garde fixes Cw, Sr,");
    expect(notesSource("RPG", src(), "binder_mass_pct")[0].texte).toContain("Am");
  });

  it("E/L, affaissement et ajouts de l'essai-erreur ne sont pas maintenus, et l'écran le dit", () => {
    const el = calcul({ method: "wb", inputs: { ...MATERIAUX, saturation_pct: 100 } });
    expect(notesSource("RPC", base(el).source, "binder_mass_pct").map((n) => n.texte).join(" ")).toContain("E/L n'est pas imposé");
    const sl = calcul({ method: "slump", inputs: { ...MATERIAUX, saturation_pct: 100 } });
    expect(notesSource("RPC", base(sl).source, "binder_mass_pct").map((n) => n.texte).join(" ")).toContain("affaissement visé n'est pas maintenu");
    expect(notesSource("RPC", base(essai()).source, "binder_mass_pct").map((n) => n.texte).join(" ")).toContain("ne sont pas rejoués");
  });

  it("calcul aux anciennes formules : alerte", () => {
    const n = notesSource("RPC", src({ solverVersion: "1.0" }), "binder_mass_pct");
    expect(n.some((x) => x.ton === "alerte" && x.texte.includes("anciennes formules"))).toBe(true);
  });
});

describe("instantaneDepuisSource : provenance", () => {
  it("courbes : méthode d'analyse, calcul d'origine, deux versions, volume", () => {
    const l = base(calcul({ method: "wb", solverVersion: "intra2017-1.0", inputs: { ...MATERIAUX, saturation_pct: 100 } }), 1);
    const inst = instantaneDepuisSource(l.base, l.source, { mode: "courbes", date: "2026-10-25T15:00:00Z" });
    expect(inst.methode).toBe("Balayage selon la méthode Cw");
    expect(inst.versionSolveur).toBe("gramme-1.1");
    expect(inst.source).toMatchObject({ id: "sr_1", libelle: "Essai A", recette: 2, nbRecettes: 2, versionCalcul: "intra2017-1.0" });
    expect(inst.source?.methode).toContain("E/L");
    expect(inst.volumeM3).toBe(0.0123);
    expect(inst.recette).toMatchObject({ gsResidu: 3.05, w0Pct: 20, cwPct: 75, bwPct: 6 });
  });

  it("composition : recettes sauvegardées, version du calcul, toutes les recettes", () => {
    const l = base(calcul({ solverVersion: "gramme-1.0" }));
    const inst = instantaneDepuisSource(l.base, l.source, { mode: "composition", date: "2026-10-25T14:03:00.000Z" });
    expect(inst.versionSolveur).toBe("gramme-1.0");
    expect(inst.source?.recette).toBeUndefined();
    expect(inst.volumeM3).toBeUndefined();
  });

  it("volume lisible en litres sous 1 m³", () => {
    expect(texteVolume(0.0123)).toBe("12,3 L");
    expect(texteVolume(2.5)).toBe("2,5 m³");
  });
});
