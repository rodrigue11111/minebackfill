// frontend/src/lib/contenant.ts
// Volume d'un moule (contenant), affiché dès la page Informations. MÊME
// géométrie que le calcul (backend/app/core/rpc_solver.py, volume du
// contenant) : section × hauteur, π r² h, L × l × h, ou volume saisi. Aucune
// formule du cours : la géométrie du moule. Dimensions en cm, résultat en m³
// (unités de stockage). null : dimensions incomplètes ou non positives.

import type { GeneralInfo } from "./store";

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
