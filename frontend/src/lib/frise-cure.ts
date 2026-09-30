// frontend/src/lib/frise-cure.ts
// Frise de cure d'une gâchée (Labo, maquette A améliorée) : de la coulée à la
// dernière échéance, un jalon par âge de cure, et la position d'aujourd'hui.
// Échelle en RACINE CARRÉE du temps : 7 j et 14 j restent lisibles à côté de
// 91 j (sur une échelle linéaire, ils se collent au départ). Module pur.

import { classeEcheance, dateCoulee, dateEcheance, type Eprouvette } from "./eprouvette";

const MS_JOUR = 86_400_000;
const jourLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const joursEntre = (a: Date, b: Date) => Math.round((jourLocal(b).getTime() - jourLocal(a).getTime()) / MS_JOUR);

export type EtatJalon = "fait" | "retard" | "aujourdhui" | "a_venir";

export interface JalonCure {
  ageJours: number;
  /** Échéance la plus proche parmi les éprouvettes de cet âge. */
  date: Date;
  /** Position sur la frise, de 0 (coulée) à 1 (dernière échéance). */
  position: number;
  nbEprouvettes: number;
  nbEcrasees: number;
  etat: EtatJalon;
}

export interface FriseCure {
  coulee: Date;
  /** Jours écoulés depuis la coulée (0 le jour même ; peut dépasser la durée). */
  jour: number;
  dureeJours: number;
  jalons: JalonCure[];
  /** Position d'aujourd'hui sur la frise, bornée à [0, 1]. */
  positionAujourdhui: number;
  /** Jours avant le prochain écrasement (0 = aujourd'hui) ; négatif = en retard ; null = tout est écrasé. */
  prochainDans: number | null;
}

/** Position d'un âge sur la frise (échelle en racine carrée). */
export function positionFrise(ageJours: number, dureeJours: number): number {
  if (dureeJours <= 0) return 0;
  return Math.min(1, Math.max(0, Math.sqrt(Math.max(0, ageJours)) / Math.sqrt(dureeJours)));
}

export function friseCure(eprouvettes: Eprouvette[], maintenant: Date): FriseCure | null {
  if (eprouvettes.length === 0) return null;
  const coulee = eprouvettes.map(dateCoulee).reduce((a, b) => (b < a ? b : a));
  const ages = [...new Set(eprouvettes.map((e) => Math.round(e.ageJours)))].sort((a, b) => a - b);
  const dureeJours = Math.max(1, ...eprouvettes.map((e) => joursEntre(coulee, dateEcheance(e))));
  const jour = joursEntre(coulee, maintenant);

  const jalons: JalonCure[] = ages.map((age) => {
    const groupe = eprouvettes.filter((e) => Math.round(e.ageJours) === age);
    const date = groupe.map(dateEcheance).reduce((a, b) => (b < a ? b : a));
    const nbEcrasees = groupe.filter((e) => e.statut === "ecrase").length;
    const classes = groupe.filter((e) => e.statut !== "ecrase").map((e) => classeEcheance(e, maintenant));
    const etat: EtatJalon = nbEcrasees === groupe.length ? "fait"
      : classes.includes("retard") ? "retard"
      : classes.includes("aujourdhui") ? "aujourdhui"
      : "a_venir";
    return { ageJours: age, date, position: positionFrise(joursEntre(coulee, date), dureeJours), nbEprouvettes: groupe.length, nbEcrasees, etat };
  });

  const enCure = eprouvettes.filter((e) => e.statut !== "ecrase");
  const prochainDans = enCure.length === 0
    ? null
    : Math.min(...enCure.map((e) => joursEntre(maintenant, dateEcheance(e))));

  return { coulee, jour, dureeJours, jalons, positionAujourdhui: positionFrise(jour, dureeJours), prochainDans };
}

/** Résumé d'une ligne : « Jour 8 sur 28 · prochain écrasement dans 20 jours ». */
export function resumeFrise(f: FriseCure): string {
  const jour = `Jour ${Math.max(0, f.jour)} sur ${f.dureeJours}`;
  if (f.prochainDans === null) return `${jour} · toutes les éprouvettes sont écrasées`;
  if (f.prochainDans < 0) return `${jour} · écrasement en retard de ${-f.prochainDans} jour${-f.prochainDans > 1 ? "s" : ""}`;
  if (f.prochainDans === 0) return `${jour} · écrasement aujourd'hui`;
  return `${jour} · prochain écrasement dans ${f.prochainDans} jour${f.prochainDans > 1 ? "s" : ""}`;
}
