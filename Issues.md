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

*Logged: 2026-03-03 · Updated: 2026-07-06*
