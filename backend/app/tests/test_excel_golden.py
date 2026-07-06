# -*- coding: utf-8 -*-
"""
Golden tests: solvers vs the professor's reference Excel (Intra 2017).

Oracle: app/tests/excel_twin.py — exact replica of the workbook, itself
validated against 38 cached cell values (test_twin_self_validation).

Tolerance: rel 1e-9. Observed post-fix agreement is ~1e-15; the historical
bug was 4.7e-2, so anything looser than 1e-6 would hide real regressions.
All Excel comparisons are at Sr = 100 % (the sheet has no Sr input);
Sr < 100 % behaviour is guarded by internal invariants (test_sr_generalization).
"""

from __future__ import annotations

import itertools

import pytest

from app.core.models import (
    GeneralInfo, ResidueProps, BinderSystem, BinderComponent,
    RpcCwInputs, RpcWbInputs, RpcEssaiInputs, RpcEssaiAdjustment,
    RpgCwInputs, RpgWbInputs, RpgEssaiInputs, RpgEssaiAdjustment,
)
from app.core.rpc_solver import solve_rpc_cw, solve_rpc_wb, solve_rpc_essai
from app.core.rpg_solver import solve_rpg_cw, solve_rpg_wb, solve_rpg_essai

from . import excel_twin

REL = 1e-9
V_CONT = 11000.0            # m3 (55 x 20 x 10 m)
GSG = 2.8                   # Gs granulat (E10)
W0_REF = 1.0 / 0.76 - 1.0   # teneur en eau du résidu de la feuille (C11)

BINDER_SPECS = {
    "GU100":        [(1.0, 3.15)],
    "GU20/Slag80":  [(0.2, 3.15), (0.8, 2.9)],
    "tern20/70/10": [(0.2, 3.15), (0.7, 2.9), (0.1, 2.3)],
}


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------

def _general() -> GeneralInfo:
    # 5500 x 2000 x 1000 cm = 55 x 20 x 10 m = 11000 m3
    return GeneralInfo(container_type="longueur_largeur_hauteur",
                       container_length=5500.0, container_width=2000.0,
                       container_height=1000.0)


def _binder_system(spec):
    return BinderSystem(components=[
        BinderComponent(type=f"B{i+1}", specific_gravity=gs, mass_fraction=f)
        for i, (f, gs) in enumerate(spec)])


def _rel(ours, ref):
    if ref == 0.0:
        return abs(ours)
    return abs(ours / ref - 1.0)


def _assert_close(name, ours, ref, tol=REL, ctx=""):
    assert _rel(ours, ref) <= tol, (
        f"{name}: ours={ours!r} excel={ref!r} rel={_rel(ours, ref):.3g} {ctx}")


def _base_pairs(st, tw):
    """(name, ours, excel) pairs for a base recipe MixState vs twin output."""
    c = st.components
    return [
        ("Gs_liant",  st.gs_binder,                     tw["Gs_liant"]),
        ("Gs_pate",   st.gs_backfill,                   tw["Gs_pate"]),
        ("e",         st.void_ratio,                    tw["e0"]),
        ("n",         st.porosity,                      tw["n0"]),
        ("Cv",        st.cv_vol_pct / 100.0,            tw["Cv0"]),
        ("theta",     st.theta_pct / 100.0,             tw["n0"]),   # saturé: theta = n
        ("rho_h",     st.bulk_density_kg_m3 / 1000.0,   tw["rho_h0"]),
        ("rho_d",     st.dry_density_kg_m3 / 1000.0,    tw["rho_d0"]),
        ("W/C",       st.wc_ratio,                      tw["WC0"]),
        ("Bv",        st.bv_vol_pct / 100.0,            tw["Bvf"]),
        ("Sr",        st.saturation_pct / 100.0,        1.0),
        ("Mr_sec",    c.residue_dry_mass_kg / 1000.0,   tw["Mr_sec"]),
        ("Mg_sec",    c.aggregate_dry_mass_kg / 1000.0, tw["Mg_sec"]),
        ("Mb",        c.binder_total_mass_kg / 1000.0,  tw["Mb"]),
        ("Mw",        c.water_total_mass_kg / 1000.0,   tw["Mw"]),
        ("Mr_hum",    c.residue_wet_mass_kg / 1000.0,   tw["Mr_hum"]),
        ("Mw_add",    c.water_to_add_mass_kg / 1000.0,  tw["Mw_add"]),
        ("tonnage",   (c.residue_dry_mass_kg + c.aggregate_dry_mass_kg
                       + c.binder_total_mass_kg + c.water_total_mass_kg) / 1000.0,
                      tw["tonnage"]),
        # granulat — équivalents feuille D24/D25/D83 (sans ajustement)
        ("Am",        st.aggregate_mass_pct / 100.0,           tw["Xg_m_f"]),
        ("Xg_v_res",  st.aggregate_vol_pct_of_residue / 100.0, tw["Xg_v_res_f"]),
        ("Xg_v_remb", st.aggregate_vol_pct_of_backfill / 100.0, tw["Xg_v_remb_f"]),
    ]


