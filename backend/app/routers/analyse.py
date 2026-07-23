# app/routers/analyse.py
"""
Route d'analyse : balayage paramétrique (courbes de réponse).
  - POST /analyse/balayage → balaye un paramètre d'entrée et renvoie les
    séries des grandeurs dérivées (réutilise les solveurs RPC/RPG).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.analyse import balayer
from app.core.models import BalayageInputs, BalayageResult

router = APIRouter(prefix="", tags=["Analyse"])


@router.post("/analyse/balayage", response_model=BalayageResult)
def analyse_balayage_endpoint(payload: BalayageInputs) -> BalayageResult:
    """
    Courbe de réponse : fait varier `param` de `x_min` à `x_max` en `steps`
    points sur une recette Cw% de base (RPC ou RPG) et renvoie, pour chaque
    grandeur de sortie, la série des valeurs.
    """
    return balayer(payload)
