# app/core/debug_cw_case.py
"""
Small helper script to run one RPC–Cw case and print all intermediate
values so you can compare Python vs Excel/C#.

Run from backend folder (venv activated):

    python -m app.core.debug_cw_case
"""

from app.core.rpc_solver import solve_rpc_cw
from app.core.models import (
    ContainerType,
    MixCategory,
    GeneralInfo,
    ResidueProps,
    BinderSystem,
    BinderComponent,
    RpcCwInputs,
)


def main():
    # 1) General info – same as what you enter in the UI
    general = GeneralInfo(
        container_type=ContainerType.SECTION_HEIGHT,
        container_section=80.516,   # cm²
        container_height=20.5,      # cm

        binder1_fraction_pct=60,
        binder2_fraction_pct=40,
        binder1_type="CP10",
        binder2_type="SLAG",
        binder_count=2,

        mix_date="2025-11-26",
        operator_name="Rodrigue",
        project_name="Test RPC Cw",
        residue_id="knlkj",
    )

    # 2) Residue properties – match your Excel values
    residue = ResidueProps(
        specific_gravity=3.4,       # Gs_residu
        moisture_mass_pct=23.8,     # w0%
        # add any other required fields here if your ResidueProps model needs them
    )

    # 3) Binder system – Gs for CP10 and SLAG (from your data)
    binder_system = BinderSystem(
        components=[
            BinderComponent(
                type="CP10",
                name="CP10",
                mass_fraction=0.60,     # 60% of binder mass
                specific_gravity=3.1543,
            ),
            BinderComponent(
                type="SLAG",
                name="SLAG",
                mass_fraction=0.40,     # 40% of binder mass
                specific_gravity=2.8426,
            ),
        ]
    )

    # 4) RPC-Cw inputs – test case we validated
    inputs = RpcCwInputs(
        category=MixCategory.RPC,
        general=general,
        solids_mass_pct=78.0,          # Cw%
        saturation_pct=100.0,          # Sr%
        residue=residue,
        binder_system=binder_system,
        binder_mass_pct_recipes=[5.0], # Bw% (liant / résidu)
        num_recipes=1,
        containers_per_recipe=70,      # N_c
        safety_factor=1.0,             # FS
    )

    # 5) Run with debug=True to print all intermediate numbers
    result = solve_rpc_cw(inputs, debug=True)

    print("======== FINAL PYTHON RESULT ========")
    print(result.recipes[0])


if __name__ == "__main__":
    main()