def _essai_pairs(st, tw):
    c = st.components
    return [
        ("W/C_f",    st.wc_ratio,                       tw["WCf"]),
        ("w_f",      st.w_mass_pct / 100.0,             tw["wf"]),
        ("Cw_f",     st.solids_mass_pct / 100.0,        tw["Cwf"]),
        ("Cv_f",     st.cv_vol_pct / 100.0,             tw["Cvf"]),
        ("e_f",      st.void_ratio,                     tw["ef"]),
        ("Sr_f",     st.saturation_pct / 100.0,         tw["Srf"]),
        ("n_f",      st.porosity,                       tw["nf"]),
        ("theta_f",  st.theta_pct / 100.0,              tw["thetaf"]),
        ("Bw_f",     st.bw_mass_pct / 100.0,            tw["Bwf"]),
        ("Bv_f",     st.bv_vol_pct / 100.0,             tw["Bvf"]),
        ("rho_h_f",  st.bulk_density_kg_m3 / 1000.0,    tw["rho_hf"]),
        ("rho_d_f",  st.dry_density_kg_m3 / 1000.0,     tw["rho_df"]),
        ("rho_s_f",  st.gs_backfill,                    tw["rho_sf"]),
        ("VT_f",     st.total_backfill_volume_m3,       tw["VT"] + tw["Vadd"]),
        ("Mr_sec_t", c.residue_dry_mass_kg / 1000.0,    tw["Mr_sec_tot"]),
        ("Mg_t",     c.aggregate_dry_mass_kg / 1000.0,  tw["Mg_tot"]),
        ("Mb_t",     c.binder_total_mass_kg / 1000.0,   tw["Mb_tot"]),
        ("Mw_t",     c.water_total_mass_kg / 1000.0,    tw["Mw_tot"]),
        ("Mb_ad",    c.binder_to_add_mass_kg / 1000.0,  tw["adj_liant"]),
        ("Mr_hum_t", c.residue_wet_mass_kg / 1000.0,    tw["Mr_hum_tot"]),
        ("Mw_add_f", c.water_to_add_mass_kg / 1000.0,   tw["eau_a_ajouter_finale"]),
        # granulat — équivalents feuille D83/D84/D85 (état final)
        ("Am_f",        st.aggregate_mass_pct / 100.0,             tw["Xg_m_f"]),
        ("Xg_v_res_f",  st.aggregate_vol_pct_of_residue / 100.0,   tw["Xg_v_res_f"]),
        ("Xg_v_remb_f", st.aggregate_vol_pct_of_backfill / 100.0,  tw["Xg_v_remb_f"]),
    ]


def _common_kwargs(Cw, Bw, w0, Gs_r, spec):
    return dict(general=_general(),
                residue=ResidueProps(specific_gravity=Gs_r, moisture_mass_pct=w0 * 100),
                binder_system=_binder_system(spec),
                num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
                solids_mass_pct=Cw * 100, saturation_pct=100.0,
                binder_mass_pct_recipes=[Bw * 100])


