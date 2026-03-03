"""
Solver functions for RPG (Remblai Pâte Granulaire / Paste Aggregate Fill).

The PAF formulas are derived from the legacy C#/VB.NET reference code
(Form1.cs / Form1.vb, PAF section, lines 3041–3152).

Key difference vs RPC:
  - Two extra inputs per mix: aggregate_fraction_pct (A_m%) and aggregate_specific_gravity (Gs_agr)
  - Modified Gs formula (Gs_PAF) that includes the aggregate
  - Modified mass distribution: adds aggregate dry mass (Ma_sec)
  - Bw% is defined as  Mb / (Mr_sec + Ma_sec) × 100
    (binder per unit of non-binder solids, same concept as RPC when A_m=0)
  - All geotechnical formulas (e, n, ρd, ρh, …) are identical to RPC — just using Gs_PAF

Supported methods:
  - solve_rpg_cw  : Dosage selon Cw (% solides massiques) — PAF version
  - solve_rpg_wb  : Rapport eau/ciment (W/C) — PAF version
"""

from __future__ import annotations

from typing import List

from .models import (
    MixCategory,
    RpcMethod,
    RpgCwInputs,
    RpgWbInputs,
    RpgEssaiInputs,
    RpgEssaiAdjustment,
    MixComponentMass,
    MixState,
    MixDesignResult,
    BinderSystem,
    ResidueProps,
    GeneralInfo,
    SolverConstants,
)
from .rpc_solver import (
    compute_container_volume_m3,
    masse_volumique_S_liant_fonction,
    effective_binder_specific_gravity,
    _resolve_solver_constants,
)

# ======================================================================
#  PAF CORE FUNCTIONS  (direct translation from C#/VB.NET)
# ======================================================================

def _gs_paf(
    A_m: float,
    Gs_agr: float,
    Gs_res: float,
    Gs_liant: float,
    Bw_pct: float,
) -> float:
    """
    Equivalent Gs for the PAF backfill solids.

    Translation of masse_volumique_grain_solid_Paf_fonction (C#/VB):
        temp  = A_m/Gs_agr + (1-A_m)/Gs_res + (Bw%/100)/Gs_liant
        Gs_PAF = (1 + Bw%/100) / temp

    When A_m = 0 this reduces to the standard RPC formula:
        Gs_PAF = (1 + Bw/100) / (1/Gs_res + (Bw/100)/Gs_liant)
    """
    Bw_frac = Bw_pct / 100.0
    denom = A_m / Gs_agr + (1.0 - A_m) / Gs_res + Bw_frac / Gs_liant
    if denom <= 0.0:
        return 0.0
    return (1.0 + Bw_frac) / denom


def _rho_bulk_paf(Cw_pct: float, Gs_PAF: float, rho_eau: float) -> float:
    """
    PAF bulk (wet) density.

    Translation of masse_volumique_bulk_total_PAF_fonction (C#/VB):
        Cw = Cw% / 100
        rho_bulk = 1 / (Cw/Gs_PAF + (1-Cw)/rho_eau)

    rho_eau is normalised to 1.0 inside (same convention as VB code); the
    caller passes the actual water density so we normalise here.
    """
    Cw_frac = Cw_pct / 100.0
    # Normalise so the formula matches the VB code (rho_eau_norm = 1.0)
    rho_eau_norm = 1.0
    denom = Cw_frac / Gs_PAF + (1.0 - Cw_frac) / rho_eau_norm
    if denom <= 0.0:
        return 0.0
    # Result in g/cm³ → convert to kg/m³
    return (1.0 / denom) * rho_eau


