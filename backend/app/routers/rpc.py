# app/routers/rpc.py
"""
Routes for RPC mix design (Cw, W/B, Slump, Essai-erreur).

For now we only wire:
  - POST /rpc/cw  → solve_rpc_cw
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.models import RpcCwInputs, RpcWbInputs, RpcSlumpInputs, RpcEssaiInputs, MixDesignResult
from app.core.rpc_solver import solve_rpc_cw, solve_rpc_wb, solve_rpc_slump, solve_rpc_essai

router = APIRouter(
    prefix="",
    tags=["RPC"],
)


@router.post("/rpc/cw", response_model=MixDesignResult)
def rpc_cw_endpoint(payload: RpcCwInputs) -> MixDesignResult:
    """
    RPC - Dosage selon Cw (%).

    The request body must match RpcCwInputs:
      - category
      - general (GeneralInfo)
      - residue (ResidueProps)
      - binder_system (BinderSystem)
      - num_recipes, containers_per_recipe, safety_factor
      - solids_mass_pct, saturation_pct
      - binder_mass_pct_recipes (list of % liant for each recette)

    This endpoint simply:
      1. Lets FastAPI + Pydantic validate data
      2. Calls the domain solver solve_rpc_cw(...)
      3. Returns the MixDesignResult to the client
    """
    result = solve_rpc_cw(payload)
    return result


@router.post("/rpc/wb", response_model=MixDesignResult)
def rpc_wb_endpoint(payload: RpcWbInputs) -> MixDesignResult:
    """
    RPC/RPG - Rapport eau/ciment (W/C).
    """
    result = solve_rpc_wb(payload)
    return result


@router.post("/rpc/slump", response_model=MixDesignResult)
def rpc_slump_endpoint(payload: RpcSlumpInputs) -> MixDesignResult:
    """
    RPC - Ajustement pour slump (prAcdiction Cw%).
    """
    result = solve_rpc_slump(payload)
    return result


@router.post("/rpc/essai", response_model=MixDesignResult)
def rpc_essai_endpoint(payload: RpcEssaiInputs) -> MixDesignResult:
    """
    RPC - MActhode essai-erreur (ajustements masse/eau).
    """
    result = solve_rpc_essai(payload)
    return result
