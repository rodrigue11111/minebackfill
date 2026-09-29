// frontend/src/lib/classe-alertes.ts
// « À surveiller » : ce que l'enseignant voudrait repérer dans le travail de
// la classe sans tout ouvrir. Module PUR, `maintenant` injecté.
//
// Ces seuils sont des HEURISTIQUES de contrôle qualité, pas des formules du
// cours : ils sont affichés à l'écran comme « valeurs par défaut, à valider
// par l'enseignant », et se changent ici, en un seul endroit.

import { agregerParAge, ageReelJours, contrainteKpa, dateEcheance, joursRestants } from "./eprouvette";
import { ecart, horsTolerance } from "./gachee";
import { gacheesRetenues, type EtudiantClasse } from "./classe";
import { libelleGroupe, type Comparaison } from "./classe-comparaison";
import { fmtDate } from "./echeance-affichage";

export const SEUILS_ALERTES = {
  /** Âge à l'essai : écart toléré = max(fenetreAgeJoursMin, fenetreAgePct % de l'âge visé). */
  fenetreAgeJoursMin: 1,
  fenetreAgePct: 10,
  /** Répliques d'une même gâchée à un âge : CV au-delà duquel on alerte, avec au moins cvNMin valeurs. */
  cvMaxPct: 15,
  cvNMin: 2,
  /** Écart à la médiane des gâchées de la même formulation (%). */
  ecartMedianePct: 30,
  groupeMinGachees: 3,
  groupeMinEtudiants: 2,
  /** Jours sans activité en ligne (session active seulement). */
  inactiviteJours: 21,
  /** « Marquer écrasée » pose la date avant la saisie de la charge : délai de grâce. */
  delaiMesureJours: 1,
};
export type SeuilsAlertes = typeof SEUILS_ALERTES;

export type TypeAlerte =
  | "echeance_depassee" | "pesee_hors_tolerance" | "age_hors_fenetre" | "cv_eleve"
  | "ecart_groupe" | "ecrasee_sans_mesure" | "inactif";

export const LIBELLES_ALERTES: Record<TypeAlerte, string> = {
  echeance_depassee: "Écrasement en retard",
  pesee_hors_tolerance: "Pesée hors tolérance",
  age_hors_fenetre: "Âge à l'essai hors fenêtre",
  cv_eleve: "Répliques dispersées",
  ecart_groupe: "Loin des autres gâchées de la formulation",
  ecrasee_sans_mesure: "Écrasée sans mesure",
  inactif: "Pas d'activité en ligne",
};
const ORDRE: TypeAlerte[] = Object.keys(LIBELLES_ALERTES) as TypeAlerte[];

export interface Alerte {
  cle: string;
  type: TypeAlerte;
  etudiantId: string;
  etudiant: string;
  /** Gâchée à ouvrir, null pour une alerte sur l'étudiant (inactivité). */
  cible: { kind: "gachee"; id: string; code: string } | null;
  message: string;
}

