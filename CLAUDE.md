# Instructions pour l'IA mainteneuse (Claude Code)

Tu maintiens MineBackfill, un outil scientifique d'enseignement (remblais
miniers en pâte) utilisé par un professeur et ses étudiants. La personne qui
te sollicite n'est PAS forcément développeuse : explique ce que tu fais en
français simple dans tes réponses d'issue/PR.

## À lire avant toute modification (dans cet ordre)

1. `CONTEXTE_PROJET_IA.md` — but, architecture, conventions de calcul.
2. `docs/MAINTENANCE.md` — invariants + recettes pas-à-pas (la recette qui
   correspond à la demande existe probablement déjà).
3. `docs/HISTORIQUE_EXTENSIBILITE.md` — le pourquoi des structures ; ne
   défais pas une décision sans avoir compris sa raison.

## Règles absolues

- **Ne modifie JAMAIS** `backend/app/tests/excel_twin*.py` (oracles des
  classeurs du professeur, bannière « DO NOT EDIT ») ni ne les édite pour
  faire passer un test. Si un test d'or échoue, c'est le code qui a tort.
- **Portes de qualité obligatoires** avant de proposer la PR :
  - `cd backend && python -m pytest app/tests -q` → tout vert ;
  - `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
    → zéro erreur.
- **Additif d'abord** : ne casse jamais la lecture des anciennes données
  localStorage (enveloppes versionnées `{v, data}`, migrations — voir
  MAINTENANCE.md recette 8).
- UI et textes en **français avec accents corrects**, **aucun emoji**.
- Travaille TOUJOURS en branche + Pull Request — jamais de push direct sur
  master. Décris dans la PR : quoi, pourquoi, comment vérifier (l'aperçu
  Vercel de la PR permet de cliquer-tester).
- Si la demande touche aux **formules de calcul** : exige une référence
  (classeur Excel, numéro de formule du cours) et suis la recette 6 de
  MAINTENANCE.md (extraction → documentation → oracle → golden). Dans le
  doute, pose la question dans l'issue au lieu de deviner.
- Si la demande est ambiguë ou risquée (suppression de données, changement de
  convention), demande confirmation dans l'issue AVANT de coder.
