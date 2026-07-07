# -*- coding: utf-8 -*-
"""
Tests unitaires du pipeline de calcul (app/core/mix_pipeline.py).

Les tests d'or (test_excel_golden.py) vérifient les solveurs de bout en bout
contre le classeur de référence ; ici on teste chaque fonction mathématique
directement : valeurs calculées à la main, identités algébriques sur une
grille pseudo-aléatoire reproductible, cas dégénérés, et la branche
ESSAI_GS_CONVENTION = "recalcule" (jamais exercée par les tests d'or).
"""

from __future__ import annotations

import itertools
import random

import pytest

from app.core import mix_pipeline
from app.core.mix_pipeline import (
    apply_essai_adjustments,
    cw_from_wc,
    gs_backfill_eff,
    gs_nonbinder_eff,
    solve_recipe,
)

REL = 1e-9


def _rel(a, b):
    if b == 0.0:
        return abs(a)
    return abs(a / b - 1.0)


def _close(name, ours, ref, tol=REL):
    assert _rel(ours, ref) <= tol, f"{name}: {ours!r} vs {ref!r} (rel {_rel(ours, ref):.3g})"


# ======================================================================
#  Gs équivalents
# ======================================================================

class TestGsHelpers:
    def test_gs_nonbinder_valeur_main(self):
        # 30 % granulat Gs 2.8, 70 % résidus Gs 3.05 :
        # 1/(0.3/2.8 + 0.7/3.05) = 1/(0.1071428... + 0.2295081...) = 2.9704...
        _close("Gs_eff", gs_nonbinder_eff(3.05, 0.30, 2.8),
               1.0 / (0.30 / 2.8 + 0.70 / 3.05))

    def test_gs_nonbinder_sans_granulat(self):
        assert gs_nonbinder_eff(3.05, 0.0, 2.8) == 3.05
        assert gs_nonbinder_eff(3.05) == 3.05
        # Gs granulat absent ou nul -> on retombe sur le résidu seul
        assert gs_nonbinder_eff(3.05, 0.30, None) == 3.05
        assert gs_nonbinder_eff(3.05, 0.30, 0.0) == 3.05

    def test_gs_nonbinder_tout_granulat(self):
        _close("Xg=1", gs_nonbinder_eff(3.05, 1.0, 2.8), 2.8)

    def test_gs_backfill_valeur_main(self):
        # (1+Bw) / ((1-Xg)/Gs_r + Xg/Gs_g + Bw/Gs_b), Bw=0.045
        attendu = 1.045 / (0.70 / 3.05 + 0.30 / 2.8 + 0.045 / 2.946774193548387)
        _close("Gs_pate", gs_backfill_eff(3.05, 0.30, 2.8, 0.045, 2.946774193548387), attendu)

    def test_gs_backfill_sans_liant(self):
        # Bw = 0 : la pâte se réduit aux solides hors liant
        _close("Bw=0", gs_backfill_eff(3.05, 0.30, 2.8, 0.0, 3.0),
               gs_nonbinder_eff(3.05, 0.30, 2.8))

    def test_gs_backfill_invalide(self):
        assert gs_backfill_eff(3.05, 0.0, None, 0.045, 0.0) == 0.0


# ======================================================================
#  Cw depuis (Bw, W/C)
# ======================================================================

class TestCwFromWc:
    @pytest.mark.parametrize("bw,wc", itertools.product([0.02, 0.045, 0.08], [4.0, 7.0, 12.0]))
    def test_aller_retour(self, bw, wc):
        cw = cw_from_wc(bw, wc)
        assert 0.0 < cw < 1.0
        # relation inverse de la feuille : wc = (1/Cw - 1)(1+Bw)/Bw
        _close("wc", (1.0 / cw - 1.0) * (1.0 + bw) / bw, wc)

    def test_degeneres(self):
        assert cw_from_wc(0.0, 7.0) == 0.0
        assert cw_from_wc(0.05, 0.0) == 0.0


# ======================================================================
#  solve_recipe — identités algébriques sur une grille reproductible
# ======================================================================

def _grille_aleatoire(n=120, seed=42):
    rng = random.Random(seed)
    cas = []
    for _ in range(n):
        cas.append(dict(
            cw_frac=rng.uniform(0.55, 0.85),
            sr_frac=rng.choice([1.0, 1.0, 0.85, 0.7]),  # saturé majoritaire
            bw_frac=rng.uniform(0.01, 0.09),
            xg_frac=rng.choice([0.0, 0.0, rng.uniform(0.05, 0.6)]),
            gs_r=rng.uniform(2.7, 4.4),
            gs_g=rng.uniform(2.4, 3.0),
            gs_binder=rng.uniform(2.6, 3.2),
            w0_frac=rng.uniform(0.0, 0.45),
            v_total_m3=rng.choice([0.00165, 1.0, 11000.0]),
            water_density=rng.choice([1000.0, 1000.0, 998.2]),
        ))
    return cas


