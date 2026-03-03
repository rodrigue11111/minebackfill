from fastapi import APIRouter, HTTPException
from ..core.models import MixInputs, MixOutputs
from ..core.solver import compute_mix as core_compute

router = APIRouter(prefix="/mix", tags=["mix"])

@router.post("/compute", response_model=MixOutputs)
def compute_mix(i: MixInputs) -> MixOutputs:
    # Guard-rails before computation (fail fast with clear messages)
    if abs(sum(i.binder_split) - 1.0) > 1e-6:
        raise HTTPException(status_code=400, detail="binder_split must sum to 1.0")
    if not (0.0 <= i.solids_mass_frac <= 1.0):
        raise HTTPException(status_code=400, detail="solids_mass_frac must be in [0,1]")
    return core_compute(i)
