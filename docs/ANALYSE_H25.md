# Analyse du classeur H25 — formulations de recettes de remblais en pâte

Dépouillement complet du classeur pour permettre une implémentation future sans
repartir de zéro. Toutes les cellules citées proviennent d'une extraction
`tools/extract_workbook.py` (openpyxl, formules + valeurs cachées) réalisée le
2026-07-12. Les valeurs « cachées » sont celles enregistrées par Excel dans le
fichier, copiées telles quelles — jamais recalculées.

Documents frères : `Issues.md` (#3 convention Intra 2017, #4 convention
« gramme »), `backend/app/tests/excel_twin.py` et `excel_twin_gramme.py`
(oracles existants), `CONTEXTE_PROJET_IA.md` section 4 (conventions à
respecter).

---

## Identité du classeur

- **Fichier** : `Data/Feuille de calculs formulations recettes remblais en pâte H25 (1).xlsx` (89 046 octets — le plus gros des trois classeurs du dossier `Data/`).
- **Titre interne** (cellule `B1` des trois feuilles de calcul) : « CALCUL DES INGRÉDIENTS POUR LES RECETTES DE MÉLANGE DE REMBLAIS EN PÂTE CIMENTÉS ».
- **Auteur / année** : aucune mention dans les cellules (pas de « (c) Tikou Belem » comme dans le classeur gramme). « H25 » dans le nom de fichier désigne vraisemblablement la session Hiver 2025 — non confirmable par le contenu.
- **Feuilles** :

| Feuille | Dimensions | Contenu |
|---|---|---|
| `calculs melanges (GU-GUS)` | B1:O41 (41 lignes, 15 col.) | Recettes de laboratoire en moules, unités **g / cm³ / pouces** ; 10 colonnes de recettes prévues (F..O), 3 remplies (F, G, H) |
| `calculs melanges (general)` | B1:O100 | Recettes pilotées par la **masse de résidu humide disponible**, unités **t / m³** (récapitulatif en kg ou t) ; 3 recettes (F, G, H) + paramètres géotechniques + coûts |
| `calculs melanges (general) (2)` | B1:O100 | **Duplicata exact** de la précédente (mêmes formules, mêmes valeurs, cellule à cellule) |
| `Feuil1` | A1:A1 | Vide |

- **Unités natives** : feuille GU-GUS en grammes et cm³ (diamètre de moule saisi en pouces, converti par 2,54) ; feuille générale en tonnes et m³ avec ρw = 1 t/m³ implicite. Échelles de pourcentage **incohérentes entre feuilles** : `Cwt` saisi en % (85,5) dans GU-GUS mais en fraction (0,8203) dans la générale ; `Cwf`, `Bw`, `Sr`, `xGU` toujours en fraction.

---

## Entrées et sorties par feuille

### Feuille `calculs melanges (GU-GUS)` — colonne F = Recette #1 (idem G, H)

Entrées opérateur (cellules numériques sans formule) :

