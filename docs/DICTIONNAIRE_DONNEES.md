# Dictionnaire des données : jeu d'essais MineBackfill

Version du dictionnaire : 1

Ce document décrit le **jeu d'essais** que l'enseignant exporte depuis la page
**Classe** (menu « Exporter », rubrique « Jeu d'essais »). Il est destiné à
qui réutilise les essais de remblai en pâte cimenté : recherche, modèles de
prédiction, comparaison entre sessions.

La source de vérité est le code (`frontend/src/lib/jeu-essais.ts`, tableaux
`COLONNES_ESSAIS`, `COLONNES_GACHEES`, `COLONNES_MATERIAUX`). Un test
(`jeu-essais.test.ts`) vérifie que chaque colonne y figure aussi dans ce
document : ajouter une colonne sans la décrire ici fait échouer les tests.

## Ce que contient un export

| Fichier | Contenu |
|---|---|
| Jeu d'essais (JSON) | `manifeste`, `dictionnaire`, puis les trois tables `essais`, `gachees`, `materiaux` |
| Jeu d'essais (CSV) | la table `essais` seule, une ligne par éprouvette |
| Jeu d'essais, gâchées acceptées (JSON ou CSV) | les mêmes fichiers, limités aux gâchées acceptées par l'enseignant et non modifiées depuis sa décision |
| Dictionnaire des données (CSV) | ce dictionnaire : table, clé, libellé, unité, type, description |

L'export porte sur la session choisie dans le filtre de la page Classe
(« Toutes » pour l'historique complet). Les noms de fichier sont datés :
`MineBackfill_jeu-essais_<session>_<AAAA-MM-JJ>`.

Conventions :

- **CSV** : séparateur « ; », virgule décimale (Excel en français), dates
  `AAAA-MM-JJ`, booléens « oui » / « non ». Une cellule vide veut dire
  « non renseigné » ; ce n'est jamais un zéro. Une cellule de texte qui
  commencerait par « = », « + », « - » ou « @ » est précédée d'une apostrophe,
  pour qu'un tableur ne l'exécute pas comme une formule.
- **JSON** : nombres en notation JSON (point décimal), booléens `true` /
  `false`, valeurs absentes `null`.
- Les clés sont en minuscules sans accent, avec l'unité en suffixe
  (`_pct`, `_mm`, `_kpa`, `_j`, `_c`, `_min`, `_g`, `_kn`).

## Pseudonymisation

Aucun nom ni courriel. La colonne `operateur` contient un pseudonyme stable :
« op- » suivi des 12 premiers caractères hexadécimaux du SHA-256 de
l'identifiant du compte (`frontend/src/lib/pseudonyme.ts`). Le même étudiant
garde le même pseudonyme d'un export à l'autre, ce qui permet de suivre un
opérateur sans le nommer.

C'est une **pseudonymisation**, pas une anonymisation : qui détient la liste
des comptes (l'enseignant) peut refaire la correspondance. Les lignes sont
rangées dans l'ordre des pseudonymes, jamais dans l'ordre alphabétique des
noms.

Champs **retirés** de l'export, parce qu'ils nomment souvent quelqu'un : nom
et courriel de l'étudiant, libellé de la formulation, observations de la
gâchée, opérateur, nom de fichier et commentaires de la presse, nom de
l'opérateur de la formulation.

Champs **conservés en texte libre** (type « texte libre » ci-dessous), utiles
à l'analyse mais saisis par les étudiants : à relire avant toute diffusion
publique. Le manifeste en donne la liste (`textes_libres`).

## Règles de lecture

- **Une ligne de `essais` = une éprouvette.** Les conditions de la gâchée
  (formulation, matériaux, cure) sont répétées sur chaque ligne, pour qu'une
  ligne se suffise à elle-même.
- **Valeurs visées et valeurs mesurées.** `cw_pct`, `el_ratio`, `bw_pct` et
  `w_pct` sont celles de la recette calculée ; `w0_mesure_pct`,
  `cw_mesure_pct`, `w_mesure_pct` et `affaissement_mm` sont mesurées au
  laboratoire. `residu_gs` et `residu_w0_pct` sont les valeurs entrées dans le
  calcul.
- **UCS.** `ucs_kpa` est la contrainte que retient l'application : la
  contrainte directe (presse ou saisie) si elle existe, sinon F / A.
  `ucs_source` dit laquelle. La presse calcule avec un diamètre de 76,20 mm ;
  si `diametre_mm` en diffère, comparer avec `charge_kn` / (π·d²/4).
- **Essais retenus.** `retenu` reprend la règle de l'application (écrasée,
  mesure exploitable, non exclue). Les moyennes de l'application sont faites
  par gâchée et par âge visé (`age_cible_j`), jamais entre gâchées.
- **Copies de conflit exclues.** Une gâchée modifiée sur deux appareils à la
  fois est gardée en double chez l'étudiant ; seule l'originale est exportée.
- **Matériaux.** `materiaux_source` dit d'où viennent les colonnes de
  matériaux : la fiche d'essai de la gâchée, ou, pour une gâchée antérieure à
  la fiche, sa formulation d'origine. La table `materiaux` décrit chaque
  matériau une fois ; elle se joint à `essais` par `residu_ref`,
  `granulat_ref` ou `liant1_code`, `liant2_code`, `liant3_code` (colonne
  `ref`, avec `type`).
- **Revue de l'enseignant.** Quand l'étudiant marque une gâchée terminée,
  l'enseignant l'accepte ou la refuse (avec un motif) et peut écarter des
  éprouvettes, sans modifier la gâchée. `revue`, `revue_perimee` et
  `eprouvette_ecartee` en rendent compte ; `retenu` reste la règle de
  l'application (l'étudiant a pu exclure une valeur lui-même, colonne
  `exclu`). Pour un jeu « propre », prendre l'export « gâchées acceptées » et
  garder les lignes où `retenu` vaut oui et `eprouvette_ecartee` vaut non.
- **Caractérisation.** La granulométrie, la chimie et la minéralogie d'un
  résidu ou d'un granulat sont saisies une seule fois, dans le catalogue de
  l'enseignant (Réglages). Elles sont lues au moment de l'export : colonnes
  `residu_d10_um` à `residu_muscovite_pct` de la table `essais`, et toutes les
  colonnes de caractérisation de la table `materiaux`. Un matériau personnel
  d'un étudiant, absent du catalogue, n'en a pas.

## Table essais

| Clé | Libellé | Unité | Type | Description |
|---|---|---|---|---|
| `operateur` | Opérateur (pseudonyme) |  | texte | Pseudonyme stable du compte étudiant (voir le manifeste). Le même étudiant garde le même pseudonyme d'un export à l'autre. |
| `session` | Session |  | texte | Session de cours de la gâchée : celle déclarée à la création, sinon celle qui contient sa date. |
| `gachee_code` | Gâchée |  | texte | Code de la gâchée (G-AAAAMMJJ-NN), unique chez un même opérateur. |
| `gachee_date` | Date de gâchée |  | date | Jour de création de la gâchée (AAAA-MM-JJ). |
| `gachee_statut` | Statut de la gâchée |  | code | brouillon : en cours de saisie ; terminee : déclarée terminée par l'étudiant. |
| `categorie` | Catégorie de remblai |  | code | RPC : remblai en pâte cimenté ; RPG : remblai en pâte avec granulat ; RRC : remblai rocheux cimenté. |
| `formulation_ref` | Formulation (référence) |  | texte | Identifiant aléatoire de la formulation d'origine chez l'opérateur : regroupe les gâchées d'une même formulation. Vide si la gâchée n'en a pas. |
| `recette` | Recette |  | entier | Numéro de la recette dans la formulation (1, 2, …). |
| `solveur_version` | Version des formules |  | texte | Version des formules de l'application qui ont calculé la recette. |
| `cw_pct` | Pourcentage solide massique Cw visé | % | nombre | Cw de la recette calculée (instantané de la gâchée, sinon relu dans la formulation d'origine). |
| `el_ratio` | Rapport eau/liant E/L visé |  | nombre | Rapport massique eau/liant de la recette calculée. Sans unité. |
| `bw_pct` | Taux massique de liant Bw visé | % | nombre | Masse de liant / masse sèche de résidu (et de granulat en RPG), de la recette calculée. |
| `w_pct` | Teneur en eau w visée | % | nombre | Teneur en eau massique de la recette calculée. |
| `materiaux_source` | Origine des matériaux |  | code | fiche : matériaux de la fiche d'essai de la gâchée ; formulation : déduits de la formulation d'origine (gâchée antérieure à la fiche d'essai) ; vide : inconnus. |
| `residu_ref` | Résidu (référence) |  | texte | Identifiant du résidu dans le catalogue, sinon « instantane:residu:<nom> ». Jointure avec la table materiaux. |
| `residu_nom` | Résidu |  | texte libre | Nom du résidu, tel que saisi ou repris du catalogue. |
| `residu_gs` | Densité relative des grains Gs du résidu |  | nombre | Gs du résidu entré dans le calcul de la recette. Sans unité. |
| `residu_w0_pct` | Teneur en eau initiale w₀ du résidu (calcul) | % | nombre | w₀ du résidu entré dans le calcul de la recette (la valeur mesurée le jour de la gâchée est w0_mesure_pct). |
| `residu_d10_um` | D10 du résidu | µm | nombre | Diamètre sous lequel passent 10 % des grains (masse). Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_d50_um` | D50 du résidu | µm | nombre | Diamètre médian des grains (50 % passant). Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_d80_um` | D80 du résidu | µm | nombre | Diamètre sous lequel passent 80 % des grains. Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_d90_um` | D90 du résidu | µm | nombre | Diamètre sous lequel passent 90 % des grains. Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_p20_pct` | P20 (passant à 20 µm) du résidu | % | nombre | Part massique des grains plus fins que 20 µm. Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_soufre_pct` | Soufre du résidu | % | nombre | Teneur massique en soufre total. Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_phyllosilicates_pct` | Phyllosilicates du résidu | % | nombre | Teneur massique en phyllosilicates (argiles, micas…). Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `residu_muscovite_pct` | Muscovite du résidu | % | nombre | Teneur massique en muscovite. Lu dans le catalogue de l'enseignant au moment de l'export ; vide si le résidu n'y est pas ou si la valeur n'est pas renseignée. |
| `granulat_ref` | Granulat (référence) |  | texte | Identifiant du granulat dans le catalogue, sinon « instantane:granulat:<nom> ». RPG seulement. |
| `granulat_nom` | Granulat |  | texte libre | Nom du granulat, tel que saisi. RPG seulement. |
| `granulat_gs` | Densité relative des grains Gs du granulat |  | nombre | Gs du granulat entré dans le calcul. Sans unité. RPG seulement. |
| `nb_liants` | Nombre de composants du liant |  | entier | Nombre de composants du liant (ciment, laitier, cendres…). Les trois premiers ont leurs colonnes ; tous figurent dans « liants ». |
| `liant1_code` | Liant, composant 1 |  | code | Code du composant 1 du liant dans le catalogue des liants (ex. CP10, SLAG). |
| `liant1_pct` | Proportion du composant 1 dans le liant | % | nombre | Part massique du composant 1 dans le liant. |
| `liant2_code` | Liant, composant 2 |  | code | Code du composant 2 du liant dans le catalogue des liants (ex. CP10, SLAG). |
| `liant2_pct` | Proportion du composant 2 dans le liant | % | nombre | Part massique du composant 2 dans le liant. |
| `liant3_code` | Liant, composant 3 |  | code | Code du composant 3 du liant dans le catalogue des liants (ex. CP10, SLAG). |
| `liant3_pct` | Proportion du composant 3 dans le liant | % | nombre | Part massique du composant 3 dans le liant. |
| `liants` | Composition du liant |  | texte | Tous les composants, « code proportion % » séparés par « + ». |
| `lot_residu` | Lot de résidu |  | texte libre | Lot du résidu employé, tel que saisi. |
| `lot_granulat` | Lot de granulat |  | texte libre | Lot du granulat employé, tel que saisi. |
| `lot_liant` | Lot de liant |  | texte libre | Lot du liant employé, tel que saisi. |
| `eau_type` | Eau de gâchage |  | code | robinet, procede (eau de procédé), distillee ou autre. |
| `adjuvant_nom` | Adjuvant |  | texte libre | Nom du produit adjuvant, s'il y en a un. |
| `adjuvant_dosage` | Dosage de l'adjuvant |  | nombre | Dosage de l'adjuvant, dans l'unité de adjuvant_unite. |
| `adjuvant_unite` | Unité du dosage de l'adjuvant |  | code | ml/100 kg, % liant ou autre. |
| `malaxage_min` | Durée de malaxage | min | nombre | Durée de malaxage de la pâte. |
| `w0_mesure_pct` | Teneur en eau w₀ mesurée | % | nombre | Humidité réelle du résidu, mesurée le jour de la gâchée. |
| `affaissement_mm` | Affaissement mesuré | mm | nombre | Affaissement au cône d'Abrams (ASTM C143/C143M). |
| `temperature_pate_c` | Température de la pâte | °C | nombre | Température de la pâte fraîche. |
| `w_mesure_pct` | Teneur en eau w mesurée | % | nombre | Teneur en eau de la pâte, mesurée. |
| `cw_mesure_pct` | Cw mesuré | % | nombre | Pourcentage solide massique de la pâte, mesuré. |
| `cure_mode` | Mode de cure |  | code | chambre_humide, immersion, ambiante (air ambiant), scellee (sac ou film) ou autre. |
| `cure_temperature_c` | Température de cure | °C | nombre | Température de la cure des éprouvettes. |
| `cure_humidite_pct` | Humidité relative de cure | % | nombre | Humidité relative pendant la cure. |
| `pesees_hors_tolerance` | Pesées hors tolérance |  | entier | Nombre de composants pesés hors de la tolérance de la gâchée. Vide si aucune pesée n'est enregistrée. |
| `completude_pct` | Complétude de la fiche d'essai | % | entier | Part des informations descriptives renseignées (lib/completude.ts). Rien n'est obligatoire pour l'étudiant : une valeur basse signale une gâchée moins documentée. |
| `revue` | Revue de l'enseignant |  | code | acceptee ou refusee : décision de l'enseignant sur la gâchée ; vide si elle n'a pas été revue. |
| `revue_perimee` | Modifiée depuis la revue |  | booléen | L'étudiant a modifié la gâchée après la décision de l'enseignant (la décision porte sur une version antérieure). Vide sans revue. |
| `eprouvette_code` | Éprouvette |  | texte | Code de l'éprouvette (code de la gâchée suivi de -ENN). |
| `coulee_le` | Coulée le |  | date | Jour du moulage de l'éprouvette. |
| `age_cible_j` | Âge de cure visé | j | entier | Âge de cure prévu à l'écrasement. Les moyennes de l'application sont faites par âge visé. |
| `statut` | Statut de l'éprouvette |  | code | en_cure ou ecrase. |
| `essai_le` | Date d'essai |  | date | Jour de l'écrasement. |
| `age_reel_j` | Temps de cure réel | j | nombre | Relevé par la presse s'il existe, sinon de la coulée au jour de l'essai. |
| `moule` | Moule |  | texte | Moule nominal (« Cylindre 50 × 100 mm ») ou texte libre. |
| `moule_diametre_mm` | Diamètre du moule | mm | nombre | Diamètre nominal du moule choisi parmi les moules proposés. Vide pour un moule saisi en texte libre. |
| `moule_hauteur_mm` | Hauteur du moule | mm | nombre | Hauteur nominale du moule. |
| `charge_kn` | Charge à la rupture | kN | nombre | Force maximale appliquée par la presse. |
| `diametre_mm` | Diamètre de l'éprouvette | mm | nombre | Diamètre retenu pour le calcul F / A (mesuré, ou prérempli depuis le moule). |
| `hauteur_mm` | Hauteur de l'éprouvette | mm | nombre | Hauteur de l'éprouvette (presse ou saisie). |
| `masse_g` | Masse de l'éprouvette | g | nombre | Masse de l'éprouvette (presse ou pesée). |
| `ucs_kpa` | Résistance en compression uniaxiale (UCS) | kPa | nombre | Contrainte retenue par l'application (ASTM C39/C39M) : la contrainte directe (presse ou saisie) si elle existe, sinon F / A avec A = π·d²/4. |
| `ucs_source` | Origine de l'UCS |  | code | presse : contrainte importée du fichier de la presse ; saisie : contrainte saisie directement ; calcul_fa : déduite de la charge et du diamètre ; vide : pas de mesure. |
| `retenu` | Essai retenu |  | booléen | L'essai entre dans les moyennes de l'application : éprouvette écrasée, mesure exploitable, non exclue (règle essaiValide). |
| `exclu` | Exclu par l'étudiant |  | booléen | L'étudiant a écarté cette valeur de la moyenne (valeur aberrante). |
| `exclusion_motif` | Motif de l'exclusion |  | texte libre | Justification de l'exclusion, telle que saisie. |
| `rupture_code` | Type de rupture |  | code | D'après ASTM C39/C39M : cone (cônes aux deux extrémités), cone_fendage (cône et fendage), colonnaire (fissures verticales), diagonale (cisaillement), extremites (rupture aux extrémités), autre. |
| `rupture_texte` | Rupture (texte libre) |  | texte libre | Précision libre du mode de rupture (« autre », ou saisie antérieure à la liste). |
| `module_young_kpa` | Module de Young | kPa | nombre | Donné par la presse. |
| `deformation_max_pct` | Déformation maximale | % | nombre | Donnée par la presse. |
| `deflexion_max_mm` | Déflexion maximale | mm | nombre | Donnée par la presse. |
| `vitesse_chargement` | Vitesse de chargement |  | nombre | Vitesse de chargement appliquée, dans l'unité de vitesse_unite (le fichier de la presse ne la donne pas). |
| `vitesse_unite` | Unité de la vitesse |  | code | mm/min, kN/s ou kPa/s. |
| `presse` | Presse |  | texte libre | Presse employée, telle que saisie. |
| `import_presse` | Importé de la presse |  | booléen | Les mesures viennent d'un fichier de presse importé (et non d'une saisie). |
| `courbe_en_ligne` | Courbe de presse en ligne |  | booléen | La courbe contrainte-déformation de l'éprouvette est sauvegardée en ligne (lisible par l'enseignant, et incluse dans l'export « Classe (JSON) »). Vide si l'information n'a pas pu être lue. |
| `eprouvette_ecartee` | Écartée par l'enseignant |  | booléen | L'enseignant a écarté cette éprouvette lors de sa revue (la gâchée de l'étudiant n'est pas modifiée). Vide sans revue. |

## Table gachees

Une ligne par gâchée. Elle reprend les colonnes de la gâchée de la table
`essais` (de `operateur` à `revue_perimee`), puis :

| Clé | Libellé | Unité | Type | Description |
|---|---|---|---|---|
| `nb_eprouvettes` | Éprouvettes |  | entier | Nombre d'éprouvettes moulées. |
| `nb_ecrasees` | Éprouvettes écrasées |  | entier | Nombre d'éprouvettes écrasées. |
| `nb_retenues` | Essais retenus |  | entier | Nombre d'essais retenus (voir la colonne retenu de la table essais). |

## Table materiaux

Une ligne par matériau employé dans le jeu. Un matériau du catalogue de
l'enseignant est décrit par le catalogue au moment de l'export ; un matériau
personnel d'un étudiant (que l'enseignant ne voit pas) est décrit par
l'instantané de la gâchée.

| Clé | Libellé | Unité | Type | Description |
|---|---|---|---|---|
| `type` | Type de matériau |  | code | residu, granulat ou liant. |
| `ref` | Référence |  | texte | Clé de jointure avec la table essais : residu_ref, granulat_ref, ou pour un liant son code (liant1_code, liant2_code…). |
| `source` | Source de la description |  | code | catalogue : décrit par le catalogue de l'enseignant au moment de l'export ; instantane : décrit par l'instantané de la gâchée (matériau personnel ou retiré du catalogue). |
| `nom` | Nom |  | texte libre | Nom du matériau. |
| `code` | Code |  | code | Code du liant (liants seulement). |
| `gs` | Densité relative des grains Gs |  | nombre | Sans unité. |
| `w0_pct` | Teneur en eau initiale w₀ | % | nombre | Résidus seulement. |
| `humidite_pct` | Humidité | % | nombre | Granulats seulement. |
| `provenance` | Provenance |  | texte libre | Provenance (mine, site) du matériau. |
| `date_echantillonnage` | Date d'échantillonnage |  | date | Jour du prélèvement du résidu caractérisé. Résidus seulement, depuis le catalogue. |
| `d10_um` | D10 | µm | nombre | Diamètre sous lequel passent 10 % des grains (masse). Résidus seulement, depuis le catalogue. |
| `d50_um` | D50 | µm | nombre | Diamètre médian des grains (50 % passant). Résidus seulement, depuis le catalogue. |
| `d80_um` | D80 | µm | nombre | Diamètre sous lequel passent 80 % des grains. Résidus seulement, depuis le catalogue. |
| `d90_um` | D90 | µm | nombre | Diamètre sous lequel passent 90 % des grains. Résidus seulement, depuis le catalogue. |
| `p20_pct` | P20 (passant à 20 µm) | % | nombre | Part massique des grains plus fins que 20 µm. Résidus seulement, depuis le catalogue. |
| `soufre_pct` | Soufre | % | nombre | Teneur massique en soufre total. Résidus seulement, depuis le catalogue. |
| `phyllosilicates_pct` | Phyllosilicates | % | nombre | Teneur massique en phyllosilicates (argiles, micas…). Résidus seulement, depuis le catalogue. |
| `muscovite_pct` | Muscovite | % | nombre | Teneur massique en muscovite. Résidus seulement, depuis le catalogue. |
| `mineralogie` | Minéralogie |  | texte libre | Description libre de la minéralogie (phases principales, méthode). Résidus seulement, depuis le catalogue. |
| `dmax_mm` | Dmax (granulat) | mm | nombre | Dimension maximale des grains du granulat. Granulats seulement, depuis le catalogue. |
| `d50_mm` | D50 (granulat) | mm | nombre | Diamètre médian des grains du granulat. Granulats seulement, depuis le catalogue. |
| `absorption_pct` | Absorption (granulat) | % | nombre | Absorption d'eau du granulat (masse). Granulats seulement, depuis le catalogue. |
| `nb_gachees` | Gâchées |  | entier | Nombre de gâchées du jeu qui emploient ce matériau. |

## Manifeste (JSON)

| Clé | Description |
|---|---|
| `application`, `type` | « MineBackfill », « jeu-essais » |
| `version` | version du format du fichier (`JEU_ESSAIS_VERSION`) |
| `dictionnaire_version` | version de ce dictionnaire (`DICTIONNAIRE_VERSION`) |
| `exporte_le` | date et heure de l'export (ISO 8601, UTC) |
| `session` | session exportée (« Toutes les sessions », « Sans session » ou son nom) |
| `selection` | toutes les gâchées, ou seulement celles acceptées par l'enseignant et non modifiées depuis |
| `nb_operateurs`, `nb_gachees`, `nb_eprouvettes`, `nb_essais_retenus`, `nb_materiaux` | comptes du jeu |
| `versions_solveur` | versions des formules présentes dans le jeu |
| `pseudonymisation` | la règle du pseudonyme |
| `champs_retires` | les champs exclus de l'export |
| `textes_libres` | les colonnes en texte libre, à relire avant diffusion publique |

## Accès direct (SQL)

Pour un accès sans passer par l'export : vues `vue_gachees` et `vue_essais`
dans Supabase, mêmes clés que ci-dessus quand elles existent, même pseudonyme,
mêmes règles d'UCS et d'essai retenu. Exemples et différences (dates en
horodatage, identifiants internes `gachee_ref` et `eprouvette_ref`, valeurs mal
typées rendues vides) : `supabase/README.md`, section « Accès direct aux
essais ».

## Faire évoluer le jeu

- **Ajouter une colonne** : une entrée dans `COLONNES_ESSAIS` (ou la table
  concernée) de `jeu-essais.ts`, avec libellé, unité, type et description,
  puis une ligne dans ce document. Une colonne s'ajoute de préférence à la fin
  de son groupe ; un script qui lit le CSV par nom de colonne n'est pas
  affecté.
- **Changer le sens d'une colonne** (unité, règle de calcul) : incrémenter
  `DICTIONNAIRE_VERSION` et la version en tête de ce document, et le dire dans
  la PR. Les jeux déjà exportés gardent leur numéro de version.
