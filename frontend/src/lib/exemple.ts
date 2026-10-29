// frontend/src/lib/exemple.ts
// L'exemple complet : ce qu'il remplace, dit AVANT de le faire, sur
// Informations comme sur Calculs. Ses matériaux et ses rapports (Cw, Bw, E/L)
// sont ceux du « Mélange 1 » du classeur de référence du professeur (Intra
// 2017, tests d'or du backend). Depuis le 2026-10-26, il est à l'échelle d'une
// gâchée de laboratoire : le volume industriel du classeur (11 000 m³) ne
// ressemblait à rien de ce que l'étudiant prépare.

/** Moule de l'exemple : cylindre 76,2 × 152,4 mm (3 × 6 po), 9 moules par recette, κ = 1,1 (environ 6,9 L). */
export const MOULE_EXEMPLE = { rayonCm: 3.81, hauteurCm: 15.24, moules: 9, kappa: 1.1 } as const;

/** Liants ajoutés au catalogue par l'exemple. */
export const NOMS_LIANTS_EXEMPLE = { GU: "Ciment GU (exemple)", GGBFS: "Laitier GGBFS (exemple)" } as const;

/** Noms donnés par l'exemple avant le 2026-10-26 : renommés s'ils sont restés tels quels. */
export const ANCIENS_NOMS_LIANTS_EXEMPLE = { GU: "Ciment GU (exemple Intra 2017)", GGBFS: "Laitier GGBFS (exemple Intra 2017)" } as const;

export const LIBELLE_EXEMPLE = "Essayer un exemple complet";

export const CONFIRMATION_EXEMPLE =
  "Charger l'exemple complet ? Il remplace le projet (opérateur, nom, résidu), les dimensions des moules " +
  "(cylindres de 76,2 × 152,4 mm, 9 moules par recette, facteur de perte κ = 1,1 : environ 6,9 L par recette), " +
  "le liant et les entrées des formulaires de calcul. Deux liants de l'exemple (GU et laitier GGBFS) " +
  "sont ajoutés au catalogue s'ils n'y sont pas.";

/** Demande l'accord de l'étudiant ; vrai s'il accepte. */
export const confirmerExemple = (): boolean => typeof window !== "undefined" && window.confirm(CONFIRMATION_EXEMPLE);
