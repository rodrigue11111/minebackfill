// frontend/src/lib/resultat-perime.ts
// « Résultats périmés » : un calcul affiché alors que ses entrées ont changé.
// Module PUR : l'état est passé en argument.
//
// Pourquoi : après une erreur, ou après une modification d'entrée, l'écran
// gardait l'ancien résultat, et Sauvegarder, Excel et PDF restaient actifs.
// Un étudiant pouvait ainsi enregistrer une recette qui ne correspondait plus
// à ce qu'il voyait dans le formulaire. L'empreinte des entrées est prise au
// moment où le résultat arrive ; à l'affichage, une empreinte différente dit
// que le résultat est périmé.

import { descriptorFor, METHOD_REGISTRY, type MethodResultKey } from "./method-registry";
import { empreinte } from "./sync-empreinte";

type EtatCalcul = Record<string, unknown> & { general?: unknown; constantes?: unknown; catalogue_liants?: unknown };

/** Ce dont un résultat dépend : l'état de sa méthode (et de la méthode de base
 *  pour l'essai-erreur), les informations générales, les constantes et les liants. */
export function entreesDuCalcul(state: EtatCalcul, cle: MethodResultKey): unknown {
  const d = METHOD_REGISTRY.find((m) => m.resultKey === cle);
  if (!d) return null;
  const etat = state[d.stateKey] as { base_method?: string; mesures?: unknown } | undefined;
  const base = etat?.base_method ? descriptorFor(d.category, etat.base_method) : undefined;
  // Les mesures au laboratoire (essai-erreur) n'entrent pas dans le calcul :
  // les saisir ne rend pas le résultat périmé.
  const methode = etat && "mesures" in etat ? { ...etat, mesures: undefined } : etat;
  return {
    methode,
    base: base ? state[base.stateKey] : undefined,
    general: state.general,
    constantes: state.constantes,
    liants: state.catalogue_liants,
  };
}

export function empreinteEntrees(state: EtatCalcul, cle: MethodResultKey): string {
  return empreinte(entreesDuCalcul(state, cle));
}

/** Vrai si un résultat affiché ne correspond plus aux entrées (empreinte inconnue : on ne conclut rien). */
export function resultatPerime(state: EtatCalcul, cle: MethodResultKey, empreinteAuCalcul: string | undefined): boolean {
  return empreinteAuCalcul !== undefined && empreinteAuCalcul !== empreinteEntrees(state, cle);
}