@pytest.mark.parametrize("cas", _grille_aleatoire(), ids=lambda c: f"cw{c['cw_frac']:.2f}")
def test_solve_recipe_invariants(cas):
    q = solve_recipe(**cas)
    rho_w = cas["water_density"]

    # teneur en eau et indice des vides
    _close("w", q.w, 1.0 / cas["cw_frac"] - 1.0)
    _close("e", q.e, q.w * q.gs_backfill / cas["sr_frac"])
    _close("n", q.n, q.e / (1.0 + q.e))
    _close("Cv", q.cv, 1.0 / (1.0 + q.e))

    # densités
    _close("rho_d", q.rho_d, q.gs_backfill * rho_w / (1.0 + q.e))
    _close("rho_h", q.rho_h, q.rho_d * (1.0 + q.w))

    # masses : répartition et bilans
    _close("Ms = rho_d*VT", q.ms_total, q.rho_d * cas["v_total_m3"])
    _close("Ms = Mr+Mg+Mb", q.mr_sec + q.mg_sec + q.mb, q.ms_total)
    _close("Mw = w*Ms", q.mw_total, q.w * q.ms_total)
    if q.mr_sec + q.mg_sec > 0:
        _close("Bw = Mb/(Mr+Mg)", q.mb / (q.mr_sec + q.mg_sec), cas["bw_frac"])
    if cas["xg_frac"] > 0:
        _close("Xg = Mg/(Mr+Mg)", q.mg_sec / (q.mr_sec + q.mg_sec), cas["xg_frac"])
    else:
        assert q.mg_sec == 0.0

    # volumes cohérents
    _close("Vs = Vr+Vg+Vb", q.vs, q.vr + q.vg + q.vb)
    _close("Vs = Cv*VT", q.vs, q.cv * cas["v_total_m3"])
    _close("Vv = VT-Vs", q.vv, cas["v_total_m3"] - q.vs)
    _close("Vw = Mw/rho_w", q.vw, q.mw_total / rho_w)

    # saturation : Vw = Sr*Vv par construction
    _close("Vw = Sr*Vv", q.vw, cas["sr_frac"] * q.vv, tol=1e-8)

    # résidu humide et eau à ajouter
    _close("Mr_hum", q.mr_hum, q.mr_sec * (1.0 + cas["w0_frac"]))
    _close("Mw_add", q.mw_to_add, q.mw_total - cas["w0_frac"] * q.mr_sec)

    # W/C et Bv
    _close("wc", q.wc, q.mw_total / q.mb)
    _close("Bv", q.bv, cas["bw_frac"] * q.gs_nonbinder / cas["gs_binder"])


def test_solve_recipe_sature_masse_totale():
    """À Sr = 100 %, la masse totale vaut exactement rho_h * VT (pas d'air)."""
    q = solve_recipe(cw_frac=0.7, sr_frac=1.0, bw_frac=0.045, xg_frac=0.0,
                     gs_r=3.05, gs_g=None, gs_binder=2.946774193548387,
                     w0_frac=0.3, v_total_m3=11000.0, water_density=1000.0)
    _close("MT", q.ms_total + q.mw_total, q.rho_h * 11000.0)
    # et le volume d'air est nul
    _close("Vair", q.vv - q.vw, 0.0, tol=1e-6)


def test_solve_recipe_sans_liant():
    q = solve_recipe(cw_frac=0.7, sr_frac=1.0, bw_frac=0.0, xg_frac=0.0,
                     gs_r=3.05, gs_g=None, gs_binder=3.15,
                     w0_frac=0.3, v_total_m3=1.0, water_density=1000.0)
    assert q.mb == 0.0 and q.vb == 0.0 and q.bv == 0.0
    _close("Ms = Mr", q.mr_sec, q.ms_total)


# ======================================================================
#  apply_essai_adjustments
# ======================================================================

def _base(sr=1.0, xg=0.0):
    """Recette de base + arguments communs pour l'essai."""
    q = solve_recipe(cw_frac=0.70, sr_frac=sr, bw_frac=0.045, xg_frac=xg,
                     gs_r=3.05, gs_g=2.8 if xg > 0 else None,
                     gs_binder=2.946774193548387, w0_frac=1 / 0.76 - 1,
                     v_total_m3=11000.0, water_density=1000.0)
    args = dict(
        mr_sec_base=q.mr_sec, mg_sec_base=q.mg_sec, mb_base=q.mb,
        mw_base=q.mw_total, vt_base=11000.0, bw_target_frac=0.045,
        gs_r=3.05, gs_g=2.8 if xg > 0 else None, gs_binder=2.946774193548387,
        gs_backfill_base=q.gs_backfill, gs_nonbinder_base=q.gs_nonbinder,
        w0_frac=1 / 0.76 - 1, water_density=1000.0,
    )
    return q, args


