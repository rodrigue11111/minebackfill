# -*- coding: utf-8 -*-
"""
Tests d'or RRC/CRF — formules du cours (Séance 5, Dias 66-70).

Cas de référence calculé à la main (vérifiable ligne à ligne) :
  V_CRF = 1000 m³, rho_wet = 2200 kg/m³  ->  M_CRF = 2 200 000 kg
  Bw = 5 %, W/C = 1.0, D0 = 100 ml/100 kg, rho_SR = 1.2 g/ml, Gs_c = 3.15

  D1 = 1e-5*100 = 1e-3 ml/g ; D2 = 1 ml/kg ; rho_SR*D1 = 1.2e-3
  K = 1 + 0.05*(1+1) = 1.1
  M_WR   = 2 200 000 / 1.1          = 2 000 000 kg
  M_c    = 0.05 * 2 000 000         =   100 000 kg
  M*     = 1.0 * 100 000            =   100 000 kg
  M_SR   = 100 000 * 1.2e-3         =       120 kg
  M_w    = 100 000 - 120            =    99 880 kg
  V_SR   = 1 ml/kg * 100 000 kg     =   100 000 ml = 100 L
  w      = 1.0*0.05/1.05            = 0.047619047...
  Cw     = 1.05/1.1                 = 0.954545454...
  D_m%   = 1.2e-3*100               = 0.12 %
  M_slur = 100 000 * 2              =   200 000 kg
  V_slur = 100000/3150 + 99880/1000 + 0.1 = 31.746032 + 99.88 + 0.1
                                    = 131.726032 m³
  Invariant : M_WR + M_c + M* = M_CRF.
"""

from __future__ import annotations

import itertools

import pytest

from app.core.models import GeneralInfo, RrcInputs
from app.core.rrc_solver import solve_rrc

REL = 1e-9


def _rel(a, b):
    if b == 0.0:
        return abs(a)
    return abs(a / b - 1.0)


def _close(name, ours, ref, tol=REL):
    assert _rel(ours, ref) <= tol, f"{name}: ours={ours!r} ref={ref!r} rel={_rel(ours, ref):.3g}"


def _inputs(**kw):
    base = dict(
        category="RRC",
        general=GeneralInfo(),
        num_recipes=1,
        quantity_mode="volume",
        volume_m3=1000.0,
        wet_density_kg_m3=2200.0,
        binder_mass_pct_recipes=[5.0],
        wc_ratio_recipes=[1.0],
        cement_specific_gravity=3.15,
        retarder_dosage_ml_per_100kg=100.0,
        retarder_density_g_ml=1.2,
    )
    base.update(kw)
    return RrcInputs(**base)


def test_rrc_reference_case():
    r = solve_rrc(_inputs()).recipes[0]
    _close("M_CRF", r.total_mass_kg, 2_200_000.0)
    _close("V_CRF", r.crf_volume_m3, 1000.0)
    _close("M_WR", r.waste_rock_mass_kg, 2_000_000.0)
    _close("M_c", r.cement_mass_kg, 100_000.0)
    _close("M*", r.fluid_mass_kg, 100_000.0)
    _close("M_SR", r.retarder_mass_kg, 120.0)
    _close("M_w", r.water_mass_kg, 99_880.0)
    _close("V_SR (L)", r.retarder_volume_l, 100.0)
    _close("w%", r.w_mass_pct, 100.0 * 1.0 * 0.05 / 1.05)
    _close("Cw%", r.solids_mass_pct, 100.0 * 1.05 / 1.1)
    _close("D_m%", r.retarder_dosage_mass_pct, 0.12)
    _close("M_slurry", r.slurry_mass_kg, 200_000.0)
    _close("V_slurry", r.slurry_volume_m3, 100_000.0 / 3150.0 + 99.88 + 0.1)


