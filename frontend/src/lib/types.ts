// Types partagés du résultat de calcul — DÉRIVÉS des modèles Pydantic du
// backend via l'OpenAPI (src/lib/api-types.gen.ts, régénéré par `pnpm gen:api`
// contre le backend en marche). Recipe/RecipeComponents/RrcRecipe ne sont plus
// un miroir manuel : un renommage de champ côté backend fait disparaître le
// champ du type source, ce qui casse le typecheck des consommateurs
// (ResultsPanel, exports PDF/Excel, FormulaPopover, Historique) au lieu de lire
// `undefined` en silence.
//
// Laxité conservée par `Lax<>` : chaque champ devient optionnel ET nullable
// (récursivement pour les objets imbriqués comme MixState.components), parce
// que les résultats sauvegardés dans localStorage avant l'ajout d'un champ
// n'ont pas ce champ. C'est la seule différence avec les modèles backend
// (stricts, non-null).

import type { components } from "./api-types.gen";

type Schemas = components["schemas"];

/** Rend T entièrement optionnel + nullable, en profondeur pour les objets. */
type Lax<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends object
    ? Lax<NonNullable<T[K]>> | null
    : T[K] | null;
};

export type RecipeComponents = Lax<Schemas["MixComponentMass"]>;
export type Recipe = Lax<Schemas["MixState"]>;

export interface MixResult {
  category?: string;
  method?: string;
  general?: Record<string, unknown>;
  recipes: Recipe[];
}

// ── RRC / CRF (remblai rocheux cimenté) — dérivé de RrcRecipeState ──

export type RrcRecipe = Lax<Schemas["RrcRecipeState"]>;

export interface RrcResultat {
  category?: string;
  general?: Record<string, unknown>;
  recipes: RrcRecipe[];
}

/** Accès numérique sûr : null si absent/NaN. */
export const champ = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : v;
