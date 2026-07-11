// frontend/src/lib/materials.ts
// Bibliothèque de matériaux (résidus, granulats, retardateurs), symétrique au
// catalogue de liants. Chaque matériau a un identifiant STABLE (clé de
// jointure fiable, contrairement au « code » renommable) et une `origine` :
// « officiel » (référence verrouillée, ex. fournie par le professeur) ou
// « perso » (ajoutée par l'utilisateur, modifiable/supprimable).

export type MaterialOrigine = "officiel" | "perso";

export type MaterialKind = "residus" | "granulats" | "retardateurs";

export interface ResiduItem {
  id: string;
  nom: string;
  gs: number;          // densité relative des grains
  w0_pct: number;      // teneur en eau initiale (%)
  provenance?: string; // site / mine
  notes?: string;
  origine: MaterialOrigine;
}

export interface GranulatItem {
  id: string;
  nom: string;
  gs: number;
  humidite_pct: number;
  fraction_defaut_pct?: number; // Xg par défaut suggéré
  provenance?: string;
  origine: MaterialOrigine;
}

export interface RetardateurItem {
  id: string;
  nom: string;
  densite_g_ml: number;          // g/ml
  dosage_d0_ml_100kg?: number;   // ml / 100 kg de ciment
  origine: MaterialOrigine;
}

export type MaterialItem = ResiduItem | GranulatItem | RetardateurItem;

/* ── Catalogues officiels par défaut (alignés sur le jeu de démonstration) ── */

export const residusDefaut: ResiduItem[] = [
  { id: "res_casa_berardi", nom: "Résidus Casa Berardi", gs: 3.05, w0_pct: 31.5789, provenance: "Casa Berardi", origine: "officiel" },
  { id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25.0, provenance: "LaRonde", origine: "officiel" },
];

export const granulatsDefaut: GranulatItem[] = [
  { id: "gra_laronde", nom: "Concassé LaRonde", gs: 2.8, humidite_pct: 0, fraction_defaut_pct: 30, provenance: "LaRonde", origine: "officiel" },
];

export const retardateursDefaut: RetardateurItem[] = [
  { id: "ret_standard", nom: "Retardateur standard", densite_g_ml: 1.2, dosage_d0_ml_100kg: 100, origine: "officiel" },
];

/* ── Fabriques d'entrées « perso » neuves ── */

export function nouveauResidu(id: string): ResiduItem {
  return { id, nom: "Nouveau résidu", gs: 3.0, w0_pct: 0, origine: "perso" };
}
export function nouveauGranulat(id: string): GranulatItem {
  return { id, nom: "Nouveau granulat", gs: 2.7, humidite_pct: 0, origine: "perso" };
}
export function nouveauRetardateur(id: string): RetardateurItem {
  return { id, nom: "Nouveau retardateur", densite_g_ml: 1.2, origine: "perso" };
}

/** Vrai si l'entrée est une référence officielle verrouillée. */
export const estOfficiel = (m: { origine?: MaterialOrigine }): boolean => m.origine === "officiel";
