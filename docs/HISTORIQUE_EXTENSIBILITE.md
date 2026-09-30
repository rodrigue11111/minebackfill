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

## Synchronisation v2 — le travail des étudiants en ligne (2026-09)
Demande : que chaque étudiant retrouve TOUT son travail (résultats ET gâchées)
d'un appareil à l'autre et d'une année à l'autre, et que l'enseignant puisse
le lire et l'annoter. La v1 (`saved_results`) n'a PAS été généralisée : elle
aurait propagé aux gâchées des défauts qui perdent du travail.
- Une erreur de lecture était prise pour un cloud VIDE ; aucun retour
  d'écriture n'était lu (refus et pannes invisibles).
- Sans trace de suppression, un appareil annulait la suppression faite sur
  l'autre en re-poussant sa copie.
- Clé primaire GLOBALE sur des ids clients faibles (`sr_<ms>_<4 car.>`).
- Chez l'enseignant, toute la classe était versée dans SON stockage local,
  tronquée à 1 000 lignes.

Décisions v2 (`supabase/schema.sql`), chacune pour une raison :
- `user_docs`, clé (utilisateur, type, id) : plus de collision entre comptes.
- Révision attribuée par le SERVEUR (trigger) et écriture conditionnelle
  (`ecrire_doc` : « j'écris par-dessus la révision que j'ai vue ») : deux
  appareils ne s'écrasent plus en silence ; un conflit garde les deux copies.
- Suppression = contenu effacé + trace `deleted` jamais purgée : supprimer
  supprime vraiment, et les autres appareils l'apprennent.
- Lecture par curseur rendu tel quel, avec recul de 120 s : ni page relue sans
  fin, ni écriture tardive manquée.
- `on delete restrict` : supprimer un compte n'emporte pas son travail par
  accident.
- `saved_results` repris une fois puis gelé en lecture seule.

## Tableau de bord de l'enseignant (2026-10)
Demande : donner à l'enseignant les outils du quotidien — ouvrir le travail
d'un étudiant en entier, comparer, exporter, repérer les problèmes, planifier
la presse, dialoguer, gérer les comptes, archiver la session. Décisions :
- **Une règle de comptage** (`essaiValide`, `lib/classe.ts`) pour tout le
  tableau de bord : éprouvette écrasée, mesurée, non exclue — ce que
  `agregerParAge` retient. Copies de conflit exclues partout : elles gardent
  les éprouvettes de l'original (mêmes ids) et doubleraient les essais.
- **Comparaison « même formulation »** = même catégorie, Cw et Bw arrondis au
  demi-point (décision de l'enseignant). Une ligne par gâchée, jamais de
  moyenne entre gâchées (même raison que `ucs-formulation.ts` : lots,
  opérateurs, protocoles différents). La médiane n'est qu'un repère de
  dispersion, à partir de 3 gâchées (avec 2, ce serait leur moyenne), jamais
  tracée ni imprimée : un rapport circule, une médiane y serait citée comme
  « l'UCS de la formulation ».
- **Alertes** : heuristiques de contrôle qualité, pas des formules du cours ;
  seuils dans UNE constante (`SEUILS_ALERTES`), affichés comme valeurs par
  défaut à valider par l'enseignant.
- **Réponses de l'étudiant par une fonction** (`repondre_annotation`, security
  definer), pas par une politique INSERT : une politique sur `annotations`
  qui interroge `annotations` fait échouer TOUTE insertion (« infinite
  recursion detected in policy », 42P17), commentaires de l'enseignant
  compris, parce que la politique SELECT contient des sous-requêtes
  `(select auth.uid())`. Vérifié sur le vrai schéma dans PGlite.
- **Accusés de lecture** (`lu_le`) posés seulement par le destinataire, via
  `marquer_annotations_lues` ; les droits UPDATE sur `annotations` sont
  limités aux colonnes `texte` et `deleted`. `lire_annotations` est gardée
  (sites en cache) mais ne rend plus les réponses : un ancien site les
  prendrait pour des commentaires de l'enseignant. Le nouveau lit
  `lire_fil_annotations`. Le fil suit la date de CRÉATION (`maj` bouge quand
  un message est lu).