def _masses_paf(
    MT_kg: float,
    A_m: float,
    Cw_pct: float,
    Bw_pct: float,
    w0_pct: float,
) -> dict:
    """
    Compute all component masses for a PAF recipe.

    Translations:
      Mr_sec  = masse_de_residu_sec_dans_le_remblai_PAF_fonction
      Ma_sec  = masse_de_aggrega_sec_dans_le_remblai_fonction
      Mb      = masse_de_liant_total_dans_le_remblai_PAF_function
      Mw      = masse_eau_total_dans_le_remblai_PAF_fonction
      Mr_hum  = masse_de_residu_humide_dans_le_remblai_PAF_fonction
      Mw_add  = masse_eau_a_rajouter_PAF_fonction
    """
    Cw_frac = Cw_pct / 100.0
    Bw_frac = Bw_pct / 100.0
    denom = 1.0 + Bw_frac

    Mr_sec = MT_kg * (1.0 - A_m) * Cw_frac / denom
    Ma_sec = MT_kg * A_m * Cw_frac / denom
    Mb     = MT_kg * Cw_frac * Bw_frac / denom
    Mw     = MT_kg * (1.0 - Cw_frac)

    # Wet residue mass: Mr_hum = Mr_sec / Cw_residu_humide
    # where Cw_residu_humide = 100 / (1 + w0/100)
    Cw_res_hum = 100.0 / (1.0 + w0_pct / 100.0)  # % solid of wet residue
    Mr_hum = Mr_sec / (Cw_res_hum / 100.0)         # = Mr_sec * (1 + w0/100)

    # Water to add = total water - water already in wet residue
    Mw_add = Mw - (Mr_hum - Mr_sec)

    return {
        "Mr_sec": Mr_sec,
        "Ma_sec": Ma_sec,
        "Mb":     Mb,
        "Mw":     Mw,
        "Mr_hum": Mr_hum,
        "Mw_add": Mw_add,
    }


# ======================================================================
#  SINGLE-RECIPE HELPERS
# ======================================================================

