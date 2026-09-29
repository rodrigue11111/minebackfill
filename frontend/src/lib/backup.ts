// Sauvegarde / restauration de toutes les données locales de l'application.
// Tout vit dans localStorage (résultats sauvegardés, prix des liants,
// journal de production, préférences d'unités, mesures de laboratoire) : un
// nettoyage du navigateur ou un changement de poste efface tout. Ces fonctions
// produisent un fichier JSON versionné téléchargeable, et le réimportent en
// fusionnant par id.

import {
  loadGacheesFromStorage, persistGachees,
  loadProtocolesFromStorage, persistProtocoles,
} from "./store";
import type { Gachee } from "./gachee";
import type { Protocole } from "./protocole";
import { ecrireLocal } from "./persisted";
import {
  estCourbeColonnes, resoudreCourbesImportees, type CourbeColonnes, type MagasinCourbes,
} from "./courbes";
import { magasinCourbes } from "./courbes-client";

/** Un échec d'écriture interrompt l'import, qui le rapporte (voir le catch).
 *  Avant, l'échec des gâchées était avalé : « Import réussi » s'affichait
 *  alors que rien n'avait été enregistré. */
function ecrireOuEchouer(ok: boolean): void {
  if (!ok) throw new Error("écriture refusée par le stockage local");
}

const CLES = {
  saved_results: "minebackfill_saved_results",
  binder_prices: "minebackfill_binder_prices",
  production_log: "minebackfill_production_log",
  unit_prefs: "minebackfill_unit_prefs",
  catalogue_liants: "minebackfill_catalogue_liants",
  constantes: "minebackfill_constantes",
  general: "minebackfill_general",
  catalogue_residus: "minebackfill_catalogue_residus",
  catalogue_granulats: "minebackfill_catalogue_granulats",
  catalogue_retardateurs: "minebackfill_catalogue_retardateurs",
  gachees: "minebackfill_gachees",
  protocoles: "minebackfill_protocoles",
  sessions: "minebackfill_sessions",
} as const;

// Clés du laboratoire : elles ne passent PAS par lire()/ecrireLocal().
// Raison : elles sont stockées en enveloppe versionnée {v,data}. lire()
// renverrait l'enveloppe, donc `Array.isArray` serait faux et la fusion par id
// impossible. On passe par les accesseurs du store, qui rendent des données
// DÉJÀ MIGRÉES, et le fichier porte alors des tableaux nus.
const CLES_LABO = ["gachees", "protocoles"] as const;
type CleLabo = (typeof CLES_LABO)[number];
function estCleLabo(nom: string): nom is CleLabo {
  return (CLES_LABO as readonly string[]).includes(nom);
}

/**
 * Accepte un tableau nu ou une enveloppe versionnée {v,data}. Un fichier
 * produit ici porte des tableaux nus, mais une sauvegarde bricolée à la main
 * (copie directe du localStorage) porterait l'enveloppe : on tolère les deux
 * plutôt que d'ignorer les données en silence.
 */
function deballer(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && Array.isArray((x as { data?: unknown }).data)) {
    return (x as { data: unknown[] }).data;
  }
  return null;
}

// v2 : catalogue de liants, constantes, infos générales.
// v3 : bibliothèque de matériaux (résidus, granulats, retardateurs).
// v4 : laboratoire — gâchées (avec éprouvettes et essais UCS) et protocoles.
//      Jusqu'ici ces mesures n'étaient NI exportées NI synchronisées : une
//      campagne d'écrasements sur 91 jours n'avait aucune copie.
// v5 : sessions de cours publiées par l'enseignant (réglage : remplacé à
//      l'import, comme les protocoles).
// v6 : courbes de presse rangées HORS des gâchées (IndexedDB) : le fichier
//      les porte dans `courbes` (par id d'éprouvette, en colonnes).
// Une sauvegarde d'une version antérieure reste importable — les clés absentes
// sont simplement ignorées (voir importerDonnees).
const SCHEMA_VERSION = 6;

interface Backup {
  application: string;
  schema: number;
  exportedAt: string;
  data: Partial<Record<keyof typeof CLES, unknown>> & { courbes?: Record<string, CourbeColonnes> };
}

