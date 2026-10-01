// frontend/src/lib/materials-io.ts
// Import / export des bibliothèques de matériaux en JSON et CSV. Le store
// force `origine = "perso"` et fusionne par id à l'import ; on ne s'occupe ici
// que de la (dé)sérialisation et du téléchargement.

import { CARACTERISATION_GRANULAT, CARACTERISATION_RESIDU, type MaterialKind, type MaterialItem, type MaterialOrigine } from "./materials";

const cles = (champs: { cle: string }[]) => champs.map((c) => c.cle);
const numeriques = (champs: { cle: string; type: string }[]) => champs.filter((c) => c.type === "nombre").map((c) => c.cle);

/** Champs exportés par type de matériau (ordre des colonnes CSV). La
 *  caractérisation vient À LA FIN : un ancien fichier reste lisible. */
const CHAMPS: Record<MaterialKind, string[]> = {
  residus: ["nom", "gs", "w0_pct", "provenance", "notes", ...cles(CARACTERISATION_RESIDU)],
  granulats: ["nom", "gs", "humidite_pct", "fraction_defaut_pct", "provenance", ...cles(CARACTERISATION_GRANULAT)],
  retardateurs: ["nom", "densite_g_ml", "dosage_d0_ml_100kg"],
};

/** Champs numériques (coercés à l'import). */
const CHAMPS_NUM: Record<MaterialKind, Set<string>> = {
  residus: new Set(["gs", "w0_pct", ...numeriques(CARACTERISATION_RESIDU)]),
  granulats: new Set(["gs", "humidite_pct", "fraction_defaut_pct", ...numeriques(CARACTERISATION_GRANULAT)]),
  retardateurs: new Set(["densite_g_ml", "dosage_d0_ml_100kg"]),
};

/** Champs numériques FACULTATIFS : une cellule vide reste absente (jamais 0,
 *  qui serait une mesure fausse). */
const CHAMPS_NUM_FACULTATIFS: Record<MaterialKind, Set<string>> = {
  residus: new Set(numeriques(CARACTERISATION_RESIDU)),
  granulats: new Set(numeriques(CARACTERISATION_GRANULAT)),
  retardateurs: new Set(),
};

const LIBELLE: Record<MaterialKind, string> = {
  residus: "residus",
  granulats: "granulats",
  retardateurs: "retardateurs",
};