def _solve_single_rpg_cw_recipe(
    *,
    Cw_pct: float,
    Sr_pct: float,
    Bw_pct: float,
    A_m: float,
    Gs_agr: float,
    Gs_res: float,
    Gs_liant: float,
    Gs_binder: float,
    binder_system: BinderSystem,
    V_T: float,          # total backfill volume m³
    w0_pct: float,       # residue moisture content %
    water_density: float,
    gravity: float,
    container_volume_m3: float,
) -> MixState:
    """
    Solve one RPG recipe using the PAF Cw method.
    """
    Sr = max(Sr_pct / 100.0, 1e-9)

    # ── 1. Gs_PAF ──────────────────────────────────────────────────────
    Gs_PAF = _gs_paf(A_m, Gs_agr, Gs_res, Gs_liant, Bw_pct)

    # ── 2. Bulk density ─────────────────────────────────────────────────
    rho_h = _rho_bulk_paf(Cw_pct, Gs_PAF, water_density)

    # ── 3. Total mass ───────────────────────────────────────────────────
    MT_kg = rho_h * V_T  # kg (rho_h in kg/m³, V_T in m³)

    # ── 4. Water content and geotechnical parameters ────────────────────
    Cw_frac = Cw_pct / 100.0
    w = (1.0 / Cw_frac - 1.0) if Cw_frac > 0 else 0.0  # dimensionless

    e0 = w * Gs_PAF / Sr
    n  = e0 / (1.0 + e0) if e0 > -1.0 else 0.0
    Cv = 1.0 / (1.0 + e0) if e0 > -1.0 else 0.0

    rho_d = Gs_PAF * water_density / (1.0 + e0) if e0 > -1.0 else 0.0
    # double-check: rho_h ≈ rho_d * (1 + w)
    rho_h_check = rho_d * (1.0 + w)

    # ── 5. Component masses ─────────────────────────────────────────────
    masses = _masses_paf(MT_kg, A_m, Cw_pct, Bw_pct, w0_pct)
    Mr_sec = masses["Mr_sec"]
    Ma_sec = masses["Ma_sec"]
    Mb     = masses["Mb"]
    Mw     = masses["Mw"]
    Mr_hum = masses["Mr_hum"]
    Mw_add = masses["Mw_add"]

    # ── 6. Per-component binder masses ─────────────────────────────────
    def binder_split(idx: int) -> float:
        if idx >= len(binder_system.components):
            return 0.0
        return Mb * binder_system.components[idx].mass_fraction

    Mc1 = binder_split(0)
    Mc2 = binder_split(1)
    Mc3 = binder_split(2)

    # ── 7. Volumetric binder ratio (Bv) ────────────────────────────────
    Bv = 0.01 * Bw_pct * Gs_res / Gs_liant  # same formula as RPC

    # ── 8. W/C ratio ───────────────────────────────────────────────────
    wc_ratio = Mw / Mb if Mb > 0 else 0.0

    # ── 9. Theta (volumetric water content) ────────────────────────────
    theta = n * Sr

    # ── 10. Unit weights ────────────────────────────────────────────────
    bulk_uw  = rho_h_check * gravity / 1000.0  # kN/m³
    dry_uw   = rho_d * gravity / 1000.0

    # ── 11. Volumes ─────────────────────────────────────────────────────
    V_s = Cv * V_T
    V_v = V_T - V_s
    V_r = V_s                              # convention C# : Vr = Vs
    V_b = Mb / (Gs_liant * water_density)  # volume liant
    V_w = Mw / water_density               # volume eau

    components = MixComponentMass(
        residue_dry_mass_kg   = Mr_sec,
        residue_wet_mass_kg   = Mr_hum,
        aggregate_dry_mass_kg = Ma_sec,
        binder_total_mass_kg  = Mb,
        binder_c1_mass_kg     = Mc1,
        binder_c2_mass_kg     = Mc2,
        binder_c3_mass_kg     = Mc3,
        water_total_mass_kg   = Mw,
        water_to_add_mass_kg  = Mw_add,
    )

    return MixState(
        bulk_density_kg_m3      = rho_h_check,
        dry_density_kg_m3       = rho_d,
        solids_mass_pct         = Cw_pct,
        saturation_pct          = Sr_pct,
        wc_ratio                = wc_ratio,
        bw_mass_pct             = Bw_pct,
        bv_vol_pct              = Bv * 100.0,
        cv_vol_pct              = Cv * 100.0,
        w_mass_pct              = w * 100.0,
        void_ratio              = e0,
        porosity                = n,
        theta_pct               = theta * 100.0,
        gs_binder               = Gs_binder,
        gs_backfill             = Gs_PAF,
        bulk_unit_weight_kN_m3  = bulk_uw,
        dry_unit_weight_kN_m3   = dry_uw,
        container_volume_m3     = container_volume_m3,
        total_backfill_volume_m3= V_T,
        residue_volume_m3       = V_r,
        binder_volume_m3        = V_b,
        water_volume_m3         = V_w,
        solid_volume_m3         = V_s,
        void_volume_m3          = V_v,
        components              = components,
    )


def _solve_single_rpg_wb_recipe(
    *,
    Sr_pct: float,
    Bw_pct: float,
    wc_ratio: float,
    A_m: float,
    Gs_agr: float,
    Gs_res: float,
    Gs_liant: float,
    Gs_binder: float,
    binder_system: BinderSystem,
    V_T: float,
    w0_pct: float,
    water_density: float,
    gravity: float,
    container_volume_m3: float,
) -> MixState:
    """
    Solve one RPG recipe using the PAF W/C method.

    Given Bw% and W/C, derive Cw% analytically:
        wc = Mw/Mb = (1-Cw)(1+Bw) / (Cw*Bw)
        → Cw = (1+Bw) / (1 + Bw + wc*Bw)
    Then delegate to the Cw solver.
    """
    Bw_frac = Bw_pct / 100.0
    Cw_frac = (1.0 + Bw_frac) / (1.0 + Bw_frac + wc_ratio * Bw_frac) if (Bw_frac > 0 and wc_ratio > 0) else 0.0
    Cw_pct  = Cw_frac * 100.0

    return _solve_single_rpg_cw_recipe(
        Cw_pct           = Cw_pct,
        Sr_pct           = Sr_pct,
        Bw_pct           = Bw_pct,
        A_m              = A_m,
        Gs_agr           = Gs_agr,
        Gs_res           = Gs_res,
        Gs_liant         = Gs_liant,
        Gs_binder        = Gs_binder,
        binder_system    = binder_system,
        V_T              = V_T,
        w0_pct           = w0_pct,
        water_density    = water_density,
        gravity          = gravity,
        container_volume_m3 = container_volume_m3,
    )