def _run_twin(Cw, Bw, Xg, w0, Gs_r, spec, adj=None, FS=0.0, nb=1.0):
    return excel_twin.run(Gs_r=Gs_r, Gs_g=GSG, w0=w0, Cw=Cw, Bw=Bw, Xg=Xg,
                          FS=FS, binders=spec, V_cont=V_CONT, nb=nb, adj=adj)


# ----------------------------------------------------------------------
# 1. oracle fidelity
# ----------------------------------------------------------------------

def test_twin_self_validation():
    assert excel_twin.self_validate(verbose=False), (
        "excel_twin.py ne reproduit plus les 38 valeurs du classeur de référence")


# ----------------------------------------------------------------------
# 2. cas canonique Mélange 1
# ----------------------------------------------------------------------

def _melange1_kwargs():
    return _common_kwargs(0.70, 0.045, W0_REF, 3.05, BINDER_SPECS["GU20/Slag80"])


def test_rpc_cw_melange1():
    tw = _run_twin(0.70, 0.045, 0.0, W0_REF, 3.05, BINDER_SPECS["GU20/Slag80"])
    st = solve_rpc_cw(RpcCwInputs(category="RPC", **_melange1_kwargs())).recipes[0]
    for name, ours, ref in _base_pairs(st, tw):
        _assert_close(name, ours, ref, ctx="[RPC Mélange 1]")
    # masses par ciment (D51/D54)
    _assert_close("M_GU", st.components.binder_c1_mass_kg / 1000.0, tw["Mliants"][0])
    _assert_close("M_Slag", st.components.binder_c2_mass_kg / 1000.0, tw["Mliants"][1])


def test_rpg_cw_melange1():
    tw = _run_twin(0.70, 0.045, 0.0, W0_REF, 3.05, BINDER_SPECS["GU20/Slag80"])
    st = solve_rpg_cw(RpgCwInputs(category="RPG", aggregate_fraction_pct=0.0,
                                  aggregate_specific_gravity=GSG,
                                  **_melange1_kwargs())).recipes[0]
    for name, ours, ref in _base_pairs(st, tw):
        _assert_close(name, ours, ref, ctx="[RPG Mélange 1]")


# ----------------------------------------------------------------------
# 3. grille Cw
# ----------------------------------------------------------------------

CW_GRID = list(itertools.product(
    [0.65, 0.76, 0.80],          # Cw
    [0.02, 0.08],                # Bw
    [0.0, 0.30, 0.50],           # Xg
    [0.20, W0_REF],              # w0
    [2.9, 3.4],                  # Gs_r
    ["GU100", "tern20/70/10"],   # liants
))


@pytest.mark.parametrize("Cw,Bw,Xg,w0,Gs_r,bname", CW_GRID)
def test_cw_grid(Cw, Bw, Xg, w0, Gs_r, bname):
    spec = BINDER_SPECS[bname]
    tw = _run_twin(Cw, Bw, Xg, w0, Gs_r, spec)
    ctx = f"[Cw={Cw} Bw={Bw} Xg={Xg} w0={w0:.3f} Gs_r={Gs_r} {bname}]"
    common = _common_kwargs(Cw, Bw, w0, Gs_r, spec)

    rpg = solve_rpg_cw(RpgCwInputs(category="RPG", aggregate_fraction_pct=Xg * 100,
                                   aggregate_specific_gravity=GSG, **common)).recipes[0]
    for name, ours, ref in _base_pairs(rpg, tw):
        _assert_close(f"RPG {name}", ours, ref, ctx=ctx)

    if Xg == 0.0:
        rpc = solve_rpc_cw(RpcCwInputs(category="RPC", **common)).recipes[0]
        for name, ours, ref in _base_pairs(rpc, tw):
            _assert_close(f"RPC {name}", ours, ref, ctx=ctx)
        # RPC doit être identique à RPG au cas Xg=0
        for (name, a, _), (_, b, _) in zip(_base_pairs(rpc, tw), _base_pairs(rpg, tw)):
            _assert_close(f"RPC==RPG {name}", a, b, tol=1e-12, ctx=ctx)


