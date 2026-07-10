// Sauvegarde / restauration de toutes les données locales de l'application.
// Tout vit dans localStorage (résultats sauvegardés, prix des liants,
// journal de production, préférences d'unités) : un nettoyage du navigateur
// ou un changement de poste efface tout. Ces fonctions produisent un fichier
// JSON versionné téléchargeable, et le réimportent en fusionnant par id.

const CLES = {
  saved_results: "minebackfill_saved_results",
  binder_prices: "minebackfill_binder_prices",
  production_log: "minebackfill_production_log",
  unit_prefs: "minebackfill_unit_prefs",
  catalogue_liants: "minebackfill_catalogue_liants",
  constantes: "minebackfill_constantes",
  general: "minebackfill_general",
} as const;

// v2 : ajout du catalogue de liants, des constantes et des infos générales.
// Une sauvegarde v1 (sans ces clés) reste importable — les clés absentes sont
// simplement ignorées (voir importerDonnees).
const SCHEMA_VERSION = 2;

interface Backup {
  application: string;
  schema: number;
  exportedAt: string;
  data: Partial<Record<keyof typeof CLES, unknown>>;
}

function lire(cle: string): unknown {
  try {
    const raw = localStorage.getItem(cle);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Télécharge un fichier JSON contenant toutes les données locales. */
export function exporterDonnees(): void {
  const backup: Backup = {
    application: "MineBackfill",
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      Object.entries(CLES).map(([nom, cle]) => [nom, lire(cle)]),
    ),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `MineBackfill_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ResultatImport {
  ok: boolean;
  message: string;
}

/**
 * Importe un fichier de sauvegarde.
 * - listes avec id (résultats, journal) : fusion — les entrées importées
 *   s'ajoutent, les id déjà présents sont conservés tels quels ;
 * - réglages (prix, unités, catalogue de liants, constantes, projet) :
 *   remplacés par le contenu du fichier.
 * Recharger les données dans le store après import (loadSavedResults etc.).
 */
export async function importerDonnees(fichier: File): Promise<ResultatImport> {
  let backup: Backup;
  try {
    backup = JSON.parse(await fichier.text());
  } catch {
    return { ok: false, message: "Fichier illisible : ce n'est pas un JSON valide." };
  }
  if (backup?.application !== "MineBackfill" || typeof backup.schema !== "number") {
    return { ok: false, message: "Ce fichier n'est pas une sauvegarde MineBackfill." };
  }
  if (backup.schema > SCHEMA_VERSION) {
    return { ok: false, message: `Sauvegarde d'une version plus récente (schéma ${backup.schema}).` };
  }

  let fusionnes = 0;
  let remplaces = 0;
  try {
    for (const [nom, cle] of Object.entries(CLES)) {
      const importe = backup.data?.[nom as keyof typeof CLES];
      if (importe === null || importe === undefined) continue;
      if (Array.isArray(importe) && (nom === "saved_results" || nom === "production_log")) {
        const existant = (lire(cle) as { id?: string }[] | null) ?? [];
        const idsExistants = new Set(existant.map((e) => e?.id));
        const nouveaux = importe.filter(
          (e: { id?: string }) => e && typeof e === "object" && !idsExistants.has(e.id),
        );
        localStorage.setItem(cle, JSON.stringify([...nouveaux, ...existant]));
        fusionnes += nouveaux.length;
      } else {
        localStorage.setItem(cle, JSON.stringify(importe));
        remplaces += 1;
      }
    }
  } catch {
    return { ok: false, message: "Échec d'écriture dans le stockage local (quota atteint ?)." };
  }
  return {
    ok: true,
    message: `Import réussi : ${fusionnes} entrée(s) ajoutée(s), ${remplaces} réglage(s) restauré(s).`,
  };
}
