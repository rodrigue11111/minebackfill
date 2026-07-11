"""
Solver functions for mine backfill mix design.

Right now we implement:

- solve_rpc_cw : RPC – Dosage selon Cw (% de solides massiques)

The logic is aligned with the C#/Excel "Modèle C1" sheet:

1) Gs_liant from the binary/ternary binder (fractions 1–3)
2) Gs_bkf (remblai) from Gs_residu, Gs_liant and Bw% (liant/résidu)
3) Water content from Cw%:
       w = (1/Cw - 1)
4) e0 from w, Gs_bkf, Sr:
       e0 = (w% / 100) * Gs_bkf / Sr
       n  = e0 / (1 + e0)
5) Densities:
       ρ_d = Gs_bkf * ρw / (1 + e0)
       ρ_h = ρ_d * (1 + w)
6) Cv = ρ_d / ρ_s_bkf = 1 / (1 + e0)
7) Geometry:
       V_T = V_moule * N_c * FS
       V_s = Cv * V_T
       V_v = V_T - V_s
8) Volumetric binder ratio:
       Bv = 0.01 * Bw% * ρ_s_residu / ρ_s_liant
   C# convention (as provided): Vr = Vs
       Vr = V_s
       Vb = Bv * Vr
       Vw = 0.01 * Sr% * V_v
9) Masses:
       M_r_sec = ρ_s_residu * Vr
       M_r_hum = M_r_sec * (1 + w0%)
       M_b     = ρ_s_liant * Vb
       M_w_tot = ρ_w * Vw
       M_w_res = M_r_hum - M_r_sec = 0.01*w0%*M_r_sec
       M_w_add = M_w_tot - M_w_res
       w/c     = M_w_tot / M_b

Masses are then reported in MixComponentMass and MixState.
"""

from __future__ import annotations

import math
from typing import List, Optional

