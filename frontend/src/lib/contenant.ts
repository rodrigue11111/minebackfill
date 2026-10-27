// frontend/src/lib/contenant.ts
// Volume d'un moule (contenant) et volume total VT, affichés dès la page
// Informations. MÊME géométrie et même VT que le calcul
// (backend/app/core/rpc_solver.py) : section × hauteur, π r² h, L × l × h,
// ou volume saisi ; VT = volume d'un moule × moules par recette × κ. Aucune
// formule du cours. Dimensions en cm, résultat en m³ (unités de stockage).
// null : donnée incomplète ou non positive.

import type { Category, GeneralInfo } from "./store";
import { descriptorFor } from "./method-registry";

const positif = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export function volumeMouleM3(g: Pick<GeneralInfo,
  "container_type" | "container_volume_m3" | "container_section" | "container_height" | "container_radius" | "container_length" | "container_width">): number | null {
  switch (g.container_type) {
    case "volume":
      return positif(g.container_volume_m3) ? g.container_volume_m3 : null;
    case "section_hauteur":
      return positif(g.container_section) && positif(g.container_height) ? g.container_section * g.container_height * 1e-6 : null;
    case "rayon_hauteur": {
      if (!positif(g.container_radius) || !positif(g.container_height)) return null;
      const r = g.container_radius / 100;
      return Math.PI * r * r * (g.container_height / 100);
    }
    case "longueur_largeur_hauteur":
      return positif(g.container_length) && positif(g.container_width) && positif(g.container_height)
        ? (g.container_length / 100) * (g.container_width / 100) * (g.container_height / 100)
        : null;
    default:
      return null;
  }
}

/**
 * Moules par recette N_c et facteur de perte κ du calcul qui sera lancé :
 * ceux de la méthode active de Calculs (l'essai-erreur prend ceux de sa
 * méthode de base, comme sa requête ; depuis 2026-10 ils sont partagés par
 * toutes les méthodes). κ vide vaut 1, comme dans le calcul. null pour le RRC,
 * qui travaille sur le volume du chantier et non sur le moule.
 */
export function parametresVolume(s: { category: Category; method: string } & Record<string, unknown>):
  { moules: number | undefined; kappa: number | undefined } | null {
  if (s.category === "RRC") return null;
  const d = descriptorFor(s.category, s.method);
  if (!d) return null;
  const essai = s.method === "essai" ? (s[d.stateKey] as { base_method?: string } | undefined) : undefined;
  const dCalcul = essai?.base_method ? descriptorFor(s.category, essai.base_method) : d;
  if (!dCalcul) return null;
  const etat = s[dCalcul.stateKey] as { desired_qty?: number; safety_factor?: number } | undefined;
  return { moules: etat?.desired_qty, kappa: etat?.safety_factor ?? 1 };
}

/**
 * Volume total à préparer par recette, MÊME formule que le calcul :
 * V_T = V_moule × N_c × κ (backend/app/core/rpc_solver.py, en-tête et
 * `V_T = container_volume_m3 * containers_per_recipe * safety_factor` ;
 * rpg_solver.py idem). m³ ; null si une donnée manque ou n'est pas positive.
 */
export function volumeTotalM3(volumeMoule: number | null, moules: number | undefined, kappa: number | undefined): number | null {
  return volumeMoule !== null && positif(moules) && positif(kappa) ? volumeMoule * moules * kappa : null;
}

/**
 * Équivalent en m³ d'un volume affiché dans une autre unité, dès 1 m³ :
 * « (11 000 m³) » à côté de « 11 000 000 000 cm³ » (l'unité de volume suit
 * celle des longueurs). Chaîne vide sinon.
 */
export function equivalentM3(m3: number, unite: string): string {
  if (unite === "m3" || !Number.isFinite(m3) || Math.abs(m3) < 1) return "";
  return ` (${m3.toLocaleString("fr-CA", { maximumSignificantDigits: 6 })} m³)`;
}

/** Aide du facteur de perte κ, commune aux formulaires de Calculs (une seule source). */
export const KAPPA_AIDE = "1 = aucun surplus ; 1,05 = +5 %. Aussi appelé « facteur de sécurité » (FS % = FS/100 + 1).";

/** Libellé d'un type de contenant (Informations, Analyse, feuille de préparation) : une seule source. */
export const LIBELLES_CONTENANT: Record<string, string> = {
  section_hauteur: "Section et hauteur",
  rayon_hauteur: "Rayon et hauteur",
  longueur_largeur_hauteur: "Longueur × largeur × hauteur",
  volume: "Volume direct",
};

export function libelleContenant(type: string | null | undefined): string {
  if (!type) return "";
  return LIBELLES_CONTENANT[type] ?? type;
}

/**
 * Au-delà de ce volume total (V_T), une gâchée n'est plus un essai de
 * laboratoire : 50 L, quand les moules de la liste font 0,2 à 1,6 L
 * (eprouvette.ts, MOULES_PROPOSES) et que le classeur « gramme » vise 2,6 L.
 * L'exemple complet (chantier de 11 000 m³) donnait une gâchée de
 * 18 298 021 kg de résidu humide sans aucun avis. Avis seulement, jamais un
 * blocage.
 */
export const SEUIL_VOLUME_LABO_M3 = 0.05;
/** Le même seuil en masse totale à peser : environ 50 L de remblai à 2 t/m³. */
export const SEUIL_MASSE_LABO_KG = 100;

/** Volume total d'une recette trop grand pour une gâchée de laboratoire. */
export function volumeHorsLabo(vtM3: number | null | undefined): boolean {
  return typeof vtM3 === "number" && Number.isFinite(vtM3) && vtM3 > SEUIL_VOLUME_LABO_M3;
}

/** Masse totale des cibles d'une gâchée si elle dépasse le seuil de laboratoire, sinon null. */
export function masseHorsLabo(composants: { cibleKg: number }[] | undefined): number | null {
  const total = (composants ?? []).reduce((s, c) => s + (Number.isFinite(c.cibleKg) ? c.cibleKg : 0), 0);
  return total > SEUIL_MASSE_LABO_KG ? total : null;
}

/** Avis commun (Labo, vue de l'enseignant) pour une gâchée de taille chantier. */
export function avisMasseHorsLabo(totalKg: number): string {
  const kg = Math.round(totalKg).toLocaleString("fr-CA");
  return `Cette gâchée demande de peser ${kg} kg au total : ce sont les masses d'un chantier, pas d'une gâchée de laboratoire (quelques litres). Refaites le calcul avec le volume de vos moules (Informations, Dimensions des moules), puis créez une nouvelle gâchée.`;
}
