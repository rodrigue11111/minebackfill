# app/core/rrc_solver.py
"""
Solveur RRC — Remblai Rocheux Cimenté (Cemented Rockfill, CRF).

Formules du cours (Séance 5, Dias 66-70) :

  Conversions retardateur [Dia 67] :
      D1 = 1e-5 * D0   (ml/g de ciment)      D0 en ml/100 kg de ciment
      D2 = 1e-2 * D0   (ml/kg de ciment)

  Avec K = 1 + Bw * (1 + W/C) :
      M_WR      = M_CRF / K                          [Dia 68]
      M_c       = Bw * M_WR                          [Dia 69]
      M_SR      = M_c * rho_SR * D1                  [Dia 69]  (rho_SR g/ml, D1 ml/g)
      M*        = (W/C) * M_c   (fluide = eau + SR)  [Dia 68]
      M_w       = M* - M_SR = M_c * (W/C - rho_SR*D1)  [Dia 69]
      V_SR      = D2 * M_c   (ml, M_c en kg)         [Dia 69]
      w         = (W/C) * Bw / (1 + Bw)              [Dia 68]
      Cw        = (1 + Bw) / K                       [Dia 68]
      D_m%      = rho_SR * D1 * 100                  [Dia 70]
      M_slurry  = M_c * (1 + W/C)                    [Dia 70]
      V_slurry  = M_c/rho_c + M_w/rho_w + V_SR       [Dia 70]

  M_CRF = rho_wet * V_CRF (mode volume) ou saisie directe (mode masse).
  Invariant : M_WR + M_c + M* = M_CRF.
"""

from __future__ import annotations

from typing import List

from .models import RrcInputs, RrcRecipeState, RrcResult
from .rpc_solver import _ensure_sequence_length, _resolve_solver_constants


def solve_rrc(inputs: RrcInputs) -> RrcResult:
    """Calcule les recettes RRC/CRF (une par couple Bw%, W/C)."""
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

    consts = _resolve_solver_constants(inputs.constants)
    rho_w = consts["water_density"]          # kg/m³

    # ------------------------------------------------------------------
    # Masse totale de CRF
    # ------------------------------------------------------------------
    if inputs.quantity_mode == "masse":
        if not inputs.total_mass_kg or inputs.total_mass_kg <= 0:
            raise ValueError("Masse totale de CRF requise en mode « masse ».")
        m_crf = float(inputs.total_mass_kg)
        v_crf = (
            m_crf / float(inputs.wet_density_kg_m3)
            if inputs.wet_density_kg_m3 and inputs.wet_density_kg_m3 > 0
            else 0.0
        )
    else:
        if not inputs.volume_m3 or inputs.volume_m3 <= 0:
            raise ValueError("Volume du chantier requis en mode « volume ».")
        if not inputs.wet_density_kg_m3 or inputs.wet_density_kg_m3 <= 0:
            raise ValueError("Masse volumique humide du CRF requise en mode « volume ».")
        v_crf = float(inputs.volume_m3)
        m_crf = float(inputs.wet_density_kg_m3) * v_crf

    # ------------------------------------------------------------------
    # Retardateur de prise [Dia 67]
    # ------------------------------------------------------------------
    d0 = float(inputs.retarder_dosage_ml_per_100kg)
    d1 = 1.0e-5 * d0    # ml/g
    d2 = 1.0e-2 * d0    # ml/kg
    rho_sr = float(inputs.retarder_density_g_ml)   # g/ml
    rho_c = float(inputs.cement_specific_gravity) * rho_w  # kg/m³

    recipes: List[RrcRecipeState] = []
    for i in range(inputs.num_recipes):
        bw = float(inputs.binder_mass_pct_recipes[i]) / 100.0
        wc = float(inputs.wc_ratio_recipes[i])

        sr_frac = rho_sr * d1                # M_SR / M_c  (g/ml * ml/g)
        if wc <= sr_frac:
            raise ValueError(
                "Dosage de retardateur trop élevé pour ce W/C : le fluide "
                f"serait entièrement du retardateur (recette {i + 1})."
            )

        k = 1.0 + bw * (1.0 + wc)
        m_wr = m_crf / k                     # [Dia 68]
        m_c = bw * m_wr                      # [Dia 69]
        m_fluid = wc * m_c                   # [Dia 68]
        m_sr = m_c * sr_frac                 # [Dia 69]
        m_water = m_fluid - m_sr             # [Dia 69]
        v_sr_l = d2 * m_c / 1000.0           # ml -> litres

        w = wc * bw / (1.0 + bw)             # [Dia 68]
        cw = (1.0 + bw) / k                  # [Dia 68]
        d_m_pct = sr_frac * 100.0            # [Dia 70]

        m_slurry = m_c * (1.0 + wc)          # [Dia 70]
        v_slurry = m_c / rho_c + m_water / rho_w + v_sr_l / 1000.0  # [Dia 70]

        recipes.append(RrcRecipeState(
            bw_mass_pct=bw * 100.0,
            wc_ratio=wc,
            w_mass_pct=w * 100.0,
            solids_mass_pct=cw * 100.0,
            retarder_dosage_mass_pct=d_m_pct,
            total_mass_kg=m_crf,
            crf_volume_m3=v_crf,
            waste_rock_mass_kg=m_wr,
            cement_mass_kg=m_c,
            fluid_mass_kg=m_fluid,
            water_mass_kg=m_water,
            retarder_mass_kg=m_sr,
            retarder_volume_l=v_sr_l,
            slurry_mass_kg=m_slurry,
            slurry_volume_m3=v_slurry,
        ))

    return RrcResult(
        category=inputs.category,
        general=inputs.general,
        recipes=recipes,
    )