- **Comptes** : le rôle change par `definir_role` (enseignant seulement,
  jamais le sien : il reste toujours un enseignant ; verrou consultatif
  commun avec le blocage, appelant revérifié après le verrou). Le blocage est
  le « ban » de Supabase (`auth.users.banned_until`, 876000 h comme l'API
  d'administration — jamais `'infinity'`, illisible pour le serveur
  d'authentification) : un compte bloqué dans Studio apparaît bloqué dans
  l'application, et inversement. La suppression définitive reste une
  procédure SQL : irréversible, elle n'a pas de bouton. Aucune clé
  service_role n'est introduite.
- **Compatibilité dans les deux sens** : le SQL est additif (l'ancien site
  marche avec la nouvelle base) ; le nouveau site tolère une base pas à jour
  (lecture `select("*")`, repli sur l'ancienne fonction, message « exécutez
  supabase/schema.sql »).

## Refonte épurée et vocabulaire du domaine (2026-09-30)
Demande : une interface « à la Apple », épurée, choisie sur un canevas de
maquettes (Calculs : la version « A » d'origine ; le reste : « A améliorée »,
avec une mise en page téléphone ; le portail dans le même style), et partout
les termes scientifiques des remblais en pâte cimentés et de l'industrie, avec
les vrais noms des essais normalisés. Décisions :
- **Jetons et kit plutôt que retouche page par page.** L'interface comptait
  1 562 styles en ligne et 1 310 couleurs codées en dur, pour 5 classes
  globales. Les anciens noms de variables (`--primary`, `--navy`…) pointent
  vers les nouveaux jetons : tout ce qui les utilisait a changé d'un coup ; les
  pages ont ensuite été reprises avec le kit `components/ui/`. Les règles CSS
  transitoires qui visaient des styles en ligne (`div[style*=…]`) ont été
  retirées à la fin : elles cassaient à la moindre retouche d'un style.
- **Un seul défilement par page.** Calculs avait trois conteneurs défilants
  et une poignée de redimensionnement ; ils sont supprimés. Un seul
  défilement garde les ancres, la recherche du navigateur et le téléphone
  prévisibles.
- **Composants du kit sans hook** quand c'est possible : le Guide est un
  composant serveur et doit pouvoir les employer.
- **Pas de hook de largeur d'écran.** La vue téléphone (barre d'onglets,
  sections du Labo, libellés courts) se décide en CSS : même rendu serveur
  et client, et aucun `setState` dans un effet (lint du React Compiler).
  Même raison pour `Menu` (API Popover) et `Feuille` (`<dialog>`) : le
  navigateur gère l'ouverture, Échap et le focus.
- **Les figures SVG gardent leurs couleurs en ligne.** L'export PNG
  sérialise le SVG seul ; une variable CSS y deviendrait noire.
- **Écran court, exports complets.** La carte Résultats n'affiche qu'un
  résumé (drapeau `resume` dans `report-schema.ts`) et renvoie au rapport
  complet ; les exports Excel et PDF ignorent ce drapeau : leur contenu ne
  change pas, un fichier exporté reste complet.
- **Vocabulaire : une source, sourcée, gardée.** `lib/glossaire.ts` porte les
  libellés (`T`), le glossaire (chaque entrée cite le cours, un classeur ou le
  programme) et les normes. Corrections de fond : la méthode « Ajustement
  pour slump » est le « Modèle prédictif » du professeur ; Bw est rapporté à
  la masse sèche de résidu (et de granulat), pas au mélange ; Gs est une
  densité relative sans unité ; « masse volumique » pour ρ. Un test
  (`terminologie.test.ts`) échoue si un libellé retiré revient. Les symboles
  du catalogue de formules ne bougent pas : la fenêtre « fx » les relie aux
  valeurs par `SYMBOL_TO_RECIPE`.
- **Normes citées, mais à confirmer.** Le cours ne cite aucune norme d'essai.
  Celles retenues (ASTM C39/C39M pour l'UCS, décision de l'utilisateur ;
  C143/C143M, C192/C192M, D2216, D854, C188, CSA A3001…) sont les normes
  usuelles nord-américaines ; le glossaire et le Guide disent qu'elles
  attendent la validation du professeur.
- **Catalogue des liants v3 : renommer sans écraser.** Les noms par défaut
  deviennent « Ciment Portland GU (anc. type 10) », etc. La migration ne
  renomme qu'un nom resté identique à celui d'origine : un nom choisi par
  l'enseignant est gardé. Ids, codes et Gs inchangés ; les anciens résultats
  gardent les noms figés dans leur instantané.
- **Texte des PDF par une seule fonction.** `pourPdf` (`lib/texte-pdf.ts`)
  translittère les lettres grecques et remplace les signes hors WinAnsi ; il
  s'applique à tous les PDF. Cela a corrigé un défaut existant : un « − »
  illisible dans la feuille labo.
- **Réponse de l'étudiant sous la note de l'enseignant** : nouvelle fonction
  SQL `repondre_annotation_ancree`, AJOUTÉE à côté de `repondre_annotation`
  (même patron de compatibilité que le tableau de bord : l'ancien site marche
  avec la nouvelle base ; le nouveau site, sur une base pas à jour, répond
  dans le fil général).
- **Portail : copie des jetons.** Le portail est une application séparée
  (build et déploiement propres) ; un paquet partagé aurait coûté plus qu'une
  copie de 30 lignes, signalée « GARDER EN PHASE ».
- **Accessibilité des libellés courts.** Sous 720 px, un contrôle segmenté
  affiche un libellé court ; le long reste lu par les lecteurs d'écran
  (masqué visuellement, pas `display: none`), sinon le bouton n'a plus de nom.
- **Hors périmètre, signalé** : `/industrie` (non liée) n'a pas été refaite.

## Ce que ça implique pour la suite
- Les golden tests + oracles sont le filet : toute évolution des formules
  passe par eux (recette 6 de `docs/MAINTENANCE.md`).
- Les migrations localStorage sont indépendantes par clé — versionner la clé
  touchée, jamais « tout casser ».
- Les décisions ci-dessus ont chacune une raison documentée ; les inverser
  demande de comprendre la raison (reproductibilité, local-first, additivité).
