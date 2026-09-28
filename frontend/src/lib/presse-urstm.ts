// frontend/src/lib/presse-urstm.ts
// Lecture d'un classeur de presse (export URSTM). Transformations PURES :
// ce module reçoit des LIGNES déjà extraites du classeur et n'importe pas
// exceljs lui-même, de sorte qu'il se teste sans navigateur.
//
// Pourquoi cet import existe. La presse calcule déjà la contrainte à la
// rupture, et l'application demandait à l'étudiant de ressaisir la charge et
// le diamètre pour la recalculer. Vérifié sur un export réel du 2026-09-25 :
// la presse applique sigma = F/A avec un moule de 76,20 mm, et la formule de
// contrainteKpa() redonne sa valeur au chiffre près (196,328 kPa). La
// ressaisie était donc du travail en double et un risque de transcription.
//
// AUCUNE FORMULE NOUVELLE : on LIT des mesures, on n'en calcule pas. Le
// sous-échantillonnage lui-même ne fait que CHOISIR des points réellement
// mesurés — jamais de moyenne, qui inventerait des valeurs que la presse n'a
// jamais enregistrées.

/** Une ligne du récapitulatif : un essai, donc une éprouvette. */
export interface EssaiPresse {
  /** Numéro d'échantillon tel que la presse le nomme (« 14 »). */
  echantillon: string;
  /** Contrainte à la rupture (kPa) — la mesure qui fait l'UCS. */
  contrainteKpa: number | null;
  /** Charge à la rupture (N). Conservée pour la traçabilité. */
  chargeN: number | null;
  /** Module de Young (kPa) — mesure réelle, jusqu'ici perdue. */
  moduleYoungKpa: number | null;
  /** Déformation maximale (%) — idem. */
  deformationMaxPct: number | null;
  deflexionMaxMm: number | null;
  hauteurMm: number | null;
  masseG: number | null;
  /** Temps de cure RÉEL relevé par la presse (jours). À ne pas confondre
   *  avec l'âge CIBLE de l'éprouvette, sur lequel l'application agrège. */
  tempsDeCureJours: number | null;
  commentaires: string;
  /** Date de début d'essai, ISO. */
  dateEssai: string | null;
  operateur: string;
}

export interface PointCourbe {
  tempsS: number;
  chargeN: number;
  deplacementMm: number;
  contrainteKpa: number;
  deformationPct: number;
}

/** Lignes de statistiques que la presse ajoute sous les essais. */
const LIGNES_STATS = ["mean", "sd", "min", "max", "moyenne", "ecart-type"];

