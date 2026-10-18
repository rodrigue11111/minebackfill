// frontend/src/lib/analyse-corps.ts
// Corps des requêtes d'Analyse, construits par des fonctions PURES : la page
// les envoie, et l'empreinte des corps du balayage (prise AU DÉPART, comme
// dans Calculs) dit si la figure affichée correspond encore aux entrées.
//
// Pourquoi : la figure n'était dite « périmée » que si la catégorie, le
// paramètre, les bornes, les points ou les variantes changeaient. Modifier Cw,
// Gs, le moule ou κ dans Calculs, puis revenir sur Analyse, laissait une
// figure ancienne passer pour à jour, exportable telle quelle.

import { construireConstantesPayload, construireGeneralPayload, construireSystemeLiant } from "./rpc_payload";
import { empreinte } from "./sync-empreinte";
import type { ConstantesCalcul, CwState, GeneralInfo, LiantCatalogueItem, RpgCwState } from "./store";

/** Recette de base d'Analyse : l'état « Selon Cw » de la catégorie, et le contexte. */
export interface BaseAnalyse {
  categorie: "RPC" | "RPG";
  general: GeneralInfo;
  constantes: ConstantesCalcul;
  catalogueLiants: LiantCatalogueItem[];
  /** cw en RPC, rpgCw en RPG. */
  base: CwState | RpgCwState;
  /** Granulat (RPG) : toujours lu dans rpgCw. */
  rpgCw: RpgCwState;
}

/** Ce que le balayage envoie, en plus de la recette de base. */
export interface EntreesBalayage extends BaseAnalyse {
  param: string;
  xMin: number;
  xMax: number;
  steps: number;
  /** Bw de chaque variante comparée ; [null] : une seule courbe, au Bw de la base. */
  bws: (number | null)[];
}

/** Entrées de la méthode Cw de la base, pour `nbRecettes` recettes (une seule pour un balayage). */
export function payloadBase(e: BaseAnalyse, nbRecettes: number): Record<string, unknown> & { binder_mass_pct_recipes: (number | undefined)[] } {
  const b = e.base;
  const commun = {
    category: e.categorie,
    general: construireGeneralPayload(e.general),
    constants: construireConstantesPayload(e.constantes),
    residue: { specific_gravity: b.residue_sg || 0, moisture_mass_pct: b.residue_w_pct || 0 },
    binder_system: construireSystemeLiant(e.general, e.catalogueLiants),
    num_recipes: nbRecettes,
    containers_per_recipe: b.desired_qty || 1,
    safety_factor: b.safety_factor || 1,
    solids_mass_pct: b.solid_mass_pct,
    saturation_pct: b.saturation_pct,
    binder_mass_pct_recipes:
      nbRecettes === 1
        ? [(b.binder_pct || [])[0] ?? 0]
        : (b.binder_pct || []).slice(0, nbRecettes),
  };
  if (e.categorie === "RPG") {
    return { ...commun, aggregate_fraction_pct: e.rpgCw.aggregate_fraction_pct, aggregate_specific_gravity: e.rpgCw.aggregate_sg };
  }
  return commun;
}

/** Corps des requêtes /analyse/balayage : un par variante, dans l'ordre des variantes. */
export function corpsBalayage(e: EntreesBalayage): Record<string, unknown>[] {
  return e.bws.map((bw) => {
    const payload = payloadBase(e, 1);
    if (bw !== null) payload.binder_mass_pct_recipes = [bw];
    return {
      category: e.categorie,
      [e.categorie === "RPC" ? "base_inputs_rpc" : "base_inputs_rpg"]: payload,
      param: e.param, x_min: e.xMin, x_max: e.xMax, steps: e.steps,
    };
  });
}

/** Empreinte de tout ce que le balayage envoie : une entrée changée la change. */
export function empreinteBalayage(e: EntreesBalayage): string {
  return empreinte(corpsBalayage(e));
}
