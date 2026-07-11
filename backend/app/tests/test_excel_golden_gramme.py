# -*- coding: utf-8 -*-
"""
Golden tests for the « gramme » convention (feuille TBelem 2016).

Oracle: app/tests/excel_twin_gramme.py — structural clone of the tonne twin
whose ONLY divergence is the essai binder rule D65 = D60·Bw (résidu ajouté
seulement). The base recipe is identical to Intra 2017, so base cases match
either twin; the discrimination lives in the essai-with-granulat scenarios.

Two families of assertions:
  (a) the solver under essai_binder_rule="residu_ajoute" == twin_gramme at 1e-9;
  (b) discrimination — on at least one « ajout de granulat » scenario, the two
      rules give measurably different binder-to-add masses (proves the flag is
      really exercised and the grid does not pass « par accident »).
"""

from __future__ import annotations

import pytest

from app.core.models import (
    ResidueProps, SolverConstants,
    RpgCwInputs, RpgEssaiInputs, RpgEssaiAdjustment,
)
from app.core.rpg_solver import solve_rpg_essai
from . import excel_twin, excel_twin_gramme
# Réutilise les aides de comparaison twin<->solveur du test d'or tonne.
from .test_excel_golden import (
    _essai_pairs, _common_kwargs, _assert_close, _rel,
    GSG, W0_REF, V_CONT, BINDER_SPECS, REL,
)


# Les densités finales (D91-D96) SONT dans la feuille gramme, avec le Gs final
# au Bw ATTEINT (D95 via D89) — le pipeline suit désormais la même formule, la
# comparaison est donc complète (aucune exclusion).
def _pairs_gramme(st, tw):
    return _essai_pairs(st, tw)


def _twin(mod, Cw, Bw, Xg, adj):
    return mod.run(Gs_r=3.05, Gs_g=GSG, w0=W0_REF, Cw=Cw, Bw=Bw, Xg=Xg,
                   FS=0.0, binders=BINDER_SPECS["GU20/Slag80"],
                   V_cont=V_CONT, nb=1.0, adj=adj)


def _solve_essai(Cw, Bw, Xg, adj, rule):
    """Recette RPG essai sous la règle de liant demandée."""
    common = _common_kwargs(Cw, Bw, W0_REF, 3.05, BINDER_SPECS["GU20/Slag80"])
    consts = SolverConstants(essai_binder_rule=rule)
    rpg_adj = RpgEssaiAdjustment(
        added_water_mass=adj.get("water", 0.0) * 1000.0,
        added_wet_residue_mass=adj.get("wet_residue", 0.0) * 1000.0,
        added_aggregate_mass=adj.get("granulat", 0.0) * 1000.0,
        aggregate_moisture_mass_pct=0.0)
    return solve_rpg_essai(RpgEssaiInputs(
        category="RPG", **common, constants=consts, base_method="dosage_cw",
        base_inputs_cw=RpgCwInputs(category="RPG", aggregate_fraction_pct=Xg * 100,
                                   aggregate_specific_gravity=GSG, **common),
        adjustments=[rpg_adj])).recipes[0]


def test_twin_gramme_self_validation():
    assert excel_twin_gramme.self_validate(verbose=False)


# Scénarios d'essai — inclut des ajouts de GRANULAT (le discriminant), ainsi
# que des ajouts de résidu/eau (où les deux règles coïncident).
GRAMME_SCENARIOS = [
    ("gran+400_Xg0",   0.0,  {"granulat": 400.0}),
    ("gran+500_Xg30",  0.30, {"granulat": 500.0}),
    ("combo_Xg30",     0.30, {"water": -80.0, "wet_residue": 250.0, "granulat": 300.0}),
    ("resh+800",       0.0,  {"wet_residue": 800.0}),        # coïncide avec intra
    ("eau+500",        0.0,  {"water": 500.0}),              # coïncide avec intra
    ("resh-600_Xg30",  0.30, {"wet_residue": -600.0}),
]