function lire(cle: string): unknown {
  try {
    const raw = localStorage.getItem(cle);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Télécharge un fichier JSON contenant toutes les données locales, courbes de
 * presse comprises (lues dans le magasin : sans elles, une sauvegarde
 * restaurée ailleurs les perdrait).
 */
export async function exporterDonnees(magasin: MagasinCourbes | null = magasinCourbes()): Promise<void> {
  const courbes: Record<string, CourbeColonnes> = {};
  if (magasin) {
    for (const g of loadGacheesFromStorage()) for (const e of g.eprouvettes ?? []) {
      if (!e.essai?.courbeInfo) continue;
      const c = await magasin.lire(e.id).catch(() => null);
      if (c) courbes[e.id] = c;
    }
  }
  const backup: Backup = {
    application: "MineBackfill",
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      Object.entries(CLES).map(([nom, cle]) => [
        nom,
        estCleLabo(nom)
          ? (nom === "gachees" ? loadGacheesFromStorage() : loadProtocolesFromStorage())
          : lire(cle),
      ]),
    ),
  };
  backup.data.courbes = courbes;
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
 * - listes avec id (résultats, journal, gâchées de labo) : fusion — les
 *   entrées importées s'ajoutent, les id déjà présents sont conservés tels
 *   quels ;
 * - réglages (prix, unités, catalogue de liants, constantes, projet,
 *   protocoles de labo) : remplacés par le contenu du fichier.
 * Recharger les données dans le store après import (loadSavedResults,
 * loadGachees, loadProtocoles, etc.).
 */
export async function importerDonnees(
  fichier: File,
  magasin: MagasinCourbes | null = magasinCourbes(),
): Promise<ResultatImport> {
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
      if (estCleLabo(nom)) {
        const items = deballer(importe);
        if (!items) continue;
        if (nom === "gachees") {
          // Même règle que saved_results : le local gagne, l'import complète.
          // Une gâchée en cours de saisie ne doit jamais être écrasée par une
          // sauvegarde plus ancienne portant le même id.
          const existant = loadGacheesFromStorage();
          const idsExistants = new Set(existant.map((g) => g?.id));
          let nouveaux = (items as Gachee[]).filter(
            (g) => g && typeof g === "object" && !idsExistants.has(g.id),
          );
          // Courbes du fichier (schéma 6) : dans le magasin d'abord ; à défaut,
          // remises dans la gâchée. Jamais de référence vers une courbe absente.
          const brutes = backup.data?.courbes;
          const courbesFichier: Record<string, CourbeColonnes> = {};
          if (brutes && typeof brutes === "object") {
            for (const [id, c] of Object.entries(brutes)) if (estCourbeColonnes(c)) courbesFichier[id] = c;
          }
          const voulues = nouveaux.flatMap((g) => (g.eprouvettes ?? [])
            .filter((e) => e.essai?.courbeInfo && courbesFichier[e.id]).map((e) => e.id));
          let enregistrees = new Set<string>();
          if (magasin && voulues.length > 0) {
            try {
              await magasin.ecrire(voulues.map((id) => [id, courbesFichier[id]]));
              enregistrees = new Set(voulues);
            } catch { /* magasin indisponible : courbes remises dans les gâchées */ }
          }
          nouveaux = resoudreCourbesImportees(nouveaux, courbesFichier, enregistrees);
          ecrireOuEchouer(persistGachees([...nouveaux, ...existant]));
          fusionnes += nouveaux.length;
        } else {
          // Les protocoles sont des procédures décidées par l'enseignant :
          // remplacement, comme les autres réglages.
          ecrireOuEchouer(persistProtocoles(items as Protocole[]));
          remplaces += 1;
        }
        continue;
      }
      if (Array.isArray(importe) && (nom === "saved_results" || nom === "production_log")) {
        const existant = (lire(cle) as { id?: string }[] | null) ?? [];
        const idsExistants = new Set(existant.map((e) => e?.id));
        const nouveaux = importe.filter(
          (e: { id?: string }) => e && typeof e === "object" && !idsExistants.has(e.id),
        );
        ecrireOuEchouer(ecrireLocal(cle, JSON.stringify([...nouveaux, ...existant])));
        fusionnes += nouveaux.length;
      } else {
        ecrireOuEchouer(ecrireLocal(cle, JSON.stringify(importe)));
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
