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
      "Calcul des mélanges de remblais miniers cimentés (RPC, RPG, RRC) : dosage selon Cw ou selon E/L, modèle prédictif de l'affaissement, méthode essai-erreur, suivi des gâchées et des essais UCS, exports Excel et PDF.",
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
    // Sous-domaine du portail plutot que cpb-trained-model.vercel.app : des
    // postes geres (Microsoft Defender, politique de l'UQAT) bloquent tout
    // *.vercel.app. HTTP 200 confirme depuis un tel poste (2026-09-28).
    // L'API doit autoriser cette origine : CPB_ALLOWED_ORIGINS sur Render.
    url: "https://cpb.progicielbelem.com",
    tags: ["Article 4", "Optimisation", "Machine learning"],
    statut: "beta",
  },
];
