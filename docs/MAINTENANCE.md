# MAINTENANCE — livre de recettes du mainteneur

Ce document s'adresse au **prochain mainteneur** de MineBackfill : étudiant,
assistant de recherche, ou personne travaillant avec un assistant IA (le dépôt
est structuré pour ça — commencez toujours par faire lire
`CONTEXTE_PROJET_IA.md` à l'assistant, puis ce fichier).

## Démarrage rapide

```powershell
# Backend (Python 3.13)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --port 8000

# Frontend (Node 20+, pnpm)
cd frontend
pnpm install
pnpm dev
```

**Portes de qualité — à passer avant CHAQUE commit :**

```powershell
cd backend  ; .\.venv\Scripts\python.exe -m pytest app/tests -q   # tous verts
cd frontend ; pnpm typecheck ; pnpm lint ; pnpm test ; pnpm build # zéro erreur
cd portail  ; pnpm typecheck ; pnpm lint ; pnpm build             # si le portail change
```

La CI (`.github/workflows/ci.yml`) rejoue ces portes sans réseau : ne jamais y
introduire de dépendance à un service externe.

## Invariants NON NÉGOCIABLES

1. **Les oracles sont intouchables.** `backend/app/tests/excel_twin.py` et
   `excel_twin_gramme.py` sont des répliques exactes des classeurs du
   professeur, auto-validées contre des valeurs cachées épinglées (`CACHED`,
   tolérance 1e-9). On n'édite JAMAIS un twin pour faire passer un test — si
   un golden échoue, c'est le solveur qui a tort (ou le classeur a changé, et
   alors on ré-extrait et on documente dans `Issues.md`).
2. **Le payload API est autosuffisant.** Les conventions de calcul voyagent en
   drapeaux explicites (`essai_gs_convention`, `essai_binder_rule`) — jamais un
   nom de pack résolu côté serveur. Raison : un ancien résultat rejoué doit
   redonner les mêmes nombres même si la définition d'un pack évolue.
3. **Additif d'abord.** Tout changement de schéma préserve les anciens champs
   (ex. `binder_c1..3_mass_kg` maintenus à côté de `binder_masses_kg[]` ;
   `binder1_type/id/fraction` en miroir de `general.binders[]`). Le
   localStorage des étudiants contient des années de résultats : on ne casse
   pas leur lecture, on migre (`persisted.ts`, enveloppes `{v, data}`).
4. **Local-first.** Le localStorage est la vérité de l'UI ; le cloud
   (Supabase) est une couche optionnelle en écriture fire-and-forget. Aucune
   fonctionnalité ne doit exiger le réseau pour fonctionner.
5. **Conventions de forme.** UI et messages en français avec accents corrects,
   aucun emoji, aucun tiret cadratin ni demi-cadratin dans un texte affiché
   ou exporté (recette 13, règle 8), un commit par item, CI verte avant de
   merger.

## Recettes

### 1. Ajouter un liant ou un matériau officiel — 0 code
Réglages → carte concernée → « Ajouter » (en mode enseignant connecté, les
entrées créées sont « officielles ») → « Publier en ligne » pour diffuser à la
classe. Les entrées officielles publiées remplacent la couche officielle des
étudiants ; leurs entrées perso sont préservées.

### 2. Ajouter un champ à un type de matériau
- **Champ facultatif** (cas courant, ex. la caractérisation) : l'ajouter à
  l'interface dans `frontend/src/lib/materials.ts` et à la liste
  `CARACTERISATION_RESIDU` ou `CARACTERISATION_GRANULAT`. Cela suffit pour la
  carte de Réglages (partie repliée « Caractérisation »), l'import et l'export
  CSV/JSON (`materials-io.ts` en déduit ses colonnes, ajoutées à la fin ; une
  case vide reste absente, jamais 0 ; un nombre de caractérisation négatif et
  une date hors du format AAAA-MM-JJ sont refusés avec le numéro de ligne)
  et la table `materiaux` du jeu d'essais
  (à décrire dans `docs/DICTIONNAIRE_DONNEES.md`, le test l'exige). **Ne PAS
  incrémenter `MATERIALS_VERSION`** : `migrerMateriauxCloud` refuse un
  catalogue publié de version supérieure, si bien qu'un étudiant dont le site
  est encore en cache perdrait le catalogue officiel. Les clés inconnues
  survivent déjà au chargement et à la publication.
- **Champ obligatoire** (rare) : le champ dans l'interface + les défauts ;
  la carte (tableau `columns` du `MaterialCatalogueCard`) ; **incrémenter
  `MATERIALS_VERSION`** (store.tsx) et écrire la migration (valeur par défaut
  pour les anciennes données), voir `migrationCatalogueLiants` comme modèle ;
  `materials-io.ts` si le champ doit voyager en CSV/JSON.

### 3. Ajouter une méthode de calcul
1. Backend : modèle d'entrée (`models.py`), solveur (idéalement une
   composition de `mix_pipeline.py`), route (`main.py`), tests d'or si un
   classeur de référence existe.
2. Frontend : **1 entrée** dans `frontend/src/lib/method-registry.ts`
   (catégorie, libellés, endpoint, tranches de store) + les tranches d'état
   dans `store.tsx` + un composant de formulaire (mappé dans
   `FORM_BY_STATE_KEY`, `mix/page.tsx`).
3. `pnpm gen:api` pour régénérer les types (backend démarré).
Le registre alimente automatiquement le choix de méthode de la page Calculs
(contrôle segmenté), l'historique, les libellés d'exports et la
sauvegarde/restauration. Chaque méthode porte quatre libellés (`labels`) :
`long` (titre, info-bulle), `court` (contrôle segmenté), `telephone` (même
contrôle sous 720 px, où la place manque) et `fichier` (noms de fichiers
exportés, sans espace ni accent). Ils suivent le vocabulaire de
`lib/glossaire.ts` (recette 14). La méthode retenue après un changement de
catégorie vient de `methodeApresChangementCategorie()` (testée dans
`method-registry.test.ts`).

**Résultats périmés** (2026-10) : le setter du résultat passe par
`avecEmpreinte` (`store.tsx`), qui range l'empreinte des entrées
(`resultat-perime.ts` : état de la méthode, méthode de base de
l'essai-erreur, informations, constantes, liants ; jamais les mesures au
laboratoire). L'empreinte est prise **au départ** : le formulaire appelle
`empreinteAuDepart(cle)` avant son `fetch` et la rend avec la réponse
(`set…Result(data, empreinte)`, imposé par le type `PoserResultat` et
gardé par `resultat-perime.test.ts`) ; prise à l'arrivée, une saisie faite
pendant l'attente passerait pour celle du résultat. Le panneau de résultats
compare à l'affichage : entrées changées, bandeau « Résultats périmés » et
ni sauvegarde ni export. Le formulaire efface son résultat en cas d'erreur
(`set…Result(null)` dans le `catch`). Une restauration depuis Mes calculs
(`/historique`) remet les entrées (pour l'essai-erreur, aussi sa méthode
de base, rangée dans `base_cw` / `base_wb`) puis reprend l'empreinte ; un
essai-erreur sauvegardé sans sa base est restauré « périmé »
(`EMPREINTE_INCONNUE`).

**Ajouts de l'essai-erreur** (convention du 2026-10-23) : le **résidu humide**
ajouté apporte ses grains et son eau w₀ (ligne D59 des feuilles du
professeur ; D60 en est la part sèche, calculée). Le **résidu sec** ajouté,
propre à l'application (aucune des trois feuilles ne le saisit), est du
résidu **séché** : grains seuls, aucune eau (`apply_essai_adjustments`,
`mix_pipeline.py`). Avant cette date il apportait w₀ d'eau et faisait double
emploi avec le résidu humide. Tests : `test_unit_pipeline.py`
(`test_residu_sec_n_apporte_pas_d_eau`, `test_residu_humide_egale_sec_plus_son_eau`).
Un essai-erreur sauvegardé avant cette date avec un ajout « sec » garde son
résultat enregistré ; recalculé, il donne moins d'eau (de w₀ × l'ajout).

**Liant pendant les ajouts** (2026-10-24) : choisi par recette dans le
formulaire (`regle_liant`, `lib/essai-liant.ts`), envoyé dans `binder_rule` :
« Garder le Bw » (`solides_totaux`, Intra 2017 D65), « Résidu seulement »
(`residu_ajoute`, feuille en grammes D65 ; proposé en RPG seulement, identique
en RPC), « Aucun liant » (`aucun`, absent des feuilles : Bw dilué, le Bw atteint
est publié). Sans choix, la règle de la convention (`essai_binder_rule`)
s'applique comme avant. L'option E/L de conception (RPG) prime et masque le
choix. Tests : `test_api.py` (`test_essai_choix_du_liant_par_recette`),
`essai-liant.test.ts`.

