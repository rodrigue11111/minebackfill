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
    # Ajouts 2026-09-27 — APPEND uniquement : la sentinelle des tests est un
    # tuple ORDONNÉ, réordonner casserait test_series_keys_sentinelle.
    # Aucune formule nouvelle : ces champs sont déjà calculés par les solveurs.
    "cv_vol_pct": lambda s: s.cv_vol_pct,                                  # Cv%
    # Les deux masses répondent à « que change vraiment un balayage de Bw ? » :
    # à Cw imposé, le résidu cède la place au liant et le total ne bouge qu'à
    # peine. Sans elles, cette redistribution n'est affirmée nulle part.
    "residue_dry_mass_kg": lambda s: s.components.residue_dry_mass_kg,
    "binder_total_mass_kg": lambda s: s.components.binder_total_mass_kg,
}

#: Grandeurs disponibles côté clients (nom stable). Exporté pour les tests.
SERIES_KEYS = tuple(_SERIES.keys())


def _linspace(a: float, b: float, n: int) -> List[float]:
    if n <= 1:
        return [a]
    return [a + (b - a) * i / (n - 1) for i in range(n)]


# Delta à appliquer sur la base pour porter le paramètre balayé, UN par membre
# de BalayageParam. Table plutôt que chaîne de si/sinon : une chaîne sans
# branche par défaut acceptait silencieusement un paramètre non branché et
# rendait une courbe PARFAITEMENT PLATE, sans erreur ni coupure — le balayage
# « réussissait » en ne balayant rien.
_PARAM_OVERRIDE: Dict[BalayageParam, Callable[[float], dict]] = {
    BalayageParam.BW: lambda x: {"binder_mass_pct_recipes": [x]},
    BalayageParam.CW: lambda x: {"solids_mass_pct": x},
    BalayageParam.SR: lambda x: {"saturation_pct": x},
    BalayageParam.AM: lambda x: {"aggregate_fraction_pct": x},
}

# Contrôle de complétude À L'IMPORT du module, et non au moment du balayage.
# Un membre ajouté à BalayageParam sans branche ici casse donc l'import, donc
# la suite entière — immédiatement, sans attendre que quelqu'un balaie ce
# paramètre-là. C'est volontairement plus brutal qu'une exception levée dans
# _override : celle-ci ne se déclencherait qu'au premier usage réel.
# `raise` et non `assert` : les assertions disparaissent sous `python -O`.
_sans_branche = set(BalayageParam) - set(_PARAM_OVERRIDE)
if _sans_branche:
    raise RuntimeError(
        "Paramètres balayables sans branche dans _PARAM_OVERRIDE : "
        f"{sorted(p.value for p in _sans_branche)}"
    )

#: Paramètres balayables (nom stable). Exporté pour la sentinelle des tests,
#: symétrique de SERIES_KEYS.
PARAM_KEYS = tuple(p.value for p in BalayageParam)


def _override(base, param: BalayageParam, x: float) -> dict:
    """Champs à remplacer sur la base pour porter le paramètre balayé (recette
    unique). Le liant garde la valeur de la 1re recette sauf si c'est LUI qu'on
    balaie."""
    bw0 = base.binder_mass_pct_recipes[0] if base.binder_mass_pct_recipes else 0.0
    maj: dict = {"num_recipes": 1, "binder_mass_pct_recipes": [bw0]}
    maj.update(_PARAM_OVERRIDE[param](x))
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
