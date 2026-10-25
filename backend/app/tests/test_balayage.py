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

from app.core.analyse import balayer, SERIES_KEYS, PARAM_KEYS, _PARAM_OVERRIDE

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
    "cv_vol_pct", "residue_dry_mass_kg", "binder_total_mass_kg",
    "theta_pct", "gs_backfill", "water_total_mass_kg", "aggregate_dry_mass_kg",
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


# Liste CANONIQUE des paramètres balayables, symétrique de SERIES_CANONIQUE.
# Elle manquait : rien ne reliait BalayageParam au tableau PARAMS du frontend
# (frontend/src/lib/analyse-series.ts), ni à sa copie dans
# analyse-series.test.ts. Ajouter un membre ici oblige à les mettre à jour.
PARAMS_CANONIQUE = (
    "binder_mass_pct", "solids_mass_pct", "saturation_pct", "aggregate_fraction_pct",
)

# Sortie qui DOIT suivre chaque paramètre balayé. Sert au test anti-courbe-plate.
SORTIE_MIROIR = {
    "binder_mass_pct": ("RPC", "bw_mass_pct"),
    "solids_mass_pct": ("RPC", "solids_mass_pct"),
    "saturation_pct": ("RPC", "saturation_pct"),
    "aggregate_fraction_pct": ("RPG", "aggregate_mass_pct"),
}


def test_params_keys_sentinelle():
    """Anti-dérive : garde synchronisés les paramètres backend et la liste
    canonique partagée avec le frontend (PARAMS + sa copie dans les tests)."""
    assert tuple(PARAM_KEYS) == PARAMS_CANONIQUE


def test_override_couvre_tous_les_params():
    """Doublon volontaire du contrôle fait à l'import d'analyse.py : si
    quelqu'un affaiblit ce contrôle, ce test reste."""
    assert set(p.value for p in _PARAM_OVERRIDE) == set(PARAM_KEYS)


def test_sortie_miroir_couvre_tous_les_params():
    """Le test anti-courbe-plate ne vaut que s'il couvre TOUS les paramètres."""
    assert set(SORTIE_MIROIR) == set(PARAM_KEYS)


@pytest.mark.parametrize("param", PARAMS_CANONIQUE)
def test_aucun_param_ne_donne_une_courbe_plate(param):
    """LE test qui aurait attrapé le bug historique.

    Un paramètre non branché dans _PARAM_OVERRIDE produisait un balayage qui
    réussissait en ne balayant rien : toutes les valeurs identiques, aucune
    erreur, aucune coupure. On vérifie ici le SYMPTÔME (la sortie miroir varie
    réellement sur la plage) et non la cause, ce qui couvre aussi les futurs
    modes de défaillance.
    """
    categorie, cle_sortie = SORTIE_MIROIR[param]
    if categorie == "RPC":
        base, _ = _rpc_base()
        inputs = BalayageInputs(category="RPC", base_inputs_rpc=base,
                                param=param, x_min=20, x_max=40, steps=5)
    else:
        base, _ = _rpg_base()
        inputs = BalayageInputs(category="RPG", base_inputs_rpg=base,
                                param=param, x_min=10, x_max=40, steps=5)

    valeurs = [v for v in balayer(inputs).series[cle_sortie] if v is not None]
    assert len(valeurs) >= 2, f"{param} : pas assez de points calculables"
    assert max(valeurs) - min(valeurs) > 1e-6, (
        f"{param} : la sortie {cle_sortie} est PLATE sur la plage — "
        "le paramètre n'est probablement pas appliqué"
    )


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


class TestRedistributionDesSolides:
    """À Cw imposé, balayer Bw redistribue les solides sans changer Cw.

    C'est LA question que pose un étudiant devant la page Analyse (« si je
    fais varier Bw, est-ce que Cw change ? »). La réponse est non : Cw est une
    ENTRÉE de la méthode Cw%, et _override ne remplace que le paramètre
    balayé. Ce qui bouge, c'est la répartition résidu/liant.
    """

    def test_cw_reste_exactement_constant(self):
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=2, x_max=10, steps=5))
        cw = [v for v in res.series["solids_mass_pct"] if v is not None]
        assert len(cw) == 5
        assert max(cw) - min(cw) == pytest.approx(0.0, abs=1e-12)

    def test_le_residu_cede_la_place_au_liant(self):
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=2, x_max=10, steps=5))
        residu = res.series["residue_dry_mass_kg"]
        liant = res.series["binder_total_mass_kg"]
        assert all(a > b for a, b in zip(residu, residu[1:])), "le résidu doit décroître"
        assert all(a < b for a, b in zip(liant, liant[1:])), "le liant doit croître"
        # Le total des solides ne bouge qu'à peine : il suit rho_d, qui se
        # déplace parce que le Gs du liant diffère de celui du résidu. Ce n'est
        # donc PAS exactement constant — ne jamais l'écrire dans l'UI.
        total = [r + b for r, b in zip(residu, liant)]
        variation = (max(total) - min(total)) / min(total)
        assert 0 < variation < 0.01, f"variation inattendue du total : {variation}"

    def test_teneur_en_eau_suit_cw_donc_reste_constante(self):
        # w = (1 - Cw)/Cw : Cw figé implique w figé.
        base, _ = _rpc_base()
        res = balayer(BalayageInputs(category="RPC", base_inputs_rpc=base,
                                     param="binder_mass_pct", x_min=2, x_max=10, steps=5))
        w = [v for v in res.series["w_mass_pct"] if v is not None]
        assert max(w) - min(w) == pytest.approx(0.0, abs=1e-12)


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


