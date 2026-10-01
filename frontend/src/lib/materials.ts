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
  // Caractérisation (FACULTATIVE, voir CARACTERISATION_RESIDU) : décrit le
  // résidu une seule fois, ici ; le jeu d'essais la joint par l'id.
  date_echantillonnage?: string; // AAAA-MM-JJ
  d10_um?: number;
  d50_um?: number;
  d80_um?: number;
  d90_um?: number;
  p20_pct?: number;    // passant à 20 µm
  soufre_pct?: number;
  phyllosilicates_pct?: number;
  muscovite_pct?: number;
  mineralogie?: string;
}

export interface GranulatItem {
  id: string;
  nom: string;
  gs: number;
  humidite_pct: number;
  fraction_defaut_pct?: number; // Xg par défaut suggéré
  provenance?: string;
  origine: MaterialOrigine;
  // Caractérisation (FACULTATIVE, voir CARACTERISATION_GRANULAT).
  dmax_mm?: number;
  d50_mm?: number;
  absorption_pct?: number;
}

export interface RetardateurItem {
  id: string;
  nom: string;
  densite_g_ml: number;          // g/ml
  dosage_d0_ml_100kg?: number;   // ml / 100 kg de ciment
  origine: MaterialOrigine;
}

export type MaterialItem = ResiduItem | GranulatItem | RetardateurItem;

/** Un champ de caractérisation d'un matériau (Réglages, import, jeu d'essais). */
export interface ChampCaracterisation {
  cle: string;
  libelle: string;
  unite?: string;
  type: "nombre" | "texte" | "date";
  description: string;
}

/**
 * Caractérisation d'un résidu : granulométrie, chimie et minéralogie, les
 * grandeurs qu'emploient les modèles de prédiction de l'UCS (CPB Cockpit :
 * D50, D90, P20, soufre, phyllosilicates, muscovite). Toutes FACULTATIVES :
 * une valeur absente reste absente (jamais 0).
 */
export const CARACTERISATION_RESIDU: ChampCaracterisation[] = [
  { cle: "date_echantillonnage", libelle: "Date d'échantillonnage", type: "date", description: "Jour du prélèvement du résidu caractérisé." },
  { cle: "d10_um", libelle: "D10", unite: "µm", type: "nombre", description: "Diamètre sous lequel passent 10 % des grains (masse)." },
  { cle: "d50_um", libelle: "D50", unite: "µm", type: "nombre", description: "Diamètre médian des grains (50 % passant)." },
  { cle: "d80_um", libelle: "D80", unite: "µm", type: "nombre", description: "Diamètre sous lequel passent 80 % des grains." },
  { cle: "d90_um", libelle: "D90", unite: "µm", type: "nombre", description: "Diamètre sous lequel passent 90 % des grains." },
  { cle: "p20_pct", libelle: "P20 (passant à 20 µm)", unite: "%", type: "nombre", description: "Part massique des grains plus fins que 20 µm." },
  { cle: "soufre_pct", libelle: "Soufre", unite: "%", type: "nombre", description: "Teneur massique en soufre total." },
  { cle: "phyllosilicates_pct", libelle: "Phyllosilicates", unite: "%", type: "nombre", description: "Teneur massique en phyllosilicates (argiles, micas…)." },
  { cle: "muscovite_pct", libelle: "Muscovite", unite: "%", type: "nombre", description: "Teneur massique en muscovite." },
  { cle: "mineralogie", libelle: "Minéralogie", type: "texte", description: "Description libre de la minéralogie (phases principales, méthode)." },
];

/** Caractérisation d'un granulat (FACULTATIVE). */
export const CARACTERISATION_GRANULAT: ChampCaracterisation[] = [
  { cle: "dmax_mm", libelle: "Dmax", unite: "mm", type: "nombre", description: "Dimension maximale des grains du granulat." },
  { cle: "d50_mm", libelle: "D50", unite: "mm", type: "nombre", description: "Diamètre médian des grains du granulat." },
  { cle: "absorption_pct", libelle: "Absorption", unite: "%", type: "nombre", description: "Absorption d'eau du granulat (masse)." },
];

/** Nombre de champs de caractérisation renseignés (« Caractérisation : 4/10 »). */
export function completudeCaracterisation(item: object, champs: ChampCaracterisation[]): { renseignes: number; total: number } {
  const rec = item as Record<string, unknown>;
  const renseignes = champs.filter((c) => {
    const v = rec[c.cle];
    return typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "";
  }).length;
  return { renseignes, total: champs.length };
}

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
