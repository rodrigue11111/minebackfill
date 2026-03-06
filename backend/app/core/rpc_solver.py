"""
Solver functions for mine backfill mix design.

Right now we implement:

- solve_rpc_cw : RPC â€“ Dosage selon Cw (% de solides massiques)

The logic is aligned with the C#/Excel "ModÃ¨le C1" sheet:

1) Gs_liant from the binary/ternary binder (fractions 1â€“3)
2) Gs_bkf (remblai) from Gs_residu, Gs_liant and Bw% (liant/rÃ©sidu)
3) Water content from Cw%:
       w = (1/Cw - 1)
4) e0 from w, Gs_bkf, Sr:
       e0 = (w% / 100) * Gs_bkf / Sr
       n  = e0 / (1 + e0)
5) Densities:
       Ï_d = Gs_bkf * Ïw / (1 + e0)
       Ï_h = Ï_d * (1 + w)
6) Cv = Ï_d / Ï_s_bkf = 1 / (1 + e0)
7) Geometry:
       V_T = V_moule * N_c * FS
       V_s = Cv * V_T
       V_v = V_T - V_s
8) Volumetric binder ratio:
       Bv = 0.01 * Bw% * Ï_s_residu / Ï_s_liant
   C# convention (as provided): Vr = Vs
       Vr = V_s
       Vb = Bv * Vr
       Vw = 0.01 * Sr% * V_v
9) Masses:
       M_r_sec = Ï_s_residu * Vr
       M_r_hum = M_r_sec * (1 + w0%)
       M_b     = Ï_s_liant * Vb
       M_w_tot = Ï_w * Vw
       M_w_res = M_r_hum - M_r_sec = 0.01*w0%*M_r_sec
       M_w_add = M_w_tot - M_w_res
       w/c     = M_w_tot / M_b

Masses are then reported in MixComponentMass and MixState.
"""

from __future__ import annotations

import math
from typing import List, Optional

from .models import (
    ContainerType,
    MixCategory,
    RpcMethod,
    GeneralInfo,
    ResidueProps,
    BinderSystem,
    SolverConstants,
    RpcCwInputs,
    RpcWbInputs,
    RpcSlumpInputs,
    RpcEssaiInputs,
    RpcEssaiAdjustment,
    MixComponentMass,
    MixState,
    MixDesignResult,
)

# ----------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------

WATER_DENSITY = 1000.0  # kg/m3 (approx. 20 C)
GRAVITY = 9.81          # m/s2
SLUMP_SMALL_TO_LARGE_FACTOR = 2.335
SLUMP_MODEL_COEFF = 4.95e6
SLUMP_MODEL_OFFSET = 235.5122


def _resolve_solver_constants(constants: Optional[SolverConstants]) -> dict:
    """
    Returns effective constants for calculations.
    Keeps previous hardcoded defaults if no override is provided.
    """
    if constants is None:
        return {
            "water_density": WATER_DENSITY,
            "gravity": GRAVITY,
            "slump_small_to_large_factor": SLUMP_SMALL_TO_LARGE_FACTOR,
            "slump_model_coeff": SLUMP_MODEL_COEFF,
            "slump_model_offset": SLUMP_MODEL_OFFSET,
        }
    return {
        "water_density": float(constants.water_density),
        "gravity": float(constants.gravity),
        "slump_small_to_large_factor": float(constants.slump_small_to_large_factor),
        "slump_model_coeff": float(constants.slump_model_coeff),
        "slump_model_offset": float(constants.slump_model_offset),
    }


def _ensure_sequence_length(
    *,
    name: str,
    values: Optional[list],
    num_recipes: int,
    required: bool = True,
) -> None:
    """
    Validate that a sequence contains enough values for `num_recipes`.
    """
    if values is None:
        if required:
            raise ValueError(f"{name} est requis.")
        return
    if len(values) < num_recipes:
        raise ValueError(
            f"{name} doit contenir au moins {num_recipes} valeur(s). "
            f"Recu: {len(values)}."
        )

# ======================================================================
#  GEOMETRY UTILITIES
# ======================================================================

def compute_container_volume_m3(general: GeneralInfo) -> float:
    """
    Compute mould/container volume [mÂ³] from GeneralInfo.

    - SECTION_HEIGHT: section (cmÂ²) + height (cm)
    - RADIUS_HEIGHT:  radius (cm) + height (cm)
    - LENGTH_WIDTH_HEIGHT: length, width, height (cm)

    Raises if required dimensions are missing.
    """
    # Type de contenant
    ct = general.container_type
    if ct is None:
        raise ValueError("container_type must be provided in GeneralInfo.")

    # SECTION_HEIGHT: V = section(cmÂ²) * height(cm)  => mÂ³
    if ct == ContainerType.SECTION_HEIGHT:
        if general.container_section is None or general.container_height is None:
            raise ValueError(
                "container_section and container_height are required "
                "for SECTION_HEIGHT."
            )
        section_cm2 = float(general.container_section)
        h_cm = float(general.container_height)
        # 1 cmÂ² = 1e-4 mÂ², 1 cm = 1e-2 m -> cmÂ²*cm = 1e-6 mÂ³
        return section_cm2 * h_cm * 1.0e-6

    # RADIUS_HEIGHT: V = Ï€ rÂ² h (r, h in cm)
    if ct == ContainerType.RADIUS_HEIGHT:
        if general.container_radius is None or general.container_height is None:
            raise ValueError(
                "container_radius and container_height are required "
                "for RADIUS_HEIGHT."
            )
        r_m = float(general.container_radius) / 100.0
        h_m = float(general.container_height) / 100.0
        return math.pi * r_m * r_m * h_m

    # LENGTH_WIDTH_HEIGHT: V = L * W * H (L,W,H in cm)
    if ct == ContainerType.LENGTH_WIDTH_HEIGHT:
        if (
            general.container_length is None
            or general.container_width is None
            or general.container_height is None
        ):
            raise ValueError(
                "container_length, container_width and container_height "
                "are required for LENGTH_WIDTH_HEIGHT."
            )
        L_m = float(general.container_length) / 100.0
        W_m = float(general.container_width) / 100.0
        H_m = float(general.container_height) / 100.0
        return L_m * W_m * H_m

    raise ValueError(f"Unknown container_type: {ct}")