class TestApplyEssai:
    @pytest.mark.parametrize("sr", [1.0, 0.85])
    def test_point_fixe_sans_ajustement(self, sr):
        """Aucun ajustement -> l'état final == l'état de base (toutes grandeurs)."""
        q, args = _base(sr=sr)
        eq = apply_essai_adjustments(**args)
        _close("e", eq.e, q.e)
        _close("Sr", eq.sr, sr)
        _close("w", eq.w, q.w)
        _close("Cw", eq.cw, 0.70)
        _close("Mb", eq.mb_tot, q.mb)
        _close("Mb_ad", eq.mb_ad, 0.0, tol=1e-6)
        _close("VT", eq.vt_new, 11000.0)
        _close("rho_h", eq.rho_h, q.rho_h)

    def test_decomposition_residu_humide(self):
        """delta_wet = partie sèche + eau, aux proportions w0."""
        q, args = _base()
        w0 = args["w0_frac"]
        eq = apply_essai_adjustments(**args, delta_wet_residue=800.0)
        sec = 800.0 / (1.0 + w0)
        _close("Mr_tot", eq.mr_sec_tot, q.mr_sec + sec)
        _close("Mw_tot", eq.mw_tot, q.mw_total + (800.0 - sec))
        # le liant suit le Bw cible
        _close("Mb_tot", eq.mb_tot, 0.045 * eq.mr_sec_tot)
        _close("Mb_ad", eq.mb_ad, eq.mb_tot - q.mb)

    def test_conservation_volume_et_masse(self):
        """VT_new = VT + volumes ajoutés ; la masse suit le bilan exact."""
        q, args = _base()
        eq = apply_essai_adjustments(**args, delta_water=500_000.0)  # 500 t
        _close("VT_new", eq.vt_new, 11000.0 + 500_000.0 / 1000.0)
        _close("Mw_tot", eq.mw_tot, q.mw_total + 500_000.0)
        _close("Sr reste 100%", eq.sr, 1.0)

    def test_retrait_liant_negatif(self):
        """Retirer du résidu rend Mb_ad négatif (liant à retirer), sans borne."""
        q, args = _base()
        eq = apply_essai_adjustments(**args, delta_wet_residue=-600_000.0)
        assert eq.mb_ad < 0.0
        _close("coherence Mb", eq.mb_tot, q.mb + eq.mb_ad)

    def test_granulat_humide(self):
        """L'agrégat ajouté transporte son eau w0_ag."""
        q, args = _base(xg=0.30)
        eq = apply_essai_adjustments(**args, delta_aggregate=400_000.0,
                                     aggregate_w0_frac=0.04)
        _close("Mg_tot", eq.mg_sec_tot, q.mg_sec + 400_000.0)
        _close("Mw_tot", eq.mw_tot, q.mw_total + 400_000.0 * 0.04)

    def test_convention_recalcule(self, monkeypatch):
        """Branche ESSAI_GS_CONVENTION='recalcule' : Gs recalculé avec le
        nouveau Xg, résultats auto-cohérents (e = w*Gs_new/Sr à saturation)."""
        monkeypatch.setattr(mix_pipeline, "ESSAI_GS_CONVENTION", "recalcule")
        q, args = _base(xg=0.30)
        eq = apply_essai_adjustments(**args, delta_aggregate=500_000.0)
        xg_new = eq.mg_sec_tot / (eq.mr_sec_tot + eq.mg_sec_tot)
        gs_attendu = gs_backfill_eff(3.05, xg_new, 2.8, 0.045, 2.946774193548387)
        _close("Gs recalculé", eq.gs_backfill, gs_attendu)
        assert _rel(eq.gs_backfill, q.gs_backfill) > 1e-6  # il a bien changé
        # en convention 'base', le Gs resterait celui de la base
        monkeypatch.setattr(mix_pipeline, "ESSAI_GS_CONVENTION", "base")
        eq_base = apply_essai_adjustments(**args, delta_aggregate=500_000.0)
        _close("Gs base figé", eq_base.gs_backfill, q.gs_backfill)

    def test_double_application_additive(self):
        """Ajouter 200 t puis 300 t d'eau == ajouter 500 t d'une traite."""
        q, args = _base()
        une_fois = apply_essai_adjustments(**args, delta_water=500_000.0)
        etape1 = apply_essai_adjustments(**args, delta_water=200_000.0)
        args2 = dict(args, mr_sec_base=etape1.mr_sec_tot, mg_sec_base=etape1.mg_sec_tot,
                     mb_base=etape1.mb_tot, mw_base=etape1.mw_tot, vt_base=etape1.vt_new)
        etape2 = apply_essai_adjustments(**args2, delta_water=300_000.0)
        for champ in ("mw_tot", "vt_new", "e", "sr", "cw", "rho_h"):
            _close(champ, getattr(etape2, champ), getattr(une_fois, champ))
