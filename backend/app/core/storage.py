import json, uuid, time, os
from typing import Dict, Any, List

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "scenarios.json")
DATA_PATH = os.path.abspath(DATA_PATH)

def _ensure_file():
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    if not os.path.exists(DATA_PATH):
        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump([], f)

def _read_all() -> List[Dict[str, Any]]:
    _ensure_file()
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def _write_all(items: List[Dict[str, Any]]):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)

def create_scenario(name: str, inputs: Dict[str, Any], outputs: Dict[str, Any], general: Dict[str, Any] | None = None) -> Dict[str, Any]:
    items = _read_all()
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "created_at": int(time.time()),
        "general": general or {},
        "inputs": inputs,
        "outputs": outputs,
    }
    items.append(doc)
    _write_all(items)
    return doc

def list_scenarios() -> List[Dict[str, Any]]:
    items = _read_all()
    return sorted(items, key=lambda d: d.get("created_at", 0), reverse=True)

def get_scenario(sid: str) -> Dict[str, Any] | None:
    for s in _read_all():
        if s.get("id") == sid:
            return s
    return None

def delete_scenario(sid: str) -> bool:
    items = _read_all()
    new_items = [s for s in items if s.get("id") != sid]
    if len(new_items) == len(items):
        return False
    _write_all(new_items)
    return True
