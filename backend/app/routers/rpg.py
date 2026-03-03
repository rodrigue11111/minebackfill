# app/routers/rpg.py
"""
Routes for RPG mix design (Paste Aggregate Fill — PAF).
  - POST /rpg/cw    → solve_rpg_cw
  - POST /rpg/wb    → solve_rpg_wb
  - POST /rpg/essai → solve_rpg_essai
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.models import RpgCwInputs, RpgWbInputs, RpgEssaiInputs, MixDesignResult
from app.core.rpg_solver import solve_rpg_cw, solve_rpg_wb, solve_rpg_essai

router = APIRouter(
    prefix="",
    tags=["RPG"],
)


@router.post("/rpg/cw", response_model=MixDesignResult)
def rpg_cw_endpoint(payload: RpgCwInputs) -> MixDesignResult:
    """
    RPG - Dosage selon Cw% (Paste Aggregate Fill).
    Requires aggregate_fraction_pct (A_m%) and aggregate_specific_gravity.
    """
    return solve_rpg_cw(payload)


@router.post("/rpg/wb", response_model=MixDesignResult)
def rpg_wb_endpoint(payload: RpgWbInputs) -> MixDesignResult:
    """
    RPG - Rapport eau/ciment W/C (Paste Aggregate Fill).
    Requires aggregate_fraction_pct (A_m%) and aggregate_specific_gravity.
    """
    return solve_rpg_wb(payload)


@router.post("/rpg/essai", response_model=MixDesignResult)
def rpg_essai_endpoint(payload: RpgEssaiInputs) -> MixDesignResult:
    """
    RPG - Méthode essai-erreur (Paste Aggregate Fill).
    Applies mass adjustments to a base RPG recipe (Cw or W/C).
    Supports added_aggregate_mass in addition to residue and water adjustments.
    """
    return solve_rpg_essai(payload)
