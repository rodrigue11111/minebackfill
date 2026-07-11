# -*- coding: utf-8 -*-
"""
Tests de contrat HTTP — la couche API complète (routage, validation
Pydantic, handler ValueError -> 422) via fastapi.testclient.

Les tests d'or couvrent les solveurs en direct ; ici on vérifie que
chaque endpoint est monté, accepte un payload valide et renvoie les
bons codes d'erreur.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

W0 = (1 / 0.76 - 1) * 100.0
GENERAL = {
    "container_type": "longueur_largeur_hauteur",
    "container_length": 5500.0, "container_width": 2000.0, "container_height": 1000.0,
}
BINDERS = {"components": [
    {"type": "GU", "specific_gravity": 3.15, "mass_fraction": 0.2},
    {"type": "SLAG", "specific_gravity": 2.9, "mass_fraction": 0.8},
]}
BASE = {
    "general": GENERAL,
    "residue": {"specific_gravity": 3.05, "moisture_mass_pct": W0},
    "binder_system": BINDERS,
    "num_recipes": 1, "containers_per_recipe": 1, "safety_factor": 1.0,
    "saturation_pct": 100.0, "binder_mass_pct_recipes": [4.5],
}


def test_health():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_rpc_cw_ok():
    r = client.post("/rpc/cw", json={**BASE, "category": "RPC", "solids_mass_pct": 70.0})
    assert r.status_code == 200
    recette = r.json()["recipes"][0]
    assert abs(recette["components"]["residue_dry_mass_kg"] - 13_906_501.49) < 1.0


def test_rpc_wb_ok():
    r = client.post("/rpc/wb", json={**BASE, "category": "RPC",
                                     "wc_ratio_recipes": [9.952380952380953]})
    assert r.status_code == 200
    assert r.json()["recipes"][0]["wc_ratio"] > 0


def test_rpc_slump_ok():
    r = client.post("/rpc/slump", json={**BASE, "category": "RPC",
                                        "cone_type": "mini", "slump_mm": 180.0})
    assert r.status_code == 200


def test_rpc_essai_ok():
    base_cw = {**BASE, "category": "RPC", "solids_mass_pct": 70.0}
    r = client.post("/rpc/essai", json={
        **base_cw, "base_method": "dosage_cw", "base_inputs_cw": base_cw,
        "adjustments": [{"added_water_mass": 500.0}],
    })
    assert r.status_code == 200
    assert abs(r.json()["recipes"][0]["saturation_pct"] - 100.0) < 1e-6


def test_rpg_cw_ok():
    r = client.post("/rpg/cw", json={**BASE, "category": "RPG", "solids_mass_pct": 70.0,
                                     "aggregate_fraction_pct": 30.0,
                                     "aggregate_specific_gravity": 2.8})
    assert r.status_code == 200
    assert r.json()["recipes"][0]["components"]["aggregate_dry_mass_kg"] > 0


def test_rrc_dosage_ok():
    r = client.post("/rrc/dosage", json={
        "category": "RRC", "general": {}, "num_recipes": 1,
        "quantity_mode": "volume", "volume_m3": 1000.0, "wet_density_kg_m3": 2200.0,
        "binder_mass_pct_recipes": [5.0], "wc_ratio_recipes": [1.0],
    })
    assert r.status_code == 200
    assert abs(r.json()["recipes"][0]["waste_rock_mass_kg"] - 2_000_000.0) < 1e-6


def test_champ_manquant_renvoie_422_pydantic():
    payload = {**BASE, "category": "RPC", "solids_mass_pct": 70.0}
    del payload["residue"]
    r = client.post("/rpc/cw", json=payload)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], list)  # forme Pydantic


def test_erreur_metier_renvoie_422_message_francais():
    # dimensions du contenant absentes -> ValueError du solveur -> handler 422
    r = client.post("/rpc/cw", json={**BASE, "category": "RPC",
                                     "solids_mass_pct": 70.0, "general": {}})
    assert r.status_code == 422
    assert "contenant" in r.json()["detail"]


def test_fractions_liant_invalides_renvoie_422():
    mauvais = {"components": [{"type": "GU", "specific_gravity": 3.15, "mass_fraction": 0.5}]}
    r = client.post("/rpc/cw", json={**BASE, "category": "RPC",
                                     "solids_mass_pct": 70.0, "binder_system": mauvais})
    assert r.status_code == 422
    assert "fractions massiques" in r.json()["detail"].lower()


QUATRE_LIANTS = {"components": [
    {"type": "A", "specific_gravity": 3.15, "mass_fraction": 0.25},
    {"type": "B", "specific_gravity": 2.9, "mass_fraction": 0.25},
    {"type": "C", "specific_gravity": 2.8, "mass_fraction": 0.25},
    {"type": "D", "specific_gravity": 2.7, "mass_fraction": 0.25},
]}


def test_rpc_quatre_liants_rejetes_422():
    # 4 composants : fractions valides (0.25*4=1) mais le 4e serait ignore.
    r = client.post("/rpc/cw", json={**BASE, "category": "RPC",
                                     "solids_mass_pct": 70.0, "binder_system": QUATRE_LIANTS})
    assert r.status_code == 422


def test_rpg_quatre_liants_rejetes_422():
    r = client.post("/rpg/cw", json={**BASE, "category": "RPG", "solids_mass_pct": 70.0,
                                     "aggregate_fraction_pct": 30.0, "aggregate_specific_gravity": 2.8,
                                     "binder_system": QUATRE_LIANTS})
    assert r.status_code == 422


def test_rpg_fractions_invalides_renvoie_422():
    # Symetrie avec le RPC : le RPG validait silencieusement (Bw=0) auparavant.
    mauvais = {"components": [{"type": "GU", "specific_gravity": 3.15, "mass_fraction": 0.5}]}
    r = client.post("/rpg/cw", json={**BASE, "category": "RPG", "solids_mass_pct": 70.0,
                                     "aggregate_fraction_pct": 30.0, "aggregate_specific_gravity": 2.8,
                                     "binder_system": mauvais})
    assert r.status_code == 422
    assert "fractions massiques" in r.json()["detail"].lower()


def test_rpg_liste_recettes_trop_courte_renvoie_422():
    r = client.post("/rpg/cw", json={**BASE, "category": "RPG", "solids_mass_pct": 70.0,
                                     "aggregate_fraction_pct": 30.0, "aggregate_specific_gravity": 2.8,
                                     "num_recipes": 2, "binder_mass_pct_recipes": [4.5]})
    assert r.status_code == 422
