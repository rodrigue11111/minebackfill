// ============================================================================
//  MODE TEST SANS COMPTE — TEMPORAIRE (phase d'évaluation).
//
//  `true`  : le portail est en accès libre (aucune connexion) et la couche
//            Supabase est désactivée. Doit rester COHÉRENT avec
//            frontend/src/lib/mode-test.ts (le même interrupteur pour les deux
//            applications).
//  `false` : comportement normal (connexion requise si les variables Supabase
//            sont présentes).
//
//  >>> REMETTRE À `false` À LA FIN DU PROJET <<<  (ici ET dans
//  frontend/src/lib/mode-test.ts). Voir docs/MAINTENANCE.md.
// ============================================================================
export const MODE_TEST_SANS_COMPTE = true;
