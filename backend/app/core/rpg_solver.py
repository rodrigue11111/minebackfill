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
from .mix_pipeline import (
    solve_recipe,
    apply_essai_adjustments,
    gs_backfill_eff,
    gs_nonbinder_eff,
    cw_from_wc,
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
    return gs_backfill_eff(Gs_res, A_m, Gs_agr, Bw_pct / 100.0, Gs_liant)


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

    # Pipeline Intra 2017 — identique à la feuille du professeur à Sr = 100 % ;
    # Sr < 100 % est la généralisation cohérente (Ms = rho_d * V_T, e = w*Gs/Sr).
    q = solve_recipe(
        cw_frac=Cw_pct / 100.0,
        sr_frac=Sr,
        bw_frac=Bw_pct / 100.0,
        xg_frac=A_m,
        gs_r=Gs_res,
        gs_g=Gs_agr,
        gs_binder=Gs_liant,
        w0_frac=w0_pct / 100.0,
        v_total_m3=V_T,
        water_density=water_density,
    )

    def binder_split(idx: int) -> float:
        if idx >= len(binder_system.components):
            return 0.0
        return q.mb * binder_system.components[idx].mass_fraction

    components = MixComponentMass(
        residue_dry_mass_kg   = q.mr_sec,
        residue_wet_mass_kg   = q.mr_hum,
        aggregate_dry_mass_kg = q.mg_sec,
        binder_total_mass_kg  = q.mb,
        binder_c1_mass_kg     = binder_split(0),
        binder_c2_mass_kg     = binder_split(1),
        binder_c3_mass_kg     = binder_split(2),
        water_total_mass_kg   = q.mw_total,
        water_to_add_mass_kg  = q.mw_to_add,
    )

    return MixState(
        bulk_density_kg_m3      = q.rho_h,
        dry_density_kg_m3       = q.rho_d,
        solids_mass_pct         = Cw_pct,
        saturation_pct          = Sr_pct,
        wc_ratio                = q.wc,
        bw_mass_pct             = Bw_pct,
        bv_vol_pct              = q.bv * 100.0,
        cv_vol_pct              = q.cv * 100.0,
        w_mass_pct              = q.w * 100.0,
        void_ratio              = q.e,
        porosity                = q.n,
        theta_pct               = q.theta * 100.0,
        gs_binder               = Gs_binder,
        gs_backfill             = q.gs_backfill,
        bulk_unit_weight_kN_m3  = q.rho_h * gravity / 1000.0,
        dry_unit_weight_kN_m3   = q.rho_d * gravity / 1000.0,
        container_volume_m3     = container_volume_m3,
        total_backfill_volume_m3= V_T,
        residue_volume_m3       = q.vr,
        binder_volume_m3        = q.vb,
        water_volume_m3         = q.vw,
        solid_volume_m3         = q.vs,
        void_volume_m3          = q.vv,
        aggregate_volume_m3     = q.vg,
        aggregate_vol_pct_of_residue=(q.vg / (q.vg + q.vr) * 100.0) if (q.vg + q.vr) > 0 else 0.0,
        aggregate_vol_pct_of_backfill=(q.vg / V_T * 100.0) if V_T > 0 else 0.0,
        aggregate_mass_pct      = (q.mg_sec / (q.mg_sec + q.mr_sec) * 100.0) if (q.mg_sec + q.mr_sec) > 0 else 0.0,
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
    Cw_frac = cw_from_wc(Bw_frac, wc_ratio)
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

    # Composition de base pour les Gs (convention feuille : Gs de BASE figés)
    A_m_base = max(0.0, min(float(base_inputs.aggregate_fraction_pct) / 100.0, 1.0))
    gs_g_base = Gs_agr if Gs_agr > 0 else None
    gs_nb_base = gs_nonbinder_eff(Gs_res, A_m_base if gs_g_base else 0.0, gs_g_base)

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        base_state = base_result.recipes[i]
        base_comp = base_state.components
        adj = inputs.adjustments[i] if i < len(inputs.adjustments) else RpgEssaiAdjustment()

        Gs_binder = base_state.gs_binder

        # Ajustements selon la feuille Intra 2017 [D57-D96] : le volume total
        # croît des volumes ajoutés, Sr reste à la valeur de base [D86-D87],
        # liant/eau « à ajouter » non bornés (négatif = à retirer) [D65, D50].
        eq = apply_essai_adjustments(
            mr_sec_base=base_comp.residue_dry_mass_kg,
            mg_sec_base=base_comp.aggregate_dry_mass_kg,
            mb_base=base_comp.binder_total_mass_kg,
            mw_base=base_comp.water_total_mass_kg,
            vt_base=base_state.total_backfill_volume_m3,
            bw_target_frac=base_state.bw_mass_pct / 100.0,
            gs_r=Gs_res,
            gs_g=gs_g_base,
            gs_binder=Gs_binder,
            gs_backfill_base=base_state.gs_backfill,
            gs_nonbinder_base=gs_nb_base,
            w0_frac=w0,
            delta_dry_residue=adj.added_dry_residue_mass,
            delta_wet_residue=adj.added_wet_residue_mass,
            delta_water=adj.added_water_mass,
            delta_aggregate=adj.added_aggregate_mass,
            aggregate_w0_frac=adj.aggregate_moisture_mass_pct / 100.0,
            water_density=water_density,
        )

        Mb_ad = eq.mb_ad
        Mc1_ad = Mb_ad * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_ad = Mb_ad * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_ad = Mb_ad * (fractions[2] if len(fractions) >= 3 else 0.0)
        Mc1_tot = eq.mb_tot * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_tot = eq.mb_tot * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_tot = eq.mb_tot * (fractions[2] if len(fractions) >= 3 else 0.0)

        comp = MixComponentMass(
            residue_dry_mass_kg=eq.mr_sec_tot,
            residue_wet_mass_kg=eq.mr_hum_tot,
            aggregate_dry_mass_kg=eq.mg_sec_tot,
            binder_total_mass_kg=eq.mb_tot,
            binder_c1_mass_kg=Mc1_tot,
            binder_c2_mass_kg=Mc2_tot,
            binder_c3_mass_kg=Mc3_tot,
            water_total_mass_kg=eq.mw_tot,
            water_to_add_mass_kg=eq.mw_to_add,
            binder_to_add_mass_kg=Mb_ad,
            binder_c1_to_add_mass_kg=Mc1_ad,
            binder_c2_to_add_mass_kg=Mc2_ad,
            binder_c3_to_add_mass_kg=Mc3_ad,
        )

        recipes.append(MixState(
            bulk_density_kg_m3=eq.rho_h,
            dry_density_kg_m3=eq.rho_d,
            solids_mass_pct=eq.cw * 100.0,
            saturation_pct=eq.sr * 100.0,
            wc_ratio=eq.wc,
            bw_mass_pct=base_state.bw_mass_pct,
            bv_vol_pct=eq.bv * 100.0,
            cv_vol_pct=eq.cv * 100.0,
            w_mass_pct=eq.w * 100.0,
            void_ratio=eq.e,
            porosity=eq.n,
            theta_pct=eq.theta * 100.0,
            gs_binder=Gs_binder,
            gs_backfill=eq.gs_backfill,
            bulk_unit_weight_kN_m3=eq.rho_h * gravity / 1000.0,
            dry_unit_weight_kN_m3=eq.rho_d * gravity / 1000.0,
            container_volume_m3=base_state.container_volume_m3,
            total_backfill_volume_m3=eq.vt_new,
            residue_volume_m3=eq.vr_new,
            binder_volume_m3=eq.vb_new,
            water_volume_m3=eq.vw_tot,
            solid_volume_m3=eq.vs_new,
            void_volume_m3=eq.vv_new,
            aggregate_volume_m3=eq.vg_new,
            aggregate_vol_pct_of_residue=(eq.vg_new / (eq.vg_new + eq.vr_new) * 100.0) if (eq.vg_new + eq.vr_new) > 0 else 0.0,
            aggregate_vol_pct_of_backfill=(eq.vg_new / eq.vt_new * 100.0) if eq.vt_new > 0 else 0.0,
            aggregate_mass_pct=(eq.mg_sec_tot / (eq.mg_sec_tot + eq.mr_sec_tot) * 100.0) if (eq.mg_sec_tot + eq.mr_sec_tot) > 0 else 0.0,
            components=comp,
        ))

    return MixDesignResult(
        category = MixCategory.RPG,
        method   = RpcMethod.ESSAI,
        general  = inputs.general,
        recipes  = recipes,
    )
