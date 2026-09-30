// frontend/src/lib/ancres.ts
// Ancres des commentaires sur une gâchée : l'endroit précis visé par une note
// de l'enseignant (une pesée, une éprouvette) — et, depuis la réponse ancrée,
// par la réponse de l'étudiant. L'ancre est un TEXTE libre côté serveur
// (annotations.ancre, 200 caractères au plus) : une pesée s'écrit
// « Pesée : <composant> », une éprouvette par son code. Module pur.

import type { Gachee } from "./gachee";

/** Préfixe des ancres de pesée. */
export const PREFIXE_PESEE = "Pesée : ";

export function ancrePesee(libelleComposant: string): string {
  return `${PREFIXE_PESEE}${libelleComposant}`.slice(0, 200);
}

/** Ancres proposées à l'enseignant pour une gâchée : ses pesées, puis ses éprouvettes. */
export function ancresGachee(g: Pick<Gachee, "composants" | "eprouvettes">): string[] {
  return [...g.composants.map((c) => ancrePesee(c.label)), ...g.eprouvettes.map((e) => e.code)];
}

/**
 * Répartit un fil entre les ancres connues de la gâchée et le fil général.
 * Une ancre inconnue (éprouvette retirée depuis, par exemple) reste visible :
 * le message va au fil général, son ancre affichée devant le texte.
 */
export function repartirAnnotations<A extends { ancre: string | null }>(
  liste: A[],
  ancresConnues: string[],
): { parAncre: Map<string, A[]>; general: A[] } {
  const connues = new Set(ancresConnues);
  const parAncre = new Map<string, A[]>();
  const general: A[] = [];
  for (const a of liste) {
    if (a.ancre && connues.has(a.ancre)) {
      const l = parAncre.get(a.ancre) ?? [];
      l.push(a);
      parAncre.set(a.ancre, l);
    } else {
      general.push(a);
    }
  }
  return { parAncre, general };
}
