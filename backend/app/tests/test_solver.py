from app.core.models import MixInputs
from app.core.solver import compute_mix

def test_solver_basic():
    i = MixInputs(
        solids_mass_frac=0.72,
        tailings_sg=2.7,
        target_ucs_28d_mpa=1.5,
        binder_split=(1.0, 0.0, 0.0),
    )
    out = compute_mix(i)
    # Sanity bounds for the placeholder model
    assert 2.0 <= out.binder_pct_wt <= 20.0
    assert 0.3 <= out.water_to_binder <= 3.0
    assert len(out.predicted_ucs_curve) == 3
    # The 28d point should equal the target
    assert abs(out.predicted_ucs_curve[1].ucs_mpa - 1.5) < 1e-9
