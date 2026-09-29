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

/** Calendrier .ics : un événement d'une journée par éprouvette à écraser. */
export function icsClasse(l: EcheanceClasse[], horodatage: Date): string {
  return construireIcs(l.map((x) => ({
    // Unique même si deux étudiants avaient le même id d'éprouvette.
    uid: `${x.etudiantId}.${x.eprouvetteId}@minebackfill`,
    date: x.echeance,
    titre: `Écraser ${x.eprouvetteCode} (${x.etudiant})`,
    description: `${x.etudiant} · gâchée ${x.gacheeCode} · ${x.formulation} · ${x.ageJours} j de cure`,
  })), horodatage);
}

export const EN_TETES_ECHEANCIER = ["Échéance", "État", "Jours restants", "Étudiant", "Éprouvette", "Âge cible (j)", "Gâchée", "Formulation"];
const ETATS: Record<EcheanceClasse["classe"], string> = { retard: "en retard", aujourdhui: "aujourd'hui", proche: "7 prochains jours", planifie: "plus tard" };

export function lignesCsvEcheancier(l: EcheanceClasse[]): CelluleCsv[][] {
  return securiserCsv([EN_TETES_ECHEANCIER, ...l.map((x) => [
    fmtDate(x.echeance), ETATS[x.classe], x.joursRestants, x.etudiant, x.eprouvetteCode, x.ageJours, x.gacheeCode, x.formulation,
  ])]);
}