# ======================================================================
#  SPECIFIC GRAVITIES
# ======================================================================

def masse_volumique_S_liant_fonction(
    f1_pct: float, f2_pct: float, f3_pct: float, gs1: float, gs2: float, gs3: float
) -> float:
    """
    Formule harmonique (C#) pour le Gs du liant :
        Gs_liant = 1 / (0.01*f1/gs1 + 0.01*f2/gs2 + 0.01*f3/gs3)
    Les fractions sont donnÃ©es en pourcentage (0â€“100).
    """
    denom = 0.01 * f1_pct / gs1 + 0.01 * f2_pct / gs2 + 0.01 * f3_pct / gs3
    return 1.0 / denom if denom > 0 else 0.0


def effective_binder_specific_gravity(binder_system: BinderSystem) -> float:
    """
    Equivalent specific gravity of the binder, from components.

    Uses the harmonic average in terms of Gs:
        1/Gb_eq = sum_i (mass_fraction_i / Gs_i)
    """
    binder_system.validate_total_fraction()
    denom = 0.0
    for c in binder_system.components:
        denom += c.mass_fraction / c.specific_gravity
    if denom <= 0.0:
        raise ValueError("Invalid binder specific gravity combination.")
    return 1.0 / denom


def equivalent_backfill_specific_gravity(
    *,
    residue: ResidueProps,
    binder_system: BinderSystem,
    binder_mass_pct: float,
    binder_gs_override: Optional[float] = None,
) -> float:
    """
    Equivalent specific gravity Gs_remblai for the mixture "rÃ©sidu + liant"
    for a given recipe.

    binder_mass_pct is Bw% defined like in Excel:
        Bw% = (M_b / M_residu_dry) * 100

    We need fb = M_b / M_s where M_s = M_residu_dry + M_b:

        Bw_ratio = M_b / M_residu_dry = Bw% / 100
        fb       = M_b / (M_residu_dry + M_b)
                 = Bw_ratio / (1 + Bw_ratio)
                 = (Bw%/100) / (1 + Bw%/100)
                 = Bw% / (100 + Bw%)

    Then the mixture rule in terms of Gs is:

        1 / Gs_backfill = (1 - fb)/Gs_residu + fb/Gs_binder
    """
    # convert Bw% (liant / rÃ©sidu) to ratio
    bw_ratio = binder_mass_pct / 100.0        # M_b / M_residu
    fb = bw_ratio / (1.0 + bw_ratio)          # M_b / (M_residu + M_b)
    fb = max(min(fb, 0.999999), 0.0)

    G_r = float(residue.specific_gravity)
    G_b = (
        binder_gs_override
        if binder_gs_override is not None and binder_gs_override > 0
        else effective_binder_specific_gravity(binder_system)
    )

    return 1.0 / ((1.0 - fb) / G_r + fb / G_b)


# ======================================================================
#  RPC â€“ DOSAGE SELON Cw (% DE SOLIDES MASSIQUES)
# ======================================================================

