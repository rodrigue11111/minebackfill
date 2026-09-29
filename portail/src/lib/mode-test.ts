// ============================================================================
//  MODE TEST SANS COMPTE — piloté par NEXT_PUBLIC_MODE_TEST_SANS_COMPTE, la
//  MÊME variable que frontend/src/lib/mode-test.ts (le même interrupteur pour
//  les deux applications : la régler dans les DEUX projets Vercel).
//
//  actif (défaut, variable absente) : le portail est en accès libre (aucune
//            connexion) et la couche Supabase est désactivée.
//  `false`  : comportement normal (connexion requise si les variables Supabase
//            sont présentes).
//
//  Lue au BUILD : un changement exige un redéploiement. Voir
//  docs/MAINTENANCE.md, recette 9.
// ============================================================================

/** Seul « false » désactive le mode test (une faute de frappe reste sûre). */
export function lireModeTest(valeur: string | undefined): boolean {
  return (valeur ?? "").trim().toLowerCase() !== "false";
}

export const MODE_TEST_SANS_COMPTE = lireModeTest(process.env.NEXT_PUBLIC_MODE_TEST_SANS_COMPTE);