# ----------------------------------------------------------------------
# 4. grille W/C + invariant Mw = wc*Mb
# ----------------------------------------------------------------------

WB_GRID = list(itertools.product(
    [4.0, 7.0, 9.952380952380953, 12.0],  # wc
    [0.02, 0.045, 0.08],                  # Bw
    [0.0, 0.30],                          # Xg
    ["GU20/Slag80", "tern20/70/10"],
))


@pytest.mark.parametrize("wc,Bw,Xg,bname", WB_GRID)
def test_wb_grid(wc, Bw, Xg, bname):
    spec = BINDER_SPECS[bname]
    Cw = (1 + Bw) / (1 + Bw + wc * Bw)   # Cw impliqué (relation D26)
    tw = _run_twin(Cw, Bw, Xg, W0_REF, 3.05, spec)
    ctx = f"[wc={wc} Bw={Bw} Xg={Xg} {bname}]"
    common = dict(general=_general(),
                  residue=ResidueProps(specific_gravity=3.05, moisture_mass_pct=W0_REF * 100),
                  binder_system=_binder_system(spec),
                  num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
                  saturation_pct=100.0, binder_mass_pct_recipes=[Bw * 100],
                  wc_ratio_recipes=[wc])

    results = []
    rpg = solve_rpg_wb(RpgWbInputs(category="RPG", aggregate_fraction_pct=Xg * 100,
                                   aggregate_specific_gravity=GSG, **common)).recipes[0]
    results.append(("RPG", rpg))
    if Xg == 0.0:
        rpc = solve_rpc_wb(RpcWbInputs(category="RPC", **common)).recipes[0]
        results.append(("RPC", rpc))

    for tag, st in results:
        _assert_close(f"{tag} Cw_derive", st.solids_mass_pct / 100.0, Cw, ctx=ctx)
        for name, ours, ref in _base_pairs(st, tw):
            _assert_close(f"{tag} {name}", ours, ref, ctx=ctx)
        # invariant W/C imposé : Mw = wc * Mb
        mw = st.components.water_total_mass_kg
        mb = st.components.binder_total_mass_kg
        assert abs(mw - wc * mb) <= 1e-12 * mw, f"{tag} Mw != wc*Mb {ctx}"


# ----------------------------------------------------------------------
# 5. essai-erreur — 13 scénarios (ajouts, retraits, granulat, combos)
# ----------------------------------------------------------------------

ESSAI_SCENARIOS = [
    # (id, Xg_base, adj twin {water,granulat,wet_residue} en t)
    ("rien",              0.0,  {}),
    ("eau+0.5",           0.0,  {"water": 0.5}),
    ("eau+500",           0.0,  {"water": 500.0}),
    ("eau-300",           0.0,  {"water": -300.0}),
    ("resh+800",          0.0,  {"wet_residue": 800.0}),
    ("resh-600",          0.0,  {"wet_residue": -600.0}),
    ("gran+400_Xg0",      0.0,  {"granulat": 400.0}),
    ("combo_Xg0",         0.0,  {"water": 120.0, "wet_residue": 350.0, "granulat": 200.0}),
    ("Xg30_eau+200",      0.30, {"water": 200.0}),
    ("Xg30_gran+500",     0.30, {"granulat": 500.0}),
    ("Xg30_resh-400",     0.30, {"wet_residue": -400.0}),
    ("Xg30_combo",        0.30, {"water": -80.0, "wet_residue": 250.0, "granulat": 300.0}),
    ("Xg50_combo",        0.50, {"water": 60.0, "wet_residue": 100.0, "granulat": 150.0}),
]


