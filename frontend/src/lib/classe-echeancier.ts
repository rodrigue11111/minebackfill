// frontend/src/lib/classe-echeancier.ts
// Échéancier de TOUTE la classe : les éprouvettes encore en cure, avec
// l'étudiant, pour planifier la presse. Module PUR, `maintenant` injecté.
// Copies de conflit exclues : elles répètent les éprouvettes de l'original.

import { classeEcheance, construireIcs, dateEcheance, joursRestants, type ClasseEcheance } from "./eprouvette";
import { gacheesRetenues, type EtudiantClasse } from "./classe";
import { fmtDate } from "./echeance-affichage";
import { securiserCsv, type CelluleCsv } from "./classe-csv";

export interface EcheanceClasse {
  etudiantId: string;
  etudiant: string;
  gacheeId: string;
  gacheeCode: string;
  formulation: string;
  eprouvetteId: string;
  eprouvetteCode: string;
  ageJours: number;
  echeance: Date;
  joursRestants: number;
  classe: Exclude<ClasseEcheance, "fait">;
}

export function echeancierClasse(etudiants: EtudiantClasse[], maintenant: Date): EcheanceClasse[] {
  const r: EcheanceClasse[] = [];
  for (const e of etudiants) {
    for (const g of gacheesRetenues(e)) {
      for (const ep of g.eprouvettes) {
        const c = classeEcheance(ep, maintenant);
        if (c === "fait") continue;
        r.push({
          etudiantId: e.id, etudiant: e.nom, gacheeId: g.id, gacheeCode: g.code, formulation: g.formulationLabel ?? "",
          eprouvetteId: ep.id, eprouvetteCode: ep.code, ageJours: ep.ageJours,
          echeance: dateEcheance(ep), joursRestants: joursRestants(ep, maintenant), classe: c,
        });
      }
    }
  }
  return r.sort((a, b) => a.echeance.getTime() - b.echeance.getTime()
    || a.etudiant.localeCompare(b.etudiant, "fr") || a.eprouvetteCode.localeCompare(b.eprouvetteCode));
}

/**
 * Calendrier .ics : un événement d'une journée par éprouvette à écraser. En
 * démonstration (classe fictive), chaque titre commence par « [Démonstration] ».
 */
export function icsClasse(l: EcheanceClasse[], horodatage: Date, o: { demonstration?: boolean } = {}): string {
  const prefixe = o.demonstration ? "[Démonstration] " : "";
  return construireIcs(l.map((x) => ({
    // Unique même si deux étudiants avaient le même id d'éprouvette.
    uid: `${x.etudiantId}.${x.eprouvetteId}@minebackfill`,
    date: x.echeance,
    titre: `${prefixe}Écraser ${x.eprouvetteCode} (${x.etudiant})`,
    description: `${prefixe}${x.etudiant} · gâchée ${x.gacheeCode} · ${x.formulation} · ${x.ageJours} j de cure`,
  })), horodatage);
}

// « Calculé le » (ajouté à la fin, 2026-10-20) : « Jours restants » se compte
// depuis ce jour-là, pas depuis le jour où l'on rouvre le fichier.
export const EN_TETES_ECHEANCIER = ["Échéance", "État", "Jours restants", "Étudiant", "Éprouvette", "Âge cible (j)", "Gâchée", "Formulation", "Calculé le"];
const ETATS: Record<EcheanceClasse["classe"], string> = { retard: "en retard", aujourdhui: "aujourd'hui", proche: "7 prochains jours", planifie: "plus tard" };

/** `calculeLe` : le « maintenant » qui a servi à echeancierClasse (jour local). */
export function lignesCsvEcheancier(l: EcheanceClasse[], calculeLe: Date): CelluleCsv[][] {
  const jour = fmtDate(calculeLe);
  return securiserCsv([EN_TETES_ECHEANCIER, ...l.map((x) => [
    fmtDate(x.echeance), ETATS[x.classe], x.joursRestants, x.etudiant, x.eprouvetteCode, x.ageJours, x.gacheeCode, x.formulation, jour,
  ])]);
}
