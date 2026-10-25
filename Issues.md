# Known Issues — minebackfill

---

## Issue #2 — Bv% formula uses Gs_res instead of effective non-binder Gs in RPG

**Status:** FIXED (2026-07-06)

**Fix:** All Bv computations now go through `mix_pipeline.gs_nonbinder_eff()`
(harmonic Gs of résidus + granulat, Excel Intra 2017 cell D34) via
`solve_recipe()` and `apply_essai_adjustments()` in
`backend/app/core/mix_pipeline.py`. Verified by golden tests
(`app/tests/test_excel_golden.py`) against the professor's workbook: Bv is now
identical to the sheet at every granulat fraction (was up to 10.7 % off at
Xg = 50 %).

---

## Issue #3 — RPC masses inflated by (1+Bv): legacy « Vr = Vs » convention

**Status:** FIXED (2026-07-06) — convention change

### Description

The RPC solver built masses with the 2005 « Modèle C1b » convention
(`V_r = V_s`, binder volume added on top), which made **every mass output**
(résidu sec/humide, liant total et par ciment, eau totale, eau à ajouter)
exactly `(1 + Bv)` times the professor's reference workbook
`Data/Feuille calculs mélanges_tonne (Intra 2017).xlsx`
(+4.7 % at Bw = 4.5 %, +9.5 % at Bw = 8 %). Geotechnical ratios
(e, n, ρ, Cw, W/C, Bv, Cv) were unaffected. Affected `/rpc/cw`, `/rpc/wb`,
`/rpc/slump` and the `/rpc/essai` base recipe.

### Fix (backend/app/core/mix_pipeline.py, shared by both solvers)

- `Ms_total = ρd · V_T` (Excel D39), split by `(1 + Bw)` (D41-D44) —
  both RPC and RPG now use this single pipeline; RPC is the Xg = 0 case.
- RPG masses now honour the Sr input (previously assumed saturation
  regardless of Sr); at Sr = 100 % nothing changes.
- Essai-erreur follows the sheet: total volume grows by the added component
  volumes (D61-D64), `e = Gs·ρw·VT_new/Ms − 1` (D86), `Sr = Gs·w/e` (D87 —
  stays at the base value), Cv/θ from real volumes (D82/D80).
- Negative « à ajouter » values are no longer clamped: negative water (D50)
  or binder (D65) means « à retirer », as in the sheet.
- Essai Gs convention: `ESSAI_GS_CONVENTION = "base"` (sheet-faithful, frozen
  base-composition Gs). Set to `"recalcule"` for the physically rigorous
  variant (recomputed Gs_PAF; ≤ 0.4 % differences on e/ρs/n when granulat
  additions change the proportion) — decision of 2026-07-06 with the user.

### Verification

- `backend/app/tests/excel_twin.py` — exact replica of the workbook, pinned
  to 38 cached cell values (oracle; do not edit to make tests pass).
- `backend/app/tests/test_excel_golden.py` — 215 tests: Mélange 1 canonical
  case, 144-case Cw grid, W/C grid + `Mw = wc·Mb` invariant, 13 essai
  scenarios (ajouts, retraits, granulat, combos), Sr = 85 % invariants,
  safety-factor/containers mapping.
- Exhaustive sweep (2 304 Cw + 128 W/C combos + 13 essai scenarios): every
  field identical to the sheet at rel ≤ 1e-9.

### Caveat

Results saved in the browser (localStorage « Historique ») **before**
2026-07-06 were computed with the old convention: their masses are (1+Bv)
higher than what the app now produces for the same inputs. They still display
fine; recompute if needed.

Note: the professor's own 2005 C#/Modèle C1b program uses the old convention
and therefore disagrees with his Intra 2017 sheet by the same (1+Bv) factor.
The app now follows the Intra 2017 sheet (confirmed reference).

---

## Issue #4 — Convention « en gramme » (feuille TBelem 2016) : règle du liant en essai

