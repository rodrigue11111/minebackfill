// frontend/src/lib/method-registry.ts
// Registre UNIQUE des catégories et méthodes de calcul. Toute la connaissance
// « quelle méthode existe, pour quelle catégorie, avec quel libellé, quel
// endpoint et quelles tranches de store » vit ici — au lieu d'être éparpillée
// en tableaux/échelles ternaires divergents (LeftPane, mix/page, ResultsPanel,
// store, historique, exports). Ajouter une méthode = 1 entrée ici + 1
// composant de formulaire + 1 solveur backend.
//
// Import type-only depuis le store (effacé à la compilation : pas de cycle —
// le store importe ce module en valeur, ce module n'importe que des types).

import type { Category, SavedMethod } from "./store";

/** Clés des tranches d'état/résultat du store (une paire par méthode). */
export type MethodStateKey =
  | "cw" | "wb" | "slump" | "essai"
  | "rpgCw" | "rpgWb" | "rpgEssai"
  | "rrc";
export type MethodResultKey =
  | "cwResult" | "wbResult" | "slumpResult" | "essaiResult"
  | "rpgCwResult" | "rpgWbResult" | "rpgEssaiResult"
  | "rrcResult";

export interface MethodDescriptor {
  category: Category;
  /** « rrc » pour la catégorie RRC (pas de sous-méthode). */
  method: SavedMethod;
  labels: {
    /** Libellé complet (fil d'Ariane, sélecteur de méthode). */
    long: string;
    /** Libellé court (historique, sous-titres d'exports). */
    court: string;
  };
  /** Complément affiché dans le panneau de gauche. */
  description: string;
  /** Endpoint backend (proxifié par Next). */
  endpoint: string;
  stateKey: MethodStateKey;
  resultKey: MethodResultKey;
}

export const CATEGORY_INFO: { id: Category; label: string; desc: string }[] = [
  { id: "RPC", label: "RPC", desc: "Remblai en pâte cimenté" },
  { id: "RPG", label: "RPG", desc: "Remblai pâte granulaire" },
  { id: "RRC", label: "RRC", desc: "Remblai rocheux cimenté" },
];

export const METHOD_REGISTRY: MethodDescriptor[] = [
  // ── RPC ──
  {
    category: "RPC", method: "dosage_cw",
    labels: { long: "Dosage selon Cw (%)", court: "Cw%" },
    description: "% solide massique fixe",
    endpoint: "/rpc/cw", stateKey: "cw", resultKey: "cwResult",
  },
  {
    category: "RPC", method: "wb",
    labels: { long: "Rapport eau/ciment (W/C)", court: "E/C" },
    description: "Rapport eau / ciment",
    endpoint: "/rpc/wb", stateKey: "wb", resultKey: "wbResult",
  },
  {
    category: "RPC", method: "slump",
    labels: { long: "Ajustement pour slump", court: "Slump" },
    description: "Correction par affaissement",
    endpoint: "/rpc/slump", stateKey: "slump", resultKey: "slumpResult",
  },
  {
    category: "RPC", method: "essai",
    labels: { long: "Méthode essai-erreur", court: "Essai-erreur" },
    description: "Ajustements manuels",
    endpoint: "/rpc/essai", stateKey: "essai", resultKey: "essaiResult",
  },
  // ── RPG (pas de slump : méthode empirique spécifique RPC) ──
  {
    category: "RPG", method: "dosage_cw",
    labels: { long: "Dosage selon Cw (%)", court: "Cw%" },
    description: "% solide massique fixe",
    endpoint: "/rpg/cw", stateKey: "rpgCw", resultKey: "rpgCwResult",
  },
  {
    category: "RPG", method: "wb",
    labels: { long: "Rapport eau/ciment (W/C)", court: "E/C" },
    description: "Rapport eau / ciment",
    endpoint: "/rpg/wb", stateKey: "rpgWb", resultKey: "rpgWbResult",
  },
  {
    category: "RPG", method: "essai",
    labels: { long: "Méthode essai-erreur", court: "Essai-erreur" },
    description: "Ajustements manuels",
    endpoint: "/rpg/essai", stateKey: "rpgEssai", resultKey: "rpgEssaiResult",
  },
  // ── RRC ──
  {
    category: "RRC", method: "rrc",
    labels: { long: "Dosage Bw et W/C (CRF)", court: "CRF" },
    description: "Remblai rocheux cimenté",
    endpoint: "/rrc/dosage", stateKey: "rrc", resultKey: "rrcResult",
  },
];

/**
 * Descripteur pour (catégorie, méthode). Pour RRC, la méthode est ignorée
 * (une seule entrée). Renvoie undefined pour une combinaison inexistante
 * (ex. RPG + slump) — l'appelant affiche alors son message dédié.
 */
export function descriptorFor(category: Category, method: string): MethodDescriptor | undefined {
  if (category === "RRC") return METHOD_REGISTRY.find((d) => d.category === "RRC");
  return METHOD_REGISTRY.find((d) => d.category === category && d.method === method);
}

/** Méthodes proposées dans le panneau de gauche pour une catégorie. */
export function methodsFor(category: Category): MethodDescriptor[] {
  if (category === "RRC") return []; // le formulaire RRC est unique, pas de liste
  return METHOD_REGISTRY.filter((d) => d.category === category);
}

/**
 * Libellé d'une méthode telle qu'enregistrée (historique, exports).
 * Tolère les valeurs inconnues (vieilles sauvegardes) : renvoie la chaîne brute.
 */
export function methodLabel(
  category: Category,
  method: string,
  forme: "long" | "court" = "court",
): string {
  return descriptorFor(category, method)?.labels[forme] ?? method;
}
