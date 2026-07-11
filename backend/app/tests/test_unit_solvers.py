# -*- coding: utf-8 -*-
"""
Tests unitaires des solveurs (géométrie du contenant, Gs du liant, modèle de
slump, constantes personnalisées, linéarités) — les chemins qui ne sont pas
directement épinglés par le classeur Intra 2017.
"""

from __future__ import annotations

import math

import pytest

from app.core.models import (
    BinderComponent, BinderSystem, GeneralInfo, ResidueProps,
    RpcCwInputs, RpcSlumpInputs, RrcInputs, SolverConstants,
)
from app.core.rpc_solver import (
    compute_container_volume_m3,
    effective_binder_specific_gravity,
    masse_volumique_S_liant_fonction,
    masse_volumique_S_liant_nary,
    solve_rpc_cw,
    solve_rpc_slump,
)
from app.core.rrc_solver import solve_rrc

REL = 1e-9


def _rel(a, b):
    if b == 0.0:
        return abs(a)
    return abs(a / b - 1.0)


def _close(name, ours, ref, tol=REL):
    assert _rel(ours, ref) <= tol, f"{name}: {ours!r} vs {ref!r}"


# ======================================================================
#  Géométrie du contenant
# ======================================================================

class TestVolumeContenant:
    def test_section_hauteur(self):
        # 80.5156 cm² x 20.5 cm = 1650.57 cm³ = 1.65057e-3 m³
        g = GeneralInfo(container_type="section_hauteur",
                        container_section=80.5155835945415, container_height=20.5)
        _close("V", compute_container_volume_m3(g), 80.5155835945415 * 20.5 * 1e-6)

    def test_rayon_hauteur(self):
        # r = 5.0625 cm, h = 20.5 cm : pi*r²*h en m³
        g = GeneralInfo(container_type="rayon_hauteur",
                        container_radius=5.0625, container_height=20.5)
        attendu = math.pi * 0.050625 ** 2 * 0.205
        _close("V", compute_container_volume_m3(g), attendu)

    def test_longueur_largeur_hauteur(self):
        g = GeneralInfo(container_type="longueur_largeur_hauteur",
                        container_length=5500.0, container_width=2000.0,
                        container_height=1000.0)
        _close("V", compute_container_volume_m3(g), 55.0 * 20.0 * 10.0)

    def test_volume_direct(self):
        g = GeneralInfo(container_type="volume", container_volume_m3=0.00165)
        _close("V", compute_container_volume_m3(g), 0.00165)

    @pytest.mark.parametrize("general,motif", [
        (GeneralInfo(), "contenant manquant"),
        (GeneralInfo(container_type="section_hauteur", container_height=20.5), "Section et hauteur"),
        (GeneralInfo(container_type="rayon_hauteur", container_radius=5.0), "Rayon et hauteur"),
        (GeneralInfo(container_type="longueur_largeur_hauteur", container_length=10.0), "Longueur, largeur et hauteur"),
        (GeneralInfo(container_type="volume"), "Volume du contenant requis"),
    ])
    def test_dimensions_manquantes(self, general, motif):
        with pytest.raises(ValueError, match=motif):
            compute_container_volume_m3(general)


# ======================================================================
#  Gs du liant
# ======================================================================

