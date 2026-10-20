// frontend/src/lib/nom-sauvegarde.ts
// Noms des résultats sauvegardés. Module PUR.
//
// Pourquoi : le nom proposé (« RPC Dosage selon Cw du 2026-10-18 ») était le
// même pour toutes les sauvegardes d'une journée, et deux résultats de même
// nom étaient impossibles à distinguer dans Mes calculs et dans la liste des
// formulations du Labo.

/** Nom proposé : « RPC Dosage selon Cw du 2026-10-18 à 14 h 05 ». */
export function nomParDefautAvecHeure(prefixe: string, date: Date): string {
  const jour = date.toLocaleDateString("fr-CA");
  return `${prefixe} du ${jour} à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Ce nom est-il déjà pris (espaces des bords et casse ignorées) ? Un avis, jamais un refus. */
export function nomDejaPris(nom: string, existants: string[]): boolean {
  const n = nom.trim().toLocaleLowerCase("fr-CA");
  return n !== "" && existants.some((e) => e.trim().toLocaleLowerCase("fr-CA") === n);
}

/**
 * Résultat déjà sauvegardé sous ce nom (le plus récent : la liste est rangée
 * du plus récent au plus ancien), ou undefined. Sert à « Remplacer l'ancien ».
 */
export function homonyme<T extends { id: string; label: string }>(nom: string, sauvegardes: T[]): T | undefined {
  const n = nom.trim().toLocaleLowerCase("fr-CA");
  if (n === "") return undefined;
  return sauvegardes.find((s) => s.label.trim().toLocaleLowerCase("fr-CA") === n);
}