**Gs après les ajouts** (2026-10-25, `Issues.md` #6) : le site envoie
`essai_gs_convention = "recalcule"`, imposé par `completerConstantes`
(`CONVENTION_GS_ESSAI`, `store.tsx`) : e, n, Sr, ρd et ρs sont calculés avec le
Gs de la composition FINALE (Bw final et part finale de granulat), soit
Ms/(Vs·ρw) ; Sr = Vw/Vv, n = 1 − Cv. Les feuilles gardent le Gs de départ (D36,
D34) ; le calculateur garde ce défaut (`base`) pour ses tests d'or, qui ne
changent pas. Version du pack gramme : `gramme-1.1`. `etatVersion`
(`conventions.ts`) donne « convention révisée » à un essai-erreur estampillé
`gramme-1.0` ou `intra2017-1.0`, « courante » aux autres méthodes. Un
essai-erreur sauvegardé sous une autre convention (Gs ou règle du liant) est
restauré PÉRIMÉ (`EMPREINTE_CONVENTION_REVISEE`, `resultat-perime.ts`), avec
ses chiffres enregistrés et un bandeau qui en donne la raison. Tests :
`test_unit_pipeline.py::TestCompositionFinale`, `conventions.test.ts`,
`store-persistence.test.ts`.

**Valeurs impossibles** (audit du 2026-10-25) : les 8 méthodes ont été appelées
des milliers de fois avec des entrées au hasard, et 30 règles physiques
vérifiées sur chaque résultat (masses et volumes ≥ 0, 0 < Cw ≤ 100 %,
0 < Sr ≤ 100 %, 0 ≤ n < 1, e ≥ 0, ρd ≤ ρh, ρd < ρs, bilans Cw = Ms/(Ms+Mw),
Vs + Vv = VT, Sr = Vw/Vv, ρd = Ms/VT…) : aucune violation avec des entrées
réalistes. Deux gardes ajoutés au calculateur, refus 422 avec le numéro de la
recette : un retrait de l'essai-erreur plus grand que le contenu du mélange
(`_verifier_masses_finales`, `ajustements_recette`, `mix_pipeline.py`), et un
Cw ≥ 100 % prédit par le modèle d'affaissement (Bw élevé et affaissement très
faible, `solve_rpc_slump`). Saisies bornées dans le Labo (date d'essai pas
avant la coulée, âge de cure ≥ 1 j, réplicats ≥ 1, w₀ et humidité 0 à 100 %,
affaissement 0 à 300 mm, Cw 0 à 100 %, w, malaxage, tolérance et adjuvant ≥ 0 :
`LigneMesure`, `EditeurGachee.tsx`) et dans les catalogues de Réglages (Gs > 0,
pourcentages 0 à 100, tailles de grain > 0 : `MaterialColumn.borne`,
`borneCaracterisation`). Hors périmètre : le module Industrie (calculateur
d'usine, journal de production), dont les champs ne sont pas bornés.

**Pédagogie** (2026-10) : chaque méthode porte aussi `quand` (quand
l'utiliser, une phrase), affichée sous le choix de méthode et lue par le
Guide (`QUAND_METHODE`) : une seule source. Les plages usuelles des champs
vivent dans `lib/plages.ts` (tableau du Guide et rappel sous chaque champ,
`<Field plage=… valeur=…>`) ; une valeur hors plage reçoit un avis doux,
jamais un refus. Gs et w₀ du résidu, le nombre de moules par recette et le
facteur de perte κ sont partagés par les formulaires (`partagerEntreMethodes`,
`CHAMPS_PARTAGES` dans `store.tsx`), y compris après un rechargement depuis
Mes calculs (`restoreSavedResult` les repartage) : le VT de la page
Informations ne dépend donc pas de la méthode active. Un avis tiré d'un
résultat (eau à retirer, Cw prédit hors plage) vit dans `lib/avis-recette.ts`
et s'affiche en tête de la carte des résultats (`ResultsPanel`). Les tableaux
de résultats groupent les milliers à l'écran (`fmtGroupe`) ; les exports PDF
gardent `fmt` (police sans espace fine). **Virgule décimale partout** (depuis
2026-10-19) : `fmt` écrit « 70,00 » à l'écran, dans le PDF et la feuille
labo ; un champ de saisie affiche sa valeur avec `decimaleFr` et accepte la
virgule comme le point (`lireNombre`). Les CSV, JSON et Excel reçoivent les
nombres bruts : ne jamais y passer `fmt`. Les lignes RRC portent toutes leurs
formules (`RrcReportRow.formulaIds`, la masse de coulis renvoie à F056 et
F057) ; la fiche s'ouvre alors sans valeurs. Sauvegarder sous un nom déjà
pris demande « Remplacer l'ancien » (même id, `saveCurrentResult(nom, true)`)
ou « Garder les deux ».

**Saisie des nombres** (2026-10) : tout champ numérique passe par
`ChampNombre` (`components/ui/ChampNombre.tsx`), champ texte qui accepte la
virgule ; jamais `<input type="number">` pour une valeur décimale (sur un
navigateur non français, « 75,5 » y devenait vide, puis 0). Sans `min`, la
valeur tapée est écrite telle quelle, même impossible : `Field` affiche alors
« Valeur impossible » (`messageHorsBornes`, bornes physiques de
`lib/plages.ts`, miroir des contraintes de `backend/app/core/models.py`),
qui remplace l'avis de plage usuelle. Avec `min` (Labo), une valeur sous la
borne n'est pas écrite et la précédente revient en quittant le champ.
Dans le magasin, un champ saisi vide vaut `undefined` (type `Saisie`), un
zéro tapé vaut 0 ; un nouveau champ part donc de `undefined`, prend sa place
dans la fabrique de défauts de sa méthode (`defautsCw()`…, aussi utilisée par
« Réinitialiser » via `reinitialiserMethode`), et la requête l'envoie sans
`|| 0` : vide, l'API répond « valeur obligatoire ».

### 4. Ajouter une ligne au rapport de résultats
`frontend/src/lib/report-schema.ts` UNIQUEMENT (section, libellé, unité,
getter, décimales, garde `when`). L'écran, l'export Excel et le PDF itèrent la
même liste — une ligne ajoutée apparaît partout. Tests dans
`report-schema.test.ts` (unicité par section, gating).

La carte « Résultats » de la page Calculs n'affiche d'abord qu'un **tableau
résumé** : les lignes qui portent `resume: <rang>` (1 = en haut), filtrées par
`lignesResume(ctx)`. Le reste s'ouvre par « Voir les N lignes du rapport
complet », N venant de `nbLignesRapport(ctx)`. Les exports Excel et PDF
ignorent ce drapeau : leur contenu ne dépend pas de l'écran. Ajouter `resume`
à une ligne = la faire monter dans le résumé ; garder le résumé court (une
dizaine de lignes).

### 5. Ajouter un pack de conventions
> **Depuis 2026-09-29, l'interface n'expose plus de choix de convention** :
> l'application impose la feuille « gramme » (`REGLE_LIANT_ESSAI` dans
> `store.tsx`). Les packs restent définis dans `conventions.ts` (étiquetage des
> anciens résultats, badge « anciennes formules »). Réintroduire un choix =
> remettre un sélecteur dans Réglages ET retirer le forçage de `store.tsx`.

1. Si la variante introduit une **nouvelle règle de calcul** : drapeau
   `Literal` dans `SolverConstants` (défaut = comportement actuel, suite verte
   inchangée), branchement dans `mix_pipeline.py`, propagation déjà assurée
   par `_resolve_solver_constants` (model_dump) et `construireConstantesPayload`.
2. `frontend/src/lib/conventions.ts` : l'entrée `CONVENTION_PACKS` (id,
   libellé, solverVersion, constantes+drapeaux).
3. Épingler la cohérence : test pytest (`test_unit_solvers.py`,
   `TestConstantesDefauts`) ET vitest (`conventions.test.ts`).
4. Oracle si un classeur de référence existe (recette 6).

### 6. Nouveau classeur Excel du professeur — LA procédure
C'est la compétence la plus précieuse du projet. Exemples aboutis : feuille
« gramme » (`Issues.md` #4, `excel_twin_gramme.py`) ; analyse préparée de la
feuille H25 (`docs/ANALYSE_H25.md`).

1. **Extraire** : `tools/extract_workbook.py` (openpyxl local, PAS dans
   requirements) — dump formules + valeurs cachées de toutes les feuilles.
2. **Documenter d'abord** (avant tout code) : nouvelle section dans
   `Issues.md` — chaîne de cellules, règle(s) divergente(s) vs Intra 2017,
   avec citations exactes cellule → formule → valeur.
3. **Ne PAS croire l'analyse sur parole** : contre-vérifier chaque
   affirmation d'absence (« la feuille n'a pas X ») dans le dump — l'analyse
   initiale de la feuille gramme avait raté les cellules D91-D96.
4. **Twin** : clone structurel d'`excel_twin_gramme.py`, formules transcrites
   1:1 en unités NATIVES de la feuille, `CACHED` = valeurs cachées copiées
   telles quelles (jamais recalculées), `self_validate()` doit sortir
   ~0.00e+00.
5. **Drapeaux/constantes** pour chaque delta « donnée » ; un delta structurel
   se documente et se discute avant d'être implémenté (on ne tord pas
   `mix_pipeline` en arbre de si/sinon).
6. **Golden discriminants** : grille de cas + au moins un scénario où
   l'ancienne et la nouvelle règle DIVERGENT au-delà d'un seuil (sinon le
   drapeau peut être mort sans que les tests le voient).

### 7. Champ backend renommé ou ajouté (réponses API)
Backend démarré → `cd frontend && pnpm gen:api` → `pnpm typecheck` désigne
tous les consommateurs à ajuster. Le fichier `api-types.gen.ts` est commité
(la CI n'a pas de réseau). `types.ts` n'est qu'un alias `Lax<>` (laxité
optionnel+nullable pour les vieux localStorage).