from .mix_pipeline import (
    solve_recipe,
    apply_essai_adjustments,
    gs_backfill_eff,
    gs_nonbinder_eff,
    cw_from_wc,
)

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
    Compute mould/container volume [m³] from GeneralInfo.

    - SECTION_HEIGHT: section (cm²) + height (cm)
    - RADIUS_HEIGHT:  radius (cm) + height (cm)
    - LENGTH_WIDTH_HEIGHT: length, width, height (cm)
    - VOLUME:        volume saisi directement (m³)

    Raises if required dimensions are missing.
    """
    # Type de contenant
    ct = general.container_type
    if ct is None:
        raise ValueError("Type de contenant manquant : renseignez-le sur la page Informations.")

    # VOLUME : le volume est saisi directement en m³
    if ct == ContainerType.VOLUME:
        if general.container_volume_m3 is None or general.container_volume_m3 <= 0:
            raise ValueError(
                "Volume du contenant requis (et supérieur à 0) pour le type « volume »."
            )
        return float(general.container_volume_m3)

    # SECTION_HEIGHT: V = section(cm²) * height(cm)  => m³
    if ct == ContainerType.SECTION_HEIGHT:
        if general.container_section is None or general.container_height is None:
            raise ValueError(
                "Section et hauteur du contenant requises pour le type section + hauteur."
            )
        section_cm2 = float(general.container_section)
        h_cm = float(general.container_height)
        # 1 cm² = 1e-4 m², 1 cm = 1e-2 m -> cm²*cm = 1e-6 m³
        return section_cm2 * h_cm * 1.0e-6

    # RADIUS_HEIGHT: V = π r² h (r, h in cm)
    if ct == ContainerType.RADIUS_HEIGHT:
        if general.container_radius is None or general.container_height is None:
            raise ValueError(
                "Rayon et hauteur du contenant requis pour le type rayon + hauteur."
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
                "Longueur, largeur et hauteur du contenant requises pour le type longueur x largeur x hauteur."
            )
        L_m = float(general.container_length) / 100.0
        W_m = float(general.container_width) / 100.0
        H_m = float(general.container_height) / 100.0
        return L_m * W_m * H_m

    raise ValueError(f"Type de contenant inconnu : {ct}")


# ======================================================================
#  SPECIFIC GRAVITIES
# ======================================================================

def masse_volumique_S_liant_fonction(
    f1_pct: float, f2_pct: float, f3_pct: float, gs1: float, gs2: float, gs3: float
) -> float:
    """
    Formule harmonique (C#) pour le Gs du liant :
        Gs_liant = 1 / (0.01*f1/gs1 + 0.01*f2/gs2 + 0.01*f3/gs3)
    Les fractions sont données en pourcentage (0–100).
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
        raise ValueError("Combinaison de Gs de liants invalide.")
    return 1.0 / denom


def equivalent_backfill_specific_gravity(
    *,
    residue: ResidueProps,
    binder_system: BinderSystem,
    binder_mass_pct: float,
    binder_gs_override: Optional[float] = None,
) -> float:
    """
    Equivalent specific gravity Gs_remblai for the mixture "résidu + liant"
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
    G_b = (
        binder_gs_override
        if binder_gs_override is not None and binder_gs_override > 0
        else effective_binder_specific_gravity(binder_system)
    )
    return gs_backfill_eff(float(residue.specific_gravity), 0.0, None,
                           binder_mass_pct / 100.0, G_b)


# ======================================================================
#  RPC – DOSAGE SELON Cw (% DE SOLIDES MASSIQUES)
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

    # ------------------------------------------------------------------
    # Pipeline Intra 2017 (Ms = rho_d * V_T) — remplace la convention
    # « Vr = Vs » du Modèle C1b 2005 qui gonflait toutes les masses
    # d'un facteur exact (1 + Bv).
    # ------------------------------------------------------------------
    A_m = max(0.0, min(aggregate_fraction_pct / 100.0, 1.0))
    gs_g = (
        float(aggregate_specific_gravity)
        if (aggregate_specific_gravity and aggregate_specific_gravity > 0 and A_m > 0)
        else None
    )

    V_T = container_volume_m3 * float(containers_per_recipe) * float(safety_factor)
    q = solve_recipe(
        cw_frac=Cw,
        sr_frac=Sr,
        bw_frac=binder_pct_recipe / 100.0,
        xg_frac=A_m if gs_g else 0.0,
        gs_r=float(residue.specific_gravity),
        gs_g=gs_g,
        gs_binder=Gs_binder,
        w0_frac=residue.moisture_mass_pct / 100.0,
        v_total_m3=V_T,
        water_density=water_density,
    )

    Gs_backfill = q.gs_backfill
    w_pct = q.w * 100.0
    e0, n, theta, Cv = q.e, q.n, q.theta, q.cv
    dry_density, bulk_density = q.rho_d, q.rho_h
    V_s, V_v, V_r, V_b, V_w = q.vs, q.vv, q.vr, q.vb, q.vw
    Bv = q.bv
    M_r_sec, M_r_hum = q.mr_sec, q.mr_hum
    M_binder = q.mb
    M_water_total = q.mw_total
    M_water_in_residue = q.mw_in_residue
    M_water_to_add = q.mw_to_add   # peut être négatif : eau à retirer  [D50]
    wc_ratio = q.wc

    log("Gs_binder", Gs_binder)
    log("Gs_backfill", Gs_backfill)
    log("w_pct", w_pct)
    log("e0", e0)
    log("V_T_m3", V_T)
    log("Bv", Bv)
    log("M_r_sec_kg", M_r_sec)
    log("M_binder_kg", M_binder)
    log("M_water_total_kg", M_water_total)
    log("M_water_to_add_kg", M_water_to_add)
    log("wc_ratio", wc_ratio)

    # Split binder mass among components 1-3
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
        aggregate_dry_mass_kg=q.mg_sec,
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
        aggregate_volume_m3=q.vg,
        aggregate_vol_pct_of_residue=(q.vg / (q.vg + q.vr) * 100.0) if (q.vg + q.vr) > 0 else 0.0,
        aggregate_vol_pct_of_backfill=(q.vg / V_T * 100.0) if V_T > 0 else 0.0,
        aggregate_mass_pct=(q.mg_sec / (q.mg_sec + q.mr_sec) * 100.0) if (q.mg_sec + q.mr_sec) > 0 else 0.0,
        components=components,
    )

    return mix_state


def solve_rpc_cw(inputs: RpcCwInputs, debug: bool = False) -> MixDesignResult:
    """
    Main solver for RPC – Dosage selon Cw.

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
    Méthode essai-erreur (Section 3 du Module 1) :
      1) Calcule une recette de base (Cw ou W/C).
      2) Applique des ajustements de masses (résidu sec/humide, eau) pour atteindre
         le slump visé.
      3) Maintient le Bw% cible en ajustant la quantité de liant si du résidu est ajouté.
      4) Recalcule tous les paramètres géotechniques (Cw%, w/c, e, n, ρ, Sr%).

    Formules implémentées : [23a]-[34] de Module 1.

    Hypothèses :
      - Le liant est ajusté pour maintenir le Bw% cible de la recette de base [24-26].
      - Le volume total (VT) reste celui calculé à l'étape de base (mêmes contenants).
      - Sr_base est utilisé comme hypothèse de saturation dans la formule de l'indice
        des vides [33d] ; Sr_aj [33g] est ensuite recalculé a posteriori.
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
        raise ValueError("base_method doit être CW ou WB")

    if len(base_result.recipes) < inputs.num_recipes:
        raise ValueError(
            "Le nombre de recettes calculees dans la methode de base est insuffisant "
            f"({len(base_result.recipes)} pour {inputs.num_recipes} demandees)."
        )

    # ------------------------------------------------------------------
    # 2) Préparation commune
    # ------------------------------------------------------------------
    w0 = inputs.residue.moisture_mass_pct / 100.0          # teneur en eau du résidu
    rho_s_residue = float(inputs.residue.specific_gravity) * water_density
    fractions = [c.mass_fraction for c in inputs.binder_system.components]

    # Composition granulat éventuelle de la recette de base (branche rarement
    # utilisée en RPC ; 0 en pratique)
    gs_r_val = float(inputs.residue.specific_gravity)
    if inputs.base_method == RpcMethod.CW and inputs.base_inputs_cw is not None:
        agg_pct = float(inputs.base_inputs_cw.aggregate_fraction_pct or 0.0)
        agg_gs = inputs.base_inputs_cw.aggregate_specific_gravity
    else:
        agg_pct, agg_gs = 0.0, None
    xg_base = max(0.0, min(agg_pct / 100.0, 1.0))
    gs_g_base = float(agg_gs) if (agg_gs and agg_gs > 0 and xg_base > 0) else None
    gs_nb_base = gs_nonbinder_eff(gs_r_val, xg_base if gs_g_base else 0.0, gs_g_base)

    recipes: List[MixState] = []

    for i in range(inputs.num_recipes):
        base_state = base_result.recipes[i]
        base_comp = base_state.components
        adj = inputs.adjustments[i] if i < len(inputs.adjustments) else RpcEssaiAdjustment()

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
            gs_r=gs_r_val,
            gs_g=gs_g_base,
            gs_binder=Gs_binder,
            gs_backfill_base=base_state.gs_backfill,
            gs_nonbinder_base=gs_nb_base,
            w0_frac=w0,
            delta_dry_residue=adj.added_dry_residue_mass,
            delta_wet_residue=adj.added_wet_residue_mass,
            delta_water=adj.added_water_mass,
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
        category=inputs.category,
        method=RpcMethod.ESSAI,
        general=inputs.general,
        recipes=recipes,
    )


