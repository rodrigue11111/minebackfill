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
   aucun emoji, un commit par item, CI verte avant de merger.

## Recettes

### 1. Ajouter un liant ou un matériau officiel — 0 code
Réglages → carte concernée → « + Ajouter » (en mode enseignant connecté, les
entrées créées sont « officielles ») → « Publier en ligne » pour diffuser à la
classe. Les entrées officielles publiées remplacent la couche officielle des
étudiants ; leurs entrées perso sont préservées.

### 2. Ajouter un champ à un type de matériau
- `frontend/src/lib/materials.ts` : le champ dans l'interface + les défauts.
- La carte : tableau `columns` du `MaterialCatalogueCard` concerné (Réglages).
- **Incrémenter `MATERIALS_VERSION`** (store.tsx) et écrire la migration
  (valeur par défaut pour les anciennes données) — voir `migrationCatalogueLiants`
  comme modèle.
- `materials-io.ts` si le champ doit voyager en CSV/JSON.

### 3. Ajouter une méthode de calcul
1. Backend : modèle d'entrée (`models.py`), solveur (idéalement une
   composition de `mix_pipeline.py`), route (`main.py`), tests d'or si un
   classeur de référence existe.
2. Frontend : **1 entrée** dans `frontend/src/lib/method-registry.ts`
   (catégorie, libellés, endpoint, tranches de store) + les tranches d'état
   dans `store.tsx` + un composant de formulaire (mappé dans
   `FORM_BY_STATE_KEY`, `mix/page.tsx`).
3. `pnpm gen:api` pour régénérer les types (backend démarré).
Le registre alimente automatiquement le panneau de gauche, l'historique, les
libellés d'exports et la sauvegarde/restauration.

### 4. Ajouter une ligne au rapport de résultats
`frontend/src/lib/report-schema.ts` UNIQUEMENT (section, libellé, unité,
getter, décimales, garde `when`). L'écran, l'export Excel et le PDF itèrent la
même liste — une ligne ajoutée apparaît partout. Tests dans
`report-schema.test.ts` (unicité par section, gating).

### 5. Ajouter un pack de conventions
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
| `minebackfill_unit_prefs`, `_binder_prices`, `_production_log` | brut | — | additif |
| `minebackfill_catalogue_liants` | `{v,data}` | 2 | `migrationCatalogueLiants` (origine) |
| `minebackfill_constantes` | `{v,data}` | 2 | `completerConstantes` (drapeaux + détection de pack) |
| `minebackfill_general` | `{v,data}` | 1 | identité |
| `minebackfill_catalogue_residus/granulats/retardateurs` | `{v,data}` | 1 | identité |
| `minebackfill_gachees` | `{v,data}` | 2 | `migrerGachees` (registre d'éprouvettes) |
| `minebackfill_protocoles` | `{v,data}` | 1 | identité + graine `protocolesDefaut()` |
| `minebackfill_sync` | `{v,data}` | 1 | état de la synchronisation v2 (`sync-etat.ts`) — **hors sauvegarde** |
| Sauvegarde (fichier) | `backup.ts` | schéma 4 | fusion par id, le local gagne |

Toute évolution de schéma : incrémenter la version de LA clé concernée
(elles sont indépendantes depuis P4) + migration + test dans
`store-persistence.test.ts`.

**Une clé ajoutée doit AUSSI entrer dans `backup.ts`** — sauf `minebackfill_sync`,
exclue exprès : restaurée sur un autre appareil, elle ferait croire que des
documents sont déjà en ligne. Les deux clés du labo
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
- **Assistant IA** : en mode test, la page `/assistant` (et son lien dans
  Réglages) est OUVERTE sans compte — la route `/api/assistant` saute la
  vérification du rôle dans ce mode uniquement (bandeau affiché sur la page).
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
4. entrée `SortieMeta` dans `frontend/src/lib/analyse-series.ts` (`SORTIES`) ;
5. la copie `SERIES_CANONIQUE` dans `analyse-series.test.ts` (comparaison
   triée, l'ordre y est libre).
Si l'unité est nouvelle, la brancher dans `fmtStat` (page Analyse) **et**
`fmtVal` (`CourbeSvg.tsx`) : ces deux fonctions choisissent leurs décimales
par une chaîne d'unités, et le défaut donne « 1 234,5678 kg ».

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
5. entrée `ParamMeta` dans `PARAMS` (`analyse-series.ts`) ;
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

**Pas de test de composant** dans ce dépôt : `vitest.config.ts` n'inclut que
`src/**/*.test.ts` en environnement `node`. La règle est d'extraire la
logique en modules purs de `src/lib` et de la tester là —
`courbe-analyse.ts`, `analyse-fixe.ts`, `composition.ts` suivent ce patron.

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

## Pièges connus

- **Lint React Compiler** : `setState` synchrone dans un `useEffect` est une
  ERREUR. Pour un état « après hydratation », utiliser
  `frontend/src/lib/use-hydrated.ts` (useSyncExternalStore). Les setState dans
  des callbacks (fetch.then, onAuthStateChange) sont acceptés.
- **`NEXT_PUBLIC_*` inlinées au build** : changer une variable Vercel exige un
  redéploiement.
- **Vérification navigateur** : pas de harnais E2E commité ; le rituel est
  `pnpm add -D playwright-core` (éphémère), script de smoke contre le build de
  prod avec Edge (`channel`/executablePath), puis `pnpm remove playwright-core`.
- **Windows/git** : il a existé un dépôt git accidentel dans le RÉPERTOIRE
  PERSONNEL — toujours vérifier `git rev-parse --show-toplevel` avant un
  `git add` dans un dossier fraîchement créé.
- **Supabase** : voir `supabase/README.md` (garde-fous) et
  `docs/OPERATIONS.md` (pannes). Le backend FastAPI n'a AUCUN lien avec
  Supabase — ne pas en introduire.