class TestGsLiant:
    def test_moyenne_harmonique_a_la_main(self):
        # 20 % GU (3.15) + 80 % Slag (2.9) :
        # 1/(0.2/3.15 + 0.8/2.9) = 2.946774193548387 (valeur du classeur, I70)
        _close("binaire", masse_volumique_S_liant_fonction(20, 80, 0, 3.15, 2.9, 3.0),
               2.946774193548387)

    def test_ternaire(self):
        attendu = 1.0 / (0.2 / 3.15 + 0.7 / 2.9 + 0.1 / 2.3)
        _close("ternaire", masse_volumique_S_liant_fonction(20, 70, 10, 3.15, 2.9, 2.3),
               attendu)

    def test_effective_binder_gs(self):
        bs = BinderSystem(components=[
            BinderComponent(type="GU", specific_gravity=3.15, mass_fraction=0.2),
            BinderComponent(type="SLAG", specific_gravity=2.9, mass_fraction=0.8)])
        _close("Gs", effective_binder_specific_gravity(bs), 2.946774193548387)

    def test_fractions_invalides(self):
        bs = BinderSystem(components=[
            BinderComponent(type="GU", specific_gravity=3.15, mass_fraction=0.5)])
        with pytest.raises(ValueError, match="fractions massiques"):
            bs.validate_total_fraction()

    def test_nary_egale_ternaire(self):
        # La variante N-aire reproduit la fonction historique a 3 composants.
        comps = [
            BinderComponent(type="A", specific_gravity=3.15, mass_fraction=0.2),
            BinderComponent(type="B", specific_gravity=2.9, mass_fraction=0.7),
            BinderComponent(type="C", specific_gravity=2.3, mass_fraction=0.1),
        ]
        attendu = masse_volumique_S_liant_fonction(20, 70, 10, 3.15, 2.9, 2.3)
        _close("nary=ternaire", masse_volumique_S_liant_nary(comps), attendu)

    def test_nary_cinq_composants(self):
        # 5 liants : moyenne harmonique sur toute la liste (aucun ignore).
        fr = [0.30, 0.25, 0.20, 0.15, 0.10]
        gs = [3.15, 2.90, 2.30, 3.00, 2.75]
        comps = [BinderComponent(type=f"L{i}", specific_gravity=gs[i],
                                 mass_fraction=fr[i]) for i in range(5)]
        attendu = 1.0 / sum(fr[i] / gs[i] for i in range(5))
        _close("nary5", masse_volumique_S_liant_nary(comps), attendu)
        # Coherence avec le Gs effectif valide (fractions sommant a 1).
        bs = BinderSystem(components=comps)
        _close("nary5=eff", masse_volumique_S_liant_nary(comps),
               effective_binder_specific_gravity(bs))

    def test_repartition_masses_cinq_composants(self):
        # Les 5 masses de liant suivent les fractions et somment au total.
        fr = [0.30, 0.25, 0.20, 0.15, 0.10]
        gs = [3.15, 2.90, 2.30, 3.00, 2.75]
        bs = BinderSystem(components=[
            BinderComponent(type=f"L{i}", specific_gravity=gs[i], mass_fraction=fr[i])
            for i in range(5)])
        res = solve_rpc_cw(RpcCwInputs(
            category="RPC",
            general=GeneralInfo(container_type="volume", container_volume_m3=0.00165),
            residue=ResidueProps(specific_gravity=3.0, moisture_mass_pct=25.0),
            binder_system=bs, num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
            solids_mass_pct=70.0, saturation_pct=100.0, binder_mass_pct_recipes=[4.5]))
        comp = res.recipes[0].components
        masses = comp.binder_masses_kg
        assert len(masses) == 5
        mb = comp.binder_total_mass_kg
        for i in range(5):
            _close(f"c{i}", masses[i], mb * fr[i])
        _close("somme", sum(masses), mb)
        # Les 3 premiers restent renseignes dans les champs legacy (compat).
        _close("c1_legacy", comp.binder_c1_mass_kg, masses[0])
        _close("c3_legacy", comp.binder_c3_mass_kg, masses[2])


# ======================================================================
#  Modèle de slump
# ======================================================================

def _slump_inputs(**kw):
    base = dict(
        category="RPC",
        general=GeneralInfo(container_type="volume", container_volume_m3=0.00165),
        residue=ResidueProps(specific_gravity=3.0, moisture_mass_pct=25.0),
        binder_system=BinderSystem(components=[
            BinderComponent(type="GU", specific_gravity=3.15, mass_fraction=1.0)]),
        num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
        cone_type="grand", slump_mm=233.5, saturation_pct=100.0,
        binder_mass_pct_recipes=[4.5],
    )
    base.update(kw)
    return RpcSlumpInputs(**base)


