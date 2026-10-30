// frontend/src/lib/labo-demo.ts
// Démonstration du Labo (/labo?demo=1, 2026-10-30, demande de l'utilisateur) :
// des gâchées de simulation pour voir et mettre au point la partie
// « Résultats UCS » sans faire de vraies gâchées. Module PUR.
//
// Les gâchées sont celles de la démonstration Classe (classe-demo.ts) : mêmes
// recettes, issues du vrai calculateur, et mêmes mesures UCS INVENTÉES par un
// modèle simple, sans valeur expérimentale. Elles deviennent le laboratoire
// d'un seul opérateur :
// - une formulation par libellé (les gâchées d'une même formulation, faites
//   par plusieurs étudiants dans la Classe, deviennent ses répétitions) ;
// - des codes refaits dans l'ordre des dates, pour qu'aucun ne se répète.
// Rien n'est enregistré : la page garde ces gâchées en mémoire.

import { classeDemo, MENTION_DEMO } from "./classe-demo";
import { genererCode, type Gachee } from "./gachee";
import type { SavedResult } from "./store";

export const MENTION_DEMO_LABO = `${MENTION_DEMO} Rien n'est enregistré : vos essais disparaissent au rechargement de la page.`;

export interface LaboDemo {
  gachees: Gachee[];
  formulations: SavedResult[];
}

/** Le laboratoire fictif, à la date `maintenant` (déterministe pour une date donnée). */
export function laboDemo(maintenant: Date): LaboDemo {
  const d = classeDemo(maintenant);
  const resultats = d.lignes.filter((l) => l.kind === "resultat").map((l) => l.contenu as SavedResult);
  const canonique = new Map<string, SavedResult>();
  for (const r of resultats) if (!canonique.has(r.label)) canonique.set(r.label, r);
  const idCanonique = new Map(resultats.map((r) => [r.id, canonique.get(r.label)!.id]));

  const brutes = d.lignes.filter((l) => l.kind === "gachee").map((l) => l.contenu as Gachee)
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const gachees: Gachee[] = [];
  for (const g of brutes) {
    const code = genererCode(gachees, new Date(g.creeLe));
    gachees.push({
      ...g,
      code,
      eprouvettes: g.eprouvettes.map((e) => ({ ...e, code: e.code.replace(g.code, code) })),
      formulationId: g.formulationId ? idCanonique.get(g.formulationId) ?? g.formulationId : g.formulationId,
      // Les revues et le fil de la Classe ne suivent pas : ici, aucun enseignant.
      conflit: undefined,
    });
  }
  return { gachees: gachees.reverse(), formulations: [...canonique.values()] };
}