# ======================================================================
#  RPC / RPG – RAPPORT EAU/CIMENT (W/C)
# ======================================================================

def _solve_single_wb_recipe(
    *,
    Sr_pct: float,
    residue: ResidueProps,
    binder_system: BinderSystem,
    binder_pct_recipe: float,     # Bw% = Mb/Mr_sec * 100
    wc_ratio_recipe: float,       # W/C massique imposé (même convention que l'Excel/C# : 4, 6, 7)
    container_volume_m3: float,
    containers_per_recipe: int,
    safety_factor: float,
    water_density: float,
    gravity: float,
) -> MixState:
    """
    Calcul d'une recette à partir de Bw% et W/C imposé.

    Hypothèses (alignées sur Cw mais avec W/C imposé) :
      - Vr = Vs (même convention que Cw)
      - w% déduit uniquement de Bw% et W/C :
            Bw_ratio = Bw% / 100 = Mb / Mr_sec
            w = (Mw / Ms) = (W/C * Mb) / (Mr_sec + Mb) = wc / (1 + 1/Bw_ratio)
        soit w_mass_fraction = wc_ratio / (1 + 100/Bw%)
      - e depuis w% et Sr : e = (w/100)*Gs_backfill / Sr
      - Cv = 1/(1+e), V_s = Cv * V_T, Vr = V_s
      - Bv = 0.01 * Bw% * (Gs_res / Gs_liant)
      - Vb = Bv * Vr, Mb = rho_s_binder * Vb
      - Mw_total = wc_ratio * Mb (définition W/C)
    """
    Sr = max(Sr_pct / 100.0, 1e-6)
    bw_ratio = binder_pct_recipe / 100.0

    # Gs liant
    Gs_binder = effective_binder_specific_gravity(binder_system)

    # Cw% prédit à partir de Bw% et W/C (relation de la feuille, cellule D26)
    Cw_frac = cw_from_wc(bw_ratio, wc_ratio_recipe)
    solids_mass_pct_pred = Cw_frac * 100.0

    # Pipeline Intra 2017 (Ms = rho_d * V_T) ; Mw = wc * Mb par construction
    V_T = container_volume_m3 * float(containers_per_recipe) * float(safety_factor)
    q = solve_recipe(
        cw_frac=Cw_frac,
        sr_frac=Sr,
        bw_frac=bw_ratio,
        xg_frac=0.0,
        gs_r=float(residue.specific_gravity),
        gs_g=None,
        gs_binder=Gs_binder,
        w0_frac=residue.moisture_mass_pct / 100.0,
        v_total_m3=V_T,
        water_density=water_density,
    )

    Gs_backfill = q.gs_backfill
    w_pct = q.w * 100.0
    e0, n, theta, Cv = q.e, q.n, q.theta, q.cv
    rho_d, rho_h = q.rho_d, q.rho_h
    V_s, V_v, V_r, V_b, V_w = q.vs, q.vv, q.vr, q.vb, q.vw
    Bv = q.bv
    M_r_sec, M_r_hum = q.mr_sec, q.mr_hum
    M_binder = q.mb
    M_water_total = q.mw_total
    M_water_to_add = q.mw_to_add   # négatif possible (eau à retirer)
    gamma_h = rho_h * gravity / 1000.0
    gamma_d = rho_d * gravity / 1000.0

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
        aggregate_volume_m3=q.vg,
        aggregate_vol_pct_of_residue=(q.vg / (q.vg + q.vr) * 100.0) if (q.vg + q.vr) > 0 else 0.0,
        aggregate_vol_pct_of_backfill=(q.vg / V_T * 100.0) if V_T > 0 else 0.0,
        aggregate_mass_pct=(q.mg_sec / (q.mg_sec + q.mr_sec) * 100.0) if (q.mg_sec + q.mr_sec) > 0 else 0.0,
        components=components,
    )


