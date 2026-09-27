# Contexte Projet (pour outils IA)

Ce document sert de memoire technique du projet **minebackfill** pour qu'un outil IA comprenne rapidement:
- le **but de l'application**
- ce qui est **deja implemente**
- les **conventions de calcul**
- les **fichiers importants**
- les **points de vigilance** avant de modifier le code

Lire ENSUITE, selon la tache :
- `docs/MAINTENANCE.md` — recettes pas-a-pas (ajouter methode/pack/champ,
  nouveau classeur Excel via `tools/extract_workbook.py`) et invariants.
- `docs/HISTORIQUE_EXTENSIBILITE.md` — le POURQUOI des structures (P0-P5).
- `docs/OPERATIONS.md` — cote exploitation (enseignant).
- `docs/ANALYSE_H25.md` — classeur H25 deja depouille (pret a implementer).

## 1) But de l'application

Application web de dimensionnement des melanges de remblai cimente en pate:
- saisie des informations generales (operateur, projet, residu, date, moule, liant)
- calcul de recettes RPC selon plusieurs methodes:
1. `Dosage Cw (%)`
2. `Rapport eau/ciment (W/C)`
3. `Ajustement pour slump` (modele predictif)
4. `Methode essai-erreur` (ajustements de masse/eau a partir d'une recette de base)

Reference metier: logique C# / Excel fournie par l'utilisateur (formules historiques).

## 2) Architecture technique

- **Frontend**: Next.js + React + Zustand
- **Backend**: FastAPI + Pydantic
- **Calculs**: noyau partagé dans `backend/app/core/mix_pipeline.py`
  (`solve_recipe`, `apply_essai_adjustments` — convention Intra 2017) ; les
  points d'entrée par méthode restent dans `rpc_solver.py`, `rpg_solver.py`
  et `rrc_solver.py`, qui délèguent au pipeline. Toute formule partagée
  RPC/RPG se touche dans `mix_pipeline.py`, pas dans un solveur.
- **Affichage resultats**: `frontend/src/components/mix/ResultsPanel.tsx`

Principe impose par l'utilisateur:
- Le frontend saisit + envoie les donnees
- Le backend calcule
- Le frontend affiche seulement les resultats

## 3) Fichiers clefs

### Backend
- `backend/app/main.py`
  - app FastAPI
  - CORS (`localhost:3000`, `127.0.0.1:3000`, etc.)
- `backend/app/core/models.py`
  - enums et schemas Pydantic (inputs/outputs)
- `backend/app/core/mix_pipeline.py`
  - noyau de calcul partagé RPC/RPG (RPC = cas Xg=0 du RPG)
- `backend/app/core/rpc_solver.py`
  - points d'entrée RPC par méthode (cw, wb, slump, essai)
- `backend/app/core/rpg_solver.py`
  - points d'entrée RPG (remblai pâte granulaire / PAF)
- `backend/app/core/rrc_solver.py`
  - remblai rocheux cimenté (RRC/CRF)
- `backend/app/core/analyse.py`
  - balayages paramétriques (page `/analyse`)
- `backend/app/routers/`
  - routes API : `rpc.py`, `rpg.py`, `rrc.py`, `analyse.py`

### Frontend
- `frontend/src/lib/store.tsx`
  - etat global (general, cw, wb, slump, essai, resultats)
- `frontend/src/app/mix/page.tsx`
  - navigation des methodes et rendu des formulaires
- `frontend/src/components/mix/rpc/CwForm.tsx`
- `frontend/src/components/mix/rpc/WbForm.tsx`
- `frontend/src/components/mix/rpc/SlumpForm.tsx`
- `frontend/src/components/mix/rpc/EssaiForm.tsx`
- `frontend/src/components/mix/ResultsPanel.tsx`
  - affichage unifie des resultats

## 4) Conventions de calcul (a respecter)

1. **Pourcentages en entree**: echelle `0-100` (pas `0-1`)
2. **Unites**:
   - masses: `kg`
   - volumes: `m3`
   - densites: `kg/m3` (affichees aussi en `g/cm3`)
3. **Convention de calcul (depuis 2026-07-06): feuille "Intra 2017"**
   - Reference: `Data/Feuille calculs mélanges_tonne (Intra 2017).xlsx`
   - `Ms_total = rho_d * V_T` puis repartition par `(1+Bw)` — pipeline
     partage dans `backend/app/core/mix_pipeline.py` (RPC = cas Xg=0 du RPG)
   - L'ancienne convention C# `Vr = Vs` (Modele C1b 2005) est ABANDONNEE:
     elle gonflait toutes les masses d'un facteur exact (1+Bv). Voir Issues.md #3.
   - Essai-erreur: le volume total croit des volumes ajoutes; Sr reste a la
     valeur de base; "a ajouter" negatif = "a retirer" (pas de bornage a 0).
   - Tests d'or: `backend/app/tests/test_excel_golden.py` (oracle
     `excel_twin.py` — ne jamais l'editer pour faire passer un test).
   - **Variante « en gramme » (Belem 2016)**: meme recette de base (Sr=100%),
     mais la regle du liant en essai differe — le liant ajoute ne repond qu'au
     **residu ajoute** (pas au granulat ajoute). Capturee en pack de convention
     via le drapeau `essai_binder_rule` (defaut `solides_totaux` = Intra 2017 ;
     `residu_ajoute` = gramme). Voir Issues.md #4 et l'oracle `excel_twin_gramme.py`.
4. **A_m (agregat/co-mixing)**:
   - garde dans la logique (preparation futures methodes), ne pas supprimer
5. **Champs de sortie**:
   - conserver les memes familles de champs visibles dans le panneau resultats

## 5) Etat des methodes RPC

### A) Methode Cw (`dosage_cw`)
- Route: `POST /rpc/cw`
- Solver principal: `solve_rpc_cw(...)`
- Base des autres methodes
- Inclut:
  - calcul Gs liant
  - calcul Gs remblai
  - Cw -> w -> e -> n -> Cv
  - volumes, masses, w/c effectif
  - split des masses par ciment 1/2/3

### B) Methode W/C (`wb`)
- Route: `POST /rpc/wb`
- Solver: `solve_rpc_wb(...)`
- W/C impose par recette
- Cw est derive selon la logique C# / Excel utilisee dans le projet

### C) Methode Slump (`slump`)
- Route: `POST /rpc/slump`
- Solver: `solve_rpc_slump(...)`
- Formule predictive Cw implementee:
  - `Cw% = 4.95e6 * (1 + Bw%) / (slump*(1+Bw%)/Gs_res + 235.5122)^2`
- Si petit cone:
  - conversion vers grand cone: `slump_grand = 2.335 * slump_petit`

### D) Methode Essai-erreur (`essai`)
- Route: `POST /rpc/essai`
- Solver: `solve_rpc_essai(...)`
- Fonctionnement:
1. recupere une recette de base (`dosage_cw` ou `wb`)
2. applique des ajustements par recette:
   - ajout residu sec
   - ajout residu humide
   - ajout eau
3. recalcule les indicateurs geotechniques et masses finales

## 6) Parametres de geometrie contenant (important)

Le backend attend strictement `general.container_type` parmi:
- `section_hauteur`
- `rayon_hauteur`
- `longueur_largeur_hauteur`

Attention aux anciennes valeurs (`llh`, `lxwxh`) qui creent des erreurs de validation.

## 7) Routes API disponibles

Neuf routes, sans préfixe (`prefix=""`), montées dans `app/main.py` :

| Routeur | Routes | Réponse |
|---|---|---|
| `rpc.py` | `POST /rpc/cw`, `/rpc/wb`, `/rpc/slump`, `/rpc/essai` | `MixDesignResult` |
| `rpg.py` | `POST /rpg/cw`, `/rpg/wb`, `/rpg/essai` | `MixDesignResult` |
| `rrc.py` | `POST /rrc/dosage` | `RrcResult` |
| `analyse.py` | `POST /analyse/balayage` | `BalayageResult` |

Le RPG n'a pas de méthode slump : le modèle prédictif n'existe qu'en RPC
(voir Issues.md #5). Documentation interactive sur `/docs`.

## 8) Frontend: logique de resultat

`ResultsPanel.tsx` affiche selon la methode active:
- `cwResult` si `dosage_cw`
- `wbResult` si `wb`
- `slumpResult` si `slump`
- `essaiResult` si `essai`

Le panel montre:
- Donnees du melange (masses)
- Parametres geotechniques 1
- Parametres geotechniques 2
- Parametres geotechniques 3

## 9) Decisions fonctionnelles prises avec l'utilisateur

1. ~~Garder l'approche metier proche du C# historique.~~ **CADUQUE depuis le
   2026-07-06** : la convention C# « Modèle C1b 2005 » (`Vr = Vs`) est
   abandonnée au profit de la feuille « Intra 2017 » (`Ms = ρd·VT`), qui est
   la référence confirmée. Le programme C# de 2005 du professeur diverge de
   sa propre feuille Intra 2017 d'un facteur exact (1+Bv). Ne pas revenir
   vers le C# — voir Issues.md #3 pour le raisonnement complet.
2. Garder les noms et labels en francais.
3. Conserver les champs de sortie existants (pas de simplification agressive).
4. Centraliser tous les calculs côté backend, dans un noyau unique :
   `mix_pipeline.py` porte les formules partagées RPC/RPG ; les solveurs
   n'en sont que les points d'entrée. (Formulation d'origine : « centraliser
   dans `rpc_solver.py` » — l'intention tient, le fichier a changé quand le
   RPG a été ajouté.)
5. Essai-erreur doit partir d'une base Cw ou W/C deja saisie.

## 10) Points de vigilance techniques

1. **Encodage**
   - certains fichiers montrent des caracteres francais mal encodes (`A©`, etc.).
   - preferer UTF-8 propre pour les prochaines modifications.

2. ~~**Duplications dans `rpc_solver.py`**~~ — **RÉSOLU**. Plus aucune
   définition de fonction dupliquée dans le fichier (vérifié le 2026-09-27).

3. **Variables d'environnement frontend**
   - le store lit `NEXT_PUBLIC_API_URL`
   - verifier coherence avec `.env.local` si une autre cle est utilisee.

4. **Erreurs CORS apparentes**
   - souvent symptome d'une erreur backend 500 (pas un vrai probleme CORS de config).
   - toujours verifier traceback backend d'abord.

## 11) Lancement local (rappel)

### Backend
```powershell
cd "backend"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host localhost --port 8000
```

### Frontend
```powershell
cd "frontend"
pnpm dev
```

App:
- Frontend: `http://localhost:3000/mix`
- API: `http://localhost:8000`

## 12) Etat des priorites

La passe de consolidation que ce document recommandait est **faite** :

1. ~~éliminer les doublons de fonctions dans `rpc_solver.py`~~ — fait ;
2. ~~normaliser l'encodage des textes FR~~ — fait dans l'UI et le README
   (ce document-ci garde son texte d'origine sans accents ; les passages
   révisés depuis sont accentués correctement) ;
3. ~~ajouter des tests backend par méthode avec cas de référence Excel~~ —
   largement dépassé : 574 tests backend, dont les tests d'or adossés aux
   oracles `excel_twin.py` et `excel_twin_gramme.py`.

**Ce qui reste ouvert** se trouve dans `frontend/src/lib/formulas-TODO.md` :
deux vérifications **métier** (convention d'unités `D1`/`D2` du retardateur
CRF, forme pratique de `F096` sous `ρw = 1 g/cm³`). Ce sont des questions
pour le professeur, pas du code — ne pas deviner.

