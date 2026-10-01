"""Garde typographique du backend.

Aucun tiret cadratin (U+2014) ni demi-cadratin (U+2013) dans un texte que l'API
peut renvoyer : un message d'erreur passe tel quel à l'écran
(frontend/src/lib/api-error.ts). Ces tirets donnaient aux textes un air « écrit
par une IA » (décision du 2026-09-30) ; on écrit avec la ponctuation ordinaire.
Même règle côté frontend : frontend/src/lib/typographie.test.ts.

Exemptés : les commentaires (absents de l'arbre syntaxique), les docstrings et
les arguments description=, title= et summary=, qui ne servent qu'à la
documentation de l'API (/docs).
"""

import ast
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # backend/app
TIRETS = ("—", "–")
MOTS_CLES_DOC = {"description", "title", "summary"}


def _sources() -> list[Path]:
    return sorted(p for p in RACINE.rglob("*.py") if "tests" not in p.relative_to(RACINE).parts)


def _exemptes(arbre: ast.AST) -> set[int]:
    """Identifiants des nœuds de texte réservés à la documentation."""
    exemptes: set[int] = set()
    for noeud in ast.walk(arbre):
        corps = getattr(noeud, "body", None)
        if (
            isinstance(noeud, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
            and corps
            and isinstance(corps[0], ast.Expr)
            and isinstance(corps[0].value, ast.Constant)
            and isinstance(corps[0].value.value, str)
        ):
            exemptes.add(id(corps[0].value))
        if isinstance(noeud, ast.Call):
            for mot in noeud.keywords:
                if mot.arg in MOTS_CLES_DOC:
                    exemptes.update(id(sous) for sous in ast.walk(mot.value))
    return exemptes


def _textes_avec_tiret(chemin: Path) -> list[str]:
    # utf-8-sig : certains fichiers commencent par une marque d'ordre (BOM).
    arbre = ast.parse(chemin.read_text(encoding="utf-8-sig"))
    exemptes = _exemptes(arbre)
    trouves = []
    for noeud in ast.walk(arbre):
        if (
            isinstance(noeud, ast.Constant)
            and isinstance(noeud.value, str)
            and id(noeud) not in exemptes
            and any(t in noeud.value for t in TIRETS)
        ):
            rel = chemin.relative_to(RACINE).as_posix()
            trouves.append(f"{rel}:{noeud.lineno} « {noeud.value.strip()[:90]} »")
    return trouves


def test_le_parcours_couvre_le_code_du_backend():
    rels = {p.relative_to(RACINE).as_posix() for p in _sources()}
    assert "core/models.py" in rels
    assert "core/rpc_solver.py" in rels
    assert "main.py" in rels
    assert not any(r.startswith("tests/") for r in rels)


def test_aucun_tiret_dans_un_texte_renvoye_par_l_api():
    trouves = [t for p in _sources() for t in _textes_avec_tiret(p)]
    assert trouves == []


def test_la_garde_voit_un_tiret_hors_documentation():
    # Contrôle de la garde elle-même : un message avec tiret est signalé, une
    # docstring ou une description de champ ne l'est pas.
    code = (
        '"""Module — docstring permise."""\n'
        "x = Field(1, description='Description — permise')\n"
        "raise ValueError('Message — interdit')\n"
    )
    arbre = ast.parse(code)
    exemptes = _exemptes(arbre)
    signales = [
        n.value
        for n in ast.walk(arbre)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in exemptes and "—" in n.value
    ]
    assert signales == ["Message — interdit"]
