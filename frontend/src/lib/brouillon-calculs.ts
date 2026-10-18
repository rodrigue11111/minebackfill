// frontend/src/lib/brouillon-calculs.ts
// Brouillon des formulaires de Calculs, gardé sur l'appareil.
//
// Pourquoi : l'état des formulaires vivait en mémoire seulement. Un
// rechargement (ou un onglet rouvert) vidait tout, ce que des étudiants ont
// pris pour une panne (« le formulaire se vide », « Analyse ne fonctionne
// pas »). Le brouillon est rangé à chaque modification et relu au démarrage.
//
// Clé versionnée `minebackfill_brouillon_calculs` {v:2, data}, HORS
// sauvegarde et hors synchronisation : un brouillon n'est pas un résultat
// (on sauvegarde un résultat pour le garder). Les résultats eux-mêmes ne sont
// pas rangés : ils se recalculent. Module PUR : les accès au stockage et au
// magasin sont faits par StoreHydrator.
//
// Version 2 (2026-10) : un champ vide est rangé vide (undefined), plus comme 0.
// Migration v1 -> v2 : les 0 des champs saisis deviennent vides (en v1, 0 était
// la valeur par défaut de « non saisi »).

import type { Category } from "./store";
import { descriptorFor } from "./method-registry";

export const BROUILLON_KEY = "minebackfill_brouillon_calculs";
export const BROUILLON_VERSION = 2;

/** Champs saisis (pas les compteurs) : en v1, leur 0 voulait dire « non saisi ». */
const CHAMPS_SAISIS = [
  "solid_mass_pct", "saturation_pct", "residue_sg", "residue_w_pct", "safety_factor", "slump_mm",
  "aggregate_fraction_pct", "aggregate_sg", "volume_m3", "wet_density_kg_m3", "total_mass_kg", "cement_sg", "retarder_density",
] as const;
const TABLEAUX_SAISIS = ["binder_pct", "wc_ratio"] as const;

/** Tranches de l'état gardées dans le brouillon. */
export const CLES_ETATS_BROUILLON = ["cw", "wb", "slump", "essai", "rpgCw", "rpgWb", "rpgEssai", "rrc"] as const;
export type CleEtatBrouillon = (typeof CLES_ETATS_BROUILLON)[number];

export interface Brouillon {
  category?: Category;
  method?: string;
  etats?: Partial<Record<CleEtatBrouillon, Record<string, unknown>>>;
}

type EtatSource = { category: Category; method: string } & Record<CleEtatBrouillon, unknown>;

/** Ce qu'on range : catégorie, méthode et l'état de chaque formulaire. */
export function extraireBrouillon(s: EtatSource): Brouillon {
  return {
    category: s.category,
    method: s.method,
    etats: Object.fromEntries(CLES_ETATS_BROUILLON.map((k) => [k, s[k]])) as Brouillon["etats"],
  };
}

/** Vrai si une tranche du brouillon a changé entre deux états du magasin. */
export function brouillonModifie(a: EtatSource, b: EtatSource): boolean {
  return a.category !== b.category || a.method !== b.method || CLES_ETATS_BROUILLON.some((k) => a[k] !== b[k]);
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Une tranche relue : null (JSON d'un undefined dans un tableau) redevient vide. */
function videsDepuisJson(e: Record<string, unknown>): Record<string, unknown> {
  const r = { ...e };
  for (const k of TABLEAUX_SAISIS) {
    if (Array.isArray(r[k])) r[k] = (r[k] as unknown[]).map((v) => (v === null ? undefined : v));
  }
  return r;
}

/**
 * Migration du brouillon relu vers la version courante. v1 -> v2 : dans chaque
 * tranche, les 0 des champs saisis et des tableaux Bw et E/L deviennent vides.
 * Un brouillon illisible est rendu tel quel (patchDepuisBrouillon l'ignore).
 */
export function migrerBrouillon(data: unknown, depuis: number): unknown {
  if (depuis >= 2 || !estObjet(data) || !estObjet(data.etats)) return data;
  const etats: Record<string, unknown> = {};
  for (const [k, e] of Object.entries(data.etats)) {
    if (!estObjet(e)) { etats[k] = e; continue; }
    const r: Record<string, unknown> = { ...e };
    for (const c of CHAMPS_SAISIS) if (r[c] === 0) delete r[c];
    for (const c of TABLEAUX_SAISIS) {
      if (Array.isArray(r[c])) r[c] = (r[c] as unknown[]).map((v) => (v === 0 ? null : v));
    }
    etats[k] = r;
  }
  return { ...data, etats };
}

/**
 * Patch du magasin depuis un brouillon relu : chaque formulaire FUSIONNÉ sur
 * ses valeurs par défaut (un champ ajouté depuis garde son défaut), une
 * catégorie ou une méthode inconnues ignorées. Brouillon illisible : rien.
 */
export function patchDepuisBrouillon(s: EtatSource, b: unknown): Partial<EtatSource> {
  if (!estObjet(b)) return {};
  const patch: Partial<EtatSource> = {};
  const etats = estObjet(b.etats) ? b.etats : {};
  for (const k of CLES_ETATS_BROUILLON) {
    const e = etats[k];
    if (estObjet(e) && estObjet(s[k])) (patch as Record<string, unknown>)[k] = { ...(s[k] as object), ...videsDepuisJson(e) };
  }
  const cat = b.category;
  if (cat === "RPC" || cat === "RPG" || cat === "RRC") {
    patch.category = cat;
    if (typeof b.method === "string" && descriptorFor(cat, b.method)) patch.method = b.method;
  }
  return patch;
}