def _solve_single_cw_recipe(
    *,
    Cw_pct: float,
    Sr_pct: float,
    residue: ResidueProps,
    binder_system: BinderSystem,
    binder_pct_recipe: float,      # Bw% final for this recipe (M_b / M_residu * 100)
    container_volume_m3: float,
    containers_per_recipe: int,
    safety_factor: float,
    water_density: float,
    gravity: float,
    aggregate_fraction_pct: float = 0.0,
    aggregate_specific_gravity: float | None = None,
    debug: bool = False,
    debug_prefix: str = "",
) -> MixState:
    """
    Solve ONE recipe for the RPC-Cw method using the same logic
    as in the C#/Excel sheet + C# convention Vr = Vs.

    If debug=True, all important steps are printed with [RPC-CW DEBUG].
    """

    def log(name: str, value: float) -> None:
        if debug:
            print(f"[RPC-CW DEBUG] {debug_prefix}{name} = {value:.6f}")

    # ------------------------------------------------------------------
    # Fractions and basic inputs
    # ------------------------------------------------------------------
    Cw = Cw_pct / 100.0
    Sr = max(Sr_pct / 100.0, 1e-6)
    log("Cw_pct", Cw_pct)
    log("Cw_fraction", Cw)
    log("Sr_pct", Sr_pct)
    log("Sr_fraction", Sr)

    # ------------------------------------------------------------------
    # Specific gravities: binder and backfill
    # ------------------------------------------------------------------
    comps = binder_system.components
    f1_pct = comps[0].mass_fraction * 100.0 if len(comps) >= 1 else 0.0
    f2_pct = comps[1].mass_fraction * 100.0 if len(comps) >= 2 else 0.0
    f3_pct = comps[2].mass_fraction * 100.0 if len(comps) >= 3 else 0.0
    gs1 = comps[0].specific_gravity if len(comps) >= 1 else 3.15
    gs2 = comps[1].specific_gravity if len(comps) >= 2 else gs1
    gs3 = comps[2].specific_gravity if len(comps) >= 3 else gs1

    Gs_binder = masse_volumique_S_liant_fonction(f1_pct, f2_pct, f3_pct, gs1, gs2, gs3)
    if Gs_binder <= 0:
        Gs_binder = effective_binder_specific_gravity(binder_system)

    Gs_backfill = equivalent_backfill_specific_gravity(
        residue=residue,
        binder_system=binder_system,
        binder_mass_pct=binder_pct_recipe,
        binder_gs_override=Gs_binder,
    )
    log("Gs_binder", Gs_binder)
    log("Gs_backfill", Gs_backfill)

    rho_s_bkf = Gs_backfill * water_density
    rho_s_residue = float(residue.specific_gravity) * water_density
    rho_s_binder = Gs_binder * water_density

    # ------------------------------------------------------------------
    # Water content, void ratio, porosity
    # ------------------------------------------------------------------
    # Cw = Ms / (Ms + Mw)  => Mw/Ms = (1/Cw) - 1
    w_mass_fraction = (1.0 / Cw) - 1.0
    w_pct = w_mass_fraction * 100.0
    log("w_mass_fraction", w_mass_fraction)
    log("w_pct", w_pct)

    # w% = (Sr * e / Gs) * 100  =>  e = (w/100) * Gs / Sr
    e0 = (w_pct / 100.0) * Gs_backfill / Sr
    n = e0 / (1.0 + e0)
    log("e0", e0)
    log("n", n)
    theta = n * Sr
    log("theta", theta)

    # Densities (kg/mÂ³)
    dry_density = Gs_backfill * water_density / (1.0 + e0)
    bulk_density = dry_density * (1.0 + w_mass_fraction)
    log("dry_density_kg_m3", dry_density)
    log("bulk_density_kg_m3", bulk_density)

    # ------------------------------------------------------------------
    # Volumetric solids fraction Cv, geometry, volumes
    # ------------------------------------------------------------------
    Cv = dry_density / rho_s_bkf  # should be 1 / (1 + e0)
    log("Cv", Cv)

    V_T = container_volume_m3 * float(containers_per_recipe) * float(safety_factor)
    log("container_volume_m3", container_volume_m3)
    log("containers_per_recipe", float(containers_per_recipe))
    log("safety_factor", float(safety_factor))
    log("V_T_m3", V_T)

    V_s = Cv * V_T
    V_v = V_T - V_s
    log("V_s_m3", V_s)
    log("V_v_m3", V_v)

    # ------------------------------------------------------------------
    # Binder volumetric ratio Bv, volumes Vr, Vb, Vw
    # ------------------------------------------------------------------
    # Bv = 0.01 * Bw% * (Gs_res / Gs_liant), avec branche agrÃ©gat (A_m)
    A_m = max(0.0, min(aggregate_fraction_pct / 100.0, 1.0))
    if aggregate_specific_gravity and aggregate_specific_gravity > 0 and A_m > 0:
        gs_res_eff = 1.0 / (
            A_m / aggregate_specific_gravity + (1.0 - A_m) / float(residue.specific_gravity)
        )
    else:
        gs_res_eff = float(residue.specific_gravity)
    Bv = 0.01 * binder_pct_recipe * (gs_res_eff / Gs_binder)
    log("Bw_pct_recipe", binder_pct_recipe)
    log("A_m", A_m)
    log("Gs_res_eff", gs_res_eff)
    log("Bv", Bv)

    # C# convention as given: Vr = Vs (volume_des_rejets = volume_de_solide)
    V_r = V_s
    V_b = Bv * V_r
    # Mw total par la relation Cw (massique), comme en C# : Mw = Ms * [(1/Cw) - 1]
    # (on en dÃ©duit V_w ensuite)
    # Note : V_w peut dÃ©passer V_v si l'hypothÃ¨se Sr=100% n'est pas
    # strictement cohÃ©rente avec Cw, mais on suit l'Excel/C#.
    # Masse des solides secs totaux
    Ms_total = rho_s_residue * V_r  +  rho_s_binder * V_b
    M_water_total = Ms_total * w_mass_fraction
    V_w = M_water_total / water_density
    log("V_r_m3", V_r)
    log("V_b_m3", V_b)
    log("V_w_m3", V_w)

    # ------------------------------------------------------------------
    # Masses: residue, binder, water
    # ------------------------------------------------------------------
    w0_fraction = residue.moisture_mass_pct / 100.0
    log("residue_moisture_pct", residue.moisture_mass_pct)

    M_r_sec = rho_s_residue * V_r
    M_r_hum = M_r_sec * (1.0 + w0_fraction)
    log("M_r_sec_kg", M_r_sec)
    log("M_r_hum_kg", M_r_hum)

    M_binder = rho_s_binder * V_b
    log("M_binder_kg", M_binder)

    M_water_in_residue = M_r_hum - M_r_sec  # = w0% * M_r_sec
    M_water_to_add = max(M_water_total - M_water_in_residue, 0.0)
    log("M_water_total_kg", M_water_total)
    log("M_water_in_residue_kg", M_water_in_residue)
    log("M_water_to_add_kg", M_water_to_add)

    # w/c ratio (mass)
    wc_ratio = M_water_total / M_binder if M_binder > 0.0 else 0.0
    log("wc_ratio", wc_ratio)

    # ------------------------------------------------------------------
    # Split binder mass among components 1â€“3
    # ------------------------------------------------------------------
    c1_mass = 0.0
    c2_mass = 0.0
    c3_mass = 0.0
    if binder_system.components:
        fractions = [c.mass_fraction for c in binder_system.components]
        if len(fractions) >= 1:
            c1_mass = M_binder * fractions[0]
        if len(fractions) >= 2:
            c2_mass = M_binder * fractions[1]
        if len(fractions) >= 3:
            c3_mass = M_binder * fractions[2]

    log("binder_c1_mass_kg", c1_mass)
    log("binder_c2_mass_kg", c2_mass)
    log("binder_c3_mass_kg", c3_mass)

    components = MixComponentMass(
        residue_dry_mass_kg=M_r_sec,
        residue_wet_mass_kg=M_r_hum,
        binder_total_mass_kg=M_binder,
        binder_c1_mass_kg=c1_mass,
        binder_c2_mass_kg=c2_mass,
        binder_c3_mass_kg=c3_mass,
        water_total_mass_kg=M_water_total,
        water_to_add_mass_kg=M_water_to_add,
    )

    mix_state = MixState(
        bulk_density_kg_m3=bulk_density,
        dry_density_kg_m3=dry_density,
        solids_mass_pct=Cw_pct,
        saturation_pct=Sr_pct,
        wc_ratio=wc_ratio,
        bw_mass_pct=binder_pct_recipe,
        bv_vol_pct=Bv * 100.0,
        cv_vol_pct=Cv * 100.0,
        w_mass_pct=w_pct,
        void_ratio=e0,
        porosity=n,
        theta_pct=theta * 100.0,
        gs_binder=Gs_binder,
        gs_backfill=Gs_backfill,
        bulk_unit_weight_kN_m3=bulk_density * gravity / 1000.0,
        dry_unit_weight_kN_m3=dry_density * gravity / 1000.0,
        container_volume_m3=container_volume_m3,
        total_backfill_volume_m3=V_T,
        residue_volume_m3=V_r,
        binder_volume_m3=V_b,
        water_volume_m3=V_w,
        solid_volume_m3=V_s,
        void_volume_m3=V_v,
        components=components,
    )

    return mix_state


