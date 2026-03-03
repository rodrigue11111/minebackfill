from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
from ..core.models import MixInputs, GeneralInfo
from ..core.solver import compute_mix
from ..core.storage import create_scenario, list_scenarios, get_scenario, delete_scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

class SaveRequest(BaseModel):
    name: str = Field(min_length=1)
    general: Optional[GeneralInfo] = None
    inputs: MixInputs

@router.get("")
def list_all():
    return list_scenarios()

@router.get("/{sid}")
def get_one(sid: str):
    s = get_scenario(sid)
    if not s:
        raise HTTPException(404, "Not found")
    return s

@router.post("")
def save(req: SaveRequest):
    out = compute_mix(req.inputs)
    doc = create_scenario(req.name, req.inputs.dict(), out.dict(), general=(req.general.dict() if req.general else {}))
    return doc

@router.delete("/{sid}")
def remove(sid: str):
    ok = delete_scenario(sid)
    if not ok:
        raise HTTPException(404, "Not found")
    return {"deleted": True}
