"""Garde du vouvoiement du backend.

Le site s'adresse au lecteur par « vous », partout (décision de l'utilisateur,
2026-10-25). Ici, TOUS les textes comptent, docstrings et description=
compris : ils sont publiés dans la documentation de l'API (/docs) et recopiés
dans frontend/src/lib/api-types.gen.ts. Même règle côté frontend :
frontend/src/lib/vouvoiement.test.ts.

Garde ciblée : pronoms et élisions qui s'adressent sans ambiguïté au lecteur
(« tu », « toi », « ton », « ta », « tes », « t' », « -toi »), pas une analyse
grammaticale des impératifs.
"""

import ast
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # backend/app

TUTOIEMENT = (
    re.compile(r"(?<![\w-])(?:tu|toi|ton|ta|tes)(?![\w-])", re.IGNORECASE),
    re.compile(r"(?<![^\W\d_])t['’](?=[^\W\d_])", re.IGNORECASE),
    re.compile(r"[^\W\d_]-toi(?![^\W\d_])", re.IGNORECASE),
)


def tutoiements(texte: str) -> list[str]:
    return [m.group(0) for r in TUTOIEMENT if (m := r.search(texte))]


def _sources() -> list[Path]:
    return sorted(p for p in RACINE.rglob("*.py") if "tests" not in p.relative_to(RACINE).parts)


def _textes_tutoyes(chemin: Path) -> list[str]:
    # utf-8-sig : certains fichiers commencent par une marque d'ordre (BOM).
    arbre = ast.parse(chemin.read_text(encoding="utf-8-sig"))
    trouves = []
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.Constant) and isinstance(noeud.value, str):
            formes = tutoiements(noeud.value)
            if formes:
                rel = chemin.relative_to(RACINE).as_posix()
                trouves.append(f"{rel}:{noeud.lineno} {formes} « {noeud.value.strip()[:90]} »")
    return trouves


def test_le_parcours_couvre_le_code_du_backend():
    rels = {p.relative_to(RACINE).as_posix() for p in _sources()}
    assert "core/models.py" in rels
    assert "core/rpc_solver.py" in rels
    assert not any(r.startswith("tests/") for r in rels)


def test_aucun_texte_ne_tutoie():
    trouves = [t for p in _sources() for t in _textes_tutoyes(p)]
    assert trouves == []


def test_la_garde_attrape_le_tutoiement_et_ignore_les_mots_voisins():
    for fautif in ("Dans ton C#, tu utilisais -99", "Tu pourras enrichir", "si t'as un doute", "Assure-toi"):
        assert tutoiements(fautif), fautif
    for correct in ("Type de contenant manquant : renseignez-le", "état", "tâche", "Taux massique",
                    "aujourd'hui", "l'écart", "TOTAL", "ui-ton-x", "tonne"):
        assert tutoiements(correct) == [], correct