const MS_JOUR = 86_400_000;
const n0 = (v: number) => v.toLocaleString("fr-CA", { maximumFractionDigits: 0 });
const n1 = (v: number) => v.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
const signe = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n1(Math.abs(v))}`;

function jourLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function alertesClasse(etudiants: EtudiantClasse[], o: {
  maintenant: Date;
  comparaison: Comparaison;
  /** Le filtre affiche la session en cours (l'inactivité n'a de sens que là). */
  sessionActiveAffichee: boolean;
  /** Premier jour de la session active (AAAA-MM-JJ), pour ne pas signaler trop tôt « aucun document ». */
  debutSessionActive?: string | null;
  seuils?: SeuilsAlertes;
}): Alerte[] {
  const s = o.seuils ?? SEUILS_ALERTES;
  const r: Alerte[] = [];
  const ajouter = (a: Omit<Alerte, "cle">, suffixe: string) =>
    r.push({ ...a, cle: `${a.type}:${a.etudiantId}:${a.cible?.id ?? "-"}:${suffixe}` });

  for (const e of etudiants) {
    const base = { etudiantId: e.id, etudiant: e.nom };
    for (const g of gacheesRetenues(e)) {
      const cible = { kind: "gachee" as const, id: g.id, code: g.code };

      const retard = g.eprouvettes.filter((ep) => ep.statut !== "ecrase" && joursRestants(ep, o.maintenant) < 0)
        .sort((a, b) => dateEcheance(a).getTime() - dateEcheance(b).getTime());
      if (retard.length > 0) {
        const j = -joursRestants(retard[0], o.maintenant);
        ajouter({ ...base, cible, type: "echeance_depassee",
          message: `${retard.length} éprouvette${retard.length > 1 ? "s" : ""} non écrasée${retard.length > 1 ? "s" : ""} après l'échéance (${retard.map((x) => x.code).join(", ")}) ; la plus ancienne était prévue le ${fmtDate(dateEcheance(retard[0]))} (${j} j de retard).` }, "");
      }

      const hors = g.composants.filter((c) => horsTolerance(c, g.tolerancePct));
      if (hors.length > 0) {
        ajouter({ ...base, cible, type: "pesee_hors_tolerance",
          message: `${hors.map((c) => `${c.label} ${signe(ecart(c)!.pct)} %`).join(", ")} (tolérance ± ${n1(g.tolerancePct)} %).` }, "");
      }

      const horsFenetre = g.eprouvettes.flatMap((ep) => {
        if (ep.statut !== "ecrase") return [];
        const reel = ageReelJours(ep);
        if (reel === null) return [];
        const tol = Math.max(s.fenetreAgeJoursMin, (s.fenetreAgePct / 100) * ep.ageJours);
        return Math.abs(reel - ep.ageJours) > tol ? [{ ep, reel, tol }] : [];
      });
      if (horsFenetre.length > 0) {
        ajouter({ ...base, cible, type: "age_hors_fenetre",
          message: horsFenetre.map(({ ep, reel, tol }) => `${ep.code} écrasée à ${n0(reel)} j pour ${n0(ep.ageJours)} j visés (± ${n1(tol)} j)`).join(" ; ") + "." }, "");
      }

      for (const a of agregerParAge(g.eprouvettes)) {
        if (a.n >= s.cvNMin && a.cvPct !== null && a.cvPct > s.cvMaxPct) {
          ajouter({ ...base, cible, type: "cv_eleve",
            message: `${a.ageJours} j : CV ${n1(a.cvPct)} % entre ${a.n} répliques (seuil ${n0(s.cvMaxPct)} %).` }, String(a.ageJours));
        }
      }

      const sansMesure = g.eprouvettes.filter((ep) => {
        if (ep.statut !== "ecrase" || ep.essai?.exclu || contrainteKpa(ep.essai) !== null) return false;
        const t = ep.essai?.date ? new Date(ep.essai.date).getTime() : NaN;
        return Number.isNaN(t) || o.maintenant.getTime() - t > s.delaiMesureJours * MS_JOUR;
      });
      if (sansMesure.length > 0) {
        ajouter({ ...base, cible, type: "ecrasee_sans_mesure",
          message: `${sansMesure.map((x) => x.code).join(", ")} marquée${sansMesure.length > 1 ? "s" : ""} écrasée${sansMesure.length > 1 ? "s" : ""} sans charge ni contrainte saisie.` }, "");
      }
    }

    if (o.sessionActiveAffichee) {
      if (e.derniereActivite) {
        const j = Math.floor((jourLocal(o.maintenant) - jourLocal(new Date(e.derniereActivite))) / MS_JOUR);
        if (j >= s.inactiviteJours) {
          ajouter({ ...base, cible: null, type: "inactif", message: `Aucune activité en ligne depuis ${j} j (dernière le ${fmtDate(new Date(e.derniereActivite))}).` }, "");
        }
      } else if (o.debutSessionActive) {
        const debut = new Date(`${o.debutSessionActive}T12:00:00`);
        const j = Math.floor((jourLocal(o.maintenant) - jourLocal(debut)) / MS_JOUR);
        if (j >= s.inactiviteJours) {
          ajouter({ ...base, cible: null, type: "inactif", message: `Aucun document en ligne depuis le début de la session (${j} j).` }, "");
        }
      }
    }
  }

  // Loin des autres gâchées de la même formulation, au même âge.
  const nomDe = new Map(etudiants.map((e) => [e.id, e.nom]));
  for (const groupe of o.comparaison.groupes) {
    for (const bloc of groupe.parAge) {
      if (!bloc.repere || bloc.lignes.length < s.groupeMinGachees) continue;
      if (new Set(bloc.lignes.map((l) => l.etudiantId)).size < s.groupeMinEtudiants) continue;
      for (const l of bloc.lignes) {
        if (l.ecartMedianePct === null || Math.abs(l.ecartMedianePct) <= s.ecartMedianePct) continue;
        ajouter({
          etudiantId: l.etudiantId, etudiant: nomDe.get(l.etudiantId) ?? l.etudiant, type: "ecart_groupe",
          cible: { kind: "gachee", id: l.gacheeId, code: l.gacheeCode },
          // Pas la valeur de la médiane : ce message va aussi dans le rapport PDF,
          // où elle serait citée comme « l'UCS de la formulation ».
          message: `${bloc.ageJours} j : ${n0(l.moyenneKpa)} kPa, ${n0(Math.abs(l.ecartMedianePct))} % ${l.ecartMedianePct < 0 ? "sous" : "au-dessus de"} la médiane des ${bloc.repere.nGachees} gâchées ${libelleGroupe(groupe)}.`,
        }, String(bloc.ageJours));
      }
    }
  }

  return r.sort((a, b) => a.etudiant.localeCompare(b.etudiant, "fr") || a.etudiantId.localeCompare(b.etudiantId)
    || ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type) || (a.cible?.code ?? "").localeCompare(b.cible?.code ?? ""));
}

/** Les seuils en clair, pour l'écran et le rapport. */
export function libellesSeuils(s: SeuilsAlertes = SEUILS_ALERTES): string[] {
  return [
    "Écrasement en retard : éprouvette encore en cure après son échéance.",
    "Pesée : écart au-delà de la tolérance fixée sur la gâchée.",
    `Âge à l'essai : écart à l'âge visé supérieur à ${n0(s.fenetreAgeJoursMin)} j ou à ${n0(s.fenetreAgePct)} % de cet âge (le plus grand des deux).`,
    `Répliques : CV supérieur à ${n0(s.cvMaxPct)} % (au moins ${s.cvNMin} valeurs retenues).`,
    `Formulation : UCS à plus de ${n0(s.ecartMedianePct)} % de la médiane des gâchées de même formulation (au moins ${s.groupeMinGachees} gâchées de ${s.groupeMinEtudiants} étudiants).`,
    `Écrasée sans mesure : plus de ${n0(s.delaiMesureJours * 24)} h après l'écrasement.`,
    `Inactivité : aucune activité en ligne depuis ${s.inactiviteJours} j (session en cours seulement).`,
  ];
}
