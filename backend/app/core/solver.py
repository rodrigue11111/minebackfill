from .models import MixInputs, MixOutputs, UCSPoint
from .units import Q_, ureg, binder_density, rho_water

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def compute_mix(i: MixInputs) -> MixOutputs:
    """
    Simplified, unit-safe placeholder.
    PURPOSE: prove end-to-end flow and establish a clear place for formulas.
    NOTE: Replace with validated equations in a later step.

    Concepts:
    - Work on a 1 kg slurry basis for clarity.
    - Cw = solids mass fraction (0–1).
    - Binder mass is a fraction of solids, scaled by desired UCS and Cw.
    - Water/Binder (W/B) is mass_water / mass_binder (common control variable).
    """
    # Basis: 1 kg slurry
    slurry_mass = Q_(1.0, "kg")
    Cw = i.solids_mass_frac

    # Masses on 1 kg basis
    m_solids = slurry_mass * Cw
    m_water  = slurry_mass - m_solids

    # Placeholder binder need model:
    # higher UCS -> more binder; higher Cw -> less binder per solids.
    k = 0.04  # tunable coefficient (placeholder)
    binder_frac_solids = k * (i.target_ucs_28d_mpa / max(Cw, 1e-6)) / 3.0
    binder_frac_solids = clamp(binder_frac_solids, 0.02, 0.20)  # keep within 2–20% of solids

    m_binder = m_solids * binder_frac_solids

    # Water-to-binder ratio (mass basis)
    w_b = (m_water / m_binder).to_base_units().magnitude
    w_b = clamp(w_b, 0.3, 3.0)

    # Binder % of total slurry mass (wt%)
    binder_pct_wt = (m_binder / slurry_mass * 100).to_base_units().magnitude

    # Very rough UCS maturity curve (placeholders)
    ucs28 = i.target_ucs_28d_mpa
    curve = [
        UCSPoint(age_days=7,  ucs_mpa=max(0.1, 0.35 * ucs28)),
        UCSPoint(age_days=28, ucs_mpa=ucs28),
        UCSPoint(age_days=56, ucs_mpa=min(1.25 * ucs28, ucs28 + 2.0)),
    ]

    return MixOutputs(
        binder_pct_wt=binder_pct_wt,
        water_to_binder=w_b,
        predicted_ucs_curve=curve
    )