def solve_rpc_cw(inputs: RpcCwInputs, debug: bool = False) -> MixDesignResult:
    """
    Main solver for RPC â€“ Dosage selon Cw.

    1) Validate binder system fractions.
    2) Compute mould volume from GeneralInfo.
    3) For each recipe (1..num_recipes), run _solve_single_cw_recipe.
    4) Return MixDesignResult with the list of MixState.

    If debug=True, prints detailed intermediate values for each recipe.
    """
    # 1) Binder system check
    inputs.binder_system.validate_total_fraction()
    _ensure_sequence_length(
        name="binder_mass_pct_recipes",
        values=inputs.binder_mass_pct_recipes,
        num_recipes=inputs.num_recipes,
        required=True,
    )
    constantes = _resolve_solver_constants(inputs.constants)

    # 2) Container volume
    Vc = compute_container_volume_m3(inputs.general)
    if debug:
        print("[RPC-CW DEBUG] container_volume_m3 (single mould) =", f"{Vc:.6f}")

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        binder_pct_i = inputs.binder_mass_pct_recipes[i]

        state_i = _solve_single_cw_recipe(
            Cw_pct=inputs.solids_mass_pct,
            Sr_pct=inputs.saturation_pct,
            residue=inputs.residue,
            binder_system=inputs.binder_system,
            binder_pct_recipe=binder_pct_i,
            container_volume_m3=Vc,
            containers_per_recipe=inputs.containers_per_recipe,
            safety_factor=inputs.safety_factor,
            water_density=constantes["water_density"],
            gravity=constantes["gravity"],
            aggregate_fraction_pct=inputs.aggregate_fraction_pct,
            aggregate_specific_gravity=inputs.aggregate_specific_gravity,
            debug=debug,
            debug_prefix=f"[recipe_{i+1}] ",
        )
        recipes.append(state_i)

    return MixDesignResult(
        category=inputs.category,
        method=RpcMethod.CW,
        general=inputs.general,
        recipes=recipes,
    )