**Status:** DOCUMENTED (2026-07-11) — sera capturée en pack de convention (P4).

**Classeur:** `Data/Feuille calculs remblais_TBelem_en gramme (1).xlsx`, feuille
`Calculs ingredients (en gr)`. « Feuille de calcul des mélanges de remblai en
pâte cimenté (RPC) + granulat concassé (RPCg) au laboratoire en fixant le %
solide massique initial (Cw%) » — © Tikou Belem (2016). Extraction locale
(openpyxl, hors requirements ; script jetable dans le scratchpad).

**Recette de base : IDENTIQUE à Intra 2017.** Vérifié numériquement contre les
valeurs cachées (Recette 1 : Cw = 0,73 ; Bw = 0,05 ; Gs_res = 3,0 ;
GU20/Slag80 → Gs_liant = 2,946774… ; V_T = 2574,074 cm³) :
- `D36` Gs_remblai `= (1+Bw)/((1/Gs_nb)+(Bw/Gs_liant))` → 2,997421875
- `D39` Ms `= (Cw·V_T)·((Cw/Gs_bkf)+(1−Cw))^-1` → 3659,0419… (= ρ_d·V_T)
- `D43` liant `= Bw·(Mr_sec+Mg_sec)` → 174,2400… ; `D44` eau → 1353,3442…
La feuille fixe **Sr = 100 %** (`D40` ≈ 1, calculé). Donc la base se reproduit
avec le solveur actuel à `saturation_pct = 100` — même convention `Ms = ρ_d·V_T`.

**LA divergence — règle du liant en essai (`D65`).** Sur ajout d'ingrédients :
- **Gramme** : `D65` (liant à ajouter) `= D60 · Bw` où `D60` = **résidu sec
  ajouté seulement**. L'ajout de **granulat** (`D58`) ou d'**eau** (`D57`) n'ajoute
  **aucun liant**. Liant total = `D43 + D65` (base + ajout résidu).
- **Intra 2017 (pipeline actuel, `mix_pipeline.py:263`)** : `mb_tot = Bw ·
  solids_nb` où `solids_nb = résidu_sec_total + granulat_sec_total` ; donc
  `mb_ad = Bw · (résidu ajouté + granulat ajouté)`.

Les deux règles **coïncident** tant qu'on n'ajoute pas de granulat en essai
(scénario courant : ajout de résidu ou d'eau). Elles **divergent** dès qu'on
ajoute du granulat : la feuille gramme n'y associe aucun liant, le pipeline si.

**Modélisation (P4).** Drapeau `essai_binder_rule` ∈ {`solides_totaux` (défaut =
Intra 2017), `residu_ajoute` (gramme)} dans `SolverConstants`, threadé dans
`apply_essai_adjustments`. Défaut = comportement actuel → suite d'or inchangée.
Le pack UI « gramme » applique le preset. Oracle : `excel_twin_gramme.py` +
tests d'or discriminants (au moins un scénario « ajout granulat » où
`|mb_ad(gramme) − mb_ad(intra)| > seuil`).

