// frontend/src/lib/moules.ts
// Moules enregistrés (2026-10-26, demande de l'utilisateur : « pour ne pas
// avoir à tout le temps taper » les dimensions). Module PUR : modèle, noms,
// comparaison, fusion à la restauration. La persistance est dans store.tsx
// (clé minebackfill_moules, enveloppe {v, data}).
//
// Portée : PERSONNELS SUR CET APPAREIL. Les moules vivent dans le navigateur,
// partagés entre les comptes qui l'utilisent, comme les matériaux personnels ;
// seuls les calculs et les gâchées suivent le compte (sync-bascule.ts). Ils
// ne sont pas synchronisés en ligne ; la sauvegarde (backup.ts) les garde.
//
// Un moule n'est jamais référencé par son id : l'appliquer COPIE ses
// dimensions dans `general` (puis dans chaque calcul sauvegardé) et dans les
// éprouvettes. Retirer un moule ne change donc aucun calcul ni éprouvette.

import type { GeneralInfo } from "./store";
import { MOULES_PROPOSES, mouleDepuisContenant, type MouleCylindre } from "./eprouvette";

export type GeometrieMoule = Pick<GeneralInfo,
  "container_type" | "container_section" | "container_height" | "container_radius" | "container_length" | "container_width" | "container_volume_m3">;

export interface MouleEnregistre {
  id: string;
  nom: string;
  geometrie: GeometrieMoule;
}

/** Champs de dimension utiles à chaque géométrie (unités du store : cm, cm², m³). */
const CHAMPS: Record<NonNullable<GeometrieMoule["container_type"]>, (keyof GeometrieMoule)[]> = {
  section_hauteur: ["container_section", "container_height"],
  rayon_hauteur: ["container_radius", "container_height"],
  longueur_largeur_hauteur: ["container_length", "container_width", "container_height"],
  volume: ["container_volume_m3"],
};
const TOUS_LES_CHAMPS: (keyof GeometrieMoule)[] = [
  "container_section", "container_height", "container_radius", "container_length", "container_width", "container_volume_m3",
];

const positif = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;

/** Géométrie complète du moule de `general` (type et ses seules dimensions), ou null si elle est incomplète. */
export function geometrieDe(general: GeometrieMoule | undefined | null): GeometrieMoule | null {
  const type = general?.container_type;
  if (!general || !type || !CHAMPS[type]) return null;
  const g: GeometrieMoule = { container_type: type };
  for (const c of CHAMPS[type]) {
    const v = general[c];
    if (!positif(v)) return null;
    (g as Record<string, unknown>)[c] = v;
  }
  return g;
}

/** Mêmes dimensions (à un millionième près) : le moule choisi est celui affiché. */
export function memeGeometrie(a: GeometrieMoule | null, b: GeometrieMoule | null): boolean {
  if (!a || !b || a.container_type !== b.container_type || !a.container_type) return false;
  return CHAMPS[a.container_type].every((c) => Math.abs((a[c] as number) - (b[c] as number)) <= 1e-6 * Math.max(1, Math.abs(a[c] as number)));
}

/** Champs à écrire dans `general` pour appliquer un moule : ses dimensions, les autres vidées. */
export function patchMoule(m: MouleEnregistre): Partial<GeneralInfo> {
  const p: Partial<GeneralInfo> = { container_type: m.geometrie.container_type };
  for (const c of TOUS_LES_CHAMPS) (p as Record<string, unknown>)[c] = m.geometrie[c] ?? undefined;
  return p;
}

const nb = (x: number, dec = 2) => x.toLocaleString("fr-CA", { maximumFractionDigits: dec });

/** Nom proposé à l'enregistrement : « Cylindre 76,2 × 152,4 mm », « Prisme 10 × 10 × 20 cm »… */
export function nomPropose(g: GeometrieMoule): string {
  const c = mouleDepuisContenant(g);
  if (c) return `Cylindre ${nb(c.diametreMm)} × ${nb(c.hauteurMm)} mm`;
  switch (g.container_type) {
    case "section_hauteur": return `Section ${nb(g.container_section as number)} cm² × ${nb(g.container_height as number)} cm`;
    case "longueur_largeur_hauteur": return `Prisme ${nb(g.container_length as number)} × ${nb(g.container_width as number)} × ${nb(g.container_height as number)} cm`;
    case "volume": return `Volume ${nb((g.container_volume_m3 as number) * 1000, 3)} L`;
    default: return "Moule";
  }
}

/** Les trois cylindres usuels du laboratoire (MOULES_PROPOSES), proposés d'office. */
export function moulesUsuels(): MouleEnregistre[] {
  return MOULES_PROPOSES.map((m, i) => ({
    id: `usuel-${i}`,
    nom: m.libelle,
    geometrie: { container_type: "rayon_hauteur", container_radius: m.diametreMm / 20, container_height: m.hauteurMm / 10 },
  }));
}

/** Cylindre (mm) d'un moule enregistré, pour le choix du moule au Labo ; undefined si ce n'est pas un cylindre. */
export function cylindreDe(m: MouleEnregistre): MouleCylindre | undefined {
  return mouleDepuisContenant(m.geometrie);
}

/** Moules lus du stockage ou d'une sauvegarde : seuls les éléments bien formés sont gardés. */
export function moulesValides(x: unknown): MouleEnregistre[] {
  if (!Array.isArray(x)) return [];
  return x.filter((m): m is MouleEnregistre =>
    !!m && typeof m === "object" && typeof (m as MouleEnregistre).id === "string" && typeof (m as MouleEnregistre).nom === "string"
    && geometrieDe((m as MouleEnregistre).geometrie) !== null);
}

/**
 * Restauration d'une sauvegarde : fusion par identifiant, l'entrée LOCALE
 * gagne (un moule renommé ici n'est pas écrasé par une sauvegarde plus
 * ancienne), les moules du fichier absents ici s'ajoutent.
 */
export function fusionnerMoules(locaux: MouleEnregistre[], importes: unknown): { moules: MouleEnregistre[]; ajoutes: number } {
  const ids = new Set(locaux.map((m) => m.id));
  const nouveaux = moulesValides(importes).filter((m) => !ids.has(m.id));
  return { moules: [...locaux, ...nouveaux], ajoutes: nouveaux.length };
}