def solve_rpc_wb(inputs: RpcWbInputs) -> MixDesignResult:
    """
    Solver pour la méthode W/C (BW% + W/C imposé).
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
#  RPC - AJUSTEMENT POUR SLUMP (prédiction de Cw% via slump)
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
    Bw% est donné en pourcentage (ex : 4.5), slump en mm (grand cône).
    """
    b = 1.0 + 0.01 * bw_mass_pct
    denom = slump_mm_grand_cone * b / gs_residue + model_offset
    if denom <= 0.0:
        # Hors domaine du modèle empirique : erreur explicite plutôt qu'un
        # Cw% = 0 silencieux (qui produirait une recette absurde). Avec les
        # contraintes gt=0 sur le slump et l'offset, ce cas est très rare.
        raise ValueError(
            "Slump hors du domaine du modèle prédictif (dénominateur négatif) : "
            "vérifiez le slump et les coefficients du modèle."
        )
    return model_coeff * b / (denom * denom)


def solve_rpc_slump(inputs: RpcSlumpInputs) -> MixDesignResult:
    """
    Ajustement pour slump :
      1) Convertit le slump en grand cône si besoin (mini -> grand : x2.335)
      2) Prédit Cw% par recette avec la formule ci-dessus
      3) Réutilise le solveur Cw sur chaque recette (mêmes masses/volumes que Cw)
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

    # Slump effectif (grand cône)
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