# ======================================================================
#  PUBLIC SOLVERS
# ======================================================================

def solve_rpg_cw(payload: RpgCwInputs) -> MixDesignResult:
    """
    RPG — Dosage selon Cw%.
    """
    consts = _resolve_solver_constants(payload.constants)
    rho_eau = consts["water_density"]
    gravity  = consts["gravity"]

    # Container geometry
    container_volume_m3 = compute_container_volume_m3(payload.general)
    V_T = container_volume_m3 * payload.containers_per_recipe * payload.safety_factor

    # Aggregate parameters
    A_m    = payload.aggregate_fraction_pct / 100.0
    Gs_agr = float(payload.aggregate_specific_gravity)

    # Residue
    Gs_res = float(payload.residue.specific_gravity)
    w0_pct = float(payload.residue.moisture_mass_pct)

    # Binder Gs (harmonic mean of components)
    bs = payload.binder_system
    comps = bs.components
    f1_pct = comps[0].mass_fraction * 100.0 if len(comps) > 0 else 0.0
    f2_pct = comps[1].mass_fraction * 100.0 if len(comps) > 1 else 0.0
    f3_pct = comps[2].mass_fraction * 100.0 if len(comps) > 2 else 0.0
    gs1 = comps[0].specific_gravity if len(comps) > 0 else 1.0
    gs2 = comps[1].specific_gravity if len(comps) > 1 else 1.0
    gs3 = comps[2].specific_gravity if len(comps) > 2 else 1.0

    Gs_liant = masse_volumique_S_liant_fonction(f1_pct, f2_pct, f3_pct, gs1, gs2, gs3)
    if Gs_liant <= 0:
        Gs_liant = effective_binder_specific_gravity(bs)

    Cw_pct = float(payload.solids_mass_pct)
    Sr_pct = float(payload.saturation_pct)

    recipes: List[MixState] = []
    for i in range(payload.num_recipes):
        Bw_pct = float(payload.binder_mass_pct_recipes[i]) if i < len(payload.binder_mass_pct_recipes) else 0.0
        state = _solve_single_rpg_cw_recipe(
            Cw_pct          = Cw_pct,
            Sr_pct          = Sr_pct,
            Bw_pct          = Bw_pct,
            A_m             = A_m,
            Gs_agr          = Gs_agr,
            Gs_res          = Gs_res,
            Gs_liant        = Gs_liant,
            Gs_binder       = Gs_liant,
            binder_system   = bs,
            V_T             = V_T,
            w0_pct          = w0_pct,
            water_density   = rho_eau,
            gravity         = gravity,
            container_volume_m3 = container_volume_m3,
        )
        recipes.append(state)

    return MixDesignResult(
        category = MixCategory.RPG,
        method   = RpcMethod.CW,
        general  = payload.general,
        recipes  = recipes,
    )