class TestSlump:
    def test_formule_a_la_main(self):
        # Cw% = 4.95e6 * b / (slump*b/Gs + 235.5122)^2, b = 1 + 0.045
        b = 1.045
        denom = 233.5 * b / 3.0 + 235.5122
        attendu = 4.95e6 * b / denom ** 2
        r = solve_rpc_slump(_slump_inputs()).recipes[0]
        _close("Cw prédit", r.solids_mass_pct, attendu)

    def test_conversion_petit_cone(self):
        """Mini cône 100 mm == grand cône 233.5 mm (facteur 2.335)."""
        grand = solve_rpc_slump(_slump_inputs(cone_type="grand", slump_mm=233.5)).recipes[0]
        mini = solve_rpc_slump(_slump_inputs(cone_type="mini", slump_mm=100.0)).recipes[0]
        _close("mini == grand", mini.solids_mass_pct, grand.solids_mass_pct)

    def test_constantes_slump_personnalisees(self):
        """Les constantes du modèle (coeff, offset, facteur de cône) sont
        surchargées via SolverConstants et changent le résultat comme attendu."""
        consts = SolverConstants(slump_model_coeff=5.0e6, slump_model_offset=240.0,
                                 slump_small_to_large_factor=2.0)
        r = solve_rpc_slump(_slump_inputs(cone_type="mini", slump_mm=100.0,
                                          constants=consts)).recipes[0]
        b = 1.045
        denom = 200.0 * b / 3.0 + 240.0   # 100 mm x facteur 2.0
        _close("Cw custom", r.solids_mass_pct, 5.0e6 * b / denom ** 2)


class TestConstantesDefauts:
    def test_defauts_solverconstants_intra2017(self):
        """Épingle les défauts de SolverConstants = pack « intra2017 » du
        frontend (conventions.ts). Une dérive d'un côté casse ce test ET son
        homologue vitest — garde-fou de cohérence des deux côtés."""
        d = SolverConstants().model_dump()
        assert d == {
            "water_density": 1000.0,
            "gravity": 9.81,
            "slump_small_to_large_factor": 2.335,
            "slump_model_coeff": 4.95e6,
            "slump_model_offset": 235.5122,
            "essai_gs_convention": "base",
            "essai_binder_rule": "solides_totaux",
        }


# ======================================================================
#  Constantes physiques personnalisées (rho_eau, g)
# ======================================================================

def _cw_inputs(**kw):
    base = dict(
        category="RPC",
        general=GeneralInfo(container_type="volume", container_volume_m3=1.0),
        residue=ResidueProps(specific_gravity=3.05, moisture_mass_pct=25.0),
        binder_system=BinderSystem(components=[
            BinderComponent(type="GU", specific_gravity=3.15, mass_fraction=0.2),
            BinderComponent(type="SLAG", specific_gravity=2.9, mass_fraction=0.8)]),
        num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
        solids_mass_pct=70.0, saturation_pct=100.0, binder_mass_pct_recipes=[4.5],
    )
    base.update(kw)
    return RpcCwInputs(**base)


class TestConstantesPersonnalisees:
    def test_densite_eau(self):
        """rho_eau = 998.2 : les masses et densités changent d'un facteur
        998.2/1000 exactement (les ratios sont inchangés)."""
        ref = solve_rpc_cw(_cw_inputs()).recipes[0]
        mod = solve_rpc_cw(_cw_inputs(constants=SolverConstants(water_density=998.2))).recipes[0]
        k = 998.2 / 1000.0
        _close("rho_d", mod.dry_density_kg_m3, ref.dry_density_kg_m3 * k)
        _close("Mr_sec", mod.components.residue_dry_mass_kg,
               ref.components.residue_dry_mass_kg * k)
        _close("Mw", mod.components.water_total_mass_kg,
               ref.components.water_total_mass_kg * k)
        # les grandeurs sans dimension ne bougent pas
        _close("e", mod.void_ratio, ref.void_ratio)
        _close("W/C", mod.wc_ratio, ref.wc_ratio)
        _close("Cv", mod.cv_vol_pct, ref.cv_vol_pct)

    def test_gravite(self):
        """g = 9.79 : seuls les poids volumiques changent (facteur 9.79/9.81)."""
        ref = solve_rpc_cw(_cw_inputs()).recipes[0]
        mod = solve_rpc_cw(_cw_inputs(constants=SolverConstants(gravity=9.79))).recipes[0]
        _close("gamma_h", mod.bulk_unit_weight_kN_m3,
               ref.bulk_unit_weight_kN_m3 * 9.79 / 9.81)
        _close("rho_h inchangé", mod.bulk_density_kg_m3, ref.bulk_density_kg_m3)
        _close("gamma = rho*g/1000", mod.bulk_unit_weight_kN_m3,
               mod.bulk_density_kg_m3 * 9.79 / 1000.0)


