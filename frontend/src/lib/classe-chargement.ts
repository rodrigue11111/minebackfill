// frontend/src/lib/classe-chargement.ts
// Chargement de la classe et garde contre les réponses égarées. Module PUR.
//
// Pourquoi (2026-10-26) : la page Classe peut passer de la classe réelle à la
// démonstration (et inversement) pendant qu'une lecture est en cours. Une
// réponse de l'ancienne source ne doit jamais remplacer les données de la
// nouvelle. Chaque chargement reçoit un numéro ; changer de source invalide les
// numéros en cours, et `chargerClasse` rend null pour une réponse dépassée.

import type { LigneClasse, ProfilClasse } from "./classe";
import type { LigneAnnotation } from "./classe-reseau";
import type { SourceClasse } from "./classe-source";
import type { RevueClasse } from "./revues";

export interface ControleurChargement {
  /** Numéro du chargement qui commence. */
  depart(): number;
  /** Ce chargement est-il encore le dernier, de la source courante ? */
  estCourant(jeton: number): boolean;
  /** Changement de source : tout chargement en cours devient dépassé. */
  invalider(): void;
}

export function creerControleur(): ControleurChargement {
  let courant = 0;
  return {
    depart: () => ++courant,
    estCourant: (jeton) => jeton === courant,
    invalider: () => { courant++; },
  };
}

export interface DonneesClasse {
  lignes: LigneClasse[];
  profils: ProfilClasse[];
  annotations: LigneAnnotation[];
  /** null : revues indisponibles (base pas à jour) ; `erreurRevues` dit pourquoi. */
  revues: RevueClasse[] | null;
  erreurRevues: unknown;
}

/**
 * Lit la classe depuis `source` ; null si un autre chargement ou un changement
 * de source est survenu pendant la lecture (réponse dépassée, à ignorer).
 * Une erreur de lecture des revues n'empêche pas le reste (comme avant).
 */
export async function chargerClasse(
  source: SourceClasse,
  o: { session: string | null },
  controleur: ControleurChargement,
): Promise<DonneesClasse | null> {
  const jeton = controleur.depart();
  let erreurRevues: unknown = null;
  let lu: [LigneClasse[], ProfilClasse[], LigneAnnotation[], RevueClasse[] | null];
  try {
    lu = await Promise.all([
      source.lireClasse({ complet: false, session: o.session }),
      source.lireProfils(),
      source.lireAnnotationsClasse(),
      source.lireRevuesClasse().catch((e: unknown) => { erreurRevues = e; return null; }),
    ]);
  } catch (e) {
    // L'échec d'un chargement dépassé ne concerne plus la page.
    if (!controleur.estCourant(jeton)) return null;
    throw e;
  }
  if (!controleur.estCourant(jeton)) return null;
  const [lignes, profils, annotations, revues] = lu;
  return { lignes, profils, annotations, revues, erreurRevues };
}
