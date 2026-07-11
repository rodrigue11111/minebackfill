// frontend/src/lib/use-hydrated.ts
import { useSyncExternalStore } from "react";

const souscrire = () => () => {}; // aucun changement après montage

/**
 * Renvoie `false` pendant le rendu serveur et la première passe d'hydratation,
 * puis `true`. Permet de rendre un contenu client-only sans mismatch
 * d'hydratation, SANS setState dans un effet (idiomatique React 18+).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(souscrire, () => true, () => false);
}