def solve_rpc_essai(inputs: RpcEssaiInputs) -> MixDesignResult:
    """
    MÃ©thode essai-erreur (Section 3 du Module 1) :
      1) Calcule une recette de base (Cw ou W/C).
      2) Applique des ajustements de masses (rÃ©sidu sec/humide, eau) pour atteindre
         le slump visÃ©.
      3) Maintient le Bw% cible en ajustant la quantitÃ© de liant si du rÃ©sidu est ajoutÃ©.
      4) Recalcule tous les paramÃ¨tres gÃ©otechniques (Cw%, w/c, e, n, Ï, Sr%).

    Formules implÃ©mentÃ©es : [23a]-[34] de Module 1.

    HypothÃ¨ses :
      - Le liant est ajustÃ© pour maintenir le Bw% cible de la recette de base [24-26].
      - Le volume total (VT) reste celui calculÃ© Ã  lâ€™Ã©tape de base (mÃªmes contenants).
      - Sr_base est utilisÃ© comme hypothÃ¨se de saturation dans la formule de lâ€™indice
        des vides [33d] ; Sr_aj [33g] est ensuite recalculÃ© a posteriori.
    """
    inputs.binder_system.validate_total_fraction()
    constantes = _resolve_solver_constants(inputs.constants)
    water_density = constantes["water_density"]
    gravity = constantes["gravity"]

    # ------------------------------------------------------------------
    # 1) Calcul de la recette de base
    # ------------------------------------------------------------------
    if inputs.base_method == RpcMethod.CW:
        if inputs.base_inputs_cw is None:
            raise ValueError("base_inputs_cw est requis pour base_method=CW")
        base_inputs_cw = inputs.base_inputs_cw
        if base_inputs_cw.constants is None and inputs.constants is not None:
            base_inputs_cw = base_inputs_cw.model_copy(
                update={"constants": inputs.constants}
            )
        base_result = solve_rpc_cw(base_inputs_cw)
    elif inputs.base_method == RpcMethod.WB:
        if inputs.base_inputs_wb is None:
            raise ValueError("base_inputs_wb est requis pour base_method=WB")
        base_inputs_wb = inputs.base_inputs_wb
        if base_inputs_wb.constants is None and inputs.constants is not None:
            base_inputs_wb = base_inputs_wb.model_copy(
                update={"constants": inputs.constants}
            )
        base_result = solve_rpc_wb(base_inputs_wb)
    else:
        raise ValueError("base_method doit Ãªtre CW ou WB")

    if len(base_result.recipes) < inputs.num_recipes:
        raise ValueError(
            "Le nombre de recettes calculees dans la methode de base est insuffisant "
            f"({len(base_result.recipes)} pour {inputs.num_recipes} demandees)."
        )

    # ------------------------------------------------------------------
    # 2) PrÃ©paration commune
    # ------------------------------------------------------------------
    w0 = inputs.residue.moisture_mass_pct / 100.0          # teneur en eau du rÃ©sidu
    rho_s_residue = float(inputs.residue.specific_gravity) * water_density
    fractions = [c.mass_fraction for c in inputs.binder_system.components]

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        base_state = base_result.recipes[i]
        base_comp  = base_state.components
        adj = inputs.adjustments[i] if i < len(inputs.adjustments) else RpcEssaiAdjustment()

        # ---------------------------------------------------------------
        # A) DÃ©composition des ajouts
        # ---------------------------------------------------------------
        delta_sec  = adj.added_dry_residue_mass    # kg de rÃ©sidu sec ajoutÃ©
        delta_wet  = adj.added_wet_residue_mass    # kg de rÃ©sidu humide ajoutÃ©
        delta_eau  = adj.added_water_mass          # kg dâ€™eau ajoutÃ©e

        # RÃ©sidu humide ajoutÃ© â†’ fraction sÃ¨che + eau [28]
        sec_from_wet = delta_wet / (1.0 + w0) if (1.0 + w0) > 0 else 0.0
        eau_from_wet = delta_wet - sec_from_wet          # [28] mw-rh-ad

        # RÃ©sidu sec ajoutÃ© emporte aussi son eau Ã  w0
        eau_from_sec = delta_sec * w0

        # ---------------------------------------------------------------
        # B) Nouvelle masse sÃ¨che totale de rÃ©sidu [23a]
        # ---------------------------------------------------------------
        Mr_sec_Tot = base_comp.residue_dry_mass_kg + delta_sec + sec_from_wet  # [23a]

        # Volume de rÃ©sidu sec total [23b]
        Vr_sec_Tot = Mr_sec_Tot / rho_s_residue  # [23b]

        # ---------------------------------------------------------------
        # C) Ajustement du liant pour maintenir Bw% cible [24-27]
        # ---------------------------------------------------------------
        Bw_target_pct  = base_state.bw_mass_pct          # Bw% Ã  maintenir
        Gs_binder      = base_state.gs_binder
        rho_s_binder   = Gs_binder * water_density

        # [24] Nouveau Bw% rÃ©el si on ne touche pas au liant
        Bw_pct_ad = (
            base_comp.binder_total_mass_kg / Mr_sec_Tot * 100.0
            if Mr_sec_Tot > 0 else 0.0
        )

        # [25a] Masse totale de liant nÃ©cessaire pour maintenir Bw_target
        Mb_Tot = Bw_target_pct / 100.0 * Mr_sec_Tot

        # [25b] Volume total de liant
        Vb_Tot = Mb_Tot / rho_s_binder if rho_s_binder > 0 else 0.0

        # [26] Masse de liant Ã  rajouter (â‰¥ 0 ; on nâ€™enlÃ¨ve pas de liant)
        Mb_ad = max(Mb_Tot - base_comp.binder_total_mass_kg, 0.0)

        # [27a-c] Masses individuelles de ciment Ã  rajouter
        Mc1_ad = Mb_ad * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_ad = Mb_ad * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_ad = Mb_ad * (fractions[2] if len(fractions) >= 3 else 0.0)

        # ---------------------------------------------------------------
        # D) Masse dâ€™eau totale [29a-b]
        # ---------------------------------------------------------------
        Mw_Tot  = base_comp.water_total_mass_kg + delta_eau + eau_from_wet + eau_from_sec  # [29a]
        Vw_Tot  = Mw_Tot / water_density  # [29b]

        # ---------------------------------------------------------------
        # E) ParamÃ¨tres dÃ©rivÃ©s [30-34]
        # ---------------------------------------------------------------
        Ms_Tot = Mr_sec_Tot + Mb_Tot   # masse sÃ¨che totale (rÃ©sidu + liant)

        # [31] Nouveau Cw%
        cw_aj = (
            Ms_Tot / (Ms_Tot + Mw_Tot) * 100.0
            if (Ms_Tot + Mw_Tot) > 0 else 0.0
        )

        # [32] Nouvelle teneur en eau massique
        w_aj      = Mw_Tot / Ms_Tot if Ms_Tot > 0 else 0.0
        w_aj_pct  = w_aj * 100.0

        # [30] Nouveau rapport eau/ciment
        wc_aj = Mw_Tot / Mb_Tot if Mb_Tot > 0 else 0.0

        # [33d] Nouvel indice des vides (hypothÃ¨se Sr de la recette de base)
        Sr_base   = max(base_state.saturation_pct / 100.0, 1e-6)
        Gs_bkf    = base_state.gs_backfill
        e_aj      = w_aj * Gs_bkf / Sr_base

        # [33f / 23f] Nouvelle porositÃ©
        n_aj = e_aj / (1.0 + e_aj) if e_aj > -1.0 else 0.0

        # [33e] CompacitÃ©  (= Cv)
        Cv_aj = 1.0 / (1.0 + e_aj) if e_aj > -1.0 else 0.0

        # Nouvelles densitÃ©s
        rho_d_aj = Gs_bkf * water_density / (1.0 + e_aj) if e_aj > -1.0 else 0.0
        rho_h_aj = rho_d_aj * (1.0 + w_aj)

        # ---------------------------------------------------------------
        # F) Volumes [33a-c, 33g]  â€” on conserve VT de la recette de base
        # ---------------------------------------------------------------
        VT_aj  = base_state.total_backfill_volume_m3         # [33b] mÃªme contenants
        Vs_aj  = Cv_aj * VT_aj                               # [33a]
        Vv_aj  = VT_aj - Vs_aj                               # [33c]

        # [33g] Nouveau degrÃ© de saturation rÃ©el
        Sr_aj     = Vw_Tot / Vv_aj if Vv_aj > 0 else 1.0
        Sr_aj_pct = Sr_aj * 100.0

        # [34] Teneur en eau volumique (utilise Sr_base comme hypothÃ¨se de conception)
        theta_aj_pct = n_aj * Sr_base * 100.0

        # Nouveau Bv%
        Bv_aj_pct = 0.01 * Bw_target_pct * (
            float(inputs.residue.specific_gravity) / Gs_binder
        ) * 100.0 if Gs_binder > 0 else 0.0

        # ---------------------------------------------------------------
        # G) Masses humide rÃ©sidu et eau Ã  rajouter
        # ---------------------------------------------------------------
        Mr_hum_Tot   = Mr_sec_Tot * (1.0 + w0)
        Mw_in_residu = Mr_hum_Tot - Mr_sec_Tot           # eau dÃ©jÃ  dans le rÃ©sidu humide
        Mw_to_add    = Mw_Tot - Mw_in_residu             # eau Ã  rajouter (peut Ãªtre < 0)

        # Fractions des masses de liant total (Mc1, Mc2, Mc3)
        Mc1_tot = Mb_Tot * (fractions[0] if len(fractions) >= 1 else 0.0)
        Mc2_tot = Mb_Tot * (fractions[1] if len(fractions) >= 2 else 0.0)
        Mc3_tot = Mb_Tot * (fractions[2] if len(fractions) >= 3 else 0.0)

        comp = MixComponentMass(
            residue_dry_mass_kg=Mr_sec_Tot,
            residue_wet_mass_kg=Mr_hum_Tot,
            binder_total_mass_kg=Mb_Tot,
            binder_c1_mass_kg=Mc1_tot,
            binder_c2_mass_kg=Mc2_tot,
            binder_c3_mass_kg=Mc3_tot,
            water_total_mass_kg=Mw_Tot,
            water_to_add_mass_kg=Mw_to_add,
            # Essai-erreur : masses supplÃ©mentaires [26, 27a-c]
            binder_to_add_mass_kg=Mb_ad,
            binder_c1_to_add_mass_kg=Mc1_ad,
            binder_c2_to_add_mass_kg=Mc2_ad,
            binder_c3_to_add_mass_kg=Mc3_ad,
        )

        adjusted_state = MixState(
            bulk_density_kg_m3=rho_h_aj,
            dry_density_kg_m3=rho_d_aj,
            solids_mass_pct=cw_aj,
            saturation_pct=Sr_aj_pct,          # [33g] Sr recalculé
            wc_ratio=wc_aj,                    # [30]
            bw_mass_pct=Bw_target_pct,         # Bw% cible (maintenu)
            bv_vol_pct=Bv_aj_pct,
            cv_vol_pct=Cv_aj * 100.0,
            w_mass_pct=w_aj_pct,               # [32]
            void_ratio=e_aj,                   # [33d]
            porosity=n_aj,                     # [33f]
            theta_pct=theta_aj_pct,            # [34]
            gs_binder=Gs_binder,
            gs_backfill=Gs_bkf,
            bulk_unit_weight_kN_m3=rho_h_aj * gravity / 1000.0,
            dry_unit_weight_kN_m3=rho_d_aj * gravity / 1000.0,
            container_volume_m3=base_state.container_volume_m3,
            total_backfill_volume_m3=VT_aj,
            residue_volume_m3=Vr_sec_Tot,
            binder_volume_m3=Vb_Tot,
            water_volume_m3=Vw_Tot,
            solid_volume_m3=Vs_aj,
            void_volume_m3=Vv_aj,
            components=comp,
        )
        recipes.append(adjusted_state)

    return MixDesignResult(
        category=inputs.category,
        method=RpcMethod.ESSAI,
        general=inputs.general,
        recipes=recipes,
    )


