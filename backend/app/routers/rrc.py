# app/routers/rrc.py
"""
Routes pour le RRC — Remblai Rocheux Cimenté (Cemented Rockfill).
  - POST /rrc/dosage -> solve_rrc
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.models import RrcInputs, RrcResult
from app.core.rrc_solver import solve_rrc

router = APIRouter(
    prefix="",
    tags=["RRC"],
)


@router.post("/rrc/dosage", response_model=RrcResult)
def rrc_dosage_endpoint(payload: RrcInputs) -> RrcResult:
    """
    RRC/CRF — dosage par Bw (liant/roches stériles) et W/C du coulis.
    Formules du cours, Dias 66-70 (masses, retardateur de prise, coulis).
    """
    return solve_rrc(payload)