**Aucun autre delta structurel relevé** (base recette, volumes, W/C, Cv, e, Sr :
mêmes formules qu'Intra 2017). Une 2ᵉ feuille du classeur, `Synthese calculs`,
est une simple mise en page des résultats (pas de nouvelle formule métier).

**Nuance découverte à l'implémentation de l'oracle.** Sous la règle gramme, un
ajout de granulat *sans liant* **dilue le Bw atteint** (`D89` = liant/solides
< Bw cible). L'essai du solveur reporte désormais le **Bw ATTEINT**
(`mb_tot/solides`, cellule `D89`) et non plus le Bw cible — strictement
identique en Intra 2017 (le liant y suit tous les solides, donc atteint = cible),
correct en gramme. La feuille gramme **s'arrête à `D90` (Bv) : aucune masse
volumique** (`D91-D96`, propres à la feuille tonne) ; sous gramme, la densité de
l'app suit la convention « base » (Gs figé) — non arbitrable par la feuille, donc
non comparée à l'oracle gramme.

---

*Logged: 2026-03-03 · Updated: 2026-07-11*

## Issue #5 — Enrichissements de l'article C4 (Belem et al. 2018, PAF) : dosage du liant par W/C, saisie volumique Av, cible de slump

**Référence.** BELEM T., HANE I., BENZAAZOUA M. & MAQSOUD A. (2018). *Reuse of
crushed waste rocks in mine backfill*, Symposium Mines & Environnement,
Rouyn-Noranda (PDF : `Progiciel de Mr Belem/C4-Belem et al Paste aggregate
fill paper_Symposium 2018b.pdf`). Analyse complète : le noyau de calcul de
l'app est CONFORME à l'article (éq. [1]-[5], convention Bw = liant/(résidus+
granulats) secs, protocole d'essai §2.3 ≡ règle `solides_totaux`). Trois
enrichissements en découlent — des AJOUTS optionnels, pas des corrections :

1. **Dosage du liant par W/C en essai** (article §3.2.3 : quand on monte le
   slump en ajoutant de l'eau, doser le liant par le rapport eau/liant et non
   plus en % de masse sèche). Champ additif `dose_binder_by_wc` (défaut
   `false`) sur `RpcEssaiAdjustment`/`RpgEssaiAdjustment` ; règle dans
   `apply_essai_adjustments` : `wc_base = mw_base/mb_base ;
   mb_tot = mw_tot/wc_base` (le liant suit l'EAU, y compris celle transportée
   par un résidu humide ; un granulat sec n'ajoute aucun liant et dilue le
   Bw atteint, publié tel quel en D89). Prioritaire sur `essai_binder_rule`.
   Garde-fou : exige Bw > 0 sur la recette de base (validateur Pydantic, 422).
   Défaut `false` → comportement Intra 2017/gramme préservé au bit près
   (suite d'or inchangée). Tests : `app/tests/test_essai_dose_wc.py`.

2. **Saisie volumique Av** (éq. [2]-[3] : l'article pilote ses mélanges en
   %v/v ; la physique du squelette granulaire est volumique, mais on pèse des
   masses). Sélecteur « % masse / % volume » sur la fraction granulat des
   formulaires RPG (`ChampFractionGranulat.tsx`) ; conversion exacte via les
   Gs courants (`frontend/src/lib/granulats.ts`, testée) ; la valeur canonique
   envoyée au backend reste Am (aucun changement backend).

3. **Cible de slump en essai RPG** (protocole §2.3 : cible 178 mm / 7 po au
   cône d'Abrams 300 mm ; slump bas → eau ; slump haut → solides + liant).
   Champ « slump cible » dans l'essai RPG + écart et geste conseillé affichés
   sous le slump mesuré (`MesuresLabo`, prop optionnelle — RPC inchangé).
   AUCUN modèle prédictif ajouté : le modèle slump n'existe qu'en RPC et ne
   s'applique pas au RPG ; la boucle de convergence reste chez l'opérateur,
   l'app fournit le critère d'arrêt et l'arithmétique de chaque itération.

**Statut.** Implémenté (branche `feat/article-c4-enrichissements`). La règle
n'a pas d'oracle Excel (elle vient de l'article, pas d'un classeur) ; ses
tests unitaires en fixent la définition.

---

*Logged: 2026-07-23*

## Issue #6 : Essai-erreur : e, Sr et ρs gardent le Gs de départ (feuilles) ; le site calcule avec la composition finale

**Status:** RÉSOLU côté site (2026-10-25), calculateur fidèle à la feuille par défaut.

**Classeurs :** `Data/Feuille calculs mélanges_tonne (Intra 2017).xlsx` et
`Data/Feuille calculs remblais_TBelem_en gramme (1).xlsx`, mêmes formules :

| Cellule | Formule | Gs utilisé |
|---|---|---|
| D82, Cv final | `=(D41/C10+D42/E10+D43/D35+D61+D62+D63)/(D38+D61+D62+D63+D64)` | volumes réels (Gs propre de chaque ingrédient) |
| D86, e final | `=(D36*(D38+D61+D62+D63+D64)/(D39+D58+D60+D65))-1` | D36, Gs de la pâte de DÉPART |
| D87, Sr final | `=D36*D79/D86` | D36 |
| D88, n final | `=D86/(1+D86)` | (via D86) |
| D95, ρs final | `=(1+D89)/(1/D34+D89/D35)` | Bw final, mais D34 (résidu + granulat de DÉPART) |

**Le défaut.** Le volume total et Cv utilisent les volumes réels ; e, Sr et ρs
un Gs de départ. Tant que la composition des grains ne change pas (RPC, ajout
d'eau ou de résidu avec le liant qui garde le Bw), les deux coïncident. Dès
qu'un ajout la change (granulat, Bw dilué), la feuille se contredit. Réplique
exacte `excel_twin.py` (Gs résidu 3,05, granulat 2,70, liant 3,15, Cw 75 %,
Bw 5 %, gâchée de 2,6 L) :

| Cas | Sr (D87) | n (D88) | 1 − Cv (D82) |
|---|---|---|---|
| RPC + eau + résidu humide | 100,00 % | 0,5520 | 0,5520 |
| RPG Xg 30 % + 300 g de résidu humide | 100,21 % | 0,4935 | 0,4945 |
| RPG Xg 30 % + 1 kg de granulat | 97,74 % | 0,4413 | 0,4313 |

La feuille en grammes donne les mêmes écarts (`excel_twin_gramme.py` :
100,21 %, 100,64 % pour 1 kg de résidu humide, 99,29 % pour 300 g de granulat).
Écart sur e : 1,3 % pour 300 g de granulat, 4 % pour 1 kg (la docstring de
`mix_pipeline.py` annonçait « ≤ 0,4 % » : faux, corrigé).

**Correction.** Gs de la composition FINALE (Bw final D89 ET part finale de
granulat D83) : `(1 + Bw) / ((1 − Xg)/Gs_r + Xg/Gs_g + Bw/Gs_b)` = Ms/(Vs·ρw).
Alors e = Vv/Vs, Sr = Vw/Vv, n = 1 − Cv, ρd = Ms/VT exactement ; le volume
d'air de la base est conservé (les ajouts n'en apportent pas), Sr = 100 % sur
une base saturée. Les masses et les volumes ne changent pas. C'est la branche
`essai_gs_convention = "recalcule"` de `apply_essai_adjustments`, qui prenait
jusque-là le Bw VISÉ (Sr 99,97 % avec « aucun liant ») : corrigée pour le Bw
final.

**Décisions (2026-10-25).**
- Calculateur : défaut `base` inchangé (tests d'or `test_excel_golden.py`,
  `test_excel_golden_gramme.py` intacts) ; le site envoie `recalcule`
  (imposé dans `completerConstantes`, `frontend/src/lib/store.tsx`).
- Version : pack gramme `gramme-1.1`. Un essai-erreur estampillé
  `gramme-1.0` ou `intra2017-1.0` porte la pastille « convention révisée »
  (masses justes, e/n/Sr/ρ à recalculer) ; les autres méthodes restent
  courantes (calcul identique).
- Traçabilité : un essai-erreur sauvegardé sous une autre convention est
  restauré avec ses chiffres enregistrés, mais PÉRIMÉ
  (`EMPREINTE_CONVENTION_REVISEE`) : ni sauvegarde ni export avant recalcul.
- Tests : `test_unit_pipeline.py::TestCompositionFinale` (bases saturée et à
  Sr 0,85 ; règles du liant, dosage par E/L ; ajouts seuls et combinés ;
  masses et volumes identiques entre conventions).

À faire relire par le professeur : la convention « Gs de la composition
finale » pour e, Sr et ρ après ajouts.

---

*Logged: 2026-10-25*