# ======================================================================
#  RPC / RPG â€“ RAPPORT EAU/CIMENT (W/C)
# ======================================================================

def _solve_single_wb_recipe(
    *,
    Sr_pct: float,
    residue: ResidueProps,
    binder_system: BinderSystem,
    binder_pct_recipe: float,     # Bw% = Mb/Mr_sec * 100
    wc_ratio_recipe: float,       # W/C massique imposÃ© (mÃªme convention que l'Excel/C# : 4, 6, 7)
    container_volume_m3: float,
    containers_per_recipe: int,
    safety_factor: float,
    water_density: float,
    gravity: float,
) -> MixState:
    """
    Calcul d'une recette Ã  partir de Bw% et W/C imposÃ©.

    HypothÃ¨ses (alignÃ©es sur Cw mais avec W/C imposÃ©) :
      - Vr = Vs (mÃªme convention que Cw)
      - w% dÃ©duit uniquement de Bw% et W/C :
            Bw_ratio = Bw% / 100 = Mb / Mr_sec
            w = (Mw / Ms) = (W/C * Mb) / (Mr_sec + Mb) = wc / (1 + 1/Bw_ratio)
        soit w_mass_fraction = wc_ratio / (1 + 100/Bw%)
      - e depuis w% et Sr : e = (w/100)*Gs_backfill / Sr
      - Cv = 1/(1+e), V_s = Cv * V_T, Vr = V_s
      - Bv = 0.01 * Bw% * (Gs_res / Gs_liant)
      - Vb = Bv * Vr, Mb = rho_s_binder * Vb
      - Mw_total = wc_ratio * Mb (dÃ©finition W/C)
    """
    Sr = max(Sr_pct / 100.0, 1e-6)
    bw_ratio = binder_pct_recipe / 100.0

    # Gs liant et remblai
    Gs_binder = effective_binder_specific_gravity(binder_system)
    Gs_backfill = equivalent_backfill_specific_gravity(
        residue=residue,
        binder_system=binder_system,
        binder_mass_pct=binder_pct_recipe,
    )

    # Cw% prÃ©dit Ã  partir de Bw% et W/C selon la formule C#/Excel :
    #   A = (100/Bw% + 1)^(-1)
    #   A = A * (W/C)
    #   A = A + 1
    #   Cw% = 100 / A
    A = 0.0
    if binder_pct_recipe > 0:
        A = (100.0 / binder_pct_recipe + 1.0) ** -1
        A = A * wc_ratio_recipe
        A = A + 1.0
    solids_mass_pct_pred = 100.0 / A if A > 0 else 0.0

    # w% massique dÃ©duit de Cw%
    Cw_frac = solids_mass_pct_pred / 100.0 if solids_mass_pct_pred > 0 else 0.0
    w_mass_fraction = (1.0 / Cw_frac) - 1.0 if Cw_frac > 0 else 0.0
    w_pct = w_mass_fraction * 100.0

    # indice des vides & porositÃ©
    e0 = (w_pct / 100.0) * Gs_backfill / Sr
    n = e0 / (1.0 + e0)

    # DensitÃ©s et solides volumique
    rho_d = Gs_backfill * water_density / (1.0 + e0)
    rho_h = rho_d * (1.0 + w_mass_fraction)
    Cv = 1.0 / (1.0 + e0)

    # GÃ©omÃ©trie
    V_T = container_volume_m3 * float(containers_per_recipe) * float(safety_factor)
    V_s = Cv * V_T
    V_r = V_s

    # Bv et volumes liant/eau
    rho_s_residue = float(residue.specific_gravity) * water_density
    rho_s_binder = Gs_binder * water_density
    Bv = 0.01 * binder_pct_recipe * (rho_s_residue / rho_s_binder)
    V_b = Bv * V_r

    # Masses solides
    M_r_sec = rho_s_residue * V_r
    M_binder = rho_s_binder * V_b

    # Eau totale imposée par W/C
    M_water_total = wc_ratio_recipe * M_binder
    V_w = M_water_total / water_density
    V_v = V_T - V_s

    # Eau contenue dans le rÃ©sidu humide
    w0_fraction = residue.moisture_mass_pct / 100.0
    M_r_hum = M_r_sec * (1.0 + w0_fraction)
    M_water_in_residue = M_r_hum - M_r_sec
    # On autorise des valeurs nÃ©gatives (eau Ã  retirer) pour coller au tableau Excel/C#
    M_water_to_add = M_water_total - M_water_in_residue

    # Recalcule gamma pour cohÃ©rence affichage
    gamma_h = rho_h * gravity / 1000.0
    gamma_d = rho_d * gravity / 1000.0
    theta = n * Sr

    components = MixComponentMass(
        residue_dry_mass_kg=M_r_sec,
        residue_wet_mass_kg=M_r_hum,
        binder_total_mass_kg=M_binder,
        binder_c1_mass_kg=M_binder * (binder_system.components[0].mass_fraction if binder_system.components else 0.0),
        binder_c2_mass_kg=M_binder * (binder_system.components[1].mass_fraction if len(binder_system.components) > 1 else 0.0),
        binder_c3_mass_kg=M_binder * (binder_system.components[2].mass_fraction if len(binder_system.components) > 2 else 0.0),
        water_total_mass_kg=M_water_total,
        water_to_add_mass_kg=M_water_to_add,
    )

    return MixState(
        bulk_density_kg_m3=rho_h,
        dry_density_kg_m3=rho_d,
        solids_mass_pct=solids_mass_pct_pred,
        saturation_pct=Sr_pct,
        wc_ratio=wc_ratio_recipe,
        bw_mass_pct=binder_pct_recipe,
        bv_vol_pct=Bv * 100.0,
        cv_vol_pct=Cv * 100.0,
        w_mass_pct=w_pct,
        void_ratio=e0,
        porosity=n,
        theta_pct=theta * 100.0,
        gs_binder=Gs_binder,
        gs_backfill=Gs_backfill,
        bulk_unit_weight_kN_m3=gamma_h,
        dry_unit_weight_kN_m3=gamma_d,
        container_volume_m3=container_volume_m3,
        total_backfill_volume_m3=V_T,
        residue_volume_m3=V_r,
        binder_volume_m3=V_b,
        water_volume_m3=V_w,
        solid_volume_m3=V_s,
        void_volume_m3=V_v,
        components=components,
    )


