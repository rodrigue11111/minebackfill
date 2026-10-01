// frontend/src/lib/classe-resume.ts
// Bande résumé du tableau de bord de l'enseignant (maquette A améliorée) :
// quatre chiffres lus d'un coup d'œil. Module pur, mêmes règles que le reste
// de la Classe : essais VALIDES seulement, copies de conflit exclues.

import type { EtudiantClasse } from "./classe";
import type { EcheanceClasse } from "./classe-echeancier";
import { estReponse, type LigneAnnotation } from "./classe-reseau";
import { aRevoir, type InfoRevue } from "./revues";

export interface ResumeClasse {
  essaisValides: number;
  gachees: number;
  /** Éprouvettes à écraser maintenant : en retard ou attendues aujourd'hui. */
  aEcraser: number;
  enRetard: number;
  reponsesNonLues: number;
  /** Gâchées terminées sans revue, ou modifiées depuis ; null si les revues sont indisponibles. */
  aRevoir: number | null;
}

export function resumeClasse(
  etudiants: EtudiantClasse[],
  echeances: EcheanceClasse[],
  annotations: LigneAnnotation[],
  revueDe?: (ownerId: string, gacheeId: string) => InfoRevue | undefined,
): ResumeClasse {
  const enRetard = echeances.filter((x) => x.classe === "retard").length;
  return {
    essaisValides: etudiants.reduce((n, e) => n + e.nbEssais, 0),
    gachees: etudiants.reduce((n, e) => n + e.gachees.filter((g) => !g.conflit).length, 0),
    aEcraser: enRetard + echeances.filter((x) => x.classe === "aujourdhui").length,
    enRetard,
    reponsesNonLues: annotations.filter((a) => estReponse(a) && !a.lu_le).length,
    aRevoir: revueDe
      ? etudiants.reduce((n, e) => n + e.gachees.filter((g) => aRevoir(g, revueDe(e.id, g.id))).length, 0)
      : null,
  };
}
