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

**Aucun autre delta structurel relevé** (base recette, densités, volumes, W/C,
Cv, e, Sr : mêmes formules qu'Intra 2017). Une 2ᵉ feuille du classeur,
`Synthese calculs`, est une simple mise en page des résultats (pas de nouvelle
formule métier).

---

*Logged: 2026-03-03 · Updated: 2026-07-11*