function normaliser(x: unknown): string {
  return String(x ?? "")
    .replace(/_x000D_/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nombre(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  // La presse exporte parfois en virgule décimale selon la locale du poste.
  const n = Number(String(x).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Date Excel (nombre de jours depuis le 1899-12-30) OU Date déjà convertie
 * par la bibliothèque de lecture. On accepte les deux : selon la version
 * d'exceljs et le format de cellule, l'une ou l'autre arrive.
 */
function dateIso(x: unknown): string | null {
  if (x instanceof Date && !Number.isNaN(x.getTime())) return x.toISOString();
  const n = nombre(x);
  if (n === null || n <= 0) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = 1970-01-01
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Association colonne -> champ, par le TEXTE de l'en-tête et non par sa
 * position : la presse peut réordonner ses colonnes d'une version à l'autre,
 * et un décalage silencieux mettrait un module de Young dans une contrainte.
 *
 * L'ordre des tests compte : « Contrainte à la rupture », « Charge à la
 * rupture » et « Force à la rupture » contiennent tous « rupture ».
 */
function champDeLEnTete(entete: unknown): keyof EssaiPresse | "ignore" {
  const h = normaliser(entete);
  if (!h) return "ignore";
  if (h.includes("contrainte")) return "contrainteKpa";
  if (h.includes("young")) return "moduleYoungKpa";
  if (h.includes("max") && h.includes("deformation")) return "deformationMaxPct";
  if (h.includes("max") && h.includes("deflexion")) return "deflexionMaxMm";
  if (h.includes("charge") && h.includes("rupture")) return "chargeN";
  if (h.includes("hauteur")) return "hauteurMm";
  if (h.includes("masse")) return "masseG";
  if (h.includes("temps") && h.includes("cure")) return "tempsDeCureJours";
  if (h.includes("commentaire")) return "commentaires";
  if (h.includes("username") || h.includes("utilisateur")) return "operateur";
  if (h.includes("timestamp") && h.includes("start")) return "dateEssai";
  if (h === "sample" || h.includes("echantillon")) return "echantillon";
  return "ignore";
}

function essaiVide(): EssaiPresse {
  return {
    echantillon: "", contrainteKpa: null, chargeN: null, moduleYoungKpa: null,
    deformationMaxPct: null, deflexionMaxMm: null, hauteurMm: null, masseG: null,
    tempsDeCureJours: null, commentaires: "", dateEssai: null, operateur: "",
  };
}

export type LectureResultats =
  | { ok: true; essais: EssaiPresse[] }
  | { ok: false; erreur: string };

/**
 * Lit le récapitulatif. `lignes[0]` est la ligne d'en-têtes ; les lignes
 * « Mean / SD / Min / Max » que la presse ajoute en dessous sont écartées —
 * ce ne sont pas des essais, et les importer créerait des éprouvettes
 * fantômes.
 */
export function lireResultats(lignes: unknown[][]): LectureResultats {
  if (!Array.isArray(lignes) || lignes.length < 2) {
    return { ok: false, erreur: "Le classeur ne contient aucune ligne de résultat." };
  }
  const entetes = lignes[0].map(champDeLEnTete);
  if (!entetes.includes("contrainteKpa")) {
    return {
      ok: false,
      erreur: "Aucune colonne « Contrainte à la rupture » : ce classeur ne ressemble pas à un export de presse.",
    };
  }

  const essais: EssaiPresse[] = [];
  for (const ligne of lignes.slice(1)) {
    if (!Array.isArray(ligne) || ligne.every((c) => c === null || c === undefined || c === "")) continue;
    const e = essaiVide();
    for (let i = 0; i < entetes.length; i++) {
      const champ = entetes[i];
      if (champ === "ignore") continue;
      const brut = ligne[i];
      switch (champ) {
        case "echantillon": e.echantillon = String(brut ?? "").trim(); break;
        case "commentaires": e.commentaires = String(brut ?? "").trim(); break;
        case "operateur": e.operateur = String(brut ?? "").trim(); break;
        case "dateEssai": e.dateEssai = dateIso(brut); break;
        default: (e[champ] as number | null) = nombre(brut);
      }
    }
    if (LIGNES_STATS.includes(normaliser(e.echantillon))) continue;
    if (e.contrainteKpa === null) continue;
    essais.push(e);
  }

  if (essais.length === 0) {
    return { ok: false, erreur: "Aucun essai exploitable : la colonne de contrainte est vide partout." };
  }
  return { ok: true, essais };
}

/**
 * Lit la feuille de courbe (Time / Load / Displacement / Stress / Strain).
 * Renvoie un tableau vide plutôt qu'une erreur : la courbe est un bonus, son
 * absence ne doit pas faire échouer l'import de la mesure.
 */
export function lireCourbe(lignes: unknown[][]): PointCourbe[] {
  if (!Array.isArray(lignes) || lignes.length < 2) return [];
  const h = lignes[0].map(normaliser);
  const idx = (motif: string) => h.findIndex((x) => x.includes(motif));
  const iT = idx("time"), iL = idx("load"), iD = idx("displacement");
  const iS = idx("stress"), iE = idx("strain");
  if (iS < 0 || iE < 0) return [];

  const pts: PointCourbe[] = [];
  for (const l of lignes.slice(1)) {
    const s = nombre(l[iS]), d = nombre(l[iE]);
    if (s === null || d === null) continue;
    pts.push({
      tempsS: nombre(l[iT]) ?? 0,
      chargeN: nombre(l[iL]) ?? 0,
      deplacementMm: nombre(l[iD]) ?? 0,
      contrainteKpa: s,
      deformationPct: d,
    });
  }
  return pts;
}

/**
 * Réduit une courbe à au plus `max` points, pour qu'elle tienne dans le
 * stockage local. Un seul essai fait ici 153 196 points ; une classe de 45
 * éprouvettes en produirait 7 millions, très au-delà des ~5 à 10 Mo du
 * localStorage.
 *
 * On CHOISIT des points réellement mesurés, à pas régulier, et on force la
 * conservation du premier, du dernier et du point de contrainte MAXIMALE —
 * celui qui porte l'UCS, qu'un pas régulier pourrait rater.
 *
 * On ne moyenne PAS : une moyenne fabriquerait des couples (contrainte,
 * déformation) que la presse n'a jamais enregistrés, ce qui reviendrait à
 * inventer de la mesure.
 */
export function reduireCourbe(points: PointCourbe[], max = 200): PointCourbe[] {
  if (max < 2 || points.length <= max) return points.slice();

  const garder = new Set<number>([0, points.length - 1]);
  let iMax = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].contrainteKpa > points[iMax].contrainteKpa) iMax = i;
  }
  garder.add(iMax);

  const pas = (points.length - 1) / (max - 1);
  for (let k = 0; k < max; k++) garder.add(Math.round(k * pas));

  return [...garder].sort((a, b) => a - b).filter((i) => i >= 0 && i < points.length)
    .map((i) => points[i]);
}
