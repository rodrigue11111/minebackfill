// frontend/src/lib/exemple.ts
// L'exemple complet (classeur Intra 2017 du professeur) : ce qu'il remplace,
// dit AVANT de le faire, sur Informations comme sur Calculs.

export const LIBELLE_EXEMPLE = "Essayer un exemple complet";

export const CONFIRMATION_EXEMPLE =
  "Charger l'exemple complet (classeur Intra 2017) ? Il remplace le projet (opérateur, nom, résidu), le contenant " +
  "(55 × 20 × 10 m, soit un volume industriel de 11 000 m³, celui du classeur du professeur), " +
  "le liant et les entrées des formulaires de calcul. Deux liants de l'exemple (GU et laitier GGBFS) " +
  "sont ajoutés au catalogue s'ils n'y sont pas.";

/** Demande l'accord de l'étudiant ; vrai s'il accepte. */
export const confirmerExemple = (): boolean => typeof window !== "undefined" && window.confirm(CONFIRMATION_EXEMPLE);
