# app/core/analyse.py
"""
Balayage paramétrique (courbes de réponse).

Fait varier UN paramètre d'entrée d'une recette (méthode Cw%) sur une plage et
collecte la réponse de grandeurs dérivées, en RÉUTILISANT les solveurs RPC/RPG
existants. Aucune formule n'est réimplémentée ici : chaque point est une vraie
résolution, donc toute évolution des solveurs se répercute automatiquement et
les tests d'or ne sont pas concernés.

Un point qui n'est pas physiquement calculable (paramètre hors bornes du
modèle d'entrée, ou erreur métier du solveur) devient `None` : la courbe
présente une coupure au lieu de faire échouer tout le balayage.
"""

from __future__ import annotations

import math
from typing import Callable, Dict, List, Optional

from pydantic import ValidationError

from app.core.models import (
    BalayageInputs, BalayageParam, BalayageResult, MixState,
)
from app.core.rpc_solver import solve_rpc_cw
from app.core.rpg_solver import solve_rpg_cw

# Grandeurs de sortie exposées : clé stable -> extracteur depuis un MixState.
# (Le frontend choisit lesquelles afficher et porte les libellés/unités.)
_SERIES: Dict[str, Callable[[MixState], float]] = {
    "solids_mass_pct": lambda s: s.solids_mass_pct,                        # Cw%
    "wc_ratio": lambda s: s.wc_ratio,                                      # W/C
    "void_ratio": lambda s: s.void_ratio,                                  # e
    "porosity": lambda s: s.porosity,                                      # n
    "saturation_pct": lambda s: s.saturation_pct,                          # Sr%
    "bw_mass_pct": lambda s: s.bw_mass_pct,                                # Bw%
    "bv_vol_pct": lambda s: s.bv_vol_pct,                                  # Bv%
    "w_mass_pct": lambda s: s.w_mass_pct,                                  # w%
    "dry_density_kg_m3": lambda s: s.dry_density_kg_m3,                    # rho_d
    "bulk_density_kg_m3": lambda s: s.bulk_density_kg_m3,                  # rho_h
    "aggregate_mass_pct": lambda s: s.aggregate_mass_pct,                  # A_m%
    "aggregate_vol_pct_of_residue": lambda s: s.aggregate_vol_pct_of_residue,  # A_v%
}

#: Grandeurs disponibles côté clients (nom stable). Exporté pour les tests.
SERIES_KEYS = tuple(_SERIES.keys())


def _linspace(a: float, b: float, n: int) -> List[float]:
    if n <= 1:
        return [a]
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def _override(base, param: BalayageParam, x: float) -> dict:
    """Champs à remplacer sur la base pour porter le paramètre balayé (recette
    unique). Le liant garde la valeur de la 1re recette sauf si c'est LUI qu'on
    balaie."""
    bw0 = base.binder_mass_pct_recipes[0] if base.binder_mass_pct_recipes else 0.0
    maj: dict = {"num_recipes": 1, "binder_mass_pct_recipes": [bw0]}
    if param == BalayageParam.BW:
        maj["binder_mass_pct_recipes"] = [x]
    elif param == BalayageParam.CW:
        maj["solids_mass_pct"] = x
    elif param == BalayageParam.SR:
        maj["saturation_pct"] = x
    elif param == BalayageParam.AM:
        maj["aggregate_fraction_pct"] = x
    return maj


def _etat(base, solve, param: BalayageParam, x: float) -> Optional[MixState]:
    """Reconstruit la base avec le paramètre à `x` (re-validée -> bornes du
    modèle respectées) et résout. None si hors bornes ou erreur métier."""
    data = base.model_dump()
    data.update(_override(base, param, x))
    try:
        payload = type(base)(**data)
        result = solve(payload)
    except (ValidationError, ValueError, ZeroDivisionError):
        return None
    return result.recipes[0] if result.recipes else None


def _valeur(v: float) -> Optional[float]:
    # None, NaN ou ±inf -> coupure (None) : une valeur non finie n'est pas du
    # JSON valide et n'a pas de sens sur une courbe. PLEINE PRÉCISION conservée
    # (l'arrondi se fait à l'affichage) — nécessaire pour les écarts relatifs de
    # grandeurs très peu variables (p. ex. l'indice des vides e).
    if v is None or not math.isfinite(v):
        return None
    return float(v)


def balayer(inputs: BalayageInputs) -> BalayageResult:
    base = inputs.base_inputs_rpc if inputs.category == "RPC" else inputs.base_inputs_rpg
    solve = solve_rpc_cw if inputs.category == "RPC" else solve_rpg_cw

    xs = _linspace(inputs.x_min, inputs.x_max, inputs.steps)
    series: Dict[str, List[Optional[float]]] = {k: [] for k in _SERIES}
    for x in xs:
        st = _etat(base, solve, inputs.param, x)
        for key, extract in _SERIES.items():
            series[key].append(_valeur(extract(st)) if st is not None else None)

    return BalayageResult(
        category=inputs.category,
        param=inputs.param.value,
        x=xs,
        series=series,
    )
