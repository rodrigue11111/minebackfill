// frontend/src/lib/recipe-theme.ts
// Couleurs d'accent des recettes (jusqu'à 4). Une seule définition, au lieu de
// 8 copies inline du même tableau dans les formulaires + une variante ARGB
// (sans « # », majuscules) pour l'export Excel.

/** Couleurs CSS des recettes 1..4 (bordure gauche des champs, badges). */
export const RECIPE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626"] as const;

/** Même palette au format ARGB d'ExcelJS (sans « # », majuscules). Dérivée. */
export const RECIPE_HEX = RECIPE_COLORS.map((c) => c.slice(1).toUpperCase());
