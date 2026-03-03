# Known Issues — minebackfill

---

## Issue #2 — Bv% formula uses Gs_res instead of effective non-binder Gs in RPG

**Status:** Open (cosmetic — does not affect geotechnical calculations)

**File:** `backend/app/core/rpg_solver.py`

**Location:** `_solve_single_rpg_cw_recipe` (line ~207) and `solve_rpg_essai` (Bv_aj_pct line ~570)

### Description

The volumetric binder ratio (Bv%) is currently computed using `Gs_res` alone:

```python
# Current (incorrect for RPG when A_m > 0)
Bv = 0.01 * Bw_pct * Gs_res / Gs_liant
```

For RPG (PAF), the non-binder solids are a mixture of **residue + aggregate**. The correct
formula should use the **effective specific gravity of non-binder solids**:

```
Gs_eff = 1 / (A_m / Gs_agr + (1 - A_m) / Gs_res)
```

So the corrected formula would be:

```python
# Correct for RPG
Gs_eff_nonbinder = 1.0 / (A_m / Gs_agr + (1.0 - A_m) / Gs_res)
Bv = 0.01 * Bw_pct * Gs_eff_nonbinder / Gs_liant
```

### Numerical Impact

Example: A_m=30%, Gs_agr=2.65, Gs_res=3.4, Bw=5%, Gs_liant=3.02176

- Current: Gs_eff = Gs_res = 3.4 → Bv% = 0.05 × 3.4 / 3.02176 × 100 = **5.626%**
- Correct: Gs_eff = 1/(0.30/2.65 + 0.70/3.4) = **2.9656** → Bv% = 0.05 × 2.9656 / 3.02176 × 100 = **4.906%**
- Difference: ~0.72 percentage points for A_m=30%

The larger A_m is, the bigger the overestimation.

### Scope

- Affects only the **displayed** `bv_vol_pct` field in `MixState`.
- Does **not** affect: e, n, ρd, ρh, Cw%, Sr, Bw%, Mw, Mb, Mr, Ma, or any
  other geotechnical or mass output.
- When A_m = 0 (pure RPC), the formula is already exact (Gs_eff = Gs_res).

### Files to Change (when fixing)

| File | Change |
|------|--------|
| `backend/app/core/rpg_solver.py` | In `_solve_single_rpg_cw_recipe`: replace `Bv = 0.01 * Bw_pct * Gs_res / Gs_liant` with the Gs_eff formula |
| `backend/app/core/rpg_solver.py` | In `solve_rpg_essai`: replace `Bv_aj_pct = 0.01 * Bw_target_pct * (Gs_res / Gs_liant) * 100.0` with the Gs_eff formula |

Note: `_solve_single_rpg_wb_recipe` delegates to `_solve_single_rpg_cw_recipe`, so it
will be fixed automatically.

---

*Logged: 2026-03-03*