# ----------------------------------------------------------------------
# Analyse à partir d'un calcul sauvegardé (2026-10-25)
# ----------------------------------------------------------------------
# Le site reconstruit une base « selon Cw » depuis une recette SAUVEGARDÉE,
# quelle que soit sa méthode d'origine (frontend/src/lib/analyse-source.ts) :
# Cw, Sr, Bw et Am de la recette ; Gs et w0 du résidu, Gs du granulat, liants
# et constantes du calcul ; contenant « volume » égal au volume total de la
# recette, 1 contenant, κ = 1. Au point de référence, le balayage doit redonner
# TOUTES les grandeurs de la recette, masses et volumes compris. Une méthode
# qui échouerait ici serait refusée par l'Analyse au lieu d'être approchée.

from app.core.analyse import _etat  # noqa: E402
from app.core.models import (  # noqa: E402
    BalayageParam, GeneralInfo, ResidueProps, RpcEssaiAdjustment, RpcEssaiInputs,
    RpcSlumpInputs, RpcWbInputs, RpgEssaiAdjustment, RpgEssaiInputs, SolverConstants,
)
from app.core.rpc_solver import solve_rpc_essai, solve_rpc_slump, solve_rpc_wb  # noqa: E402
from app.core.rpg_solver import solve_rpg_cw, solve_rpg_essai  # noqa: E402
from .test_excel_golden import _binder_system  # noqa: E402

# Moules de laboratoire (10 x 10 x 20 cm), 6 par recette, κ = 1,1 : le volume
# total de la recette n'est donc PAS celui d'un moule.
_MOULES = dict(
    general=GeneralInfo(container_type="longueur_largeur_hauteur", container_length=10.0,
                        container_width=10.0, container_height=20.0),
    containers_per_recipe=6, safety_factor=1.1,
)
_RESIDU = ResidueProps(specific_gravity=3.05, moisture_mass_pct=25.0)
_LIANTS = _binder_system(BINDER_SPECS["GU20/Slag80"])
# Conventions du site (store.tsx, completerConstantes).
_CONSTANTES = SolverConstants(essai_gs_convention="recalcule", essai_binder_rule="residu_ajoute")
_GS_GRANULAT = 2.65


def _commun(num_recipes: int, sr: float = 100.0) -> dict:
    return dict(_MOULES, residue=_RESIDU, binder_system=_LIANTS, constants=_CONSTANTES,
                num_recipes=num_recipes, saturation_pct=sr)


def _cw_rpc(sr=100.0):
    return RpcCwInputs(category="RPC", solids_mass_pct=74.0, binder_mass_pct_recipes=[4.5, 6.0], **_commun(2, sr))


def _wb_rpc():
    return RpcWbInputs(category="RPC", binder_mass_pct_recipes=[4.5, 6.0], wc_ratio_recipes=[7.0, 8.5], **_commun(2))


def _cw_rpg():
    return RpgCwInputs(category="RPG", solids_mass_pct=78.0, binder_mass_pct_recipes=[4.0, 5.5],
                       aggregate_fraction_pct=30.0, aggregate_specific_gravity=_GS_GRANULAT, **_commun(2))