def solve_rpc_wb(inputs: RpcWbInputs) -> MixDesignResult:
    """
    Solver pour la mÃ©thode W/C (BW% + W/C imposÃ©).
    """
    inputs.binder_system.validate_total_fraction()
    _ensure_sequence_length(
        name="binder_mass_pct_recipes",
        values=inputs.binder_mass_pct_recipes,
        num_recipes=inputs.num_recipes,
        required=True,
    )
    _ensure_sequence_length(
        name="wc_ratio_recipes",
        values=inputs.wc_ratio_recipes,
        num_recipes=inputs.num_recipes,
        required=True,
    )
    constantes = _resolve_solver_constants(inputs.constants)
    Vc = compute_container_volume_m3(inputs.general)

    recipes: List[MixState] = []
    for i in range(inputs.num_recipes):
        bw_pct = inputs.binder_mass_pct_recipes[i]
        wc_ratio = inputs.wc_ratio_recipes[i]
        state_i = _solve_single_wb_recipe(
            Sr_pct=inputs.saturation_pct,
            residue=inputs.residue,
            binder_system=inputs.binder_system,
            binder_pct_recipe=bw_pct,
            wc_ratio_recipe=wc_ratio,
            container_volume_m3=Vc,
            containers_per_recipe=inputs.containers_per_recipe,
            safety_factor=inputs.safety_factor,
            water_density=constantes["water_density"],
            gravity=constantes["gravity"],
        )
        recipes.append(state_i)

    return MixDesignResult(
        category=inputs.category,
        method=RpcMethod.WB,
        general=inputs.general,
        recipes=recipes,
    )


