// frontend/src/lib/analyse-corps.ts
// Corps des requêtes d'Analyse, construits par des fonctions PURES : la page
// les envoie, et l'empreinte des corps du balayage (prise AU DÉPART, comme
// dans Calculs) dit si la figure affichée correspond encore aux entrées.
//
// Depuis 2026-10-25, la base vient d'un CALCUL SAUVEGARDÉ (analyse-source.ts),
// plus du formulaire en cours de Calculs : après un calcul selon E/L ou en
// essai-erreur, l'Analyse montrait d'autres valeurs que le résultat obtenu.
// Le volume analysé est le volume total de la recette sauvegardée (contenant
// « volume », 1 contenant, κ = 1) : au point de référence, le balayage redonne
// toutes ses grandeurs, masses et volumes compris, y compris après un
// essai-erreur dont le volume final dépasse celui des moules
// (backend/app/tests/test_balayage.py, test_base_reconstruite_...).

import { construireConstantesPayload, construireGeneralPayload } from "./rpc_payload";
import { empreinte } from "./sync-empreinte";
import type { ConstantesCalcul, GeneralInfo } from "./store";

/** Valeurs d'une recette sauvegardée qui deviennent les entrées de la méthode Cw. */
export interface ValeursRecette {
  cwPct: number;
  srPct: number;
  bwPct: number;
  /** RPG seulement. */
  amPct?: number;
  /** Volume total de la recette (m³) : le volume analysé. */
  volumeM3: number;
}

/** Matériaux du calcul, communs à toutes ses recettes. */
export interface MateriauxAnalyse {
  gsResidu: number;
  w0Pct: number;
  /** RPG seulement. */
  gsGranulat?: number;
}

/** Composant de liant résolu AVANT l'envoi (jamais de Gs par défaut). */
export interface LiantResolu {
  code: string;
  nom: string;
  gs: number;
  /** Fraction massique (0 à 1), normalisée comme construireSystemeLiant. */
  fraction: number;
  /** D'où vient le Gs : l'instantané du calcul, ou le catalogue actuel (signalé). */
  origine: "calcul" | "catalogue_actuel";
}

/** Base d'une analyse : un calcul sauvegardé et une recette, avec leur contexte. */
export interface BaseAnalyse {
  categorie: "RPC" | "RPG";
  /** `general` du calcul : seuls les champs d'identification sont repris ; le contenant est remplacé par le volume analysé. */
  general: GeneralInfo;
  constantes: ConstantesCalcul;
  liants: LiantResolu[];
  materiaux: MateriauxAnalyse;
  recette: ValeursRecette;
  /** « idCalcul#indexRecette » : entre dans l'empreinte, jamais dans les requêtes. */
  cleSource: string;
}

/** Ce que le balayage envoie, en plus de la base. */
export interface EntreesBalayage extends BaseAnalyse {
  param: string;
  xMin: number;
  xMax: number;
  steps: number;
  /** Recettes comparées (la base d'abord) ; null : une seule courbe, à `recette`. */
  variantes: ValeursRecette[] | null;
}

/** Entrées de la méthode Cw pour UNE recette (`v`, par défaut celle de la base). */
export function payloadBase(e: BaseAnalyse, v: ValeursRecette = e.recette): Record<string, unknown> {
  const commun = {
    category: e.categorie,
    general: {
      ...construireGeneralPayload(e.general),
      container_type: "volume",
      container_section: null,
      container_height: null,
      container_radius: null,
      container_length: null,
      container_width: null,
      container_volume_m3: v.volumeM3,
    },
    constants: construireConstantesPayload(e.constantes),
    residue: { specific_gravity: e.materiaux.gsResidu, moisture_mass_pct: e.materiaux.w0Pct },
    binder_system: {
      components: e.liants.map((l) => ({ type: l.code, specific_gravity: l.gs, mass_fraction: l.fraction })),
    },
    num_recipes: 1,
    containers_per_recipe: 1,
    safety_factor: 1,
    solids_mass_pct: v.cwPct,
    saturation_pct: v.srPct,
    binder_mass_pct_recipes: [v.bwPct],
  };
  if (e.categorie === "RPG") {
    return { ...commun, aggregate_fraction_pct: v.amPct, aggregate_specific_gravity: e.materiaux.gsGranulat };
  }
  return commun;
}

/** Corps des requêtes /analyse/balayage : un par variante, dans l'ordre des variantes. */
export function corpsBalayage(e: EntreesBalayage): Record<string, unknown>[] {
  return (e.variantes ?? [e.recette]).map((v) => ({
    category: e.categorie,
    [e.categorie === "RPC" ? "base_inputs_rpc" : "base_inputs_rpg"]: payloadBase(e, v),
    param: e.param, x_min: e.xMin, x_max: e.xMax, steps: e.steps,
  }));
}

/**
 * Empreinte de tout ce que le balayage envoie, et du calcul d'où il part : deux
 * calculs aux entrées identiques ne partagent pas une provenance.
 */
export function empreinteBalayage(e: EntreesBalayage): string {
  return empreinte({ source: e.cleSource, corps: corpsBalayage(e) });
}
