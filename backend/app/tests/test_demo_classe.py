"""Recettes figées de la démonstration de la page Classe.

frontend/src/lib/classe-demo-recettes.json est produit par
backend/scripts/recettes_demo_classe.py avec le vrai calculateur. Ce test le
refait et compare : si les solveurs changent, il échoue jusqu'à ce que le
fichier soit régénéré, et la démonstration ne montre jamais des recettes que
le calculateur ne donnerait plus.
"""

import importlib.util
import json
from pathlib import Path

RACINE_BACKEND = Path(__file__).resolve().parents[2]
SCRIPT = RACINE_BACKEND / "scripts" / "recettes_demo_classe.py"


def _script():
    spec = importlib.util.spec_from_file_location("recettes_demo_classe", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _ecarts(attendu, obtenu, chemin="") -> list[str]:
    if isinstance(attendu, dict):
        assert isinstance(obtenu, dict) and attendu.keys() == obtenu.keys(), chemin
        return [e for k in attendu for e in _ecarts(attendu[k], obtenu[k], f"{chemin}.{k}")]
    if isinstance(attendu, list):
        assert isinstance(obtenu, list) and len(attendu) == len(obtenu), chemin
        return [e for i, (a, o) in enumerate(zip(attendu, obtenu)) for e in _ecarts(a, o, f"{chemin}[{i}]")]
    if isinstance(attendu, (int, float)) and not isinstance(attendu, bool) and isinstance(obtenu, (int, float)):
        return [] if abs(attendu - obtenu) <= 1e-9 * max(1.0, abs(attendu), abs(obtenu)) else [chemin]
    return [] if attendu == obtenu else [chemin]


def test_recettes_figees_egales_au_calcul_actuel():
    module = _script()
    fige = json.loads(module.FICHIER.read_text(encoding="utf-8"))
    assert _ecarts(fige, json.loads(json.dumps(module.calculer()))) == [], (
        "Recettes de démonstration périmées : relancer backend/scripts/recettes_demo_classe.py"
    )


def test_recettes_a_l_echelle_du_laboratoire():
    fige = json.loads(_script().FICHIER.read_text(encoding="utf-8"))
    for cle, f in fige["formulations"].items():
        for r in f["recettes"]:
            # 9 moules de 76,2 x 152,4 mm et κ = 1,1 : environ 6,9 L, bien sous 50 L.
            assert 0.006 < r["total_backfill_volume_m3"] < 0.008, cle
            total_kg = r["components"]["residue_dry_mass_kg"] + r["components"]["binder_total_mass_kg"] \
                + r["components"]["water_total_mass_kg"] + (r["components"].get("aggregate_dry_mass_kg") or 0)
            assert total_kg < 100, cle