# ======================================================================
#  Linéarités (contenants multiples, facteur de sécurité, recettes)
# ======================================================================

class TestLinearites:
    def test_contenants_et_securite(self):
        ref = solve_rpc_cw(_cw_inputs()).recipes[0]
        x6 = solve_rpc_cw(_cw_inputs(containers_per_recipe=3, safety_factor=2.0)).recipes[0]
        _close("VT x6", x6.total_backfill_volume_m3, ref.total_backfill_volume_m3 * 6.0)
        _close("Mr x6", x6.components.residue_dry_mass_kg,
               ref.components.residue_dry_mass_kg * 6.0)
        _close("rho inchangé", x6.bulk_density_kg_m3, ref.bulk_density_kg_m3)

    def test_recettes_independantes(self):
        """4 recettes avec des Bw différents == 4 appels séparés."""
        quatre = solve_rpc_cw(_cw_inputs(num_recipes=4,
                                         binder_mass_pct_recipes=[2.0, 4.5, 6.0, 8.0])).recipes
        for bw, recette in zip([2.0, 4.5, 6.0, 8.0], quatre):
            seul = solve_rpc_cw(_cw_inputs(binder_mass_pct_recipes=[bw])).recipes[0]
            _close(f"Mb Bw={bw}", recette.components.binder_total_mass_kg,
                   seul.components.binder_total_mass_kg)
            _close(f"e Bw={bw}", recette.void_ratio, seul.void_ratio)


# ======================================================================
#  RRC — constantes et conversions de retardateur
# ======================================================================

class TestRrcUnitaires:
    def test_conversions_retardateur(self):
        """D0 = 260 ml/100 kg (haut de plage cours) : M_SR = Mc*rho_SR*1e-5*D0
        et V_SR = 1e-2*D0*Mc ml."""
        r = solve_rrc(RrcInputs(
            category="RRC", general=GeneralInfo(), num_recipes=1,
            quantity_mode="masse", total_mass_kg=1_000_000.0,
            binder_mass_pct_recipes=[5.0], wc_ratio_recipes=[1.0],
            retarder_dosage_ml_per_100kg=260.0, retarder_density_g_ml=1.1,
        )).recipes[0]
        mc = r.cement_mass_kg
        _close("M_SR", r.retarder_mass_kg, mc * 1.1 * 1e-5 * 260.0)
        _close("V_SR (L)", r.retarder_volume_l, 1e-2 * 260.0 * mc / 1000.0)
        # cohérence volume/masse : V_SR = M_SR / rho_SR
        _close("V=M/rho", r.retarder_volume_l, r.retarder_mass_kg / 1.1)

    def test_densite_eau_coulis(self):
        """rho_eau surchargée -> seul le volume d'eau du coulis change."""
        def run(wd):
            consts = SolverConstants(water_density=wd)
            return solve_rrc(RrcInputs(
                category="RRC", general=GeneralInfo(), num_recipes=1,
                quantity_mode="masse", total_mass_kg=1_000_000.0,
                binder_mass_pct_recipes=[5.0], wc_ratio_recipes=[1.0],
                retarder_dosage_ml_per_100kg=0.0, constants=consts,
            )).recipes[0]
        a, b = run(1000.0), run(998.2)
        _close("masses inchangées", b.cement_mass_kg, a.cement_mass_kg)
        # V_slurry = Mc/(Gs_c*rho_w) + Mw/rho_w
        _close("V coulis", b.slurry_volume_m3,
               b.cement_mass_kg / (3.15 * 998.2) + b.water_mass_kg / 998.2)
