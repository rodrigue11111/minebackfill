// frontend/src/lib/completude.ts
// Complétude de la fiche d'essai d'une gâchée. Module PUR, testé.
//
// RIEN N'EST OBLIGATOIRE : un étudiant qui n'a pas l'information continue sa
// gâchée. L'indicateur dit seulement ce qui rendrait l'essai réutilisable plus
// tard (base de données des essais). Un point « sans objet » (pas encore
// d'éprouvette écrasée, par exemple) ne compte pas contre l'étudiant.
//
// La liste est une proposition à valider par le professeur : pour la modifier,
// c'est ici, et le test completude.test.ts dit ce qu'elle doit couvrir.

import type { Gachee } from "./gachee";

export type EtatItem = "ok" | "manque" | "sans_objet";
export type GroupeCompletude = "materiaux" | "gachee" | "cure" | "eprouvettes" | "essais";

export interface ItemCompletude {
  cle: string;
  groupe: GroupeCompletude;
  libelle: string;
  etat: EtatItem;
}

export interface Completude {
  items: ItemCompletude[];
  renseignes: number;
  /** Points applicables (hors « sans objet »). */
  total: number;
  /** Pourcentage arrondi ; 100 quand aucun point n'est applicable. */
  pct: number;
  manquants: ItemCompletude[];
}

export const LIBELLES_GROUPES: Record<GroupeCompletude, string> = {
  materiaux: "Matériaux",
  gachee: "Gâchée",
  cure: "Cure",
  eprouvettes: "Éprouvettes",
  essais: "Essais",
};

const texte = (v: string | undefined | null) => typeof v === "string" && v.trim().length > 0;
const nombre = (v: number | undefined | null) => typeof v === "number" && Number.isFinite(v);

export function completudeGachee(g: Gachee): Completude {
  const composants = g.composants ?? [];
  const eprouvettes = g.eprouvettes ?? [];
  const ecrasees = eprouvettes.filter((e) => e.statut === "ecrase");
  const parAge = new Map<number, number>();
  for (const e of eprouvettes) parAge.set(e.ageJours, (parAge.get(e.ageJours) ?? 0) + 1);

  const item = (cle: string, groupe: GroupeCompletude, libelle: string, etat: EtatItem | boolean): ItemCompletude =>
    ({ cle, groupe, libelle, etat: typeof etat === "boolean" ? (etat ? "ok" : "manque") : etat });
  const siApplicable = (applicable: boolean, ok: boolean): EtatItem => (!applicable ? "sans_objet" : ok ? "ok" : "manque");

  const items: ItemCompletude[] = [
    item("residu", "materiaux", "Résidu identifié", texte(g.materiaux?.residu?.nom) || texte(g.lotResidu)),
    item("lot_liant", "materiaux", "Lot de liant", texte(g.lotLiant)),
    item("eau", "materiaux", "Type d'eau", !!g.materiaux?.eau?.type),
    item("pesees", "gachee", "Pesées réelles complètes",
      siApplicable(composants.length > 0, composants.every((c) => nombre(c.peseeKg)))),
    item("w0", "gachee", "w₀ mesuré", nombre(g.w0MesurePct)),
    item("affaissement", "gachee", "Affaissement mesuré", nombre(g.slumpMesureMm)),
    item("malaxage", "gachee", "Durée de malaxage", nombre(g.malaxageDureeMin)),
    item("cure_mode", "cure", "Mode de cure", !!g.cure?.mode),
    item("cure_temperature", "cure", "Température de cure", nombre(g.cure?.temperatureC)),
    item("moules", "eprouvettes", "Géométrie des moules",
      siApplicable(eprouvettes.length > 0, eprouvettes.every((e) => nombre(e.mouleDiametreMm) || texte(e.moule)))),
    item("replicats", "eprouvettes", "Au moins deux réplicats par âge visé",
      siApplicable(eprouvettes.length > 0, [...parAge.values()].every((n) => n >= 2))),
    item("essais", "essais", "Essais documentés (date, vitesse, mode de rupture)",
      siApplicable(ecrasees.length > 0, ecrasees.every((e) =>
        texte(e.essai?.date) && nombre(e.essai?.vitesseChargement?.valeur) && (!!e.essai?.modeRuptureCode || texte(e.essai?.modeRupture))))),
  ];

  const applicables = items.filter((i) => i.etat !== "sans_objet");
  const renseignes = applicables.filter((i) => i.etat === "ok").length;
  const total = applicables.length;
  return {
    items,
    renseignes,
    total,
    pct: total === 0 ? 100 : Math.round((renseignes / total) * 100),
    manquants: applicables.filter((i) => i.etat === "manque"),
  };
}

/** « type d'eau, mode de cure et température de cure » (libellés en minuscule initiale). */
export function listeManquants(c: Completude, max = 4): string {
  const noms = c.manquants.map((i) => i.libelle.charAt(0).toLowerCase() + i.libelle.slice(1));
  if (noms.length === 0) return "";
  const vus = noms.slice(0, max);
  const reste = noms.length - vus.length;
  if (reste > 0) return `${vus.join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
  return vus.length > 1 ? `${vus.slice(0, -1).join(", ")} et ${vus[vus.length - 1]}` : vus[0];
}
