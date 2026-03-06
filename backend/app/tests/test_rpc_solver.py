import pytest

from app.core.models import (
    BinderComponent,
    BinderSystem,
    ContainerType,
    GeneralInfo,
    MixCategory,
    ResidueProps,
    RpcCwInputs,
    RpcEssaiAdjustment,
    RpcEssaiInputs,
    RpcMethod,
    RpcWbInputs,
)
from app.core.rpc_solver import solve_rpc_cw, solve_rpc_essai, solve_rpc_wb


def _general_info() -> GeneralInfo:
    return GeneralInfo(
        container_type=ContainerType.SECTION_HEIGHT,
        container_section=80.516,
        container_height=20.5,
        binder_count=2,
        binder1_type="CP10",
        binder2_type="SLAG",
    )


def _residu() -> ResidueProps:
    return ResidueProps(specific_gravity=3.4, moisture_mass_pct=23.8)


def _systeme_liant() -> BinderSystem:
    return BinderSystem(
        components=[
            BinderComponent(type="CP10", specific_gravity=3.1543, mass_fraction=0.6),
            BinderComponent(type="SLAG", specific_gravity=2.8426, mass_fraction=0.4),
        ]
    )


def test_rpc_cw_smoke() -> None:
    inputs = RpcCwInputs(
        category=MixCategory.RPC,
        general=_general_info(),
        residue=_residu(),
        binder_system=_systeme_liant(),
        num_recipes=2,
        containers_per_recipe=70,
        safety_factor=1.0,
        solids_mass_pct=78.0,
        saturation_pct=100.0,
        binder_mass_pct_recipes=[5.0, 6.0],
    )

    result = solve_rpc_cw(inputs)
    assert len(result.recipes) == 2
    assert result.recipes[0].components.residue_dry_mass_kg > 0
    assert result.recipes[0].components.binder_total_mass_kg > 0
    assert result.recipes[0].components.water_total_mass_kg > 0


def test_rpc_wb_valide_longueur_wc() -> None:
    inputs = RpcWbInputs(
        category=MixCategory.RPC,
        general=_general_info(),
        residue=_residu(),
        binder_system=_systeme_liant(),
        num_recipes=2,
        containers_per_recipe=1,
        safety_factor=1.0,
        saturation_pct=90.0,
        binder_mass_pct_recipes=[4.5, 4.5],
        wc_ratio_recipes=[4.0],  # volontairement trop court
    )

    with pytest.raises(ValueError, match="wc_ratio_recipes"):
        solve_rpc_wb(inputs)


def test_rpc_essai_accepte_ajustements_partiels() -> None:
    base_cw = RpcCwInputs(
        category=MixCategory.RPC,
        general=_general_info(),
        residue=_residu(),
        binder_system=_systeme_liant(),
        num_recipes=2,
        containers_per_recipe=1,
        safety_factor=1.0,
        solids_mass_pct=78.0,
        saturation_pct=100.0,
        binder_mass_pct_recipes=[5.0, 6.0],
    )

    inputs = RpcEssaiInputs(
        category=MixCategory.RPC,
        general=_general_info(),
        residue=_residu(),
        binder_system=_systeme_liant(),
        num_recipes=2,
        containers_per_recipe=1,
        safety_factor=1.0,
        base_method=RpcMethod.CW,
        base_inputs_cw=base_cw,
        adjustments=[
            RpcEssaiAdjustment(added_water_mass=0.5),
            # la 2e recette reste volontairement "vide"
        ],
    )

    result = solve_rpc_essai(inputs)
    assert len(result.recipes) == 2
    assert result.recipes[0].components.water_total_mass_kg >= result.recipes[1].components.water_total_mass_kg