def solve_rpg_wb(payload: RpgWbInputs) -> MixDesignResult:
    """
    RPG — Rapport eau/ciment (W/C).
    """
    consts = _resolve_solver_constants(payload.constants)
    rho_eau = consts["water_density"]
    gravity  = consts["gravity"]

    container_volume_m3 = compute_container_volume_m3(payload.general)
    V_T = container_volume_m3 * payload.containers_per_recipe * payload.safety_factor

    A_m    = payload.aggregate_fraction_pct / 100.0
    Gs_agr = float(payload.aggregate_specific_gravity)
    Gs_res = float(payload.residue.specific_gravity)
    w0_pct = float(payload.residue.moisture_mass_pct)
    Sr_pct = float(payload.saturation_pct)

    bs = payload.binder_system
    comps = bs.components
    f1_pct = comps[0].mass_fraction * 100.0 if len(comps) > 0 else 0.0
    f2_pct = comps[1].mass_fraction * 100.0 if len(comps) > 1 else 0.0
    f3_pct = comps[2].mass_fraction * 100.0 if len(comps) > 2 else 0.0
    gs1 = comps[0].specific_gravity if len(comps) > 0 else 1.0
    gs2 = comps[1].specific_gravity if len(comps) > 1 else 1.0
    gs3 = comps[2].specific_gravity if len(comps) > 2 else 1.0

    Gs_liant = masse_volumique_S_liant_fonction(f1_pct, f2_pct, f3_pct, gs1, gs2, gs3)
    if Gs_liant <= 0:
        Gs_liant = effective_binder_specific_gravity(bs)

    recipes: List[MixState] = []
    for i in range(payload.num_recipes):
        Bw_pct   = float(payload.binder_mass_pct_recipes[i]) if i < len(payload.binder_mass_pct_recipes) else 0.0
        wc_ratio = float(payload.wc_ratio_recipes[i]) if i < len(payload.wc_ratio_recipes) else 0.0
        state = _solve_single_rpg_wb_recipe(
            Sr_pct          = Sr_pct,
            Bw_pct          = Bw_pct,
            wc_ratio        = wc_ratio,
            A_m             = A_m,
            Gs_agr          = Gs_agr,
            Gs_res          = Gs_res,
            Gs_liant        = Gs_liant,
            Gs_binder       = Gs_liant,
            binder_system   = bs,
            V_T             = V_T,
            w0_pct          = w0_pct,
            water_density   = rho_eau,
            gravity         = gravity,
            container_volume_m3 = container_volume_m3,
        )
        recipes.append(state)

    return MixDesignResult(
        category = MixCategory.RPG,
        method   = RpcMethod.WB,
        general  = payload.general,
        recipes  = recipes,
    )


