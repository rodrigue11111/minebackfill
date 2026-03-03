# Contexte Projet (pour outils IA)

Ce document sert de memoire technique du projet **minebackfill** pour qu'un outil IA comprenne rapidement:
- le **but de l'application**
- ce qui est **deja implemente**
- les **conventions de calcul**
- les **fichiers importants**
- les **points de vigilance** avant de modifier le code

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
- **Calculs**: centralises dans `backend/app/core/rpc_solver.py`
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
- `backend/app/core/rpc_solver.py`
  - formules et solveurs RPC
- `backend/app/routers/rpc.py`
  - routes API `/rpc/*`

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
3. **Convention C# conservee**:
   - `Vr = Vs` (volume des rejets egal volume de solides du remblai)
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

Dans `backend/app/routers/rpc.py`:
- `POST /rpc/cw`
- `POST /rpc/wb`
- `POST /rpc/slump`
- `POST /rpc/essai`

Retour commun: `MixDesignResult`.

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

1. Garder l'approche metier proche du C# historique.
2. Garder les noms et labels en francais.
3. Conserver les champs de sortie existants (pas de simplification agressive).
4. Centraliser tous les calculs dans `rpc_solver.py`.
5. Essai-erreur doit partir d'une base Cw ou W/C deja saisie.

## 10) Points de vigilance techniques

1. **Encodage**
   - certains fichiers montrent des caracteres francais mal encodes (`A©`, etc.).
   - preferer UTF-8 propre pour les prochaines modifications.

2. **Duplications dans `rpc_solver.py`**
   - il existe des sections placeholder puis des versions implementees plus bas.
   - verifier les definitions actives avant refactor.

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

## 12) Prochaine priorite recommandee

Faire une passe de **consolidation / nettoyage**:
1. eliminer les doublons de fonctions dans `rpc_solver.py`
2. normaliser l'encodage des textes FR
3. ajouter des tests backend par methode (`cw`, `wb`, `slump`, `essai`) avec cas de reference Excel

