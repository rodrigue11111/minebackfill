# app/tests/test_essai_dose_wc.py
"""
Option « dosage du liant par W/C » de l'essai-erreur (dose_binder_by_wc).

Référence scientifique : BELEM T., HANE I., BENZAAZOUA M. & MAQSOUD A. (2018),
« Reuse of crushed waste rocks in mine backfill », Symposium Rouyn-Noranda,
§3.2.3 : quand on augmente le slump en AJOUTANT DE L'EAU, le liant ne devrait
plus être dosé en % de masse sèche mais par le rapport eau/liant de conception.

Règle implémentée (mix_pipeline.apply_essai_adjustments, option OFF par
défaut — le comportement Intra 2017/gramme est préservé au bit près) :
    wc_base = mw_base / mb_base ;  mb_tot = mw_tot / wc_base.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.mix_pipeline import apply_essai_adjustments, solve_recipe
from app.core.models import RpgCwInputs, RpgEssaiAdjustment, RpgEssaiInputs
from app.core.rpg_solver import solve_rpg_essai
from .test_excel_golden import _common_kwargs, BINDER_SPECS, GSG, W0_REF


def _close(nom, a, b, tol=1e-9):
    assert abs(a - b) <= tol * max(1.0, abs(a), abs(b)), f"{nom}: {a} != {b}"


def _base(xg=0.0, bw=0.045):
    """Recette de base + arguments communs (même patron que test_unit_pipeline)."""
    q = solve_recipe(cw_frac=0.70, sr_frac=1.0, bw_frac=bw, xg_frac=xg,
                     gs_r=3.05, gs_g=2.8 if xg > 0 else None,
                     gs_binder=2.946774193548387, w0_frac=1 / 0.76 - 1,
                     v_total_m3=11000.0, water_density=1000.0)
    args = dict(
        mr_sec_base=q.mr_sec, mg_sec_base=q.mg_sec, mb_base=q.mb,
        mw_base=q.mw_total, vt_base=11000.0, bw_target_frac=bw,
        gs_r=3.05, gs_g=2.8 if xg > 0 else None, gs_binder=2.946774193548387,
        gs_backfill_base=q.gs_backfill, gs_nonbinder_base=q.gs_nonbinder,
        w0_frac=1 / 0.76 - 1, water_density=1000.0,
    )
    return q, args


class TestDoseBinderByWc:
    def test_ajout_eau_maintient_wc_exactement(self):
        """+eau : mb suit l'eau, le W/C final == W/C de conception (exact)."""
        q, args = _base()
        wc_base = q.mw_total / q.mb
        eq = apply_essai_adjustments(**args, delta_water=500_000.0,
                                     dose_binder_by_wc=True)
        _close("W/C maintenu", eq.wc, wc_base)
        _close("mb_ad = eau ajoutée / wc_base", eq.mb_ad, 500_000.0 / wc_base)
        # le Bw atteint dérive (le liant a augmenté sans solides) et est publié
        assert eq.bw > args["bw_target_frac"]

    def test_residu_humide_le_liant_suit_son_eau(self):
        """+résidu humide : seule l'EAU transportée fait bouger le liant."""
        q, args = _base()
        wc_base = q.mw_total / q.mb
        w0 = args["w0_frac"]
        ajout = 800_000.0
        eau_transportee = ajout - ajout / (1.0 + w0)
        eq = apply_essai_adjustments(**args, delta_wet_residue=ajout,
                                     dose_binder_by_wc=True)
        _close("mb_ad", eq.mb_ad, eau_transportee / wc_base, tol=1e-9)
        _close("W/C maintenu", eq.wc, wc_base)

    def test_granulat_sec_aucun_liant_ajoute(self):
        """+granulat SEC : pas d'eau -> pas de liant ; le Bw atteint se dilue."""
        q, args = _base(xg=0.30)
        eq = apply_essai_adjustments(**args, delta_aggregate=400_000.0,
                                     dose_binder_by_wc=True)
        _close("mb_ad nul", eq.mb_ad, 0.0, tol=1e-9)
        assert eq.bw < args["bw_target_frac"]

    def test_option_desactivee_bit_identique(self):
        """OFF (défaut) : strictement le comportement Intra 2017 existant."""
        q, args = _base()
        avec = apply_essai_adjustments(**args, delta_water=250_000.0)
        sans = apply_essai_adjustments(**args, delta_water=250_000.0,
                                       dose_binder_by_wc=False)
        for champ in ("mb_tot", "mb_ad", "wc", "bw", "cw", "e", "sr", "rho_h"):
            assert getattr(avec, champ) == getattr(sans, champ)

    def test_prioritaire_sur_la_regle_gramme(self):
        """Activée, l'option prime sur essai_binder_rule (les deux assiettes
        sont incompatibles : l'eau vs les solides)."""
        q, args = _base()
        wc_base = q.mw_total / q.mb
        eq = apply_essai_adjustments(**args, delta_water=100_000.0,
                                     essai_binder_rule="residu_ajoute",
                                     dose_binder_by_wc=True)
        _close("W/C maintenu malgré la règle gramme", eq.wc, wc_base)

    def test_base_sans_liant_erreur_claire(self):
        """Bw = 0 : W/C de conception indéfini -> erreur explicite du pipeline."""
        q, args = _base(bw=0.0)
        with pytest.raises(ValueError, match="Bw > 0"):
            apply_essai_adjustments(**args, delta_water=1000.0,
                                    dose_binder_by_wc=True)

    def test_retrait_eau_modere_liant_a_retirer(self):
        """-eau : mb_ad négatif proportionnel (liant à retirer), W/C maintenu.
        Convention du projet : grandeurs non bornées (négatif = à retirer)."""
        q, args = _base()
        wc_base = q.mw_total / q.mb
        eq = apply_essai_adjustments(**args, delta_water=-100_000.0,
                                     dose_binder_by_wc=True)
        _close("mb_ad négatif proportionnel", eq.mb_ad, -100_000.0 / wc_base)
        _close("W/C maintenu au retrait", eq.wc, wc_base)
        assert eq.mb_tot > 0.0  # retrait modéré : total encore physique

    def test_convention_recalcule_suit_le_bw_reel(self):
        """Sous l'option + convention Gs « recalcule », le Gs suit le liant
        RÉEL : pour une base saturée + eau seule, Sr reste EXACTEMENT 1
        (le Sr volumique vrai), sans l'artefact de la convention « base »."""
        q, args = _base()  # base saturée (Sr = 1) par construction
        eq = apply_essai_adjustments(**args, delta_water=2_000_000.0,
                                     dose_binder_by_wc=True,
                                     essai_gs_convention="recalcule")
        _close("Sr exact à 1 (recalcule)", eq.sr, 1.0, tol=1e-9)
        # en convention « base », l'artefact (marginal) existe et est documenté
        eq_base = apply_essai_adjustments(**args, delta_water=2_000_000.0,
                                          dose_binder_by_wc=True,
                                          essai_gs_convention="base")
        assert abs(eq_base.sr - 1.0) > 1e-6  # l'écart marginal est réel...
        assert abs(eq_base.sr - 1.0) < 5e-3  # ...et reste < 0,5 %


