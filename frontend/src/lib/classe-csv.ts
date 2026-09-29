// frontend/src/lib/classe-csv.ts
// Export CSV de la classe (Excel en français : « ; » et virgule décimale, via
// versCsv/celluleCsv). Module PUR. Deux tableaux « à plat », prêts pour un
// tableau croisé dynamique — donc SANS lignes de commentaire en tête :
//   - éprouvettes : une ligne par éprouvette, valeurs MESURÉES ;
//   - synthèse : une ligne par gâchée et par âge (agregerParAge, la moyenne
//     des essais retenus d'UNE gâchée — jamais de moyenne entre gâchées).
// Copies de conflit exclues (elles répètent les éprouvettes de l'original).

import { agregerParAge, ageReelJours, contrainteKpa, dateCoulee, dateEcheance } from "./eprouvette";
import { horsTolerance, parametresEffectifs } from "./gachee";
import { sessionEffective, type Session } from "./sessions";
import { essaiValide, gacheesRetenues, type EtudiantClasse } from "./classe";
import { fmtDate } from "./echeance-affichage";

export type CelluleCsv = string | number | null | undefined;

/**
 * Neutralise une cellule TEXTE qu'un tableur prendrait pour une formule
 * (« =…», « +…», « -…», « @… », tabulation) : noms, codes et libellés sont
 * saisis par les étudiants. Les nombres, négatifs compris, ne passent pas ici.
 */
export function texteCsvSur(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Applique texteCsvSur à toutes les cellules texte. */
export function securiserCsv(lignes: CelluleCsv[][]): CelluleCsv[][] {
  return lignes.map((l) => l.map((c) => (typeof c === "string" ? texteCsvSur(c) : c)));
}

const arrondi = (v: number | null | undefined, d: number): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;
const jour = (iso: string | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtDate(d);
};

interface Contexte {
  e: EtudiantClasse;
  g: EtudiantClasse["gachees"][number];
  session: string;
  p: ReturnType<typeof parametresEffectifs>;
}

function parcourir(etudiants: EtudiantClasse[], sessions: Session[]): Contexte[] {
  const r: Contexte[] = [];
  for (const e of [...etudiants].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))) {
    const formulations = e.resultats.map((x) => ({ id: x.id, recipes: x.recipes ?? [] }));
    const gachees = [...gacheesRetenues(e)].sort((a, b) => (a.creeLe ?? "").localeCompare(b.creeLe ?? "") || a.code.localeCompare(b.code));
    for (const g of gachees) {
      r.push({
        e, g, p: parametresEffectifs(g, formulations),
        session: sessionEffective({ sessionId: g.sessionId, date: g.creeLe }, sessions)?.nom ?? "Sans session",
      });
    }
  }
  return r;
}

const tete = (c: Contexte): CelluleCsv[] => [
  c.e.nom, c.e.email ?? "", c.session, c.g.code, jour(c.g.creeLe), c.g.categorie, c.g.formulationLabel ?? "",
  c.p?.cwPct ?? null, c.p?.wcRatio ?? null, c.p?.bwPct ?? null, c.p?.wPct ?? null,
];
const EN_TETE_COMMUN = ["Étudiant", "Courriel", "Session", "Gâchée", "Date de gâchée", "Catégorie", "Formulation", "Cw (%)", "W/C", "Bw (%)", "w (%)"];

export const EN_TETES_EPROUVETTES = [
  ...EN_TETE_COMMUN, "Éprouvette", "Coulée le", "Âge cible (j)", "Échéance", "Statut", "Date d'essai", "Âge réel (j)",
  "Charge (kN)", "Diamètre (mm)", "Hauteur (mm)", "UCS (kPa)", "Valide", "Exclue", "Justification", "Mode de rupture",
  "Module de Young (kPa)", "Déformation max (%)", "Fichier de presse",
];

/** Une ligne par éprouvette (en-tête compris). */
export function lignesCsvEprouvettes(etudiants: EtudiantClasse[], sessions: Session[]): CelluleCsv[][] {
  const lignes: CelluleCsv[][] = [EN_TETES_EPROUVETTES];
  for (const c of parcourir(etudiants, sessions)) {
    const eps = [...c.g.eprouvettes].sort((a, b) => a.code.localeCompare(b.code));
    for (const ep of eps) {
      const es = ep.essai;
      lignes.push([
        ...tete(c), ep.code, fmtDate(dateCoulee(ep)), ep.ageJours, fmtDate(dateEcheance(ep)),
        ep.statut === "ecrase" ? "écrasée" : "en cure", jour(es?.date), ep.statut === "ecrase" ? ageReelJours(ep) : null,
        es?.chargeKn ?? null, es?.diametreMm ?? null, es?.hauteurMm ?? null, contrainteKpa(es),
        essaiValide(ep) ? "oui" : "non", es?.exclu ? "oui" : "non", es?.justificationExclusion ?? "", es?.modeRupture ?? "",
        es?.moduleYoungKpa ?? null, es?.deformationMaxPct ?? null, es?.sourcePresse?.fichier ?? "",
      ]);
    }
  }
  return securiserCsv(lignes);
}

export const EN_TETES_SYNTHESE = [
  ...EN_TETE_COMMUN, "Âge (j)", "n", "Exclues", "UCS moyenne (kPa)", "Écart-type (kPa)", "CV (%)", "Pesées hors tolérance",
];

/** Une ligne par gâchée et par âge mesuré (une ligne sans âge si rien n'est mesuré). */
export function lignesCsvSynthese(etudiants: EtudiantClasse[], sessions: Session[]): CelluleCsv[][] {
  const lignes: CelluleCsv[][] = [EN_TETES_SYNTHESE];
  for (const c of parcourir(etudiants, sessions)) {
    // Pesées : inconnues (cellule vide) si la gâchée n'en porte aucune.
    const hors = c.g.composants.length === 0 ? null : c.g.composants.filter((x) => horsTolerance(x, c.g.tolerancePct)).length;
    const ages = agregerParAge(c.g.eprouvettes);
    if (ages.length === 0) {
      lignes.push([...tete(c), null, 0, 0, null, null, null, hors]);
      continue;
    }
    for (const a of ages) {
      lignes.push([...tete(c), a.ageJours, a.n, a.nExclus, arrondi(a.moyenneKpa, 1), arrondi(a.ecartTypeKpa, 1), arrondi(a.cvPct, 1), hors]);
    }
  }
  return securiserCsv(lignes);
}
