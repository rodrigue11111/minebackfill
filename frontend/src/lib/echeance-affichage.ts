// frontend/src/lib/echeance-affichage.ts
// Affichage des échéances d'écrasement (libellé, couleur, date), partagé par
// le Labo de l'étudiant et le tableau de bord de l'enseignant. Module PUR.

import { classeEcheance, joursRestants, type ClasseEcheance, type Eprouvette } from "./eprouvette";

// Couleurs de TEXTE (contraste suffisant sur fond blanc), palette de la refonte.
export const COULEUR_ECHEANCE: Record<ClasseEcheance, string> = {
  retard: "#B3261E",
  aujourdhui: "#8A4B00",
  proche: "#0071E3",
  planifie: "#6E6E73",
  fait: "#1F7A45",
};

const p2 = (n: number) => String(n).padStart(2, "0");

/** Date affichée AAAA-MM-JJ (non ambigu, local). */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Libellé + couleur de l'état d'échéance d'une éprouvette. */
export function badgeEcheance(e: Eprouvette, ref: Date): { texte: string; couleur: string } {
  const c = classeEcheance(e, ref);
  const j = joursRestants(e, ref);
  const texte =
    c === "fait" ? "écrasée"
    : c === "aujourdhui" ? "à écraser aujourd'hui"
    : c === "retard" ? `en retard de ${-j} j`
    : `dans ${j} j`;
  return { texte, couleur: COULEUR_ECHEANCE[c] };
}
