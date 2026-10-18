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
 * méthode de base, comme sa requête). null pour le RRC, qui travaille sur le
 * volume du chantier et non sur le moule.
 */
export function parametresVolume(s: { category: Category; method: string } & Record<string, unknown>):
  { moules: number | undefined; kappa: number | undefined; methode: string } | null {
  if (s.category === "RRC") return null;
  const d = descriptorFor(s.category, s.method);
  if (!d) return null;
  const essai = s.method === "essai" ? (s[d.stateKey] as { base_method?: string } | undefined) : undefined;
  const dCalcul = essai?.base_method ? descriptorFor(s.category, essai.base_method) : d;
  if (!dCalcul) return null;
  const etat = s[dCalcul.stateKey] as { desired_qty?: number; safety_factor?: number } | undefined;
  return { moules: etat?.desired_qty, kappa: etat?.safety_factor, methode: dCalcul.labels.long };
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
