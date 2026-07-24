# app/tests/test_balayage.py
"""
Balayage paramétrique (courbes de réponse) — app/core/analyse.py.

Le balayage n'introduit AUCUNE formule : il rejoue le solveur existant sur une
grille de valeurs. Les tests vérifient donc la MÉCANIQUE (grille, cohérence
avec un appel direct, coupures hors bornes, garde-fous) et non la physique
(déjà couverte par les tests d'or, ici intouchés).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.analyse import balayer, SERIES_KEYS

# Liste CANONIQUE des grandeurs de sortie du balayage. C'est CETTE sentinelle
# (ordonnée, ci-dessous) qui casse de façon GARANTIE dès qu'on modifie _SERIES.
# Elle rappelle alors de mettre à jour AUSSI le frontend : le tableau SORTIES et
# sa copie dans frontend/src/lib/analyse-series.test.ts (libellés + unités),
# sans quoi une nouvelle grandeur ne serait jamais affichée dans l'onglet.
SERIES_CANONIQUE = (
    "solids_mass_pct", "wc_ratio", "void_ratio", "porosity",
    "saturation_pct", "bw_mass_pct", "bv_vol_pct", "w_mass_pct",
    "dry_density_kg_m3", "bulk_density_kg_m3",
    "aggregate_mass_pct", "aggregate_vol_pct_of_residue",
)


def test_series_keys_sentinelle():
    """Anti-dérive : garde synchronisées les clés backend et la liste
    canonique partagée avec le frontend."""
    assert tuple(SERIES_KEYS) == SERIES_CANONIQUE
from app.core.models import BalayageInputs, RpcCwInputs, RpgCwInputs
from app.core.rpc_solver import solve_rpc_cw
from .test_excel_golden import _common_kwargs, BINDER_SPECS, GSG


def _rpc_base():
    common = _common_kwargs(0.75, 0.05, 0.20, 3.05, BINDER_SPECS["GU100"])
    return RpcCwInputs(category="RPC", **common), common


def _rpg_base():
    common = _common_kwargs(0.75, 0.05, 0.20, 3.05, BINDER_SPECS["GU20/Slag80"])
    base = RpgCwInputs(category="RPG", aggregate_fraction_pct=20.0,
                       aggregate_specific_gravity=GSG, **common)
    return base, common


class TestGrille:
    def test_dimensions_et_bornes_de_x(self):
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=2, x_max=8, steps=7))
        assert len(res.x) == 7
        assert res.x[0] == 2.0 and res.x[-1] == 8.0
        # pas régulier
        assert res.x[1] - res.x[0] == pytest.approx(1.0)
        # toutes les séries attendues, longueur = steps
        assert set(res.series) == set(SERIES_KEYS)
        assert all(len(v) == 7 for v in res.series.values())

    def test_coherence_avec_le_solveur_direct(self):
        """Le point du balayage == un appel direct du solveur à cette valeur."""
        base, common = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=4, x_max=6, steps=3))
        # x = [4, 5, 6] ; on vérifie le point Bw = 5 %
        assert res.x[1] == 5.0
        direct = solve_rpc_cw(RpcCwInputs(category="RPC", **{
            **common, "num_recipes": 1, "binder_mass_pct_recipes": [5.0]})).recipes[0]
        assert res.series["wc_ratio"][1] == pytest.approx(direct.wc_ratio)
        assert res.series["void_ratio"][1] == pytest.approx(direct.void_ratio)
        assert res.series["dry_density_kg_m3"][1] == pytest.approx(direct.dry_density_kg_m3)

    def test_coherence_cw_base_multi_recettes_reduite(self):
        """Balayer Cw sur une base MULTI-recettes : chaque point == solve direct
        à num_recipes=1 avec le liant FIGÉ à la 1re recette (couvre _override
        pour un paramètre autre que Bw)."""
        common = _common_kwargs(0.75, 0.05, 0.20, 3.05, BINDER_SPECS["GU100"])
        base = RpcCwInputs(category="RPC", **{
            **common, "num_recipes": 3, "binder_mass_pct_recipes": [4.0, 5.0, 6.0]})
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="solids_mass_pct", x_min=70, x_max=80, steps=3))
        assert res.x[1] == 75.0
        direct = solve_rpc_cw(RpcCwInputs(category="RPC", **{
            **common, "num_recipes": 1, "binder_mass_pct_recipes": [4.0],
            "solids_mass_pct": 75.0})).recipes[0]
        assert res.series["wc_ratio"][1] == pytest.approx(direct.wc_ratio)
        assert res.series["void_ratio"][1] == pytest.approx(direct.void_ratio)
        # le liant est bien figé à la 1re recette (4 %), pas 5 ni 6
        assert res.series["bw_mass_pct"][1] == pytest.approx(direct.bw_mass_pct)
        assert res.series["bw_mass_pct"][1] == pytest.approx(4.0, abs=1e-6)

    def test_coherence_sr(self):
        """Balayer Sr : cohérence avec un solve direct (couvre le figeage Sr)."""
        base, common = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="saturation_pct", x_min=80, x_max=100, steps=3))
        assert res.x[-1] == 100.0
        direct = solve_rpc_cw(RpcCwInputs(category="RPC", **{
            **common, "num_recipes": 1, "binder_mass_pct_recipes": [5.0],
            "saturation_pct": 100.0})).recipes[0]
        assert res.series["void_ratio"][-1] == pytest.approx(direct.void_ratio)
        assert res.series["saturation_pct"][-1] == pytest.approx(100.0, abs=1e-6)

    def test_wc_decroit_avec_bw(self):
        """W/C = w(1+Bw)/Bw décroît quand Bw augmente (sanité physique)."""
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=2, x_max=10, steps=9))
        wc = res.series["wc_ratio"]
        assert all(a > b for a, b in zip(wc, wc[1:]))  # strictement décroissant


class TestCoupures:
    def test_saturation_zero_donne_none(self):
        """Sr = 0 est hors bornes (gt=0) -> point None, le reste calculé."""
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="saturation_pct", x_min=0, x_max=100, steps=5))
        assert res.x[0] == 0.0
        assert res.series["void_ratio"][0] is None      # point invalide
        assert res.series["void_ratio"][-1] is not None  # Sr = 100 : OK

    def test_bw_hors_bornes_donne_none(self):
        """Bw > 100 % est hors bornes (le=100) -> None, sans faire échouer tout."""
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=90, x_max=110, steps=3))
        assert res.series["wc_ratio"][0] is not None   # 90 %
        assert res.series["wc_ratio"][-1] is None       # 110 % : hors bornes


class TestRpg:
    def test_balayage_am_reflete_la_sortie(self):
        """Balayer A_m : la sortie aggregate_mass_pct suit la valeur balayée."""
        base, _ = _rpg_base()
        res = balayer(BalayageInputs(category="RPG", base_inputs_rpg=base,
                                     param="aggregate_fraction_pct", x_min=10, x_max=40, steps=4))
        for xi, am in zip(res.x, res.series["aggregate_mass_pct"]):
            assert am == pytest.approx(xi, abs=1e-6)
        # l'Av (volumique) est renseigné et croît avec l'Am
        av = res.series["aggregate_vol_pct_of_residue"]
        assert all(a < b for a, b in zip(av, av[1:]))


class TestValidation:
    def test_am_refuse_en_rpc(self):
        base, _ = _rpc_base()
        with pytest.raises(ValidationError, match="RPG"):
            BalayageInputs(category="RPC", base_inputs_rpc=base,
                           param="aggregate_fraction_pct", x_min=10, x_max=40, steps=4)

    def test_base_manquante_refusee(self):
        with pytest.raises(ValidationError, match="requis"):
            BalayageInputs(category="RPG", param="binder_mass_pct",
                           x_min=1, x_max=2, steps=2)

    def test_steps_hors_bornes_refuse(self):
        base, _ = _rpc_base()
        with pytest.raises(ValidationError):
            BalayageInputs(category="RPC", base_inputs_rpc=base,
                           param="binder_mass_pct", x_min=1, x_max=2, steps=1)
        with pytest.raises(ValidationError):
            BalayageInputs(category="RPC", base_inputs_rpc=base,
                           param="binder_mass_pct", x_min=1, x_max=2, steps=201)

    def test_plage_inversee_refusee(self):
        base, _ = _rpc_base()
        with pytest.raises(ValidationError, match="x_max"):
            BalayageInputs(category="RPC", base_inputs_rpc=base,
                           param="binder_mass_pct", x_min=8, x_max=2, steps=3)
