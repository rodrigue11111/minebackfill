"""Formules des masses affichées sur la page Calculs (2026-10-26).

Les lignes « Résidu sec Mr », « Liant Mb » et « Eau totale Mw » du site
ouvrent désormais une fiche de formule (frontend/src/lib/report-schema.ts) :

    RPC : Mr = Cwf·M_T/(1+Bw) (F070), Mb = Mt·Bw = M_h·Cw·Bw/(1+Bw) (F040),
          Mw = M·(1−Cw) = w·Ms (F014) ;
    RPG : Mr = M_T·(1−Am)·Cw/(1+Bw) (F048), Mb = M_T·Bw/(1+Bw)·Cw (F051),
          Mw = M·(1−Cw) (F014).

Ce test vérifie que ces identités tiennent pour les recettes du calculateur,
à κ = 1 et à κ = 1,1 : aucune de ces formes ne contient κ, qui est déjà dans
la masse totale M_T (V_T = V_moule × n × κ). Le pendant côté site,
frontend/src/lib/formula-masses.test.ts, évalue les mêmes formes avec les
valeurs que la fiche affiche.
"""

from __future__ import annotations

import pytest

from app.core.models import (
    BinderComponent, BinderSystem, GeneralInfo, ResidueProps, RpcCwInputs, RpgCwInputs, SolverConstants,
)
from app.core.rpc_solver import solve_rpc_cw
from app.core.rpg_solver import solve_rpg_cw

MOULE = GeneralInfo(container_type="rayon_hauteur", container_radius=3.81, container_height=15.24)
CONSTANTES = SolverConstants(essai_gs_convention="recalcule", essai_binder_rule="residu_ajoute")
LIANT = BinderSystem(components=[
    BinderComponent(type="CP10", specific_gravity=3.1543, mass_fraction=0.2),
    BinderComponent(type="SLAG", specific_gravity=2.8426, mass_fraction=0.8),
])


def _commun(kappa: float, bw: list[float]) -> dict:
    return dict(
        general=MOULE,
        residue=ResidueProps(specific_gravity=3.1, moisture_mass_pct=25.0),
        binder_system=LIANT,
        constants=CONSTANTES,
        num_recipes=len(bw),
        containers_per_recipe=9,
        safety_factor=kappa,
        saturation_pct=100.0,
        binder_mass_pct_recipes=bw,
    )


def _proche(a: float, b: float) -> bool:
    return abs(a - b) <= 1e-9 * max(abs(a), abs(b), 1e-12)


def _grandeurs(r):
    c = r.components
    mr, mb, mw = c.residue_dry_mass_kg, c.binder_total_mass_kg, c.water_total_mass_kg
    ma = c.aggregate_dry_mass_kg or 0.0
    ms = mr + ma + mb
    return dict(mr=mr, ma=ma, mb=mb, mw=mw, ms=ms, mt=ms + mw,
                cw=r.solids_mass_pct / 100, bw=r.bw_mass_pct / 100, w=r.w_mass_pct / 100)


@pytest.mark.parametrize("kappa", [1.0, 1.1])
@pytest.mark.parametrize("cw,bw", [(70.0, [4.5, 6.0]), (75.0, [3.0, 5.0]), (78.0, [7.0])])
def test_masses_rpc(kappa, cw, bw):
    res = solve_rpc_cw(RpcCwInputs(category="RPC", solids_mass_pct=cw, **_commun(kappa, bw)))
    for r in res.recipes:
        g = _grandeurs(r)
        assert _proche(g["mr"], g["cw"] * g["mt"] / (1 + g["bw"]))                    # F070
        assert _proche(g["mb"], g["mr"] * g["bw"])                                     # F040, 1re forme
        assert _proche(g["mb"], g["mt"] * g["cw"] * g["bw"] / (1 + g["bw"]))           # F040, 2e forme
        assert _proche(g["mw"], g["mt"] * (1 - g["cw"]))                               # F014, 1re forme
        assert _proche(g["mw"], g["w"] * g["ms"])                                      # F014, 2e forme


@pytest.mark.parametrize("kappa", [1.0, 1.1])
@pytest.mark.parametrize("cw,am,bw", [(78.0, 30.0, [4.0]), (75.0, 50.0, [3.0, 6.0])])
def test_masses_rpg(kappa, cw, am, bw):
    res = solve_rpg_cw(RpgCwInputs(category="RPG", solids_mass_pct=cw, aggregate_fraction_pct=am,
                                   aggregate_specific_gravity=2.8, **_commun(kappa, bw)))
    for r in res.recipes:
        g = _grandeurs(r)
        a_m = g["ma"] / (g["mr"] + g["ma"])
        assert _proche(a_m, am / 100)                                                  # Am de F048
        assert _proche(g["mr"], g["mt"] * (1 - a_m) * g["cw"] / (1 + g["bw"]))         # F048
        assert _proche(g["mb"], g["mt"] * g["bw"] / (1 + g["bw"]) * g["cw"])           # F051
        assert _proche(g["mw"], g["mt"] * (1 - g["cw"]))                               # F014


def test_kappa_seulement_dans_la_masse_totale():
    """κ multiplie la masse totale ; les formules affichées n'en ont pas besoin."""
    m1 = solve_rpc_cw(RpcCwInputs(category="RPC", solids_mass_pct=75.0, **_commun(1.0, [5.0]))).recipes[0]
    m11 = solve_rpc_cw(RpcCwInputs(category="RPC", solids_mass_pct=75.0, **_commun(1.1, [5.0]))).recipes[0]
    assert _proche(_grandeurs(m11)["mt"], 1.1 * _grandeurs(m1)["mt"])
    assert _proche(m11.solids_mass_pct, m1.solids_mass_pct)
