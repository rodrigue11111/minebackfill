"""Recettes de la classe de démonstration (page Classe, /classe?demo=1).

Les recettes de la démonstration sont calculées par le VRAI calculateur, puis
figées dans frontend/src/lib/classe-demo-recettes.json : le site n'a pas de
calcul de recette en TypeScript, et la démonstration ne doit faire aucun appel
réseau. Les mesures UCS de la démonstration, elles, sont inventées par le site
(frontend/src/lib/classe-demo.ts) et n'ont aucune valeur expérimentale.

Régénérer le fichier après un changement des solveurs :
    cd backend && .venv/Scripts/python.exe scripts/recettes_demo_classe.py
Le test app/tests/test_demo_classe.py échoue tant que le fichier n'est pas à jour.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE_BACKEND = Path(__file__).resolve().parents[1]
if str(RACINE_BACKEND) not in sys.path:
    sys.path.insert(0, str(RACINE_BACKEND))

from app.core.models import (  # noqa: E402
    BinderComponent, BinderSystem, GeneralInfo, ResidueProps, RpcCwInputs, RpcWbInputs,
    RpgCwInputs, SolverConstants,
)
from app.core.rpc_solver import solve_rpc_cw, solve_rpc_wb  # noqa: E402
from app.core.rpg_solver import solve_rpg_cw  # noqa: E402

FICHIER = RACINE_BACKEND.parent / "frontend" / "src" / "lib" / "classe-demo-recettes.json"

# Moules de laboratoire : cylindres 76,2 x 152,4 mm (rayon 3,81 cm, hauteur
# 15,24 cm), 9 par recette, facteur de perte 1,1.
MOULE = {"container_type": "rayon_hauteur", "container_radius": 3.81, "container_height": 15.24}
NB_MOULES = 9
KAPPA = 1.1

# Catalogue officiel du site (frontend/src/lib/store.tsx et materials.ts).
RESIDUS = {
    "res_laronde": {"nom": "Résidus LaRonde", "gs": 3.1, "w0": 25.0},
    "res_casa_berardi": {"nom": "Résidus Casa Berardi", "gs": 3.05, "w0": 31.5789},
}
LIANTS = {"liant_cp10": ("CP10", 3.1543), "liant_slag": ("SLAG", 2.8426)}
GRANULAT = {"id": "gra_laronde", "gs": 2.8}

# Constantes de la feuille gramme, celles du site.
CONSTANTES = SolverConstants(essai_gs_convention="recalcule", essai_binder_rule="residu_ajoute")

# Formulations de la classe fictive (voir classe-demo.ts pour les groupes).
FORMULATIONS = {
    "laronde_bw5": {"categorie": "RPC", "methode": "dosage_cw", "residu": "res_laronde",
                    "liants": [("liant_cp10", 20), ("liant_slag", 80)], "cw": 75.0, "bw": [5.0]},
    "laronde_bw3": {"categorie": "RPC", "methode": "dosage_cw", "residu": "res_laronde",
                    "liants": [("liant_cp10", 20), ("liant_slag", 80)], "cw": 75.0, "bw": [3.0]},
    "laronde_rpg": {"categorie": "RPG", "methode": "dosage_cw", "residu": "res_laronde",
                    "liants": [("liant_cp10", 20), ("liant_slag", 80)], "cw": 78.0, "bw": [4.0], "am": 30.0},
    "casa_bw6": {"categorie": "RPC", "methode": "dosage_cw", "residu": "res_casa_berardi",
                 "liants": [("liant_cp10", 100)], "cw": 70.0, "bw": [6.0]},
    "laronde_el": {"categorie": "RPC", "methode": "wb", "residu": "res_laronde",
                   "liants": [("liant_cp10", 20), ("liant_slag", 80)], "bw": [4.0, 6.0], "el": [7.5, 6.0]},
}


def _entrees_communes(f: dict) -> dict:
    residu = RESIDUS[f["residu"]]
    return dict(
        general=GeneralInfo(**MOULE),
        residue=ResidueProps(specific_gravity=residu["gs"], moisture_mass_pct=residu["w0"]),
        binder_system=BinderSystem(components=[
            BinderComponent(type=LIANTS[i][0], specific_gravity=LIANTS[i][1], mass_fraction=pct / 100)
            for i, pct in f["liants"]
        ]),
        constants=CONSTANTES,
        num_recipes=len(f["bw"]),
        containers_per_recipe=NB_MOULES,
        safety_factor=KAPPA,
        saturation_pct=100.0,
        binder_mass_pct_recipes=f["bw"],
    )


def calculer() -> dict:
    """Recettes de chaque formulation, telles que le calculateur les rend."""
    sortie = {}
    for cle, f in FORMULATIONS.items():
        commun = _entrees_communes(f)
        if f["methode"] == "wb":
            resultat = solve_rpc_wb(RpcWbInputs(category="RPC", wc_ratio_recipes=f["el"], **commun))
        elif f["categorie"] == "RPG":
            resultat = solve_rpg_cw(RpgCwInputs(category="RPG", solids_mass_pct=f["cw"], aggregate_fraction_pct=f["am"],
                                                aggregate_specific_gravity=GRANULAT["gs"], **commun))
        else:
            resultat = solve_rpc_cw(RpcCwInputs(category="RPC", solids_mass_pct=f["cw"], **commun))
        residu = RESIDUS[f["residu"]]
        sortie[cle] = {
            "categorie": f["categorie"],
            "methode": f["methode"],
            "residu": {"id": f["residu"], "nom": residu["nom"], "gs": residu["gs"], "w0_pct": residu["w0"]},
            "liants": [{"id": i, "code": LIANTS[i][0], "gs": LIANTS[i][1], "fraction_pct": pct} for i, pct in f["liants"]],
            "granulat": ({"id": GRANULAT["id"], "gs": GRANULAT["gs"], "am_pct": f["am"]} if f["categorie"] == "RPG" else None),
            "cw_pct": f.get("cw"),
            "bw_pct": f["bw"],
            "el": f.get("el"),
            "moule": MOULE,
            "nb_moules": NB_MOULES,
            "kappa": KAPPA,
            "recettes": [r.model_dump(mode="json") for r in resultat.recipes],
        }
    return {
        "genere_par": "backend/scripts/recettes_demo_classe.py",
        "note": "Recettes calculées par le calculateur MineBackfill pour la démonstration de la page Classe.",
        "formulations": sortie,
    }


if __name__ == "__main__":
    FICHIER.write_text(json.dumps(calculer(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Écrit : {FICHIER}")
