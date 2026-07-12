# Historique du chantier d'extensibilité (P0 → P5)

Distillation, pour le dépôt, de l'historique de conception 2026-07. Chaque
phase = une branche, un commit par item, CI verte avant merge. Ce document
explique le POURQUOI des structures en place — à lire avant de les remettre en
cause.

Origine : demande du professeur — « penser au futur : les gens doivent pouvoir
ajouter ou modifier des choses ». Analyse multi-agents du dépôt → plan P0-P5
approuvé, puis exécuté et REVU adversarialement (deux campagnes de revue, 15
constats confirmés au total, tous corrigés avec tests de régression).

## P0 — Persistance et pertes de données (merge `0ced477`)
- Bug d'écrasement d'historique corrigé (`saveCurrentResult` relit le stockage
  et déduplique par id — ne JAMAIS repartir de l'état mémoire seul).
- `catalogue_liants`, `constantes`, `general` enfin persistés — module
  versionné `persisted.ts` (enveloppe `{v, data}`), hydratation globale
  `StoreHydrator` (montage) + synchronisation multi-onglets (événement
  `storage`).
- Chaque résultat sauvegardé emporte un INSTANTANÉ de son contexte
  (catalogue + constantes) : reproductibilité exacte au rechargement.
- RRC sauvegardable (`SavedMethod = RpcMethod | "rrc"`).

## P1 — Fiabilité scientifique (merge `d89631d`)
- Backend : rejet explicite de ce que le solveur ignorerait silencieusement
  (à l'époque >3 liants) ; RPG valide comme RPC ; gardes sr/slump/Cw > 0.
- Page Formules corrigée + test d'invariants (l'écran ne peut plus diverger
  des formules réelles).
- Hygiène : accents, zéro emoji, mojibake backend corrigé.

## P2 — Bibliothèque de matériaux (merges `f6ab783`, `368341f`)
- `materials.ts` : résidus/granulats/retardateurs avec id STABLES et
  `origine: officiel|perso` — le verrou des officiels vit dans le STORE, pas
  seulement dans l'UI.
- Préréglages dans tous les formulaires ; l'id du matériau choisi est
  snapshoté dans le résultat SEULEMENT si les valeurs correspondent encore
  (traçabilité honnête).
- Import/export CSV+JSON ; import re-clé en collision avec un officiel.
- Prix des liants par id (repli code pour les anciennes sauvegardes).

## Revue P0-P2 (merge `dd53918`) puis identité des liants (merge `a1801a4`)
4 bugs confirmés corrigés (verrou d'import contourné, résolution des prix pas
vraiment id-d'abord, suppression croisée de prix, écrasement des prix démo).
Puis migration de l'IDENTITÉ des liants du code vers l'id : `binderN_id`
source de vérité, le code n'est plus qu'affichage/repli — deux liants peuvent
porter le même code sans se voler leur Gs.

## P3 — Architecture frontend (merge `957244b`)
- `method-registry.ts` : le registre UNIQUE des 8 méthodes (86 branchements
  catégorie/méthode éparpillés supprimés). Ajouter une méthode = 1 entrée.
- `report-schema.ts` : les 52 lignes du rapport définies UNE fois —
  écran = Excel = PDF (avant : 3 copies divergentes). RRC inclus (15 lignes).
- Dédoublonnage : `recipe-theme.ts`, `branding.ts`, `format.ts`.
- Types `Recipe`/`RrcRecipe` GÉNÉRÉS depuis l'OpenAPI (`pnpm gen:api`) — un
  champ backend renommé casse le typecheck au lieu de lire `undefined`.

## N liants (merge `55e366a`)
Déplafonnement 3 → 8 composants. Backend N-aire (Gs harmonique, splits en
boucles, listes `binder_masses_kg[]` ADDITIVES aux champs c1..c3) ; frontend
`general.binders[]` source de vérité avec miroir legacy maintenu par
`patchBinders`. Tests d'or ≤3 inchangés au bit près.

## P4 — Packs de conventions + oracle « gramme » (merge `abffa75`)
- Décision structurante : le payload porte des DRAPEAUX explicites, le
  « pack » n'est qu'un preset UI (reproductibilité).
- Feuille « gramme » (Belem 2016) extraite et documentée (`Issues.md` #4) :
  base identique à Intra 2017, seule divergence D65 — le liant ajouté en
  essai suit le RÉSIDU ajouté seul (drapeau `essai_binder_rule`).
- Second oracle `excel_twin_gramme.py` (auto-validation exacte) + golden
  discriminants (au moins un scénario où les deux règles DIVERGENT).
- `SolverConstants` = source unique des défauts (`model_dump()`).

## P5 — Supabase multi-utilisateur optionnel (merge `5e8223f`)
- supabase-js direct depuis le frontend, sécurité = RLS Postgres ; le backend
  FastAPI n'a PAS changé d'un octet.
- Sans variables d'env : application strictement identique (CI le prouve à
  chaque build). Comptes (prof/étudiant), catalogues officiels publiés,
  résultats en double écriture local-first.
- Pièges traités : récursion RLS (`is_prof()` security definer), upsert =
  politiques insert ET update, anti-mismatch d'hydratation (`use-hydrated.ts`),
  pause du gratuit à ~7 jours (voir `supabase-keepalive.yml`).

## Revue P3-P5 (merge `132c9e7`)
11 constats confirmés, dont : coûts industrie limités aux 3 premiers liants ;
la synchro écrasait les modifications officielles NON publiées du prof ;
badge « anciennes formules » sur les résultats gramme/personnalisés ; les
cellules de densité D91-D96 EXISTENT dans la feuille gramme (l'analyse
initiale les avait ratées — d'où la règle « contre-vérifier toute affirmation
d'absence » de `docs/MAINTENANCE.md`) → densités d'essai au Bw ATTEINT (D95),
exclusion de test supprimée ; anti-réattribution des résultats (`ownerId`).

## Ce que ça implique pour la suite
- Les golden tests + oracles sont le filet : toute évolution des formules
  passe par eux (recette 6 de `docs/MAINTENANCE.md`).
- Les migrations localStorage sont indépendantes par clé — versionner la clé
  touchée, jamais « tout casser ».
- Les décisions ci-dessus ont chacune une raison documentée ; les inverser
  demande de comprendre la raison (reproductibilité, local-first, additivité).
