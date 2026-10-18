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

/**
 * Les fractions d'un agent liant composé font-elles 100 % ? La tolérance suit
 * l'affichage (« Total des fractions : 100,0 % », une décimale) : un total qui
 * s'affiche 100,0 est accepté (33,33 + 66,66 = 99,99 l'est). Le calcul
 * normalise lui-même les fractions (construireSystemeLiant) : cette garde est
 * celle de l'interface.
 */
export function fractionsCompletes(total: number, decimales = 1): boolean {
  return Math.abs(total - 100) < 0.5 * 10 ** -decimales;
}