def _cas_calculs():
    """(nom, recettes sauvegardées, catégorie, recette est-elle un essai-erreur)."""
    cas = [
        ("RPC selon Cw", solve_rpc_cw(_cw_rpc()).recipes, "RPC", False),
        ("RPC selon Cw, Sr 90 %", solve_rpc_cw(_cw_rpc(90.0)).recipes, "RPC", False),
        ("RPC selon E/L", solve_rpc_wb(_wb_rpc()).recipes, "RPC", False),
        ("RPC modèle prédictif", solve_rpc_slump(RpcSlumpInputs(
            category="RPC", cone_type="grand", slump_mm=180.0,
            binder_mass_pct_recipes=[4.5, 6.0], **_commun(2))).recipes, "RPC", False),
        ("RPG selon Cw", solve_rpg_cw(_cw_rpg()).recipes, "RPG", False),
    ]
    ajouts_rpc = [
        RpcEssaiAdjustment(added_dry_residue_mass=0.5, added_wet_residue_mass=0.3, added_water_mass=0.2),
        RpcEssaiAdjustment(added_dry_residue_mass=0.4, binder_rule="aucun"),
    ]
    cas.append(("RPC essai-erreur, base selon Cw", solve_rpc_essai(RpcEssaiInputs(
        category="RPC", base_method="dosage_cw", base_inputs_cw=_cw_rpc(), adjustments=ajouts_rpc,
        **_commun(2))).recipes, "RPC", True))
    cas.append(("RPC essai-erreur, base selon E/L", solve_rpc_essai(RpcEssaiInputs(
        category="RPC", base_method="wb", base_inputs_wb=_wb_rpc(),
        adjustments=[RpcEssaiAdjustment(added_water_mass=0.3), RpcEssaiAdjustment(added_wet_residue_mass=0.6)],
        **_commun(2))).recipes, "RPC", True))
    cas.append(("RPG essai-erreur avec granulat", solve_rpg_essai(RpgEssaiInputs(
        category="RPG", base_method="dosage_cw", base_inputs_cw=_cw_rpg(),
        adjustments=[
            RpgEssaiAdjustment(added_aggregate_mass=0.8, aggregate_moisture_mass_pct=2.0, added_water_mass=0.1),
            RpgEssaiAdjustment(added_dry_residue_mass=0.5, added_aggregate_mass=0.3, binder_rule="aucun"),
        ],
        aggregate_fraction_pct=30.0, aggregate_specific_gravity=_GS_GRANULAT,
        **_commun(2))).recipes, "RPG", True))
    return cas


def _base_reconstruite(recette, categorie):
    """Ce que fait le site (analyse-source.ts + analyse-corps.ts)."""
    sr = recette.saturation_pct
    if 100.0 < sr <= 100.0 + 1e-6:
        sr = 100.0  # bruit d'arrondi, ramené comme sur le site
    commun = dict(
        general=GeneralInfo(container_type="volume", container_volume_m3=recette.total_backfill_volume_m3),
        residue=_RESIDU, binder_system=_LIANTS, constants=_CONSTANTES,
        num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
        solids_mass_pct=recette.solids_mass_pct, saturation_pct=sr,
        binder_mass_pct_recipes=[recette.bw_mass_pct],
    )
    if categorie == "RPC":
        return RpcCwInputs(category="RPC", **commun), solve_rpc_cw
    return RpgCwInputs(category="RPG", aggregate_fraction_pct=recette.aggregate_mass_pct,
                       aggregate_specific_gravity=_GS_GRANULAT, **commun), solve_rpg_cw


def _a_plat(etat) -> dict:
    d = etat.model_dump()
    composants = d.pop("components", None) or {}
    d.update({f"components.{k}": v for k, v in composants.items()})
    return d


def _ecart(a, b) -> float:
    if isinstance(a, list):
        assert isinstance(b, list) and len(a) == len(b)
        return max((_ecart(x, y) for x, y in zip(a, b)), default=0.0)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) / max(1.0, abs(a), abs(b))
    return 0.0 if a == b else float("inf")


@pytest.mark.parametrize("nom,recettes,categorie,essai", _cas_calculs(), ids=lambda v: v if isinstance(v, str) else "")
def test_base_reconstruite_reproduit_la_recette_sauvegardee(nom, recettes, categorie, essai):
    assert len(recettes) == 2
    for i, recette in enumerate(recettes):
        base, solve = _base_reconstruite(recette, categorie)
        etat = _etat(base, solve, BalayageParam.BW, recette.bw_mass_pct)
        assert etat is not None, f"{nom}, recette {i + 1} : point de référence non calculable"
        attendu, obtenu = _a_plat(recette), _a_plat(etat)
        assert attendu.keys() == obtenu.keys()
        exclus = {"container_volume_m3"}
        if essai:
            exclus |= {k for k in attendu if k.startswith("components.binder") and "_to_add_" in k}
        ecarts = {k: (attendu[k], obtenu[k]) for k in attendu
                  if k not in exclus and _ecart(attendu[k], obtenu[k]) > 1e-9}
        assert ecarts == {}, f"{nom}, recette {i + 1}"
        # Le volume analysé est bien celui de la recette, pas celui d'un moule.
        assert etat.total_backfill_volume_m3 == pytest.approx(recette.total_backfill_volume_m3, rel=1e-12)