def test_rrc_mass_mode_equivalent():
    """Mode masse directe == mode volume pour la même masse totale."""
    a = solve_rrc(_inputs()).recipes[0]
    b = solve_rrc(_inputs(quantity_mode="masse", total_mass_kg=2_200_000.0,
                          volume_m3=None)).recipes[0]
    for champ in ("waste_rock_mass_kg", "cement_mass_kg", "water_mass_kg",
                  "retarder_mass_kg", "slurry_volume_m3", "w_mass_pct",
                  "solids_mass_pct"):
        _close(champ, getattr(b, champ), getattr(a, champ))


GRID = list(itertools.product(
    [2.0, 5.0, 8.0],            # Bw %
    [0.8, 1.0, 1.5, 7.0],       # W/C
    [0.0, 50.0, 260.0],         # D0 (plage du cours : 50-260)
    [1800.0, 2200.0, 2400.0],   # rho_wet
))


@pytest.mark.parametrize("bw_pct,wc,d0,rho_wet", GRID)
def test_rrc_invariants(bw_pct, wc, d0, rho_wet):
    """Invariants algébriques des Dias 68-70 sur une grille de 108 cas."""
    r = solve_rrc(_inputs(binder_mass_pct_recipes=[bw_pct], wc_ratio_recipes=[wc],
                          retarder_dosage_ml_per_100kg=d0,
                          wet_density_kg_m3=rho_wet)).recipes[0]
    bw = bw_pct / 100.0
    # Conservation de la masse : M_WR + M_c + M* = M_CRF
    _close("bilan de masse",
           r.waste_rock_mass_kg + r.cement_mass_kg + r.fluid_mass_kg,
           r.total_mass_kg)
    # M* = M_w + M_SR
    _close("fluide", r.water_mass_kg + r.retarder_mass_kg, r.fluid_mass_kg)
    # Bw = M_c / M_WR
    _close("Bw", r.cement_mass_kg / r.waste_rock_mass_kg, bw)
    # W/C = M* / M_c
    _close("W/C", r.fluid_mass_kg / r.cement_mass_kg, wc)
    # w = M*/(M_WR+M_c) et Cw = 1/(1+w)  [F058/F059]
    w = r.fluid_mass_kg / (r.waste_rock_mass_kg + r.cement_mass_kg)
    _close("w%", r.w_mass_pct, w * 100.0)
    _close("Cw%", r.solids_mass_pct, 100.0 / (1.0 + w))
    # M_slurry = M_c + M*
    _close("coulis", r.slurry_mass_kg, r.cement_mass_kg + r.fluid_mass_kg)
    # D_m% = M_SR/M_c * 100
    if d0 > 0:
        _close("D_m%", r.retarder_dosage_mass_pct,
               r.retarder_mass_kg / r.cement_mass_kg * 100.0)


def test_rrc_validation_errors():
    with pytest.raises(ValueError, match="Volume du chantier requis"):
        solve_rrc(_inputs(volume_m3=None))
    with pytest.raises(ValueError, match="Masse totale de CRF requise"):
        solve_rrc(_inputs(quantity_mode="masse", total_mass_kg=None))
    with pytest.raises(ValueError, match="binder_mass_pct_recipes"):
        solve_rrc(_inputs(num_recipes=2))
    # Retardateur absurde : fluide entièrement retardateur
    with pytest.raises(ValueError, match="retardateur trop élevé"):
        solve_rrc(_inputs(wc_ratio_recipes=[0.001],
                          retarder_dosage_ml_per_100kg=200_000.0))


def test_rrc_multi_recipes():
    res = solve_rrc(_inputs(num_recipes=3,
                            binder_mass_pct_recipes=[3.0, 5.0, 7.0],
                            wc_ratio_recipes=[1.0, 1.0, 1.0]))
    assert len(res.recipes) == 3
    # Bw croissant -> plus de ciment, moins de roches
    cements = [r.cement_mass_kg for r in res.recipes]
    rocks = [r.waste_rock_mass_kg for r in res.recipes]
    assert cements[0] < cements[1] < cements[2]
    assert rocks[0] > rocks[1] > rocks[2]