def solve_rpg_essai(inputs: RpgEssaiInputs) -> MixDesignResult:
    """
    RPG — Méthode essai-erreur (variante PAF).

    Identical in structure to solve_rpc_essai, but:
      - Supports added_aggregate_mass in each adjustment.
      - Bw% is defined as  Mb / (Mr_sec + Ma_sec) × 100.
      - A_m is recomputed from the updated (Mr_sec_Tot, Ma_sec_Tot).
      - Gs_PAF is recomputed using the new A_m and Bw_target_pct.
    """
    if inputs.base_method == RpcMethod.CW:
        if inputs.base_inputs_cw is None:
            raise ValueError("base_inputs_cw est requis pour base_method=CW")
        base_inputs = inputs.base_inputs_cw
        if base_inputs.constants is None and inputs.constants is not None:
            base_inputs = base_inputs.model_copy(update={"constants": inputs.constants})
        base_result = solve_rpg_cw(base_inputs)
        Gs_agr = float(base_inputs.aggregate_specific_gravity)
        Gs_res = float(base_inputs.residue.specific_gravity)
        w0_pct = float(base_inputs.residue.moisture_mass_pct)
    elif inputs.base_method == RpcMethod.WB:
        if inputs.base_inputs_wb is None:
            raise ValueError("base_inputs_wb est requis pour base_method=WB")
        base_inputs = inputs.base_inputs_wb
        if base_inputs.constants is None and inputs.constants is not None:
            base_inputs = base_inputs.model_copy(update={"constants": inputs.constants})
        base_result = solve_rpg_wb(base_inputs)
        Gs_agr = float(base_inputs.aggregate_specific_gravity)
        Gs_res = float(base_inputs.residue.specific_gravity)
        w0_pct = float(base_inputs.residue.moisture_mass_pct)
    else:
        raise ValueError("base_method doit être CW ou WB")

    constantes = _resolve_solver_constants(inputs.constants)
    water_density = constantes["water_density"]
    gravity = constantes["gravity"]

    w0 = w0_pct / 100.0
    fractions = [c.mass_fraction for c in inputs.binder_system.components]

    # Binder Gs (harmonic mean of components)
    bs = inputs.binder_system
    comps = bs.components
    f1_pct = comps[0].mass_fraction * 100.0 if len(comps) > 0 else 0.0
    f2_pct = comps[1].mass_fraction * 100.0 if len(comps) > 1 else 0.0
    f3_pct = comps[2].mass_fraction * 100.0 if len(comps) > 2 else 0.0
    gs1 = comps[0].specific_gravity if len(comps) > 0 else 1.0
    gs2 = comps[1].specific_gravity if len(comps) > 1 else 1.0
    gs3 = comps[2].specific_gravity if len(comps) > 2 else 1.0
    Gs_liant = masse_volumique_S_liant_fonction(f1_pct, f2_pct, f3_pct, gs1, gs2, gs3)
    if Gs_liant <= 0:
        Gs_liant = effective_binder_specific_gravity(bs)

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        base_state = base_result.recipes[i]
        base_comp  = base_state.components
        adj = inputs.adjustments[i] if i < len(inputs.adjustments) else RpgEssaiAdjustment()

        # ------------------------------------------------------------------
        # A) Decompose adjustments
        # ------------------------------------------------------------------
        delta_sec = adj.added_dry_residue_mass
        delta_wet = adj.added_wet_residue_mass
        delta_eau = adj.added_water_mass
        delta_agr = adj.added_aggregate_mass   # RPG-specific
        w0_ag     = adj.aggregate_moisture_mass_pct / 100.0  # w0-ag

        sec_from_wet = delta_wet / (1.0 + w0) if (1.0 + w0) > 0 else 0.0
        eau_from_wet = delta_wet - sec_from_wet   # [28]
        eau_from_sec = delta_sec * w0
        eau_from_agr = delta_agr * w0_ag          # water carried by added aggregate

        # ------------------------------------------------------------------
        # B) Updated solid masses [23a] + aggregate
        # ------------------------------------------------------------------
        Mr_sec_Tot = base_comp.residue_dry_mass_kg + delta_sec + sec_from_wet  # [23a]
        Ma_sec_Tot = base_comp.aggregate_dry_mass_kg + delta_agr

        # ------------------------------------------------------------------
        # C) New A_m (aggregate fraction among non-binder solids)
        # ------------------------------------------------------------------
        solids_non_binder = Mr_sec_Tot + Ma_sec_Tot
        A_m_new = Ma_sec_Tot / solids_non_binder if solids_non_binder > 0 else 0.0

        # ------------------------------------------------------------------
        # D) Binder adjustment [24-27]  — Bw% denominator is (Mr_sec + Ma_sec)
        # ------------------------------------------------------------------
        Bw_target_pct = base_state.bw_mass_pct
        Gs_binder     = base_state.gs_binder
        rho_s_binder  = Gs_binder * water_density

        # [25a] Total binder needed to maintain Bw_target_pct
        Mb_Tot = Bw_target_pct / 100.0 * solids_non_binder

        # [26] Binder mass to add (never remove)
        Mb_ad = max(Mb_Tot - base_comp.binder_total_mass_kg, 0.0)

        # [27a-c] Per-component binder to add
        Mc1_ad = Mb_ad * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_ad = Mb_ad * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_ad = Mb_ad * (fractions[2] if len(fractions) >= 3 else 0.0)

        # ------------------------------------------------------------------
        # E) Water total [29a-b]
        # ------------------------------------------------------------------
        Mw_Tot = base_comp.water_total_mass_kg + delta_eau + eau_from_wet + eau_from_sec + eau_from_agr
        Vw_Tot = Mw_Tot / water_density

        # ------------------------------------------------------------------
        # F) New Gs_PAF with updated A_m and Bw_target
        # ------------------------------------------------------------------
        Gs_PAF_new = _gs_paf(A_m_new, Gs_agr, Gs_res, Gs_liant, Bw_target_pct)

        # ------------------------------------------------------------------
        # G) Derived parameters [30-34]
        # ------------------------------------------------------------------
        Ms_Tot = solids_non_binder + Mb_Tot   # all dry solids

        cw_aj    = Ms_Tot / (Ms_Tot + Mw_Tot) * 100.0 if (Ms_Tot + Mw_Tot) > 0 else 0.0
        w_aj     = Mw_Tot / Ms_Tot if Ms_Tot > 0 else 0.0
        wc_aj    = Mw_Tot / Mb_Tot if Mb_Tot > 0 else 0.0

        Sr_base  = max(base_state.saturation_pct / 100.0, 1e-6)
        e_aj     = w_aj * Gs_PAF_new / Sr_base

        n_aj     = e_aj / (1.0 + e_aj) if e_aj > -1.0 else 0.0
        Cv_aj    = 1.0 / (1.0 + e_aj) if e_aj > -1.0 else 0.0
        rho_d_aj = Gs_PAF_new * water_density / (1.0 + e_aj) if e_aj > -1.0 else 0.0
        rho_h_aj = rho_d_aj * (1.0 + w_aj)

        # ------------------------------------------------------------------
        # H) Volumes [33a-c, 33g] — same containers, VT unchanged
        # ------------------------------------------------------------------
        VT_aj = base_state.total_backfill_volume_m3
        Vs_aj = Cv_aj * VT_aj
        Vv_aj = VT_aj - Vs_aj

        Sr_aj_pct    = (Vw_Tot / Vv_aj * 100.0) if Vv_aj > 0 else 100.0
        theta_aj_pct = n_aj * Sr_base * 100.0
        Bv_aj_pct    = 0.01 * Bw_target_pct * (Gs_res / Gs_liant) * 100.0 if Gs_liant > 0 else 0.0

        # ------------------------------------------------------------------
        # I) Wet residue and water-to-add
        # ------------------------------------------------------------------
        Mr_hum_Tot = Mr_sec_Tot * (1.0 + w0)
        Mw_to_add  = Mw_Tot - (Mr_hum_Tot - Mr_sec_Tot)

        Mc1_tot = Mb_Tot * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_tot = Mb_Tot * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_tot = Mb_Tot * (fractions[2] if len(fractions) >= 3 else 0.0)

        comp = MixComponentMass(
            residue_dry_mass_kg      = Mr_sec_Tot,
            residue_wet_mass_kg      = Mr_hum_Tot,
            aggregate_dry_mass_kg    = Ma_sec_Tot,
            binder_total_mass_kg     = Mb_Tot,
            binder_c1_mass_kg        = Mc1_tot,
            binder_c2_mass_kg        = Mc2_tot,
            binder_c3_mass_kg        = Mc3_tot,
            water_total_mass_kg      = Mw_Tot,
            water_to_add_mass_kg     = Mw_to_add,
            binder_to_add_mass_kg    = Mb_ad,
            binder_c1_to_add_mass_kg = Mc1_ad,
            binder_c2_to_add_mass_kg = Mc2_ad,
            binder_c3_to_add_mass_kg = Mc3_ad,
        )

        recipes.append(MixState(
            bulk_density_kg_m3       = rho_h_aj,
            dry_density_kg_m3        = rho_d_aj,
            solids_mass_pct          = cw_aj,
            saturation_pct           = Sr_aj_pct,
            wc_ratio                 = wc_aj,
            bw_mass_pct              = Bw_target_pct,
            bv_vol_pct               = Bv_aj_pct,
            cv_vol_pct               = Cv_aj * 100.0,
            w_mass_pct               = w_aj * 100.0,
            void_ratio               = e_aj,
            porosity                 = n_aj,
            theta_pct                = theta_aj_pct,
            gs_binder                = Gs_binder,
            gs_backfill              = Gs_PAF_new,
            bulk_unit_weight_kN_m3   = rho_h_aj * gravity / 1000.0,
            dry_unit_weight_kN_m3    = rho_d_aj * gravity / 1000.0,
            container_volume_m3      = base_state.container_volume_m3,
            total_backfill_volume_m3 = VT_aj,
            components               = comp,
        ))

    return MixDesignResult(
        category = MixCategory.RPG,
        method   = RpcMethod.ESSAI,
        general  = inputs.general,
        recipes  = recipes,
    )
