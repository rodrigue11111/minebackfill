// Registre des projets du portail. AJOUTER UN PROJET = une entrée ici,
// puis redéployer (git push). Rien d'autre à toucher.

export interface Projet {
  id: string;
  nom: string;
  /** Courte phrase sous le nom (français, sans jargon inutile). */
  description: string;
  /** URL de l'application déployée (ouvre dans un nouvel onglet). */
  url: string;
  /** Étiquettes affichées sur la carte. */
  tags: string[];
  /** « stable » | « beta » — purement indicatif. */
  statut?: "stable" | "beta";
}

export const PROJETS: Projet[] = [
  {
    id: "minebackfill",
    nom: "MineBackfill",
    description:
      "Dimensionnement des mélanges de remblai minier en pâte (RPC, RPG, RRC) — méthodes Cw%, E/C, slump et essai-erreur, exports Excel/PDF, bibliothèques de matériaux.",
    // MineBackfill demenage de l'apex progicielbelem.com (repris par CE portail)
    // vers ce sous-domaine. VALIDE une fois le sous-domaine ajoute au projet
    // Vercel de MineBackfill (voir portail/README.md, section « Domaines »).
    url: "https://minebackfill.progicielbelem.com",
    tags: ["Module 1", "Remblai en pâte", "Laboratoire"],
    statut: "stable",
  },
  {
    id: "cpb-cockpit",
    nom: "CPB Cockpit",
    description:
      "Optimisation de recettes CPB par modèles Slump/UCS entraînés et échantillonnage Monte-Carlo sous contraintes (article 4).",
    // URL de production confirmee (HTTP 200, 2026-07-12).
    url: "https://cpb-trained-model.vercel.app",
    tags: ["Article 4", "Optimisation", "Machine learning"],
    statut: "beta",
  },
];