| Cellule | Libellé | Valeur (Recette #1) |
|---|---|---|
| `F4` | d moule (po) | 2 |
| `F7` | %solides résidus Cwt (%) | 85,5 (échelle 0-100) |
| `F9` | %solides remblai Cwf (%) | 0,76 (fraction) |
| `F10` | degré de saturation Sr (%) | 1 (fraction) |
| `F13` | Gs-t résidus (g/cm³) | 2,96 |
| `F14` | taux de liant Bw (%) | 0,08 (fraction) |
| `F15` / `F16` | Gs GU / Gs Slag | 3,15 / 2,9 |
| `F17` | Type de liant (texte) | « 55GU/45Slag » |
| `F18` | proportion GU xGU (%) | 0,10 (G : 0,28 ; H : 0,37) |
| `F25` | facteur de perte k | 1 |

Entrées « figées en formule » (constantes déguisées) : `F5` h moule `=2*F4`
(élancement 2:1 imposé), `F6` Nb de moules `=2*7` (14).

Sorties calculées : `F8` (wt), `F11`-`F12` (volumes moule/total), `F19`-`F24`
(dosages GU-GUS, Gs liant, Gs pâte, ρh), `F26`-`F33` (masses), `F35`-`F41`
(récapitulatif = simples renvois). **Pas de bloc essai-erreur, pas de
granulat, pas de slump.**

### Feuille `calculs melanges (general)` — colonnes F, G, H = Recettes #1-3

Entrées opérateur :

| Cellule | Libellé | F (Recette #1) | G (#2) | H (#3) |
|---|---|---|---|---|
| `F4`/`F5`/`F6` | Gs Slag / GU / FA-C | 2,94 / 3,15 / 2,62 | idem | idem |
| `F8` | Gs résidus | 2,98 | 2,98 | 3,17 |
| `F9` | Type de liant (texte) | GU-Slag | GU-FAC | GU seul |
| `F10` | proportion GU xGU | 0,3 | 0,5 | 1 |
| `F18` | Cwt (fraction) | 0,8203 | 0,8503 | 0,8 |
| `F20` | masse résidus humides Mth (t), figée en formule | `=0.001*500` = 0,5 | `=0.001*500` = 0,5 | `=8000*360` = 2 880 000 |
| `F21` | Cwf | 0,76 | 0,76 | 0,78 |
| `F22` | Sr | 1 | 1 | 1 |
| `F23` | Bw | 0,05 | 0,07 | 0,06 |
| `F30` | facteur de perte k | 1 (jamais utilisé — entrée morte) | 1 | 1 |

Sorties calculées : `F7` (Gs GUS prémélange), `F11`-`F17` (proportions et Gs
liant des 3 familles GU-Slag / GU-GUS / GU-FAC calculées **en parallèle**),
`F24`-`F29` (ρsf, ρhf par famille), `F31`-`F44` (masses), `F46`-`F56`
(récapitulatif kg ou t), `F58`-`F91` (paramètres géotechniques : w, W/C, Bv,
ρd, Cv, VT, Vv, θ, e, n, γh, γd), `F92`-`F93` (Bv avec Gs = 3,98 en dur),
`F94`-`F100` (coûts de liant, prix unitaires en dur). **Pas d'essai-erreur non
plus.**

---

## Chaîne de formules

Citations exactes du dump : cellule → formule → valeur cachée.

### Bloc 1 — Géométrie du moule (feuille GU-GUS)

- `F5: =2*F4` → 4 (h = 2d, pouces)
- `F11: =(2.54*F5)*PI()*(2.54*F4)^2/4` → 205.92591950522308 (V0 en cm³ ; **valeur identique au V_cont du classeur gramme**, même moule Ø2"×4")
- `F12: =F6*F11` → 2882.962873073123 (VT = 14 moules ; pas de facteur de sécurité sur le volume)

### Bloc 2 — Dosage GU-GUS (les deux feuilles ; nouveauté du classeur)

Le laboratoire pèse du GU pur et un prémélange « GUS » composé de 10 % GU +
90 % Slag (ratio 0,1/0,9 **en dur** dans les formules). Conversion proportion
cible (xGU, ySlag) → dosage de pesée (X_GU, Y_GUS) :

- `F18` (GU-GUS) : 0.1 (entrée xGU) ; `F19: =1-F18` → 0.9
- `F20: =F18-F19*(0.1/0.9)` → 0 (X_GU ; algébriquement (xGU − 0,1)/0,9)
- `G20: =G18-G19*(0.1/0.9)` → 0.2 ; `H20` → 0.3
- `F21: =1-F20` → 1 (Y_GUS)
- Générale : `F13: =F10-F11*(0.1/0.9)` → 0.2222222222222222 ; `F14: =1-F13` → 0.7777777777777778
- Gs du prémélange (générale) : `F7: =(0.1/F5+0.9/F4)^-1` → 2.959731543624161
- La feuille démontre elle-même l'équivalence des deux bases : `F15: =(F10/F5+F11/F4)^-1` → 3 (base GU/Slag) contre `F16: =(F13/F5+F14/F7)^-1` → 2.9999999999999996 (base GU/GUS) — identiques à l'ulp près.

### Bloc 3 — Gs équivalents et densités (les deux feuilles)

- Gs liant (GU-GUS) : `F22: =(F18/F15+F19/F16)^-1` → 2.9232 — moyenne harmonique, identique à D35 d'Intra 2017.
- Gs pâte (GU-GUS) : `F23: =(1+F14)*(F13*F22)/(F22+F14*F13)` → 2.9572423291139245 — réécriture algébrique **exacte** de D36 : (1+Bw)/((1/Gs_t)+(Bw/Gs_b)).
- Gs pâte (générale) : `F24: =(1+F23)*(1/F8+F23/F15)^-1` → 2.9809463321689424 — la forme D36 littérale.
- **ρh avec Sr explicite** (GU-GUS) : `F24: =F23*(F9+(F23/F10)*(1-F9))^-1` → 2.012087874993653, soit ρh = ρsf/(Cwf + (ρsf/Sr)(1−Cwf)). Identique (générale) : `F27: =F24/(F21+(F24/F22)*(1-F21))` → 2.020395512814994. C'est exactement la généralisation e = w·Gs/Sr du pipeline (vérifié : mêmes valeurs à 1e-15 en recalculant par e = w·Gs/Sr, ρd = Gs·ρw/(1+e), ρh = ρd(1+w)).

### Bloc 4 — Masses, feuille GU-GUS (pilotage par le volume, comme Intra 2017)

- `F26: =F25*F24*F12` → 5800.774640967295 (M_T = k·ρh·VT ; k = facteur de perte, multiplicatif sur la masse)
- `F27: =F26*(1-F9)` → 1392.1859138321508 (Mw = M_T(1−Cwf))
- `F29: =F9*(1+F8)*(F26/(1+F14))` → 4774.300116022465 (Mth ; répartition des solides par (1+Bw) — même convention que D41/D49 d'Intra 2017)
- `F28: =0.01*F7*F29` → 4082.0265991992073 (Mt-sec = Cwt·Mth ; noter le 0.01 : Cwt est en % sur cette feuille)
- `F30: =F9*F14*(F26/(1+F14))` → 326.5621279359366 (Mb = Bw·Mr_sec, identique à D43 avec Xg = 0)
- `F31: =F20*F30` → 0 ; `G31: =G20*G30` → 65.34888997652001 (masse GU pesée = X_GU·Mb — **base de pesée GU-GUS, pas GU-Slag**)
- `F32: =F21*F30` → 326.5621279359366 ; `G32` → 261.39555990608005 (masse GUS)
- `F33: =F26*(1-F9)-F28*F8` → 699.9123970088938 (Mw-aj = Mw − wt·Mt-sec, identique à D50)
- `F41: =SUM(F37:F40)` → 5800.774640967295 (bouclage : Mth + mGU + mGUS + Mw-aj = M_T)

### Bloc 5 — Masses, feuille générale (pilotage par la masse de résidu disponible)

- `F31: =F20*(1+F23)*(F18/F21)` → 0.5666546052631579 (M_T = Mth·(1+Bw)·Cwt/Cwf — **inversion du sens de calcul** : la masse totale découle du résidu disponible, pas d'un volume cible)
- `F32: =F31*(1-F21)` → 0.1359971052631579 (Mw)
- `F33: =F21*(F31/(1+F23))` → 0.41015 (Mt-sec ; = Cwt·Mth)
- `F34: =F23*F33` → 0.0205075 (Mb = Bw·Mt-sec)
- `F36: =F10*F34` → 0.006152250000000001 ; `F37: =F11*F34` → 0.01435525 (pesée base GU-Slag)
- `F39: =F13*F34` → 0.004557222222222222 ; `F40: =F14*F34` → 0.01595027777777778 (pesée base GU-GUS)
- `F44: =F31*(1-F21)-F33*(1/F18-1)` → 0.04614710526315792 (Mw-aj)
- `F48: =1000*F20` → 500 ; `H48: =1*H20` → 2880000 (récapitulatif : ×1000 pour les recettes « en kg », ×1 pour « en tonne » — pure présentation)

### Bloc 6 — Paramètres géotechniques (feuille générale, lignes 58-91)

- `F47: =(F33+F34)/F31` → 0.76 (Cw final, boucle sur l'entrée)
- `F60: =1/F47-1` → 0.3157894736842106 (w)
- `F67: =F32/F34` → 6.63157894736842 (W/C = Mw/Mb)
- `F68: =F23*(F8/F15)` → 0.049666666666666665 (Bv = Bw·Gs_t/Gs_b — identique à D90 / `bv` du pipeline)
- `F74: =F59*F72` → 1.5355005897393956 (ρd = Cw·ρh)
- `F76: =F74/F70` → 0.5151050769244016 (Cv = ρd/ρs, équivaut à 1/(1+e))
- `F78: =F31/F72` → 0.2804671667844107 (VT = M_T/ρh — le volume est une **sortie**)
- `F80: =F78*(1-F76)` → 0.13599710526315786 (Vv)
- `F82: =F60*(F74/1)` → 0.4848949230755988 (θ = w·ρd/ρw ; équivaut au θ = n·Sr du pipeline)
- `F84: =1/F76-1` → 0.9413514733165078 (e) ; `F86: =F84/(1+F84)` → 0.48489492307559845 (n)
- `F88: =9.81*F72` → 19.820079980715093 (γh) ; `F90: =9.81*F74` → 15.063260785343472 (γd)

### Bloc 7 — Bv alternatif et coûts (feuille générale, lignes 92-100)

- `F92: =F23*(3.98/F15)` → 0.06633333333333334 (« %liant volumique (Gs=3.98) » — numérateur 3,98 **en dur**, remplace le Gs résidus ; origine inconnue)
- `F94: =195*F36` → 1.1996887500000002 (coût GU à 195 $/t en dur)
- `F97: =210*F37` → 3.0146025 (Slag à 210 $/t) ; `F99: =160*F43` → 2.29684 (FA-C à 160 $/t)
- `F100: =F94+F97` → 4.2142912500000005 (coût total liant ; `G100: =G95+G99` — la famille sommée suit le type de liant de la colonne)
- `E96` « coût ciment GUS_liant_GU-GUS » et `E98` « coût Slag liant_GU-GUS » : libellés présents, **formules absentes** (fonctionnalité inachevée dans le classeur).

---

## Correspondance avec le pipeline actuel

Référence : `backend/app/core/mix_pipeline.py` (`solve_recipe`,
`apply_essai_adjustments`), `SolverConstants` (`backend/app/core/models.py`,
drapeaux `essai_gs_convention`, `essai_binder_rule`), solveurs
(`V_T = Vc·nb·safety_factor`, `rpc_solver.py:323`).

| Élément H25 (cellules) | Statut vis-à-vis du pipeline |
|---|---|
| Gs liant composé, moyenne harmonique (`F22` GU-GUS ; `F15`-`F17` générale) | **Identique à Intra 2017** (D35 ; liste `binders`) |
| Gs pâte (`F23` GU-GUS ; `F24`-`F26` générale) | **Identique** (D36, réécriture algébrique vérifiée numériquement) |
| ρh avec Sr explicite (`F24` GU-GUS ; `F27`-`F29` générale) | **Identique** à la généralisation Sr du pipeline (e = w·Gs/Sr) — le classeur H25 **valide a posteriori** ce choix de 2026-07-06 |
| wt = 1/Cwt − 1 (`F8` GU-GUS ; `F19` générale) | **Identique** (conversion d'entrée ; l'app saisit w0 directement) |
| Moule Ø pouces, h = 2d, nb moules (`F4`-`F6`, `F11`-`F12` GU-GUS) | **Identique / paramétrable par l'existant** (types de contenant + unités « po » déjà supportés ; h = 2d et « 2*7 » sont de la saisie, pas de la logique) |
| M_T = k·ρh·VT et répartition par (1+Bw) (`F26`, `F29`, `F30` GU-GUS) | **Identique** (Ms = ρd·VT = Cwf·M_T, split (1+Bw) = D39/D41/D43) ; k **paramétrable par le champ EXISTANT** `safety_factor` (multiplicateur de V_T, effet strictement équivalent sur les masses, nul sur l'état géotechnique) |
| Mw-aj = Mw − wt·Mt-sec (`F33` GU-GUS ; `F44` générale) | **Identique** (D50, négatif possible) |
| W/C, Bv, ρd, Cv, VT, Vv, θ, e, n, γh, γd (générale `F67`-`F91`) | **Identique** — chaque formule équivaut algébriquement au champ correspondant de `RecipeQuantities` (vérifié : Cv = ρd/ρs = 1/(1+e), θ = w·ρd/ρw = n·Sr, e = 1/Cv − 1) |
| Récapitulatif kg / t (`F46`-`F56` générale), 10 recettes côte à côte (GU-GUS) | Présentation pure (facteurs d'échelle, `num_recipes` existant) |
| **Dosage GU-GUS** : X_GU = xGU − ySlag·(0,1/0,9), pesée {GU pur, prémélange GUS} (`F20`-`F21`, `F31`-`F32` GU-GUS ; `F13`-`F14`, `F39`-`F40`, `F7` générale) | **Nouveau — mais hors noyau** : aucune constante ni drapeau existant ; capturable par un convertisseur côté pack/UI (constante `premix_gu_fraction = 0,10`) sans toucher `solve_recipe` — l'équivalence des Gs entre bases est démontrée par la feuille elle-même (`F15` vs `F16`) |
| **Pilotage par la masse de résidu humide disponible** Mth (`F20`, `F31` générale : M_T = Mth·(1+Bw)·Cwt/Cwf) | **STRUCTUREL (léger)** : `solve_recipe` est piloté par `v_total_m3` ; ce mode d'entrée inverse n'existe pas côté backend. La chaîne des masses est déjà implémentée **côté frontend** (`frontend/src/lib/industrie_helpers.ts`, `calculeUsine`, Dia 83 — formules vérifiées identiques : mrs = Mth·Cwt, Mb = Bw·mrs, total = (mrs+Mb)/Cwf, Mw-aj), mais sans l'état géotechnique. Implémentation propre : wrapper qui calcule VT_équiv = M_T/ρh (cellule `F78` !) puis appelle `solve_recipe` — aucun changement du noyau |
| Bv avec Gs = 3,98 en dur (`F92`-`F93` générale) | Nouveau scénario figé, **paramétrable trivialement** (recalcul de Bv avec un Gs alternatif) ; pas de drapeau — origine de 3,98 à éclaircir avant d'exposer |
| Coûts de liant, prix en dur 195/210/160 $/t (`F94`-`F100` générale) | **Paramétrable par la fonctionnalité EXISTANTE** `BinderPrice` / CostDashboard (onglet Industrie) ; il suffit d'un preset de prix |
| Facteur k saisi mais inutilisé (générale `F30`) | Entrée morte — rien à faire |
| Essai-erreur, granulat (Xg), slump | **Absents du classeur** — les drapeaux `essai_gs_convention` / `essai_binder_rule` ne sont ni sollicités ni contredits |

---

## Verdict

**Oui, capturable en pack de conventions — sans aucun nouveau drapeau du noyau
de calcul.** Le coeur mathématique des deux feuilles est textuellement la
convention Intra 2017 déjà en place (Gs pâte D36, Ms = ρd·VT, répartition
(1+Bw), Mw-aj = D50, Bv = D90), y compris la généralisation Sr que le pipeline
avait introduite par extrapolation et que H25 confirme par une formule
explicite. Le classeur ne contient ni essai-erreur, ni granulat, ni slump : il
ne peut donc entrer en conflit avec les drapeaux existants.

Trois nouveautés, toutes **périphériques au noyau** :

1. **Mode d'entrée « masse de résidu disponible »** (feuille générale) — la
   seule nouveauté qualifiable de structurelle, et encore : c'est une
   inversion d'entrée (VT_équiv = M_T/ρh, que la feuille calcule elle-même en
   `F78`), implémentable en wrapper au-dessus de `solve_recipe`. La moitié
   « masses » existe déjà dans `calculeUsine` (frontend, onglet Industrie).
2. **Convertisseur de dosage GU-GUS** (prémélange 10 % GU / 90 % Slag) —
   helper + constante `premix_gu_fraction`, côté pack/UI.
3. **Coûts de liant** — couverts par `BinderPrice` existant ; préremplir
   195/210/160 $/t en preset.

Pas de granulométrie, pas de nouvelle méthode de résolution (Cw imposé
partout), pas de nouvelle chaîne géotechnique.

---

## Plan d'oracle

Modèle : `excel_twin_gramme.py` (réplique 1:1 + dict `CACHED` de valeurs
cachées du classeur + `self_validate()` à 1e-9 ; « TEST ORACLE — DO NOT EDIT
TO MAKE TESTS PASS »). Un futur `backend/app/tests/excel_twin_h25.py`
comporterait deux fonctions (`run_general()` et `run_gu_gus()`) ou une seule à
deux modes.

**Cas canoniques choisis** :

- **Principal** — feuille `calculs melanges (general)`, **Recette #1
  (colonne F)** : GU-Slag, xGU = 0,3, Gs Slag/GU/FAC = 2,94/3,15/2,62,
  Gs_t = 2,98, Cwt = 0,8203, Mth = 0,5 t, Cwf = 0,76, Sr = 1, Bw = 0,05.
  Colonne la plus riche (chaîne complète masses + géotechnique + coûts).
- **Secondaire** — feuille `calculs melanges (GU-GUS)`, **Recette #2
  (colonne G)** : xGU = 0,28 donc X_GU = 0,2 **non dégénéré** (la Recette #1
  donne X_GU = 0, qui masquerait une erreur de signe dans le convertisseur) ;
  d = 2 po, 14 moules, Cwt = 85,5 %, Cwf = 0,76, Sr = 1, Gs_t = 2,96,
  Bw = 0,08, GU/Slag = 3,15/2,9, k = 1.

**Valeurs cachées candidates au `CACHED`** (copiées telles quelles du dump,
38 valeurs) :

Feuille `calculs melanges (general)`, colonne F (26 valeurs) :

| Cellule | Grandeur | Valeur cachée |
|---|---|---|
| F7 | Gs GUS prémélange | 2.959731543624161 |
| F13 | X_GU | 0.2222222222222222 |
| F16 | Gs-b base GU-GUS | 2.9999999999999996 |
| F17 | Gs-b GU-FAC | 2.759277833500502 |
| F19 | wt | 0.2190661952944044 |
| F24 | ρsf GU-Slag | 2.9809463321689424 |
| F27 | ρhf GU-Slag | 2.020395512814994 |
| F31 | M_T (t) | 0.5666546052631579 |
| F32 | Mw (t) | 0.1359971052631579 |
| F33 | Mt-sec (t) | 0.41015 |
| F34 | Mb (t) | 0.0205075 |
| F36 | mGU base GU-Slag (t) | 0.006152250000000001 |
| F37 | mSlag (t) | 0.01435525 |
| F39 | mGU base GU-GUS (t) | 0.004557222222222222 |
| F40 | mGUS (t) | 0.01595027777777778 |
| F44 | Mw-aj (t) | 0.04614710526315792 |
| F60 | w | 0.3157894736842106 |
| F67 | W/C | 6.63157894736842 |
| F68 | Bv | 0.049666666666666665 |
| F74 | ρdf | 1.5355005897393956 |
| F76 | Cv | 0.5151050769244016 |
| F78 | VT (m³) | 0.2804671667844107 |
| F82 | θ | 0.4848949230755988 |
| F84 | e0 | 0.9413514733165078 |
| F88 | γh (kN/m³) | 19.820079980715093 |
| F100 | coût total liant ($) | 4.2142912500000005 |

Feuille `calculs melanges (GU-GUS)`, colonne G (12 valeurs) :

| Cellule | Grandeur | Valeur cachée |
|---|---|---|
| G8 | wt | 0.16959064327485374 |
| G11 | V0 moule (cm³) | 205.92591950522308 |
| G12 | VT (cm³) | 2882.962873073123 |
| G20 | X_GU | 0.2 |
| G22 | Gs-b | 2.965909090909091 |
| G23 | ρsf | 2.9604369028492927 |
| G24 | ρhf | 2.013211237891076 |
| G26 | M_T (g) | 5804.013254493554 |
| G29 | Mth (g) | 4776.9656415584805 |
| G30 | Mb (g) | 326.74444988260007 |
| G31 | mGU (g) | 65.34888997652001 |
| G32 | mGUS (g) | 261.39555990608005 |

Tests d'or discriminants à prévoir en plus de la self-validation : (a) le
wrapper Mth → VT reproduit `F78` puis toute la colonne géotechnique via
`solve_recipe` ; (b) le convertisseur GU-GUS reproduit `G31`/`G32` et
l'identité `F15` = `F16` ; (c) équivalence k ↔ `safety_factor` sur `F26`.

---

## Inconnues et limites

Ce que le dump (formules + valeurs cachées, sans formats ni métadonnées) ne
permet pas de trancher :

- **Auteur et année** : aucune cellule de copyright ; « H25 » = Hiver 2025 est une inférence de nom de fichier.
- **Origine du Gs = 3,98** (`F92`-`F93` générale) : résidu spécifique d'un site ? coquille pour 2,98 ? Le libellé dit seulement « (Gs=3.98) ». À demander au professeur avant d'exposer cette sortie.
- **Étiquette « 55GU/45Slag »** (`F17` GU-GUS) incohérente avec les xGU saisis (0,10 / 0,28 / 0,37) : texte décoratif ou périmé — la logique réelle suit les nombres.
- **Prix 195 / 210 / 160 $/t** : devise, date et source non documentées dans le classeur ; les lignes de coût GUS (`E96`, `E98`) n'ont pas de formule.
- **Ratio prémélange GUS 10:90** : en dur à trois endroits (`F20` GU-GUS, `F7` et `F13` générale) ; rien n'indique s'il varie selon les fournisseurs.
- **Facteur de perte k** : utilisé dans GU-GUS (`F26`), saisi mais **jamais référencé** dans la générale (`F30`) — intention inconnue (oubli ou abandon).
- **Feuille `(2)`** : duplicata exact de la générale — copie de travail probable, aucune information supplémentaire.
- **Échelles d'entrée incohérentes** (Cwt en % sur une feuille, en fraction sur l'autre) : les formats d'affichage Excel ne sont pas extraits ; toute implémentation devra fixer l'échelle par champ et ne pas imiter cette ambiguïté.
- **Recette #3 de la générale** (`H20: =8000*360`) : ressemble à une production annuelle (8 000 t/j × 360 j) mais n'est pas étiquetée comme telle.
- **Colonnes I..O de GU-GUS** : sans saisies opérateur, mais pas vides — les formules sont tirées jusqu'en colonne O et les Gs GU/Slag (3,15 / 2,9) y sont préremplis (lignes 15-16) ; faute d'entrées, la ligne dosage rend X_GU = −0,1111 (xGU vide traité comme 0) et les masses cascadent en `#DIV/0!`. 10 recettes prévues, 3 remplies ; aucune valeur de référence à en tirer.
- **Pas d'essai-erreur, pas de granulat, pas de slump** dans ce classeur : il ne peut pas servir à arbitrer les conventions `essai_gs_convention` / `essai_binder_rule` (voir Issues.md #4) ni le modèle de slump.