class TestBoutEnBoutEtValidation:
    def _payload(self, bw_pct: float, adj: RpgEssaiAdjustment) -> RpgEssaiInputs:
        common = _common_kwargs(0.70, bw_pct / 100.0, W0_REF, 3.05,
                                BINDER_SPECS["GU20/Slag80"])
        return RpgEssaiInputs(
            category="RPG", **common, base_method="dosage_cw",
            base_inputs_cw=RpgCwInputs(category="RPG", aggregate_fraction_pct=30.0,
                                       aggregate_specific_gravity=GSG, **common),
            adjustments=[adj],
        )

    def test_solveur_rpg_bout_en_bout(self):
        """Le drapeau traverse modèle -> solveur -> pipeline : W/C conservé."""
        res = solve_rpg_essai(self._payload(
            4.5, RpgEssaiAdjustment(added_water_mass=300_000.0,
                                    dose_binder_by_wc=True)))
        st = res.recipes[0]
        base = solve_rpg_essai(self._payload(4.5, RpgEssaiAdjustment()))
        _close("W/C essai == W/C base", st.wc_ratio, base.recipes[0].wc_ratio,
               tol=1e-9)
        # du liant a bien été ajouté (l'eau en a exigé)
        assert st.components.binder_to_add_mass_kg > 0.0

    def test_validation_bw_nul_refusee(self):
        """422 propre : option demandée avec Bw = 0 sur la recette de base."""
        with pytest.raises(ValidationError, match="Bw > 0"):
            self._payload(0.0, RpgEssaiAdjustment(added_water_mass=1000.0,
                                                  dose_binder_by_wc=True))

    def test_validation_bw_positif_acceptee(self):
        """Contrôle : la même construction passe dès que Bw > 0."""
        p = self._payload(4.5, RpgEssaiAdjustment(added_water_mass=1000.0,
                                                  dose_binder_by_wc=True))
        assert p.adjustments[0].dose_binder_by_wc is True

    def test_ajustement_au_dela_des_recettes_ignore(self):
        """Un ajustement RÉSIDUEL (au-delà de num_recipes, p. ex. case cochée
        puis nombre de recettes réduit) ne doit PAS déclencher la garde : le
        solveur ne le lit pas."""
        common = _common_kwargs(0.70, 0.045, W0_REF, 3.05,
                                BINDER_SPECS["GU20/Slag80"])
        # num_recipes = 1 (via _common_kwargs) ; 2e ajustement orphelin avec
        # l'option cochée : la validation doit passer.
        p = RpgEssaiInputs(
            category="RPG", **common, base_method="dosage_cw",
            base_inputs_cw=RpgCwInputs(category="RPG", aggregate_fraction_pct=30.0,
                                       aggregate_specific_gravity=GSG, **common),
            adjustments=[
                RpgEssaiAdjustment(added_water_mass=500.0),
                RpgEssaiAdjustment(dose_binder_by_wc=True),  # orphelin
            ],
        )
        assert p.num_recipes == 1
        # et le solveur tourne sans erreur (l'orphelin est ignoré)
        res = solve_rpg_essai(p)
        assert len(res.recipes) == 1