@pytest.mark.parametrize("sid,Xg,adj", ESSAI_SCENARIOS, ids=[s[0] for s in ESSAI_SCENARIOS])
def test_essai_scenarios(sid, Xg, adj):
    spec = BINDER_SPECS["GU20/Slag80"]
    tw = _run_twin(0.70, 0.045, Xg, W0_REF, 3.05, spec, adj=adj)
    ctx = f"[essai {sid}]"
    common = _common_kwargs(0.70, 0.045, W0_REF, 3.05, spec)

    rpg_adj = RpgEssaiAdjustment(
        added_water_mass=adj.get("water", 0.0) * 1000.0,
        added_wet_residue_mass=adj.get("wet_residue", 0.0) * 1000.0,
        added_aggregate_mass=adj.get("granulat", 0.0) * 1000.0,
        aggregate_moisture_mass_pct=0.0)
    rpg = solve_rpg_essai(RpgEssaiInputs(
        category="RPG", **common, base_method="dosage_cw",
        base_inputs_cw=RpgCwInputs(category="RPG", aggregate_fraction_pct=Xg * 100,
                                   aggregate_specific_gravity=GSG, **common),
        adjustments=[rpg_adj])).recipes[0]
    for name, ours, ref in _essai_pairs(rpg, tw):
        _assert_close(f"RPG {name}", ours, ref, ctx=ctx)
    # Sr reste exactement à 100 % quand l'ajout ne change pas la composition
    # (eau seule, ou résidu+liant au ratio de base) — comme la feuille [D87].
    # Quand l'ajout change la proportion de granulat, la feuille elle-même
    # dérive légèrement (D86 fige le Gs de base) et on doit la reproduire.
    if _rel(tw["Srf"], 1.0) <= REL:
        _assert_close("RPG Sr==100%", rpg.saturation_pct, 100.0, ctx=ctx)

    if Xg == 0.0 and adj.get("granulat", 0.0) == 0.0:
        rpc_adj = RpcEssaiAdjustment(
            added_water_mass=adj.get("water", 0.0) * 1000.0,
            added_wet_residue_mass=adj.get("wet_residue", 0.0) * 1000.0)
        rpc = solve_rpc_essai(RpcEssaiInputs(
            category="RPC", **common, base_method="dosage_cw",
            base_inputs_cw=RpcCwInputs(category="RPC", **common),
            adjustments=[rpc_adj])).recipes[0]
        for name, ours, ref in _essai_pairs(rpc, tw):
            _assert_close(f"RPC {name}", ours, ref, ctx=ctx)

    # signes attendus sur les retraits
    if sid == "eau-300":
        assert tw["eau_a_ajouter_finale"] < tw["Mw_add"], "scénario mal construit"
    if sid in ("resh-600", "Xg30_resh-400"):
        assert rpg.components.binder_to_add_mass_kg < 0.0, (
            f"liant à retirer attendu négatif {ctx}")


def test_essai_base_wc():
    """Essai sur base W/C (+0.5 t eau) — doit aussi coller à la feuille."""
    spec = BINDER_SPECS["GU20/Slag80"]
    wc = 9.952380952380953
    Bw = 0.045
    Cw = (1 + Bw) / (1 + Bw + wc * Bw)
    tw = _run_twin(Cw, Bw, 0.0, W0_REF, 3.05, spec, adj={"water": 0.5})
    common = dict(general=_general(),
                  residue=ResidueProps(specific_gravity=3.05, moisture_mass_pct=W0_REF * 100),
                  binder_system=_binder_system(spec),
                  num_recipes=1, containers_per_recipe=1, safety_factor=1.0,
                  saturation_pct=100.0, binder_mass_pct_recipes=[Bw * 100])
    base_wb = RpgWbInputs(category="RPG", wc_ratio_recipes=[wc],
                          aggregate_fraction_pct=0.0, aggregate_specific_gravity=GSG,
                          **common)
    st = solve_rpg_essai(RpgEssaiInputs(
        category="RPG", base_method="wb", base_inputs_wb=base_wb,
        adjustments=[RpgEssaiAdjustment(added_water_mass=500.0)],
        **common)).recipes[0]
    for name, ours, ref in _essai_pairs(st, tw):
        _assert_close(name, ours, ref, ctx="[essai base W/C]")


