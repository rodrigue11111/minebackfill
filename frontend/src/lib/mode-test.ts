// ============================================================================
//  MODE TEST SANS COMPTE — piloté par la variable d'environnement
//  NEXT_PUBLIC_MODE_TEST_SANS_COMPTE (lue au BUILD : un changement exige un
//  redéploiement). Même variable pour portail/src/lib/mode-test.ts.
//
//  actif (défaut, variable absente) : aucune connexion requise. Tout le monde
//            arrive directement dans la vue ENSEIGNANT (édition locale des
//            catalogues officiels + réglages). La couche cloud Supabase
//            (comptes, rôles, synchronisation, publication en ligne) est
//            DÉSACTIVÉE — l'application tourne 100 % en local, exactement comme
//            si les variables Supabase étaient absentes.
//  `false`  : comportement normal — comptes + rôles + synchronisation en ligne.
//
//  Pourquoi une variable plutôt qu'une constante : les aperçus Vercel peuvent
//  tester les comptes (contre un projet Supabase de préproduction) pendant que
//  la production reste en mode test, sans modifier le code. Voir
//  docs/MAINTENANCE.md, recette 9.
// ============================================================================

/**
 * Interprète la variable. Seul « false » (casse et espaces ignorés) désactive
 * le mode test : une faute de frappe laisse l'application dans l'état SÛR
 * (sans compte), jamais dans un état à moitié connecté.
 */
export function lireModeTest(valeur: string | undefined): boolean {
  return (valeur ?? "").trim().toLowerCase() !== "false";
}

// Référence LITTÉRALE à process.env.NEXT_PUBLIC_… : Next ne remplace au build
// que cette forme exacte (pas un accès dynamique process.env[nom]).
export const MODE_TEST_SANS_COMPTE = lireModeTest(process.env.NEXT_PUBLIC_MODE_TEST_SANS_COMPTE);
