// frontend/src/lib/classe-csv.ts
// Export CSV de la classe (Excel en français : « ; » et virgule décimale, via
// versCsv/celluleCsv). Module PUR. Deux tableaux « à plat », prêts pour un
// tableau croisé dynamique — donc SANS lignes de commentaire en tête :
//   - éprouvettes : une ligne par éprouvette, valeurs MESURÉES ;
//   - synthèse : une ligne par gâchée et par âge (agregerParAge, la moyenne
//     des essais retenus d'UNE gâchée — jamais de moyenne entre gâchées).
// Copies de conflit exclues (elles répètent les éprouvettes de l'original).

import { agregerParAge, ageReelJours, contrainteKpa, dateCoulee, dateEcheance, libelleMoule, libelleRupture } from "./eprouvette";
import { MODES_CURE, TYPES_EAU, horsTolerance, parametresEffectifs } from "./gachee";
import { completudeGachee } from "./completude";
import { LIBELLE_DECISION, type InfoRevue } from "./revues";
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
// Fiche d'essai de la gâchée (colonnes AJOUTÉES À LA FIN des deux tableaux :
// les classeurs déjà montés par l'enseignant gardent leurs références).
const ficheGachee = (g: Contexte["g"]): CelluleCsv[] => {
  const m = g.materiaux;
  const liants = (m?.liants ?? [])
    .map((l) => `${l.nom ?? l.code ?? "Liant"}${l.fractionPct != null ? ` ${l.fractionPct.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} %` : ""}`)
    .join(", ");
  return [
    m?.residu?.nom ?? "", liants, TYPES_EAU.find((t) => t.valeur === m?.eau?.type)?.libelle ?? "",
    m?.adjuvant?.nom ?? "", m?.adjuvant?.dosage ?? null, m?.adjuvant?.dosage != null ? m.adjuvant.dosageUnite ?? "" : "",
    g.malaxageDureeMin ?? null, MODES_CURE.find((c) => c.valeur === g.cure?.mode)?.libelle ?? "",
    g.cure?.temperatureC ?? null, g.cure?.humiditePct ?? null,
  ];
};
const EN_TETE_FICHE = [
  "Résidu", "Liants", "Eau de gâchage", "Adjuvant", "Dosage d'adjuvant", "Unité du dosage", "Durée de malaxage (min)",
  "Mode de cure", "Température de cure (°C)", "Humidité de cure (%)",
];

/** Revue de l'enseignant (colonnes ajoutées à la fin, après la fiche). */
export type RevueDe = (ownerId: string, gacheeId: string) => InfoRevue | undefined;
const EN_TETE_REVUE = ["Revue", "Motif de la revue", "Modifiée depuis la revue"];
const revueGachee = (r: InfoRevue | undefined): CelluleCsv[] =>
  r ? [LIBELLE_DECISION[r.decision], r.motif ?? "", r.perimee ? "oui" : "non"] : ["", "", ""];

const EN_TETE_COMMUN = ["Étudiant", "Courriel", "Session", "Gâchée", "Date de gâchée", "Catégorie", "Formulation", "Cw (%)", "E/L", "Bw (%)", "w (%)"];

export const EN_TETES_EPROUVETTES = [
  ...EN_TETE_COMMUN, "Éprouvette", "Coulée le", "Âge cible (j)", "Échéance", "Statut", "Date d'essai", "Âge réel (j)",
  "Charge (kN)", "Diamètre (mm)", "Hauteur (mm)", "UCS (kPa)", "Valide", "Exclue", "Justification", "Mode de rupture",
  "Module de Young (kPa)", "Déformation max (%)", "Fichier de presse",
  ...EN_TETE_FICHE, "Moule", "Diamètre du moule (mm)", "Hauteur du moule (mm)", "Masse (g)", "Vitesse de chargement",
  "Unité de vitesse", "Presse", "Code de rupture", "Déflexion max (mm)", "Complétude de la fiche (%)",
  ...EN_TETE_REVUE, "Écartée par l'enseignant",
];

/** Une ligne par éprouvette (en-tête compris). */
export function lignesCsvEprouvettes(etudiants: EtudiantClasse[], sessions: Session[], revueDe?: RevueDe): CelluleCsv[][] {
  const lignes: CelluleCsv[][] = [EN_TETES_EPROUVETTES];
  for (const c of parcourir(etudiants, sessions)) {
    const fiche = ficheGachee(c.g);
    const completude = completudeGachee(c.g).pct;
    const revue = revueDe?.(c.e.id, c.g.id);
    const eps = [...c.g.eprouvettes].sort((a, b) => a.code.localeCompare(b.code));
    for (const ep of eps) {
      const es = ep.essai;
      lignes.push([
        ...tete(c), ep.code, fmtDate(dateCoulee(ep)), ep.ageJours, fmtDate(dateEcheance(ep)),
        ep.statut === "ecrase" ? "écrasée" : "en cure", jour(es?.date), ep.statut === "ecrase" ? ageReelJours(ep) : null,
        es?.chargeKn ?? null, es?.diametreMm ?? null, es?.hauteurMm ?? null, contrainteKpa(es),
        essaiValide(ep) ? "oui" : "non", es?.exclu ? "oui" : "non", es?.justificationExclusion ?? "", libelleRupture(es),
        es?.moduleYoungKpa ?? null, es?.deformationMaxPct ?? null, es?.sourcePresse?.fichier ?? "",
        ...fiche, libelleMoule(ep), ep.mouleDiametreMm ?? null, ep.mouleHauteurMm ?? null, es?.masseG ?? null,
        es?.vitesseChargement?.valeur ?? null, es?.vitesseChargement?.unite ?? "", es?.presse ?? "",
        es?.modeRuptureCode ?? "", es?.deflexionMaxMm ?? null, completude,
        ...revueGachee(revue), revue ? (revue.ecartees.includes(ep.id) ? "oui" : "non") : "",
      ]);
    }
  }
  return securiserCsv(lignes);
}

export const EN_TETES_SYNTHESE = [
  ...EN_TETE_COMMUN, "Âge (j)", "n", "Exclues", "UCS moyenne (kPa)", "Écart-type (kPa)", "CV (%)", "Pesées hors tolérance",
  ...EN_TETE_FICHE, "Complétude de la fiche (%)", ...EN_TETE_REVUE,
];

/** Une ligne par gâchée et par âge mesuré (une ligne sans âge si rien n'est mesuré). */
export function lignesCsvSynthese(etudiants: EtudiantClasse[], sessions: Session[], revueDe?: RevueDe): CelluleCsv[][] {
  const lignes: CelluleCsv[][] = [EN_TETES_SYNTHESE];
  for (const c of parcourir(etudiants, sessions)) {
    // Pesées : inconnues (cellule vide) si la gâchée n'en porte aucune.
    const hors = c.g.composants.length === 0 ? null : c.g.composants.filter((x) => horsTolerance(x, c.g.tolerancePct)).length;
    const fin = [...ficheGachee(c.g), completudeGachee(c.g).pct, ...revueGachee(revueDe?.(c.e.id, c.g.id))];
    const ages = agregerParAge(c.g.eprouvettes);
    if (ages.length === 0) {
      lignes.push([...tete(c), null, 0, 0, null, null, null, hors, ...fin]);
      continue;
    }
    for (const a of ages) {
      lignes.push([...tete(c), a.ageJours, a.n, a.nExclus, arrondi(a.moyenneKpa, 1), arrondi(a.ecartTypeKpa, 1), arrondi(a.cvPct, 1), hors, ...fin]);
    }
  }
  return securiserCsv(lignes);
}