# ----------------------------------------------------------------------
# 6. généralisation Sr < 100 % — invariants internes (pas de contrepartie Excel)
# ----------------------------------------------------------------------

def test_sr_generalization():
    spec = BINDER_SPECS["GU20/Slag80"]
    kwargs = _common_kwargs(0.70, 0.045, W0_REF, 3.05, spec)
    kwargs["saturation_pct"] = 85.0
    st = solve_rpg_cw(RpgCwInputs(category="RPG", aggregate_fraction_pct=0.0,
                                  aggregate_specific_gravity=GSG, **kwargs)).recipes[0]
    c = st.components
    gs = st.gs_backfill
    w = st.w_mass_pct / 100.0
    e = st.void_ratio
    # e = w*Gs/Sr
    _assert_close("e = w*Gs/Sr", e, w * gs / 0.85)
    # Ms = rho_d * VT
    ms = c.residue_dry_mass_kg + c.aggregate_dry_mass_kg + c.binder_total_mass_kg
    _assert_close("Ms = rho_d*VT", ms, st.dry_density_kg_m3 * st.total_backfill_volume_m3)
    # Vs = Vr + Vg + Vb = Cv*VT ; Vw < Vv (non saturé)
    _assert_close("Vs = Vr+Vb", st.solid_volume_m3,
                  st.residue_volume_m3 + st.binder_volume_m3)
    _assert_close("Vs = Cv*VT", st.solid_volume_m3,
                  st.cv_vol_pct / 100.0 * st.total_backfill_volume_m3)
    assert st.water_volume_m3 < st.void_volume_m3
    # rho_h = MT/VT (les masses respectent la densité affichée)
    mt = ms + c.water_total_mass_kg
    _assert_close("rho_h = MT/VT", st.bulk_density_kg_m3,
                  mt / st.total_backfill_volume_m3)
    # essai sans ajustement : Sr_aj == Sr_base
    st2 = solve_rpg_essai(RpgEssaiInputs(
        category="RPG", base_method="dosage_cw",
        base_inputs_cw=RpgCwInputs(category="RPG", aggregate_fraction_pct=0.0,
                                   aggregate_specific_gravity=GSG, **kwargs),
        adjustments=[RpgEssaiAdjustment()], **kwargs)).recipes[0]
    _assert_close("essai Sr_aj == Sr_base", st2.saturation_pct, 85.0)


# ----------------------------------------------------------------------
# 7. conventions facteur de sécurité / nombre de contenants
# ----------------------------------------------------------------------

def test_safety_factor_mapping():
    spec = BINDER_SPECS["GU20/Slag80"]
    tw = _run_twin(0.70, 0.045, 0.0, W0_REF, 3.05, spec, FS=0.05)
    kwargs = _common_kwargs(0.70, 0.045, W0_REF, 3.05, spec)
    kwargs["safety_factor"] = 1.05
    st = solve_rpg_cw(RpgCwInputs(category="RPG", aggregate_fraction_pct=0.0,
                                  aggregate_specific_gravity=GSG, **kwargs)).recipes[0]
    _assert_close("FS: Mr_sec", st.components.residue_dry_mass_kg / 1000.0, tw["Mr_sec"])
    _assert_close("FS: VT", st.total_backfill_volume_m3, tw["VT"])


def test_containers_mapping():
    spec = BINDER_SPECS["GU20/Slag80"]
    tw = _run_twin(0.70, 0.045, 0.0, W0_REF, 3.05, spec, nb=3.0)
    kwargs = _common_kwargs(0.70, 0.045, W0_REF, 3.05, spec)
    kwargs["containers_per_recipe"] = 3
    st = solve_rpg_cw(RpgCwInputs(category="RPG", aggregate_fraction_pct=0.0,
                                  aggregate_specific_gravity=GSG, **kwargs)).recipes[0]
    _assert_close("nb: Mr_sec", st.components.residue_dry_mass_kg / 1000.0, tw["Mr_sec"])