function telecharger(nom: string, contenu: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([contenu], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

function horodatage(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Export ── */

export function materialsVersJson(kind: MaterialKind, items: MaterialItem[]): void {
  const contenu = JSON.stringify({ application: "MineBackfill", kind, materials: items }, null, 2);
  telecharger(`MineBackfill_${LIBELLE[kind]}_${horodatage()}.json`, contenu, "application/json");
}

function echapperCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Texte CSV d'une bibliothèque (sans BOM) : une ligne d'en-tête, puis une
 *  ligne par matériau. */
export function materialsCsvTexte(kind: MaterialKind, items: MaterialItem[]): string {
  const champs = CHAMPS[kind];
  const lignes = [champs.join(";")];
  for (const it of items) {
    const rec = it as unknown as Record<string, unknown>;
    lignes.push(champs.map((c) => echapperCsv(rec[c])).join(";"));
  }
  return lignes.join("\r\n");
}

export function materialsVersCsv(kind: MaterialKind, items: MaterialItem[]): void {
  // BOM UTF-8 pour qu'Excel (FR) reconnaisse l'encodage et le point-virgule.
  telecharger(`MineBackfill_${LIBELLE[kind]}_${horodatage()}.csv`, "﻿" + materialsCsvTexte(kind, items), "text/csv");
}

/* ── Import ── */

/**
 * Découpe un texte CSV complet en lignes de cellules (séparateur point-virgule).
 * Le parcours se fait caractère par caractère sur TOUT le texte : une cellule
 * entre guillemets peut donc contenir des points-virgules ET des retours à la
 * ligne sans être coupée.
 */
function parseCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let cells: string[] = [];
  let cur = "";
  let dansGuillemets = false;
  const finLigne = () => {
    cells.push(cur);
    cur = "";
    if (cells.some((c) => c.trim() !== "")) lignes.push(cells);
    cells = [];
  };
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (dansGuillemets) {
      if (ch === '"' && texte[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') dansGuillemets = false;
      else cur += ch;
    } else if (ch === '"') dansGuillemets = true;
    else if (ch === ";") { cells.push(cur); cur = ""; }
    else if (ch === "\n") finLigne();
    else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || cells.length > 0) finLigne();
  return lignes;
}

/** Champ numérique « principal » exigé strictement positif par type. */
const CHAMP_REQUIS: Record<MaterialKind, string> = {
  residus: "gs",
  granulats: "gs",
  retardateurs: "densite_g_ml",
};

function construireItem(kind: MaterialKind, source: Record<string, unknown>, i: number): MaterialItem {
  const num = CHAMPS_NUM[kind];
  const out: Record<string, unknown> = {
    id: typeof source.id === "string" && source.id ? source.id : `${kind}_imp_${Date.now()}_${i}`,
    origine: "perso" as MaterialOrigine,
  };
  for (const champ of CHAMPS[kind]) {
    const brut = source[champ];
    if (num.has(champ)) {
      const texte = String(brut ?? "").trim();
      if (CHAMPS_NUM_FACULTATIFS[kind].has(champ)) {
        if (texte === "") continue;
        const n = Number(texte.replace(",", "."));
        if (!Number.isFinite(n)) throw new Error(`Ligne ${i + 1} : « ${champ} » n'est pas un nombre (« ${texte} »).`);
        out[champ] = n;
        continue;
      }
      // Virgule décimale acceptée (l'export CSV cible Excel FR).
      const n = Number(texte.replace(",", "."));
      out[champ] = Number.isFinite(n) ? n : 0;
    } else if (brut !== undefined && brut !== null && brut !== "") {
      out[champ] = String(brut);
    }
  }
  // Validation minimale : un nom et le champ physique principal > 0, sinon le
  // matériau produirait des calculs silencieusement faux (Gs 0...).
  if (!out.nom || String(out.nom).trim() === "") {
    throw new Error(`Ligne ${i + 1} : le champ « nom » est requis.`);
  }
  const principal = out[CHAMP_REQUIS[kind]];
  if (typeof principal !== "number" || principal <= 0) {
    throw new Error(
      `Ligne ${i + 1} (« ${String(out.nom)} ») : « ${CHAMP_REQUIS[kind]} » doit être un nombre strictement positif.`,
    );
  }
  return out as unknown as MaterialItem;
}

/** Lit un fichier .json ou .csv et renvoie des matériaux (id garanti). */
export async function materialsDepuisFichier(kind: MaterialKind, fichier: File): Promise<MaterialItem[]> {
  const texte = await fichier.text();
  const estJson = fichier.name.toLowerCase().endsWith(".json") || texte.trimStart().startsWith("{") || texte.trimStart().startsWith("[");

  if (estJson) {
    let data: unknown;
    try { data = JSON.parse(texte); } catch { throw new Error("Fichier JSON illisible."); }
    const brut = Array.isArray(data)
      ? data
      : (data as { materials?: unknown }).materials;
    if (!Array.isArray(brut)) throw new Error("Format JSON inattendu (tableau « materials » attendu).");
    return brut.map((m, i) => construireItem(kind, m as Record<string, unknown>, i));
  }

  // CSV
  const lignes = parseCsv(texte.replace(/^﻿/, ""));
  if (lignes.length < 2) throw new Error("Fichier CSV vide ou sans données.");
  const entetes = lignes[0].map((h) => h.trim());
  return lignes.slice(1).map((cells, i) => {
    const source: Record<string, unknown> = {};
    entetes.forEach((h, ci) => { source[h] = cells[ci]; });
    return construireItem(kind, source, i);
  });
}