@pytest.mark.parametrize("sid,Xg,adj", GRAMME_SCENARIOS, ids=[s[0] for s in GRAMME_SCENARIOS])
def test_essai_gramme_vs_twin(sid, Xg, adj):
    """(a) Le solveur sous « residu_ajoute » reproduit le twin gramme à 1e-9."""
    tw = _twin(excel_twin_gramme, 0.70, 0.045, Xg, adj)
    st = _solve_essai(0.70, 0.045, Xg, adj, "residu_ajoute")
    ctx = f"[gramme {sid}]"
    for name, ours, ref in _pairs_gramme(st, tw):
        _assert_close(f"gramme {name}", ours, ref, ctx=ctx)
    if _rel(tw["Srf"], 1.0) <= REL:
        _assert_close("Sr==100%", st.saturation_pct, 100.0, ctx=ctx)


# Grille réduite base (Cw x Bw) : sans ajustement, gramme == intra (D65=0).
BASE_GRID = [(cw, bw, xg) for cw in (0.68, 0.73, 0.80)
             for bw in (0.03, 0.05, 0.07) for xg in (0.0, 0.30)]


@pytest.mark.parametrize("Cw,Bw,Xg", BASE_GRID)
def test_base_gramme_reproduit(Cw, Bw, Xg):
    """La recette de base sous drapeaux gramme == twin gramme (== intra)."""
    tw = _twin(excel_twin_gramme, Cw, Bw, Xg, {})
    st = _solve_essai(Cw, Bw, Xg, {}, "residu_ajoute")
    for name, ours, ref in _pairs_gramme(st, tw):
        _assert_close(f"base {name}", ours, ref, ctx=f"[base Cw{Cw} Bw{Bw} Xg{Xg}]")


DISCRIMINANTS = [
    ("gran+400_Xg0",   0.0,  {"granulat": 400.0}),
    ("gran+500_Xg30",  0.30, {"granulat": 500.0}),
    ("combo_Xg30",     0.30, {"water": -80.0, "wet_residue": 250.0, "granulat": 300.0}),
]


@pytest.mark.parametrize("sid,Xg,adj", DISCRIMINANTS, ids=[s[0] for s in DISCRIMINANTS])
def test_discrimination_regle_liant(sid, Xg, adj):
    """(b) Sur ajout de granulat, les deux règles DIVERGENT : gramme suit le
    twin gramme, intra (défaut) suit le twin tonne, et le liant à ajouter
    diffère nettement."""
    tw_g = _twin(excel_twin_gramme, 0.70, 0.045, Xg, adj)
    tw_i = _twin(excel_twin, 0.70, 0.045, Xg, adj)
    st_g = _solve_essai(0.70, 0.045, Xg, adj, "residu_ajoute")
    st_i = _solve_essai(0.70, 0.045, Xg, adj, "solides_totaux")

    # Chaque solveur reproduit SON oracle.
    _assert_close("gramme Mb_ad", st_g.components.binder_to_add_mass_kg / 1000.0,
                  tw_g["adj_liant"], ctx=f"[disc {sid}]")
    _assert_close("intra Mb_ad", st_i.components.binder_to_add_mass_kg / 1000.0,
                  tw_i["adj_liant"], ctx=f"[disc {sid}]")

    # Les deux règles DIVERGENT (le granulat ajouté reçoit du liant en intra,
    # aucun en gramme). Écart largement au-dessus du bruit numérique.
    ecart = abs(st_g.components.binder_to_add_mass_kg
                - st_i.components.binder_to_add_mass_kg)
    assert ecart > 1.0, f"[{sid}] règles non discriminées : écart Mb_ad = {ecart}"
    # En gramme, un ajout de granulat seul n'ajoute aucun liant.
    if adj.get("granulat", 0.0) > 0 and adj.get("wet_residue", 0.0) == 0:
        assert abs(st_g.components.binder_to_add_mass_kg) < 1e-6
