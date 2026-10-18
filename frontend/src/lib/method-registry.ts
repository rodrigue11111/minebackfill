// frontend/src/lib/method-registry.ts
// Registre UNIQUE des catégories et méthodes de calcul. Toute la connaissance
// « quelle méthode existe, pour quelle catégorie, avec quel libellé, quel
// endpoint et quelles tranches de store » vit ici — au lieu d'être éparpillée
// en tableaux/échelles ternaires divergents (page Calculs, ResultsPanel,
// store, historique, exports). Ajouter une méthode = 1 entrée ici + 1
// composant de formulaire + 1 solveur backend.
//
// Import type-only depuis le store (effacé à la compilation : pas de cycle —
// le store importe ce module en valeur, ce module n'importe que des types).

import type { Category, RpcMethod, SavedMethod } from "./store";
import { T } from "./glossaire";

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
    /** Fragment de nom de fichier (exports) : ASCII, sans espace. */
    fichier: string;
    /** Très court, pour le contrôle segmenté du téléphone. */
    telephone: string;
  };
  /** Complément affiché dans le panneau de gauche. */
  description: string;
  /** Quand l'utiliser : une phrase, sous le choix de méthode (Calculs) et dans le Guide. */
  quand: string;
  /** Endpoint backend (proxifié par Next). */
  endpoint: string;
  stateKey: MethodStateKey;
  resultKey: MethodResultKey;
}

export const CATEGORY_INFO: { id: Category; label: string; desc: string }[] = [
  { id: "RPC", label: T.rpc.court, desc: T.rpc.long },
  { id: "RPG", label: T.rpg.court, desc: T.rpg.long },
  { id: "RRC", label: T.rrc.court, desc: T.rrc.long },
];

// Quand utiliser chaque méthode (textes du Guide, source unique).
const QUAND_DOSAGE_CW = "Vous fixez le pourcentage solide massique Cw du mélange. C'est la méthode la plus courante en pratique.";
const QUAND_WB = "Vous imposez un rapport eau/liant E/L (noté aussi E/C ou W/C), par exemple tiré d'essais de résistance antérieurs.";
const QUAND_SLUMP = "Vous visez un affaissement donné au cône d'Abrams (ASTM C143/C143M) et voulez en déduire le Cw. Modèle empirique calé sur le RPC.";
const QUAND_ESSAI = "Vous avez une recette de base (dosage selon Cw ou selon E/L) et avez fait des ajouts après la mesure de l'affaissement : résidu sec, résidu humide, eau (et granulat en RPG).";
const QUAND_RRC = "Remblai rocheux cimenté : vous connaissez la quantité à produire (volume du chantier ou masse totale) et visez un Bw et un E/L du coulis.";

/** Les mêmes textes, par méthode (Guide). */
export const QUAND_METHODE = { dosage_cw: QUAND_DOSAGE_CW, wb: QUAND_WB, slump: QUAND_SLUMP, essai: QUAND_ESSAI, rrc: QUAND_RRC } as const;

export const METHOD_REGISTRY: MethodDescriptor[] = [
  // ── RPC ──
  {
    category: "RPC", method: "dosage_cw",
    labels: { long: "Dosage selon Cw", court: "Selon Cw", fichier: "dosage-Cw", telephone: "Cw" },
    description: "Pourcentage solide massique fixé",
    quand: QUAND_DOSAGE_CW,
    endpoint: "/rpc/cw", stateKey: "cw", resultKey: "cwResult",
  },
  {
    category: "RPC", method: "wb",
    labels: { long: "Dosage selon E/L", court: "Selon E/L", fichier: "dosage-EL", telephone: "E/L" },
    description: "Rapport eau/liant fixé",
    quand: QUAND_WB,
    endpoint: "/rpc/wb", stateKey: "wb", resultKey: "wbResult",
  },
  {
    category: "RPC", method: "slump",
    labels: { long: "Modèle prédictif (affaissement)", court: "Modèle prédictif", fichier: "modele-predictif", telephone: "Prédictif" },
    description: "Cw prédit à partir de l'affaissement visé",
    quand: QUAND_SLUMP,
    endpoint: "/rpc/slump", stateKey: "slump", resultKey: "slumpResult",
  },
  {
    category: "RPC", method: "essai",
    labels: { long: "Méthode essai-erreur", court: "Essai-erreur", fichier: "essai-erreur", telephone: "Essai" },
    description: "Ajouts réels après mesure de l'affaissement",
    quand: QUAND_ESSAI,
    endpoint: "/rpc/essai", stateKey: "essai", resultKey: "essaiResult",
  },
  // ── RPG (pas de modèle prédictif : il est calé sur le RPC) ──
  {
    category: "RPG", method: "dosage_cw",
    labels: { long: "Dosage selon Cw", court: "Selon Cw", fichier: "dosage-Cw", telephone: "Cw" },
    description: "Pourcentage solide massique fixé",
    quand: QUAND_DOSAGE_CW,
    endpoint: "/rpg/cw", stateKey: "rpgCw", resultKey: "rpgCwResult",
  },
  {
    category: "RPG", method: "wb",
    labels: { long: "Dosage selon E/L", court: "Selon E/L", fichier: "dosage-EL", telephone: "E/L" },
    description: "Rapport eau/liant fixé",
    quand: QUAND_WB,
    endpoint: "/rpg/wb", stateKey: "rpgWb", resultKey: "rpgWbResult",
  },
  {
    category: "RPG", method: "essai",
    labels: { long: "Méthode essai-erreur", court: "Essai-erreur", fichier: "essai-erreur", telephone: "Essai" },
    description: "Ajouts réels après mesure de l'affaissement",
    quand: QUAND_ESSAI,
    endpoint: "/rpg/essai", stateKey: "rpgEssai", resultKey: "rpgEssaiResult",
  },
  // ── RRC ──
  {
    category: "RRC", method: "rrc",
    labels: { long: "Dosage selon Bw et E/L du coulis", court: "Bw et E/L du coulis", fichier: "RRC", telephone: "RRC" },
    description: T.rrc.long,
    quand: QUAND_RRC,
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
  forme: "long" | "court" | "fichier" = "court",
): string {
  return descriptorFor(category, method)?.labels[forme] ?? method;
}

/**
 * Méthode à garder quand on change de catégorie : la méthode courante si la
 * nouvelle catégorie la propose, sinon le dosage selon Cw (ex. modèle
 * prédictif -> RPG). RRC n'a pas de liste (formulaire unique) : la méthode est
 * gardée, pour qu'un aller-retour RPC -> RRC -> RPC retrouve la méthode et ses
 * résultats.
 */
export function methodeApresChangementCategorie(categorie: Category, methode: RpcMethod): RpcMethod {
  const methodes = methodsFor(categorie);
  if (methodes.length === 0) return methode;
  return methodes.some((d) => d.method === methode) ? methode : "dosage_cw";
}
