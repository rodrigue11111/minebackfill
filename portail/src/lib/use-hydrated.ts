import { useSyncExternalStore } from "react";

const souscrire = () => () => {}; // aucun changement après montage

/**
 * false pendant le rendu serveur et la première passe d'hydratation, puis
 * true. Permet un contenu client-only sans mismatch d'hydratation.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(souscrire, () => true, () => false);
}
