// Icônes au trait (24 × 24, currentColor), reprises de la maquette. Sans hook :
// utilisables par les composants serveur (Guide) comme par les clients.

import type { IconeNav } from "@/lib/navigation";

export type NomIcone =
  | IconeNav
  | "plus" | "portail" | "chevron" | "retour" | "telecharger" | "fermer"
  | "coche" | "menu" | "pleinEcran" | "imprimer" | "ajouter" | "actualiser";

const TRACES: Record<NomIcone, React.ReactNode> = {
  informations: (<><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>),
  calculs: (<><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 7h6" /><path d="M9 12h.01" /><path d="M12 12h.01" /><path d="M15 12h.01" /><path d="M9 16h.01" /><path d="M12 16h.01" /><path d="M15 16h.01" /></>),
  analyse: (<><path d="M4 20V4" /><path d="M4 20h16" /><path d="m7 15 4-5 3 3 5-7" /></>),
  labo: (<><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /><path d="M7.5 15h9" /></>),
  classe: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>),
  formules: (<><path d="M17 5H8l5 7-5 7h9" /></>),
  historique: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>),
  guide: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7" /></>),
  reglages: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="m4.9 4.9 2.1 2.1" /><path d="m17 17 2.1 2.1" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.9 19.1 2.1-2.1" /><path d="m17 7 2.1-2.1" /></>),
  compte: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  plus: (<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>),
  portail: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>),
  chevron: (<path d="m9 6 6 6-6 6" />),
  retour: (<path d="m15 18-6-6 6-6" />),
  telecharger: (<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>),
  fermer: (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>),
  coche: (<path d="m5 12 5 5 9-10" />),
  menu: (<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>),
  pleinEcran: (<><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></>),
  imprimer: (<><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>),
  ajouter: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  actualiser: (<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>),
};

export function Icone({ nom, taille = 18, epaisseur = 1.8, titre }: {
  nom: NomIcone;
  taille?: number;
  epaisseur?: number;
  /** Texte accessible ; sans titre, l'icône est décorative. */
  titre?: string;
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titre ? undefined : true}
      role={titre ? "img" : undefined}
      aria-label={titre}
      style={{ flexShrink: 0 }}
    >
      {TRACES[nom]}
    </svg>
  );
}

/** Marque de l'application : pastille sombre et silhouette de chevalement. */
export function Marque({ taille = 24 }: { taille?: number }) {
  return (
    <span className="ui-marque" style={{ width: taille, height: taille }} aria-hidden="true">
      <svg width={Math.round(taille * 0.58)} height={Math.round(taille * 0.58)} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 20h18" /><path d="M6 20V10l6-5 6 5v10" /><path d="M10 20v-5h4v5" />
      </svg>
    </span>
  );
}