# ======================================================================
#  RPC - AJUSTEMENT POUR SLUMP (prAcdiction de Cw% via slump)
# ======================================================================

def _predict_cw_pct_from_slump(
    bw_mass_pct: float,
    slump_mm_grand_cone: float,
    gs_residue: float,
    model_coeff: float,
    model_offset: float,
) -> float:
    """
    Formule empirique (C# / document Word) :
        Cw% = 4.95e6 * (1 + Bw%) / ( slump*(1+Bw%)/Gs_res + 235.5122 )^2
    Bw% est donnAc en pourcentage (ex : 4.5), slump en mm (grand cA'ne).
    """
    b = 1.0 + 0.01 * bw_mass_pct
    denom = slump_mm_grand_cone * b / gs_residue + model_offset
    if denom <= 0.0:
        return 0.0
    return model_coeff * b / (denom * denom)


def solve_rpc_slump(inputs: RpcSlumpInputs) -> MixDesignResult:
    """
    Ajustement pour slump :
      1) Convertit le slump en grand cA'ne si besoin (mini -> grand : x2.335)
      2) PrAcdict Cw% par recette avec la formule ci-dessus
      3) RAcutilise le solveur Cw sur chaque recette (mA"mes masses/volumes que Cw)
    """
    inputs.binder_system.validate_total_fraction()
    _ensure_sequence_length(
        name="binder_mass_pct_recipes",
        values=inputs.binder_mass_pct_recipes,
        num_recipes=inputs.num_recipes,
        required=True,
    )
    constantes = _resolve_solver_constants(inputs.constants)

    # Volume d'un moule (mA3)
    Vc = compute_container_volume_m3(inputs.general)

    # Slump effectif (grand cA'ne)
    slump_mm_eff = float(inputs.slump_mm)
    if inputs.cone_type == "mini":
        slump_mm_eff *= constantes["slump_small_to_large_factor"]

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        bw_pct = inputs.binder_mass_pct_recipes[i]

        cw_pred = _predict_cw_pct_from_slump(
            bw_mass_pct=bw_pct,
            slump_mm_grand_cone=slump_mm_eff,
            gs_residue=float(inputs.residue.specific_gravity),
            model_coeff=constantes["slump_model_coeff"],
            model_offset=constantes["slump_model_offset"],
        )

        state_i = _solve_single_cw_recipe(
            Cw_pct=cw_pred,
            Sr_pct=inputs.saturation_pct,
            residue=inputs.residue,
            binder_system=inputs.binder_system,
            binder_pct_recipe=bw_pct,
            container_volume_m3=Vc,
            containers_per_recipe=inputs.containers_per_recipe,
            safety_factor=inputs.safety_factor,
            water_density=constantes["water_density"],
            gravity=constantes["gravity"],
            aggregate_fraction_pct=0.0,
            aggregate_specific_gravity=None,
            debug=False,
        )
        recipes.append(state_i)

    return MixDesignResult(
        category=inputs.category,
        method=RpcMethod.SLUMP,
        general=inputs.general,
        recipes=recipes,
    )
