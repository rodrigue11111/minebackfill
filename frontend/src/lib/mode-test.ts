// ============================================================================
//  MODE TEST SANS COMPTE — TEMPORAIRE (phase d'évaluation par le professeur).
//
//  `true`  : aucune connexion requise. Tout le monde arrive directement dans la
//            vue ENSEIGNANT (édition locale des catalogues officiels + réglages).
//            La couche cloud Supabase (comptes, rôles, synchronisation,
//            publication en ligne) est DÉSACTIVÉE — l'application tourne 100 %
//            en local, exactement comme si les variables Supabase étaient
//            absentes. La PUBLICATION en ligne reste indisponible (elle exige un
//            vrai compte prof), ce qui est cohérent avec « pas de compte ».
//  `false` : comportement normal — comptes + rôles + synchronisation en ligne.
//
//  >>> REMETTRE À `false` À LA FIN DU PROJET <<<  (une seule ligne à changer,
//  ici et dans portail/src/lib/mode-test.ts). Voir docs/MAINTENANCE.md,
//  recette « Réactiver les comptes ».
// ============================================================================
export const MODE_TEST_SANS_COMPTE = true;
