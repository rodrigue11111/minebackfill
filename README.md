# MineBackfill — Outil de dimensionnement des mélanges de remblai minier

Application web de calcul des recettes de **remblai cimenté en pâte** (RPC), **remblai pâte
granulaire** (RPG/PAF) et bientôt remblai rocheux cimenté (RRC), développée dans le cadre du
Module 1 du programme de M. Belem (GNM1002).

**Application en ligne : https://frontend-eight-xi-64.vercel.app**

## Ce que fait l'outil

À partir des propriétés du résidu (Gs, teneur en eau), du système liant (1 à 3 ciments) et de
la géométrie du contenant, l'application calcule des recettes complètes :

- masses des composants (résidu sec/humide, granulat, eau à ajouter/retirer, liant par ciment) ;
- paramètres géotechniques (e, n, ρd, ρh, Cw%, Cv%, Sr, W/C, Bw%, Bv%, θ) ;
- quatre méthodes : **Dosage Cw%**, **Rapport eau/ciment (W/C)**, **Ajustement pour slump**
  (RPC) et **Méthode essai-erreur** (ajouts/retraits d'eau, de résidu et de granulat) ;
- un module **Industrie** : comparaison des coûts de liant par niveau de Bw% et journal de
  production ;
- exports **Excel** et **PDF**, historique local des résultats, unités configurables.

## Validation contre le classeur de référence

Les solveurs reproduisent **cellule par cellule** le classeur de référence du professeur
(`Data/Feuille calculs mélanges_tonne (Intra 2017).xlsx`) :

- `backend/app/tests/excel_twin.py` — réplique Python exacte de la feuille, validée sur
  38 valeurs du classeur (précision ~1e-15) ;
- `backend/app/tests/` — **514 tests** : les tests d'or (tolérance 1e-9, cas
  canonique « Mélange 1 », grille de 144 combinaisons Cw, grille W/C avec invariant
  Mw = W/C × Mb, 13 scénarios d'essai-erreur), les tests d'or RRC/CRF, les tests
  unitaires du pipeline (identités algébriques sur grille aléatoire reproductible,
  constantes personnalisées, géométrie du contenant, modèle de slump), les tests
  de contrat HTTP et les gardes-fous de validation (limite de 3 liants, entrées
  hors domaine). Côté frontend : 116 tests Vitest (conversions d'unités, calculs
  usine, grandeurs dérivées, w/Cw mesurés, constructeurs de payload, persistance
  versionnée, bibliothèques de matériaux, prix des liants, invariants des formules).

Le bouton **« Exemple Intra 2017 »** de la page Informations charge exactement les entrées du
classeur : l'application affiche alors les mêmes valeurs que la feuille du professeur.

## Architecture

| Couche | Techno | Rôle |
|---|---|---|
| `frontend/` | Next.js 16 · React 19 · Zustand | Saisie, affichage, exports (le calcul reste côté serveur) |
| `backend/`  | FastAPI · Pydantic | Solveurs (`app/core/mix_pipeline.py` — pipeline partagé RPC/RPG, convention Intra 2017) |

Endpoints : `POST /rpc/cw`, `/rpc/wb`, `/rpc/slump`, `/rpc/essai`, `/rpg/cw`, `/rpg/wb`,
`/rpg/essai` — documentation interactive sur `/docs`.

## Lancer en local

Backend (Python 3.13) :

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20+, pnpm) :

```powershell
cd frontend
pnpm install
pnpm dev
```

Application sur http://localhost:3000 (le proxy Next.js redirige `/rpc` et `/rpg` vers le
backend, configurable via `BACKEND_URL`).

Tests :

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest   # tests d'or + unitaires + contrat
cd ../frontend
pnpm test                              # tests Vitest
```

### Types de l'API (générés depuis l'OpenAPI)

`frontend/src/lib/api-types.gen.ts` est **généré** depuis le schéma OpenAPI du
backend ; `types.ts` en dérive `Recipe`/`RecipeComponents`/`RrcRecipe`. Le
fichier généré est commité (la CI ne le régénère pas — pas de réseau). Après un
changement des modèles de réponse Pydantic, régénérer avec le backend en marche :

```powershell
# backend démarré sur http://127.0.0.1:8000
cd frontend
pnpm gen:api
```

Un champ de réponse renommé côté backend disparaît alors du type et casse le
`pnpm typecheck` des consommateurs — c'est voulu (fini les lectures `undefined`
silencieuses).

## Notes de conventions

- Convention de calcul : feuille « Intra 2017 » (`Ms = ρd·VT`) — voir `Issues.md` pour
  l'historique du changement par rapport au Modèle C1b 2005 (`Vr = Vs`).
- Facteur de sécurité : multiplicateur (1 = aucun surplus ; la feuille du professeur saisit
  un pourcentage : FS % → 1 + FS/100).
- L'essai-erreur suit la feuille : le volume total croît des volumes ajoutés, Sr reste à la
  valeur de base, les valeurs « à ajouter » négatives signifient « à retirer ».
