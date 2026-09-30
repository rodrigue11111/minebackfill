// frontend/src/lib/liants.ts
// Nom affiché d'un composant de l'agent liant, en UN seul endroit (avant : trois
// copies divergentes dans ResultsPanel, ResultatLecture et exports-resultat).

import { lireBinders, type GeneralInfo, type LiantCatalogueItem } from "./store";

/**
 * Nom du composant n (1-indexé) de l'agent liant décrit par `general`.
 * Ordre : le nom du catalogue (par id, puis par code), sinon le code, sinon
 * « Liant n ». Pour un résultat sauvegardé, passer le catalogue FIGÉ avec lui
 * (`sr.catalogue_liants`) : le nom reste celui du moment du calcul.
 */
export function nomLiant(general: GeneralInfo, catalogue: LiantCatalogueItem[] = []): (n: number) => string {
  const composants = lireBinders(general);
  return (n) => {
    const ref = composants[n - 1];
    if (!ref?.code && !ref?.id) return `Liant ${n}`;
    const item =
      (ref.id ? catalogue.find((l) => l.id === ref.id) : undefined) ??
      catalogue.find((l) => l.code === ref.code);
    return item?.nom ?? ref.code ?? `Liant ${n}`;
  };
}