### 8. Clés localStorage et versions (état actuel)
| Clé | Format | Version | Migration |
|---|---|---|---|
| `minebackfill_saved_results` | brut (tableau) | — | additif seulement |
| `minebackfill_unit_prefs`, `_binder_prices`, `_production_log` | brut | — | additif (préférences d'unités relues sur `DEFAULT_UNITS` : `masseLabo`, unité de saisie des pesées, ajoutée en 2026-10 avec « g » par défaut) |
| `minebackfill_catalogue_liants` | `{v,data}` | 4 | `migrationCatalogueLiants(d, versionLue)` : v1 → v2 champ `origine` ; v2 → v3 noms normalisés des liants par défaut (« Ciment Portland GU (anc. type 10) »…), **seulement si le nom est encore celui d'origine** (`NOMS_LIANTS_V2`) : un nom modifié par l'enseignant reste. Le catalogue publié en ligne passe par la même migration à la lecture (`migrerCatalogueLiantsCloud`). ; v3 → v4 (2026-10-29) : « anc. type 10/50 » devient « anciennement type 10/50 », même règle (`NOMS_LIANTS_V3`). **Le catalogue PUBLIÉ reste au format v3** (`FORMAT_PUBLIE_LIANTS`) : un site déjà ouvert chez un étudiant refuse une version supérieure à la sienne. |
| `minebackfill_constantes` | `{v,data}` | 2 | `completerConstantes` (drapeaux + détection de pack) |
| `minebackfill_general` | `{v,data}` | 1 | identité |
| `minebackfill_catalogue_residus/granulats/retardateurs` | `{v,data}` | 1 | identité |
| `minebackfill_gachees` | `{v,data}` | 2 | `migrerGachees` (registre d'éprouvettes) |
| `minebackfill_protocoles` | `{v,data}` | 1 | identité + graine `protocolesDefaut()` |
| `minebackfill_sessions` | `{v,data}` | 1 | `validerSessions` (sessions.ts) — publiées par l'enseignant |
| `minebackfill_moules` | `{v,data}` | 1 | moules enregistrés (`moules.ts`, 2026-10-26) : personnels, sur cet appareil, jamais synchronisés ; validés à la lecture (`moulesValides`) ; dans la sauvegarde depuis le schéma 7, fusionnés par id à l'import (le local gagne) |
| `minebackfill_formules_brouillons` | `{v,data}` | 1 | brouillons des fiches de formules de l'enseignant (`formules-enseignant.ts`, 2026-10-29), par propriétaire (uid, ou « local » sans compte) ; validés à la lecture (`brouillonsValides`) ; dans la sauvegarde depuis le schéma 8, le brouillon local d'un propriétaire gagne à l'import |
| `minebackfill_formules_publiees` | `{v,data}` | 1 | dernière publication valide reçue (`official_catalogs` id `formules`) ; remplacée seulement par une publication valide (`recevoirFormules`) : une panne garde la copie ; **hors sauvegarde** |
| `minebackfill_sync` | `{v,data}` | 1 | état de la synchronisation v2 (`sync-etat.ts`) — **hors sauvegarde** |
| `minebackfill_compte_<uid>` | `{v,data}` | 1 | travail d'un compte mis de côté au changement de compte (`sync-bascule.ts`) — **hors sauvegarde** |
| `minebackfill_espace_<uid>` | `{v,data}` | 1 | saisies en cours d'un compte mises de côté au changement de compte (`espace-compte.ts`, 2026-10-30) : le texte brut de `minebackfill_general` et de `minebackfill_brouillon_calculs`, relu par leurs propres migrations au retour du compte ; consommée à ce retour ; illisible : gardée, et le compte part de formulaires vides ; **hors sauvegarde** |
| `minebackfill_annotations` | `{v,data}` | 2 | fil de commentaires lu en ligne ; v1 → v2 : curseur remis à zéro (tout est relu), `auteur`/`creeLe`/`luLe` complétés en gardant ceux déjà présents (`migrerAnnotationV1`) — **hors sauvegarde** |
| IndexedDB `minebackfill`, magasin `courbes` | colonnes `{v:1,t,f,d,s,e}` par clé de courbe (`cleCourbe` : `<idEprouvette>:<importeLe>`, ou l'id d'éprouvette pour une courbe d'origine inconnue) | 1 | courbes de presse hors des gâchées (`courbes.ts`) ; l'éprouvette garde `essai.courbeInfo` (avec `importeLe` depuis le 2026-10-18) ; orphelines balayées au démarrage (`balayerCourbesOrphelines`, prudent) |
| `minebackfill_sync_courbes` | `{v,data}` | 2 | envoi des courbes en ligne (`sync-courbes.ts`) : `{ comptes: { [uid]: { envoyees, bloquees } } }`, par id de document ; v1 → v2 : compte repris, entrées abandonnées (`migrerEtatCourbes`) — **hors sauvegarde** |
| `minebackfill_revues` | `{v,data}` | 1 | revues de l'enseignant sur mes gâchées, relues en entier (`revues.ts`) — **hors sauvegarde** |
| `minebackfill_rattachement_reporte` | `{v,data}` | 1 | « Plus tard » sur le bandeau de rattachement : `{ uid, jusqua }`, 12 h, pour ce compte sur cet appareil (`rattachement-report.ts`) ; effacé au rattachement ; illisible : le bandeau revient ; **hors sauvegarde** |
| `minebackfill_brouillon_calculs` | `{v,data}` | 2 | brouillon des formulaires de Calculs (catégorie, méthode, état de chaque formulaire), relu au démarrage et rangé à chaque modification (`brouillon-calculs.ts`, `StoreHydrator`) ; fusionné sur les défauts au chargement. Les résultats ne sont pas rangés ; **hors sauvegarde**. v1 → v2 (`migrerBrouillon`) : les 0 des champs saisis deviennent vides (en v1, 0 voulait dire « non saisi ») |
| Sauvegarde (fichier) | `backup.ts` | schéma 8 | fusion par id, le local gagne (gâchées, moules, brouillons de formules par propriétaire) ; courbes dans `data.courbes` |

Toute évolution de schéma : incrémenter la version de LA clé concernée
(elles sont indépendantes depuis P4) + migration + test dans
`store-persistence.test.ts`.

**Une clé ajoutée doit AUSSI entrer dans `backup.ts`** — sauf les clés du lien
en ligne, exclues exprès : `minebackfill_sync` (restaurée sur un autre
appareil, elle ferait croire que des documents sont déjà en ligne),
`minebackfill_compte_<uid>` et `minebackfill_espace_<uid>` (travail et saisies d'un autre compte) et
`minebackfill_annotations` (propriété du serveur, relue à la connexion). Les deux clés du labo
y ont manqué du jour de leur création jusqu'au schéma 4 : les gâchées, les
éprouvettes et les essais UCS n'étaient ni exportés ni importés, et rien ne le
signalait. Leur cas est particulier et sert de modèle : parce qu'elles sont en
enveloppe `{v,data}`, `backup.ts` ne les lit pas par `lire()` (qui rendrait
l'enveloppe, empêchant la fusion par id) mais par les accesseurs exportés du
store, `loadGacheesFromStorage` / `persistGachees` et leurs équivalents
protocoles, qui rendent des données déjà migrées. À l'import, `deballer()`
tolère les deux formes. Tests : `backup.test.ts`.

### 9. Mode test sans compte — activer / RÉACTIVER les comptes

Interrupteur temporaire pour laisser tester l'application sans connexion : tout
le monde voit la vue enseignant, la couche Supabase (comptes, rôles, synchro,
publication) est désactivée. **La publication en ligne est indisponible dans ce
mode** (elle exige un vrai compte prof), le reste fonctionne 100 % en local.

- Le drapeau : la variable d'environnement **`NEXT_PUBLIC_MODE_TEST_SANS_COMPTE`**,
  lue par `frontend/src/lib/mode-test.ts` ET `portail/src/lib/mode-test.ts`.
  **Absente = mode test actif** ; seule la valeur `false` le désactive (une
  faute de frappe laisse l'état sûr). Elle se règle sur Vercel, **dans les deux
  projets** (MineBackfill et portail), et par environnement : on peut ouvrir
  les comptes sur les aperçus (Preview, reliés à un projet Supabase de
  préproduction) en gardant la production en mode test.
- **Assistant IA** : en mode test, la page `/assistant` est OUVERTE sans
  compte, par son adresse. Son lien dans Réglages, lui, n'apparaît qu'à un
  vrai compte enseignant (`isProf`, pas `vueAdmin`) : en mode test, tout le
  monde a la vue enseignant, étudiants compris (décision du 2026-09-30). La
  route `/api/assistant` saute la vérification du rôle dans ce mode
  uniquement (bandeau affiché sur la page).
  Il reste 503 « non configuré » tant que `ASSISTANT_GITHUB_TOKEN` /
  `ASSISTANT_GITHUB_REPO` ne sont pas définies sur Vercel. Conséquence
  assumée : quiconque connaît l'URL peut créer une issue GitHub pendant la
  fenêtre de test ; repasser le drapeau à `false` referme l'accès.
- **Réactiver les comptes** : Vercel → chaque projet → Settings →
  Environment Variables → `NEXT_PUBLIC_MODE_TEST_SANS_COMPTE` = `false` pour
  l'environnement voulu → **Redeploy** (variable inlinée au build). Aucune
  modification de code. Les variables Supabase déjà présentes reprennent effet
  (connexion, rôles, publication). Retour arrière : supprimer la variable (ou
  la remettre à autre chose que `false`) puis redéployer.
- Mécanique : `getSupabase()` renvoie `null` quand le drapeau est vrai — même
  chemin que « variables Supabase absentes », d'où la désactivation propre de
  toute l'UI compte/cloud sans toucher chaque appelant.

### 10. Toucher au module Analyse (balayages, courbes)

Aucune recette ne couvrait ce module ; voici ses points d'accroche.

**Ajouter une grandeur de sortie (axe Y)** — 4 fichiers, 2 sentinelles :
1. le champ doit exister sur `MixState` et être renseigné par les solveurs ;
2. entrée dans `_SERIES` (`backend/app/core/analyse.py`), **en APPEND** ;
3. `SERIES_CANONIQUE` dans `backend/app/tests/test_balayage.py` — tuple
   **ORDONNÉ**, réordonner casse `test_series_keys_sentinelle` ;
4. entrée `SortieMeta` dans `frontend/src/lib/analyse-series.ts` (`SORTIES`),
   libellé au format du glossaire (`libelle()`, « Rapport eau/liant E/L ») et
   unité `SANS_UNITE` (`lib/format.ts`) pour une grandeur sans dimension ;
5. la copie `SERIES_CANONIQUE` dans `analyse-series.test.ts` (comparaison
   triée, l'ordre y est libre).
Si l'unité est nouvelle, la brancher dans `fmtStat` (page Analyse) **et**
`fmtVal` (`CourbeSvg.tsx`) : ces deux fonctions choisissent leurs décimales
par une chaîne d'unités, et le défaut donne « 1 234,5678 kg ». Elles écrivent
par `nombreFr` (`lib/format.ts`), qui arrondit avant d'écrire : jamais
« -0 » ; ne pas revenir à `toLocaleString` direct.

**Source de l'analyse** (2026-10-25). L'Analyse part d'un **calcul
sauvegardé** (Mes calculs) et d'une de ses recettes, plus du formulaire en
cours de Calculs (après un calcul selon E/L ou en essai-erreur, elle montrait
d'autres valeurs que le résultat obtenu). `lib/analyse-source.ts` (pur) :
- valeurs de la RECETTE sauvegardée (Cw, Sr, Bw, Am) comme entrées d'un
  balayage selon la méthode Cw ; Gs et w₀ du résidu, Gs du granulat dans
  `inputs` (en essai-erreur : la base désignée par `base_method`) ;
- **volume analysé = `total_backfill_volume_m3` de la recette** (contenant
  `"volume"`, 1 contenant, κ = 1) : au point de référence, le balayage
  redonne toutes les grandeurs sauvegardées, masses et volumes compris, même
  après un essai-erreur dont le volume final dépasse celui des moules.
  Épinglé par `test_base_reconstruite_reproduit_la_recette_sauvegardee`
  (`backend/app/tests/test_balayage.py`) : une méthode qui y échoue doit être
  refusée par l'Analyse, pas approchée ;
- contexte STRICT : constantes et liants de l'instantané du calcul, jamais
  `completerConstantes` (qui impose les conventions du site) ni `gsLiant`
  (qui retombe sur un Gs par défaut). Valeur absente : reconstituée ET
  signalée, ou refus expliqué (`baseDepuisCalcul`). Essai-erreur sous
  l'ancienne convention : refusé, par le même prédicat que la restauration
  (`essaiConventionRevisee`, `lib/conventions.ts`) ;
- méthode d'origine et méthode d'analyse affichées séparément (`notesSource`,
  selon l'axe : jamais « à Cw constant » quand l'axe est Cw), et deux versions
  dans la provenance (formules du balayage, calcul d'origine).
Accès : lien « Analyser » de Mes calculs (`/analyse?calcul=<id>`), lu par
`useSearchParams`, ce qui exige la frontière `<Suspense>` de la page (sinon
le build échoue). La sélection est dérivée à chaque rendu : un calcul supprimé
ailleurs fait retomber sur le plus récent. RRC exclu. La composition affiche
les recettes sauvegardées telles quelles, sans requête.

**Courbe périmée et requêtes concurrentes** (2026-10, revu le 2026-10-25). Les
requêtes du balayage sont construites par `corpsBalayage` (`lib/analyse-corps.ts`,
module pur) ; `tracer()` prend leur empreinte (avec la clé `idCalcul#recette`)
et la provenance AU DÉPART, et la courbe est périmée dès que l'empreinte des
entrées courantes diffère (bandeau, figures estompées, exports CSV, JSON et
PNG désactivés). Un nouveau champ envoyé au balayage se met donc dans
`payloadBase` ou `corpsBalayage`, jamais directement dans la page : sinon il
échapperait à l'empreinte. La figure et ses requêtes vivent dans
`lib/analyse-figure.ts` (réducteur pur) : chaque requête a un numéro ; changer
de calcul ou de recette, effacer ou recharger un fichier passe au numéro
suivant, et la réponse d'un numéro dépassé est ignorée. Une erreur de tracé
retire la courbe. Une courbe rechargée d'un fichier n'a pas d'empreinte
(provenance du fichier, exportable telle quelle) et restitue toutes ses
variantes (`variantesDetail` du JSON, champ ajouté au format `/2`). La courbe
est un état local de la page : quitter Analyse la retire.

**Ajouter un paramètre balayable (axe X)** — trois garde-fous, tous
indispensables :
1. membre de `BalayageParam` (`backend/app/core/models.py`) ; la VALEUR doit
   être exactement le nom du champ d'entrée ;
2. branche dans `_PARAM_OVERRIDE` (`analyse.py`). **Un contrôle de complétude
   s'exécute à l'IMPORT du module** : un membre non branché casse l'import,
   donc la suite entière. C'est voulu — la chaîne de si/sinon d'avant rendait
   une courbe parfaitement plate sans erreur ;
3. `BalayageInputs._coherence` si le paramètre est réservé à une catégorie
   (modèle existant : `AM` refusé en RPC) ;
4. `PARAMS_CANONIQUE` dans `test_balayage.py`, et sa copie dans
   `analyse-series.test.ts` ;
5. entrée `ParamMeta` dans `PARAMS` (`analyse-series.ts`), avec son
   `symbole` (« Bw ») : l'infobulle et la pente l'affichent ; on ne découpe
   plus le libellé ;
6. membre de `ParamCle` **et** branche dans `valeurReference`
   (`frontend/src/lib/analyse-fixe.ts`) : le `switch` y est exhaustif, donc
   un oubli est une erreur de compilation.

**Où vit le tracé.** `CourbeSvg.tsx` (Analyse) et `CourbeUCS.tsx` (Labo)
partagent `frontend/src/lib/courbe-utils.ts`. Refus documentés dans
`CourbeSvg.tsx`, à ne pas défaire sans lire la raison : pas de zoom, pas de
second axe Y, pas d'échelle log, pas de normalisation min-max (une grandeur
quasi constante doit RESTER plate).

**Pourquoi les mesures de labo ne sont pas dans Analyse.** La page fige
`versionSolveur`, le pack de conventions et les constantes dans son
instantané de provenance. Une mesure d'UCS ne dépend d'aucun des trois : l'y
afficher produirait une provenance fausse. Et un nuage mesuré à côté d'une
courbe calculée, sur des graphes identiques, se lit comme une validation de
modèle. Les mesures restent donc dans `/labo`, avec deux liens croisés.

**Pas de navigateur dans les tests** : `vitest.config.ts` n'inclut que
`src/**/*.test.ts` en environnement `node`. La règle est d'extraire la
logique en modules purs de `src/lib` et de la tester là —
`courbe-analyse.ts`, `analyse-fixe.ts`, `composition.ts` suivent ce patron.
Le rendu d'un composant se vérifie en node avec `renderToStaticMarkup`
(`react-dom/server`), sans DOM ni effet : `components/classe/rendu.test.ts`,
`components/ui/kit.test.ts`, `components/mix/carte-resultats.test.ts`,
`components/labo/editeur-gachee.test.ts`. Ce rendu n'insère pas les
séparateurs `<!-- -->` entre texte et expression : on y teste des textes
d'un seul tenant.

### 11. Synchronisation du travail (v2)

Toute la logique vit dans des modules PURS, testés en node :
`sync-moteur.ts` (décisions, cycle), `sync-empreinte.ts`, `sync-planificateur.ts`,
`sync-local.ts` (dépôt local), `sync-supabase.ts` (seul module réseau),
`sync-etat.ts` (clé `minebackfill_sync`). `sync-client.ts` ne fait que brancher.
Le pourquoi : `docs/HISTORIQUE_EXTENSIBILITE.md`, « Synchronisation v2 ».

**Ajouter un type de document** (ex. un nouveau registre du labo) :
1. SQL : ajouter le type à la contrainte `user_docs_kind_ck` de
   `supabase/schema.sql` (idempotent), et à la projection de `lire_docs_classe`
   si le tableau de bord doit l'alléger.
2. Moteur : l'ajouter au type `Kind` de `sync-moteur.ts`.
3. Dépôt local : le lister et l'appliquer dans `sync-local.ts` (forme
   canonique : retirer ce qui ne doit pas partir en ligne, et le RÉATTACHER à
   l'écriture) ; le brancher dans `sync-client.ts` (lecture/écriture du
   magasin, abonnement aux changements).
4. Suppression : l'action du magasin appelle `marquerSuppressionLocale`
   SEULEMENT si l'écriture locale a réussi.
5. Tests : `sync-local.test.ts` (aller-retour), `schema-sql.test.ts` (contrainte).

**Ne jamais** : prendre une erreur de lecture pour « rien en ligne » ; déduire
une suppression d'une absence ; convertir le curseur en `Date` (perte des
microsecondes) ; écrire sans `base_rev` un document déjà connu.

### 12. Tableau de bord de l'enseignant (/classe)

Logique PURE, testée en node : `lib/classe.ts` (regroupement, règle de
comptage `essaiValide`, normalisation des documents lus en ligne),
`classe-comparaison.ts`, `classe-alertes.ts`, `classe-echeancier.ts`,
`classe-csv.ts`, `rapport-classe.ts` (modèle) ; `classe-reseau.ts` est le seul
module réseau ; `rapport-classe-pdf.ts` dessine le rapport (jsPDF). Les
composants (`components/classe/`) sont minces ; leur rendu est testé par
`components/classe/rendu.test.ts` (sans navigateur : ces pages exigent une
connexion enseignant). Le pourquoi : `docs/HISTORIQUE_EXTENSIBILITE.md`,
« Tableau de bord de l'enseignant ».

- **Changer un seuil d'alerte** : `SEUILS_ALERTES` (`classe-alertes.ts`) ; le
  texte affiché suit (`libellesSeuils`). Adapter `classe-alertes.test.ts`.
- **Ajouter une alerte** : un type dans `TypeAlerte` + `LIBELLES_ALERTES`, la
  règle dans `alertesClasse` (jamais sur une copie de conflit : partir de
  `gacheesRetenues`), une ligne dans `libellesSeuils`, un test positif ET
  négatif.
- **Compter des essais** : toujours `essaiValide` — ne pas réécrire une règle
  voisine (le tableau, la figure et les exports doivent dire la même chose).
- **Essai hors fenêtre d'âge** (choix du 2026-10-20) : gardé dans la moyenne
  de son âge visé, mais signalé. Une seule règle, `horsFenetreAge`
  (`eprouvette.ts`, fenêtre `FENETRE_AGE` : max(1 j, 10 % de l'âge visé)),
  reprise par l'alerte ; `agregerParAge` en donne le compte (`nHorsFenetre`),
  affiché « dont n hors fenêtre d'âge » (`mentionHorsFenetre`) partout où une
  moyenne par âge s'affiche : tuile « Essais valides », détail de l'étudiant,
  gâchée en lecture, rapport PDF, CSV (colonnes en fin de ligne), Comparaison,
  et chez l'étudiant (éditeur de gâchée, Résultats).
- **« Même formulation »** (élargi le 2026-10-20) : `cleFormulation` (catégorie,
  Cw et Bw au demi-point) + `cleMateriaux` (résidu, liants triés avec leur
  proportion au pour cent, et en RPG granulat + `amPct` au demi-point, champ de
  `ParametresFormulation` rempli depuis `aggregate_mass_pct`). Un matériau
  absent compte « ? » : une gâchée ancienne ne se mêle jamais à une gâchée
  renseignée. Le critère en clair : `CRITERE_MEME_FORMULATION` (écran et PDF).
- **Gâchée de taille chantier** : `SEUIL_VOLUME_LABO_M3` (50 L, à la création,
  sur le V_T de la recette) et `SEUIL_MASSE_LABO_KG` (100 kg de cibles, sur une
  gâchée existante, plus l'alerte `masse_hors_labo`), dans `contenant.ts`.
  Avis seulement, jamais un blocage.
- **Revue indisponible** : la carte distingue la base sans la table des revues
  (« pas encore activée ») d'une autre panne (message d'erreur) ; aucun texte
  destiné à l'enseignant ne parle de SQL.
- **Jamais de moyenne entre gâchées**, et pas de valeur de médiane dans ce qui
  s'exporte (CSV, PDF, messages d'alerte). Voir l'en-tête de
  `classe-comparaison.ts`.
- **Texte d'un PDF** : toujours par `pourPdf` (police intégrée WinAnsi : un seul
  caractère hors table rend la ligne illisible) ; nombres par `nombrePdf`. Les
  deux vivent dans `lib/texte-pdf.ts` (réexportés par `rapport-classe.ts`) ;
  voir « Pièges connus ».
- **CSV** : cellules texte par `securiserCsv` (garde contre les formules),
  nombres bruts (virgule décimale à l'écriture, `celluleCsv`).
- **Annotations, côté SQL** : une colonne que les clients doivent modifier
  s'ajoute au `grant update (texte, deleted)` ; ne JAMAIS écrire une politique
  sur `annotations` qui interroge `annotations` (récursion 42P17 : passer par
  une fonction security definer, comme `repondre_annotation`).
- **Banc PGlite** (`schema-sql.test.ts`) : les blocs anciens dépendent de leur
  ordre ; un nouveau bloc crée SES comptes et ne change jamais le rôle de
  `PROF`.

**Démonstration** (`/classe?demo=1`, 2026-10-26). La même page sur une classe
FICTIVE de 7 étudiants, sans compte, pour montrer le tableau de bord au
professeur sans créer de faux comptes dans la base réelle.
- **Données** : `lib/classe-demo.ts`, `classeDemo(maintenant)`, déterministe
  pour une date donnée, dates relatives à aujourd'hui. Les RECETTES viennent du
  calculateur, figées dans `lib/classe-demo-recettes.json` par
  `backend/scripts/recettes_demo_classe.py`. Après un changement des solveurs,
  `test_demo_classe.py` échoue : relancer le script. Les MESURES UCS sont
  inventées (modèle `UCS28` × `FACTEUR_AGE`, dispersion à graine fixe) et
  annoncées comme telles. Chaque cas du tableau de bord y figure (groupes de
  comparaison, médiane, une gâchée à environ −35 % de la médiane, valeur exclue, hors fenêtre, retard,
  revues, réponse non lue, inactivité) : `classe-demo.test.ts` le garantit.
- **Source** : toutes les lectures et écritures de la page et de l'onglet
  Comptes passent par une `SourceClasse` (`lib/classe-source.ts`).
  `sourceSupabase` délègue 1 pour 1 à `classe-reseau.ts`. `sourceDemo`
  répond depuis la mémoire et SIMULE revues, commentaires et « lu ». Rôles et
  blocage sont désactivés, comme les exports d'un calcul ouvert ; les courbes
  de presse ne sont pas incluses. Un nouvel appel réseau de la page s'ajoute à
  `SourceClasse`, jamais en direct.
- **Garantie** : la démonstration ne déclenche aucun appel réseau et ne
  persiste rien (ni store, ni localStorage, ni IndexedDB) ; pas de
  `rafraichirReponsesNonLues`. `CloudSync` et `StoreHydrator` ne sont pas
  suspendus : sur un navigateur connecté, ils continuent sur les seules données
  réelles, qu'ils ne mélangent jamais aux données fictives.
- **Changement de mode** : le tableau de bord est monté sous `key={mode}`, et
  `lib/classe-chargement.ts` ignore toute réponse dépassée (testé dans les deux
  sens).
- **Exports** : chaque export de classe porte la mention dans son CONTENU
  (`marquerCsvDemo`, `marquerJsonDemo`, `marquerRapportDemo`, option
  `demonstration` de `icsClasse`), pas seulement « _demo » dans son nom.

### 13. Système de design (refonte « épurée », 2026-09-30)

**Accessibilité (2026-10).** `Champ` pose `aria-invalid` et
`aria-describedby` sur son enfant direct quand `erreur` est fournie (input,
select, textarea ou `ChampNombre`, qui les transmet à l'`<input>`) et
annonce le message (`role="alert"`) : passer la saisie en enfant direct, sans
enveloppe. Une valeur cliquable d'un tableau est un `<button>` dans la
cellule (`mix-valeur-bouton`), jamais un `<td onClick>`. Les fenêtres
(`FormulaPopover`) ont `role="dialog"`, un nom, un bouton « Fermer », et
rendent le focus à leur déclencheur. `Menu` gère flèches, Début, Fin et
Échap.

L'interface suit un seul langage visuel, inspiré des réglages d'Apple : fond
gris très clair, cartes blanches sans bordure (rayon 22, ombre douce), titres
de 56 px, listes groupées à filets, contrôles segmentés, boutons en pilule,
une seule couleur d'accent. Le pourquoi : `docs/HISTORIQUE_EXTENSIBILITE.md`,
« Refonte épurée ».

**Où sont les choses.**
- **Jetons** : `frontend/src/app/globals.css`, section `:root` — couleurs
  (`--fond`, `--surface`, `--texte`, `--texte-2`, `--filet`, `--accent`…),
  états (`--succes-*`, `--alerte-*`, `--hors-tolerance*`, `--danger-*`,
  `--violet-*`), rayons, ombres, `--barre-haut` (52 px), `--page-max`
  (1160 px). Les anciens noms (`--primary`, `--navy`, `--border`…) pointent
  vers les nouveaux : ne pas en créer d'autres.
- **Classes globales** : `btn-primary` (pilule), `btn-secondary` (teinté),
  `btn-sombre`, `btn-discret`, `btn-danger`, `btn-contour` ; `field-input` ;
  `result-table` (filets) ; `grille-2`, `grille-auto`. Les classes du kit
  commencent par `ui-` ; celles d'une page par son préfixe (`mix-`, `labo-`,
  `classe-`, `info-`, `hist-`, `analyse-`, `frm-`, `regl-`, `compte-`,
  `assistant-`, `lecture-` pour le Guide).
- **Kit** : `frontend/src/components/ui/`. Sans hook (donc utilisables par un
  composant serveur, comme le Guide) : `Page`/`EnTetePage`, `Carte`,
  `ListeGroupee`/`LigneListe`, `BandeChiffres`/`TuilesChiffres`, `Pastille`,
  `Bandeau`, `Champ`, `Icone`/`Marque`. Composants client : `Segmente`
  (radiogroup ou tablist, flèches du clavier ; `libelleCourt` sous 720 px),
  `Menu` (API Popover), `Feuille` (`<dialog>` du téléphone), `ChampNombre`
  (virgule décimale sûre, `lireNombre`), `BarreHaut`, `BarreOnglets`. Tests de
  rendu : `components/ui/kit.test.ts`.
- **Navigation** : `lib/navigation.ts` (`liensNavigation(role)`,
  `ongletsTelephone(role)`, `estActif`) — une entrée de menu s'ajoute là, les
  deux barres suivent. Test : `navigation.test.ts`.

**Règles.**
1. **Un défilement par page** : chaque page s'enveloppe dans `<Page>` (le
   conteneur défilant sous la barre haute). Ne pas ajouter de second
   conteneur défilant, ni faire défiler le document.
2. **Pas de couleur codée en dur dans une page** : `var(--…)`. Exception
   voulue : **les figures SVG** (`CourbeSvg`, `CourbeUCS`, `BarresPhases`,
   `DiagrammeTernaire`, `EchantillonCylindre`) gardent leurs
   couleurs hexadécimales en ligne, parce que l'export PNG
   (`lib/export-fig.ts`) sérialise le SVG seul, sans la feuille de style : une
   variable CSS y deviendrait noire. Même raison pour les couleurs de séries
   (`COULEURS` de `components/classe/commun.tsx`, utilisées par
   `FigureClasse` ; `COULEURS_SERIE` ; `RECIPE_COLORS`).
3. **Survol en CSS** (`:hover`), jamais par `onMouseEnter`/`onMouseLeave`.
4. **Téléphone (≤ 720 px)** : barre d'onglets en bas, barre haute réduite à
   la marque ; champs en 16 px (sinon iOS zoome) ; zones de sécurité par
   `env(safe-area-inset-*)`. Une section qui ne doit pas s'afficher sur
   téléphone se masque en CSS (`data-section`, `data-vue`), sans hook de
   largeur d'écran (règle du React Compiler, et rendu serveur identique).
5. **Grilles** : `repeat(auto-fit, minmax(min(100%, Npx), 1fr))` — le
   `min(100%, …)` évite qu'une colonne minimale plus large que l'écran ne
   déborde.
6. **Portail** (`portail/`) : application séparée, qui reprend une COPIE des
   jetons en tête de `portail/src/app/globals.css`. Une couleur changée ici se
   change là (le commentaire « GARDER EN PHASE » le rappelle).
7. **`/industrie`** n'est liée nulle part et n'a pas été refaite : elle
   hérite des couleurs, pas de la mise en page. Ne pas s'en servir de modèle.
8. **Typographie** (décision du 2026-09-30) : aucun tiret cadratin « — »
   ni demi-cadratin « – » dans un texte affiché ou exporté, car ils font
   « texte écrit par une IA ». À la place :
   - une incise : parenthèses ou virgules ;
   - une explication : deux-points ; une phrase distincte : un point ;
   - un titre composé : deux-points (« Méthode 1 : masse totale de
     remblai ») ;
   - un intervalle : « 3 à 10 » ; un signe moins dans une formule : « − »
     (U+2212) ;
   - une ligne d'export à plusieurs champs : « | », déjà employé.
   La valeur absente reste « — », mais seulement par `TIRET`
   (`lib/format.ts`) : pour en changer, c'est une ligne. Une grandeur sans
   unité porte `SANS_UNITE` ; `libelleAvecUnite` et `valeurAvecUnite`
   l'affichent. Gardes : `lib/typographie.test.ts` (textes du frontend et
   du portail, `content` des CSS) et `backend/app/tests/test_typographie.py`
   (messages de l'API ; les docstrings et descriptions de `/docs` sont
   exemptées).

**Ajouter une page** : `<Page>` + `<EnTetePage titre=… sousTitre=… actions=…>`,
puis des `<Carte titre=…>` ; les réglages en `ListeGroupee`, les champs en
`Champ` ; un lien dans `lib/navigation.ts` si elle doit figurer au menu.

**Vérifier** : les tests de rendu ne voient ni la mise en page ni les
débordements. Pour un changement visuel, contrôle dans un navigateur sur le
build de production, à 1440×900 et à 390×844 (aucun défilement horizontal,
aucune erreur de console) — voir « Pièges connus », vérification navigateur.

### 14. Glossaire, libellés et normes d'essai

**Source unique** : `frontend/src/lib/glossaire.ts` (module pur, sans
dépendance). Il contient :
- `T` : les libellés répétés, en deux formes (`long` : nom scientifique ;
  `court` : symbole) — `libelle("cw")` donne « Pourcentage solide massique Cw » ;
- `GLOSSAIRE` : une entrée par terme (définition, symbole, unité, synonymes,
  normes, **source** obligatoire : diapositive du cours, classeur, programme) ;
- `NORMES_REF` et `ESSAIS_NORMALISES` : les normes citées (ASTM C143/C143M,
  C39/C39M, C192/C192M, C470, D2216, D854, C188, CSA A3001, ASTM C989, C618,
  D6913, D7928…) et l'essai qui les emploie.

Le Guide les affiche (`components/guide/SectionGlossaire.tsx`, section 9,
ancre `/guide#glossaire`) ; Réglages → À propos y renvoie.

**Vocabulaire retenu** (décisions du 2026-09-30) : « Rapport eau/liant E/L »
(« (W/C) » entre parenthèses au besoin) ; « Taux massique de liant Bw » (masse
de liant / masse sèche de résidu, + granulat en RPG) ; « Densité relative des
grains Gs » (sans unité) ; « masse volumique » pour ρ (jamais « densité » en
kg/m³) ; « granulat » (jamais « agrégat ») ; « Modèle prédictif
(affaissement) » ; UCS selon ASTM C39/C39M.

**Changer un libellé** : le modifier dans `T` (ou dans `method-registry.ts`
pour une méthode) ; `pnpm test` désigne les tests qui l'épinglent
(`report-schema.test.ts`, `glossaire.test.ts`…). Si un ancien terme ne doit
plus revenir, l'ajouter à `RETIRES` dans `lib/terminologie.test.ts` : ce test
parcourt le code de l'interface et échoue s'il le retrouve (exemptés : les
tests, le glossaire, le catalogue de formules, les types générés,
`/industrie`). Son voisin `lib/typographie.test.ts`, lui, couvre aussi le
catalogue de formules et `/industrie` (recette 13, règle 8).

**Ajouter un terme** : une entrée dans `GLOSSAIRE` avec sa source ; une norme
nouvelle dans `NORMES_REF`. `glossaire.test.ts` vérifie que les clés sont
uniques, que chaque entrée cite sa source, l'absence d'emoji et d'accents
manquants, et les normes de l'UCS et de l'affaissement.

**Ne pas toucher** : les symboles du catalogue de formules
(`lib/formulas-data.ts`) restent ceux du cours, y compris `(W/C)_m` — la
fenêtre « fx » des résultats les relie aux valeurs calculées par
`SYMBOL_TO_RECIPE` (`components/mix/FormulaPopover.tsx`).

**Normes à confirmer** : le cours ne cite aucune norme d'essai. Celles du
glossaire sont les normes usuelles de la pratique nord-américaine ; l'en-tête
de `glossaire.ts` et le Guide le disent. Une correction du professeur se
reporte dans `NORMES_REF` (et dans les protocoles par défaut,
`lib/protocole.ts`, qui les citent).

### 15. Fiche d'essai (gâchée, éprouvette, essai)

But : que chaque essai soit réutilisable plus tard (base de données des
essais). **Rien n'y est obligatoire** (décision du 2026-10-01) : un étudiant
qui n'a pas l'information continue ; un indicateur de complétude le lui
rappelle sans le bloquer.

- **Champs** (tous facultatifs) : `Gachee.materiaux` (instantané du résidu,
  du granulat, des liants, de l'eau, de l'adjuvant), `Gachee.cure`,
  `Gachee.malaxageDureeMin` (`lib/gachee.ts`) ; `Eprouvette.mouleDiametreMm`
  et `mouleHauteurMm` (moule nominal ; `moule` reste le texte libre) ;
  `EssaiUCS.masseG`, `deflexionMaxMm`, `vitesseChargement`, `presse`,
  `modeRuptureCode` (`modeRupture` reste le texte libre). Listes fermées :
  `TYPES_EAU`, `MODES_CURE`, `UNITES_DOSAGE_ADJUVANT` (`gachee.ts`),
  `TYPES_RUPTURE`, `UNITES_VITESSE`, `MOULES_PROPOSES` (`eprouvette.ts`).
- **Instantané des matériaux** : `materiauxDepuisFormulation`
  (`lib/gachee-materiaux.ts`), appelé une seule fois, à la création de la
  gâchée (`app/labo/page.tsx`). Il porte l'identité et les valeurs entrées
  dans le calcul (Gs, w₀), pas la caractérisation du résidu : celle-ci vit
  dans le catalogue et se joint par `materiaux.residu.id`.
- **Choix dans la bibliothèque** : avec la propriété facultative
  `bibliotheque` (page Labo), l'éditeur propose le résidu et, en RPG, le
  granulat parmi le catalogue (officiel et personnel) ou « Autre (saisie
  libre) ». Un choix ne change que l'IDENTITÉ (id, nom, provenance) : Gs et w₀
  restent ceux du calcul. Sans la propriété, le résidu se saisit en texte.
- **Côté enseignant** : un matériau d'une gâchée absent du catalogue officiel
  peut y être ajouté depuis la vue de la gâchée (« Ajouter au catalogue
  officiel », action `ajouterMateriauOfficiel` du magasin, toujours avec un
  NOUVEL id pour ne jamais doubler l'id d'un matériau personnel d'étudiant),
  puis caractérisé et publié depuis Réglages.
- **Complétude** : `completudeGachee` (`lib/completude.ts`), une liste de
  points `ok` / `manque` / `sans_objet` ; les « sans objet » ne comptent pas.
  Ajouter un point : une entrée dans `completudeGachee` et son libellé, puis
  adapter `completude.test.ts` (le nombre de points y est épinglé). La
  pastille « Fiche : x/y » de l'éditeur et de la vue enseignant, et la
  colonne « Complétude de la fiche (%) » des CSV en dépendent.
- **Groupes imbriqués** : `modifierGachee` fusionne au premier niveau ; un
  groupe se modifie donc par une copie complète
  (`onMaj({ cure: { ...g.cure, mode } })`, voir `majCure` dans
  `EditeurGachee.tsx`), sinon les autres champs du groupe disparaissent. La
  copie passe par `groupeSansVide` / `materiauxSansVide` (`gachee.ts`) :
  une clé vide disparaît, un groupe vide aussi, et effacer un champ redonne
  la gâchée d'avant (même empreinte, pas de « modifiée depuis la revue »).
  Un adjuvant sans nom ne garde ni dosage ni unité.
- **Saisie libre d'un matériau** : taper un nom efface l'identité de
  bibliothèque (id, catalogue, provenance) ; un id périmé ne survit jamais
  sous un autre nom.
- **Import de presse** : `essaiDepuisPresse` (`presse-urstm.ts`) ne met dans
  l'essai que les champs que le classeur porte (une masse ou une date déjà
  saisies restent) ; seule la mesure de résistance (contrainte et charge)
  est remplacée en bloc.
- **Valeurs du calcul d'abord** : l'instantané prend Gs et w₀ entrés dans le
  calcul (`inputs`, et `inputs.base_cw` / `base_wb` pour l'essai-erreur,
  rangés à la sauvegarde), la bibliothèque en repli. Les formulaires RPG
  n'ont pas d'humidité du granulat : elle vient de la bibliothèque.
- **Jamais de valeur par défaut au chargement** (`migrerGachees`,
  normalisation) : l'empreinte de chaque gâchée changerait et toute la classe
  serait renvoyée en ligne (étape C de `sync-moteur.ts`). Un champ absent
  s'affiche « Non précisé » ; il ne s'écrit jamais tout seul.
- **CSV de la classe** : une colonne nouvelle s'ajoute **à la fin**
  (`EN_TETE_FICHE` et la suite dans `classe-csv.ts`) ; les classeurs de
  l'enseignant pointent sur les positions des anciennes colonnes
  (`classe-csv.test.ts` épingle les 32 premières).

### 16. Jeu d'essais pseudonymisé (export de recherche)

Module PUR `lib/jeu-essais.ts` (tests : `jeu-essais.test.ts`), branché dans
le menu « Exporter » de `app/classe/page.tsx`. Trois tables (`essais`,
`gachees`, `materiaux`) et un manifeste ; le dictionnaire des données est la
liste `COLONNES_*` du module, et `docs/DICTIONNAIRE_DONNEES.md` en est la
version lisible.

- **Ajouter une colonne** : une entrée dans `COLONNES_GACHEE` (conditions de
  la gâchée, reprises dans `essais` et `gachees`), `COLONNES_EPROUVETTE` ou
  `COLONNES_MATERIAUX`, avec libellé, unité, type et description ; puis sa
  ligne dans `docs/DICTIONNAIRE_DONNEES.md`. Le test échoue tant que la
  colonne n'y est pas décrite.
- **Changer le sens d'une colonne** (unité, règle) : incrémenter
  `DICTIONNAIRE_VERSION` et la ligne « Version du dictionnaire » du document.
- **Pseudonymisation** : jamais de nom, de courriel ni de texte qui nomme
  souvent quelqu'un (libellé de formulation, observations, opérateur,
  fichier et commentaires de la presse). Un nouveau champ en texte libre
  prend le type « texte libre » (il entre alors dans `textes_libres` du
  manifeste). Les étudiants sont parcourus dans l'ordre de leur pseudonyme ;
  ne pas réutiliser `parcourir` de `classe-csv.ts`, qui trie par nom.
- **Le pseudonyme** (`lib/pseudonyme.ts`) : « op- » + 12 caractères
  hexadécimaux du SHA-256 de l'identifiant du compte. Le changer casserait le
  suivi d'un opérateur d'un export à l'autre : ne pas y toucher sans raison.
- **Aucune formule nouvelle** : les valeurs viennent de `contrainteKpa`,
  `parametresEffectifs`, `essaiValide`, `completudeGachee`. Les copies de
  conflit sont exclues (`gacheesRetenues`).
- **Lecture** : l'export relit la classe EN ENTIER (`lireClasse` avec
  `complet: true` ; la classe affichée est allégée, sans les entrées du
  calcul), sur toutes les sessions pour les formulations d'origine
  (`avecFormulationsDeToutesSessions`) ; les revues sont jugées sur cette
  lecture fraîche.
- **Matériaux par groupe** : résidu, granulat et liants de la fiche ; un
  groupe que la fiche n'a pas est relu dans la formulation
  (`materiaux_source` = `fiche_et_formulation`).
- **Références** : jamais un nom en clair. Instantané :
  `instantane:<type>:<empreinte du nom et du Gs>` (`refMateriau`) ;
  formulation : `f-<empreinte du compte et de l'id>` (`refFormulation`).
  Une colonne qui peut porter un texte saisi sans être « texte libre »
  (moule, codes de liants personnels) porte `libre: true` et entre dans
  `textes_libres`. Dictionnaire en version 2 depuis ces changements.

### 17. Revue des gâchées par l'enseignant

« Marquer terminée » vaut soumission ; l'enseignant accepte ou refuse (motif
obligatoire) et peut écarter des éprouvettes. Le mot « valide » reste réservé
à `essaiValide` : une revue « accepte » ou « refuse ».

- **SQL** (`supabase/schema.sql`, bloc « revues ») : table `revues`, une ligne
  par document, clé (owner_id, target_kind, target_id). Lecture : RLS
  (propriétaire ou `is_prof()`). Écriture : AUCUN droit direct ; seulement
  `poser_revue` et `retirer_revue` (security definer, réservées à
  l'enseignant, document existant exigé). `poser_revue` : `p_rev` null vaut
  la révision courante, une révision plus récente que celle en ligne est
  refusée (22023), les éprouvettes écartées sont réduites à celles du
  document et dédoublonnées, le motif est débarrassé des blancs aux bouts. L'étudiant lit par
  `lire_mes_revues(p_attendu)` (garde de session 28000). Banc :
  `schema-sql.test.ts`, bloc « revues de l'enseignant » (comptes propres).
- **Client** : `lib/revues.ts` (pur : types, « modifiée depuis la revue » par
  comparaison des révisions, « à rafraîchir » quand la décision porte sur une
  version plus récente que celle lue (`aRafraichir`, exclu de l'export
  « acceptées »), « à revoir », motif d'un refus jamais renvoyé avec une
  acceptation (`motifAEnvoyer`), écartées limitées aux éprouvettes écrasées
  (`ecarteesAEnvoyer`)) ; la page Classe remplace la ligne d'un document
  ouvert par sa version relue (`remplacerLigne`) ; `classe-reseau.ts`
  (`lireRevuesClasse`, `poserRevue`, `retirerRevue`, `lireMesRevues`). Base
  pas à jour : les lectures rendent `null` et la classe se charge sans revues
  (`schemaPasAJour` reconnaît aussi une table absente, PGRST205).
- **Étudiant** : copie locale `minebackfill_revues` `{v:1, data}`, HORS
  sauvegarde (elle appartient au serveur), relue avec les commentaires
  (`sync-client.ts`), vidée au changement de compte.
- **Écrans** : `CarteRevue` (vue d'une gâchée, page Classe ; jamais un bouton
  dont le texte serait exactement « Retirer », voir `rendu.test.ts`),
  pastilles « À examiner » / « À réexaminer » dans `DetailEtudiant` (`etatRevue`,
  2026-10-29), tuile « Gâchées à examiner » (`classe-resume.ts`),
  pastille et bandeau dans le Labo de l'étudiant.
- **Exports** : colonnes « Revue », « Motif de la revue », « Modifiée depuis
  la revue », « Écartée par l'enseignant » à la fin des CSV de classe ; dans
  le jeu d'essais `revue`, `revue_perimee`, `eprouvette_ecartee` et l'export
  « gâchées acceptées » (`seulementAcceptees`, `accepteeTelleQuelle`) ;
  `nb_essais_retenus` du manifeste sans les éprouvettes écartées ; clé
  `revues` du JSON de la classe (sauvegarde mensuelle).
- **Effacer un compte** : ses revues bloquent la suppression comme ses
  annotations (`docs/OPERATIONS.md`).

### 18. Courbes de presse en ligne

Les courbes vivent dans IndexedDB (`courbes.ts`, `courbes-idb.ts`) ;
l'éprouvette n'en garde que `essai.courbeInfo`, qui reste LOCAL : la forme
canonique des gâchées (`sync-local.ts`) continue de le retirer, sinon deux
appareils se réécriraient la même gâchée à chaque cycle.

- **Identité = l'import** (depuis le 2026-10-18) : une courbe est identifiée
  par `sourcePresse.importeLe` de l'import qui l'a produite (identique sur
  tous les appareils, car il voyage dans la gâchée). `courbeInfo.importeLe`
  le note localement. Clé locale ET id du document en ligne :
  `cleCourbe(e)` = `<idEprouvette>:<importeLe>`. Une courbe sans
  `courbeInfo.importeLe` (rangée avant, ou encore dans la gâchée) est
  d'**origine inconnue** : ancienne clé `<idEprouvette>`, lisible avec la
  note « origine non vérifiée », JAMAIS envoyée ; le bandeau de presse
  propose de réimporter. Ne jamais « réconcilier » une ancienne courbe par
  son maximum ou son nombre de points : cela ne prouve pas l'identité.
- **Réattache** (`avecCourbes`, `sync-local.ts`) : une version reçue ne
  récupère la courbe locale que si l'éprouvette désigne toujours le même
  import ; réimportée ailleurs, elle la perd (le balayage la retire) et
  l'écran propose « Courbe en ligne : afficher ». Une copie de conflit garde
  `courbe` ET `courbeInfo` (`courbesAOublier` protège les clés partagées).
- **Import** : `appliquerImportPresse` (`courbes.ts`, pur) range la courbe
  sous sa clé par import et retire courbe et référence de l'import
  précédent, case « Conserver la courbe » décochée comprise.
- **Envoi** : `sync-courbes.ts` (pur), À PART du moteur (il ne connaît que
  résultats et gâchées, et son dépôt est synchrone). Après chaque cycle
  réussi (`sync-client.ts`), au plus 10 envois réels (une courbe absente du
  magasin ne compte pas) ; reste à envoyer : relance et compte dans « en
  attente ». Seules partent les courbes d'origine vérifiée
  (`courbeInfo.importeLe === sourcePresse.importeLe`), copies de conflit
  comprises, et seulement quand la gâchée en ligne est la gâchée locale
  (même empreinte : garde d'économie). Document « courbe », contenu =
  colonnes + `eprouvetteId`, `gacheeId`, `importeLe`, par `ecrire_doc`
  (`ecrivainCourbes`, `sync-supabase.ts`). Identifiant déjà en ligne : même
  import, on retient sa révision SANS réécrire ; retiré : recréé. Aucun
  chemin ne réécrit un document sur une révision lue.
- **État d'envoi** : `minebackfill_sync_courbes`, version 2 :
  `{ comptes: { [uid]: { envoyees, bloquees } } }`, indexé par id de
  document, hors sauvegarde. La v1 (un seul compte, indexé par éprouvette)
  est migrée : compte repris, entrées abandonnées. Les refus définitifs
  (`bloquees`) sont retentés une fois par connexion.
- **Lecture** : à la demande seulement (`lireCourbe`, `classe-reseau.ts`) :
  document de l'import désigné, sinon l'ancien document (non vérifié) ;
  `lire_docs` et `lire_docs_classe` ne rendent jamais les courbes.
  L'étudiant, sur un autre appareil : « Courbe en ligne : afficher » (la
  courbe de l'import désigné est alors rangée dans son IndexedDB, appliquée
  sur l'état frais du magasin) ; l'enseignant : même bouton.
- **Affichage** : `CourbeEprouvette` (une seule instance : magasin, puis en
  ligne) et `CourbeContrainteDeformation` (SVG, maximum marqué, PNG et CSV).
- **Nettoyage** : en ligne, `purger_mes_courbes_ids` une fois par connexion,
  après un cycle PROPRE (rien en attente, aucun conflit) ; c'est aussi la
  sonde : fonction absente, aucune courbe n'est envoyée (la page Compte le
  dit). `purger_mes_courbes` reste pour les sites en cache, même règle
  d'orphelin (voir `schema.sql`). Sur l'appareil, `balayerCourbesOrphelines`
  au démarrage, qui ne fait RIEN au moindre doute (gâchées illisibles,
  migration en échec, travail mis de côté illisible).
- **Exports** : « Classe (JSON) » ajoute la clé `courbes` (version
  inchangée) : pour chaque éprouvette, le document de son import, sinon
  l'ancien avec `origineNonVerifiee: true` (`courbesRetenues`) ; le jeu
  d'essais a la colonne `courbe_en_ligne` (même règle, comme la vue
  `vue_essais`). La lecture se fait par compte exporté, paginée par id.
- **Taille** : 151 points par courbe (`presse-fichier.ts`), environ 9 Ko en
  ligne ; limites : 256 Kio par document, 25 Mo par compte.

### 19. Accès direct SQL aux essais (vues)

`supabase/schema.sql`, bloc « Accès direct » : vues `vue_gachees` et
`vue_essais` (`security_invoker = true` : la RLS de `user_docs` et de
`revues` s'applique à qui lit), fonctions de lecture sûre `jsonb_num` et
`jsonb_ts`, `pseudonyme(uuid)` (même règle que `lib/pseudonyme.ts`),
`parametre_gachee` (règle de `parametresEffectifs`), `exporter_essais`
(enseignant). Banc : `schema-sql.test.ts`, bloc « accès direct ».

- **Même résultat que le site** : le banc compare `ucs_kpa` à `contrainteKpa`
  et `retenu` à `essaiValide`, et le pseudonyme SQL à celui du site. Une
  règle qui change dans le site change aussi dans la vue, dans la même PR.
- **Ajouter une colonne** : À LA FIN de la vue (`create or replace view`
  refuse de renommer ou de déplacer une colonne), avec la clé du
  dictionnaire si elle existe.
- **Jamais** d'identifiant de compte dans une vue (le banc le vérifie), et
  jamais de vue sans `security_invoker` (elle contournerait la RLS).
- **Retirer ou renommer une colonne** : `exporter_essais` rend
  `setof vue_essais` ; il faut `drop function public.exporter_essais(text)`
  avant de recréer la vue : ajouter ce `drop` dans `schema.sql`, juste avant
  la vue (la fonction est recréée plus bas dans le script). Ajouter une
  colonne à la fin n'exige rien de tel.
- **Robustesse** : une valeur aberrante d'un document rend une case vide,
  jamais une erreur de la vue entière : `jsonb_num` (nombre hors du double,
  1e400), `jsonb_ts` (seulement AAAA-MM-JJ…, pas « now »), bornes du calcul
  F / A (charge < 1e6 kN, diamètre entre 1e-3 et 1e5 mm), `recette_gachee`
  (index entier, borné, calcul en double avant la conversion),
  `parametre_gachee` (instantané seulement s'il est un objet). Les gâchées
  des comptes enseignants sont exclues, comme dans la classe du site.
- **SQL Editor** (rôle postgres, sans session) : les vues s'y lisent en
  entier, mais `exporter_essais` refuse (42501, pas d'enseignant connecté) ;
  le filtre de session porte sur `sessionId` seulement (une gâchée sans
  session n'est pas rangée par date, contrairement au site).

## Pièges connus

- **Lint React Compiler** : `setState` synchrone dans un `useEffect` est une
  ERREUR. Pour un état « après hydratation », utiliser
  `frontend/src/lib/use-hydrated.ts` (useSyncExternalStore). Les setState dans
  des callbacks (fetch.then, onAuthStateChange) sont acceptés.
- **`NEXT_PUBLIC_*` inlinées au build** : changer une variable Vercel exige un
  redéploiement.
- **Zoom iOS** : Safari zoome sur tout champ dont le texte fait moins de
  16 px. `field-input` et les champs du portail passent à 16 px sous 720 px ;
  un champ stylé à la main doit faire de même.
- **Menu (Popover) et Feuille (`<dialog>`)** : le menu est un `popover` natif ;
  sa position sous le bouton se calcule dans `onBeforeToggle`, sans état
  React. La feuille « Plus » du téléphone est un `<dialog>` : la propriété
  `ouverte` est reportée sur `showModal()` / `close()` par un effet qui ne
  touche que le DOM (aucun `setState`, que le lint du React Compiler
  refuserait) ; Échap et le clic sur le fond appellent `onFermer`. Le focus
  piégé et Échap viennent du navigateur : ne pas les réécrire à la main.
- **Libellé court d'un contrôle segmenté** : sous 720 px, le libellé long est
  masqué **visuellement seulement** (le libellé court est `aria-hidden`). Un
  `display: none` sur le libellé long laisserait le bouton sans nom
  accessible.
- **Texte des PDF** : jsPDF n'a que la police intégrée WinAnsi. Tout texte
  passe par `pourPdf` (`lib/texte-pdf.ts`) : lettres grecques translittérées
  (ρh → « rho_h », κ → « kappa »), espaces fines et signes typographiques
  remplacés ; `assainirTextePdf(doc)` l'applique à tous les `doc.text` d'un
  document. Ajouter un PDF = appeler `assainirTextePdf` sur son document.
- **Espace perdue en JSX** : constaté sur le portail, un texte sur plusieurs
  lignes qui commence par une espace juste après une expression (`{n} projets`
  suivi de texte) a perdu cette espace au rendu ; de même, une ligne qui finit
  par une ponctuation devant `{expression}` à la ligne suivante. Écrire
  `{" "}` explicitement.
- **Vérification navigateur** : pas de harnais E2E commité ; le rituel est
  `pnpm add -D playwright-core` (éphémère), script de smoke contre le build de
  prod avec Edge (`channel`/executablePath), puis `pnpm remove playwright-core`.
- **Windows/git** : il a existé un dépôt git accidentel dans le RÉPERTOIRE
  PERSONNEL — toujours vérifier `git rev-parse --show-toplevel` avant un
  `git add` dans un dossier fraîchement créé.
- **Supabase** : voir `supabase/README.md` (garde-fous) et
  `docs/OPERATIONS.md` (pannes). Le backend FastAPI n'a AUCUN lien avec
  Supabase — ne pas en introduire.
