import { describe, it, expect } from "vitest";
import { lireResultats, lireCourbe, reduireCourbe, type PointCourbe } from "./presse-urstm";

// En-têtes et valeurs RELEVÉS sur un export réel de la presse URSTM
// (Results-Batch_URSTM(V1)-20260925-143132.xlsx), lu avec exceljs — la
// bibliothèque que l'application utilise déjà pour ses exports.
//
// Trois points vérifiés sur le fichier, et non supposés :
//   - la presse insère un retour chariot entre le libellé et son unité ;
//     exceljs le rend en CR+LF, tandis que le XML brut porte « _x000D_ ».
//     Les deux formes sont testées ;
//   - les horodatages arrivent en objets Date, pas en nombres Excel ;
//   - « Sample » arrive en NOMBRE, pas en chaîne.
const ENTETES = [
  "Sample",
  "Young's Modulus\r\n(kPa)",
  "Max Force\r\n(N)",
  "Max déflexion\r\n(mm)",
  "Max déformation\r\n(%)",
  "Charge à la rupture\r\n(N)",
  "Force à la rupture\r\n(N)",
  "Contrainte à la rupture\r\n(kPa)",
  "Slope\r\n(kPa)",
  "ISO 6892 Ag\r\n(%)",
  "Username\r\n",
  "Timestamp - Start\r\n",
  "Timestamp - End\r\n",
  "Batch number\r\n(Prompt For Value - Before Test)",
  "Hauteur (mm)\r\n(Prompt For Value - Before Test)",
  "Masse (g)\r\n(Prompt For Value - Before Test)",
  "Contrat de service\r\n(Prompt For Value - Before Test)",
  "Numéro séquentiel\r\n(Prompt For Value - Before Test)",
  "Commentaires\r\n(Prompt For Value - Before Test)",
  "Temps de cure\r\n(Prompt For Value - Before Test)",
];

// Valeurs exactes de l'essai réel. `Sample` et les horodatages sont donnés
// tels qu'exceljs les rend : un nombre et deux Date.
const ESSAI: unknown[] = [
  14, 6122.071, 895.326, 1.673, 4.403, 895.326, 892.273, 196.328, -578.023,
  1.196, "URSTM",
  new Date("2026-09-25T14:28:36.000Z"),
  new Date("2026-09-25T14:31:19.000Z"),
  345, 38, 567, 657, 789, "RW-MU-66", 29,
];

const STATS: unknown[][] = [
  ["Mean", 6122.071, 895.326, 1.673, 4.403, 895.326, 892.273, 196.328, -578.023, 1.196],
  ["SD", 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ["Min", 6122.071, 895.326, 1.673, 4.403, 895.326, 892.273, 196.328, -578.023, 1.196],
  ["Max", 6122.071, 895.326, 1.673, 4.403, 895.326, 892.273, 196.328, -578.023, 1.196],
];

describe("presse-urstm — lecture du récapitulatif", () => {
  it("lit l'essai réel et le mappe par le TEXTE des en-têtes", () => {
    const r = lireResultats([ENTETES, ESSAI]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.essais[0];
    expect(e.echantillon).toBe("14"); // la presse rend le nombre 14
    expect(e.contrainteKpa).toBeCloseTo(196.328, 3);
    expect(e.chargeN).toBeCloseTo(895.326, 3);
    expect(e.moduleYoungKpa).toBeCloseTo(6122.071, 3);
    expect(e.deformationMaxPct).toBeCloseTo(4.403, 3);
    expect(e.deflexionMaxMm).toBeCloseTo(1.673, 3);
    expect(e.hauteurMm).toBe(38);
    expect(e.masseG).toBe(567);
    expect(e.tempsDeCureJours).toBe(29);
    expect(e.commentaires).toBe("RW-MU-66");
    expect(e.operateur).toBe("URSTM");
  });

  it("ne confond pas les trois colonnes qui contiennent « rupture »", () => {
    // « Contrainte », « Charge » et « Force » à la rupture cohabitent dans le
    // fichier. Prendre la mauvaise mettrait une force, en newtons, dans une
    // contrainte en kPa — sans que rien ne le signale.
    const r = lireResultats([ENTETES, ESSAI]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].contrainteKpa).toBeCloseTo(196.328, 3);
    expect(r.essais[0].chargeN).toBeCloseTo(895.326, 3);
  });

  it("lit aussi les en-têtes au format XML brut", () => {
    const bruts = ENTETES.map((h) => h.replace(/\r\n/g, "_x000D_\n"));
    const r = lireResultats([bruts, ESSAI]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].contrainteKpa).toBeCloseTo(196.328, 3);
  });

  it("accepte les horodatages en objets Date (le cas réel)", () => {
    const r = lireResultats([ENTETES, ESSAI]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].dateEssai?.slice(0, 10)).toBe("2026-09-25");
  });

  it("accepte aussi un horodatage en nombre Excel", () => {
    const l = [...ESSAI];
    l[11] = 46290.603194444448;
    const r = lireResultats([ENTETES, l]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].dateEssai?.slice(0, 10)).toBe("2026-09-25");
  });

  it("écarte les lignes de statistiques ajoutées par la presse", () => {
    // Mean / SD / Min / Max ne sont pas des essais : les importer créerait
    // quatre éprouvettes fantômes portant toutes la même valeur.
    const r = lireResultats([ENTETES, ESSAI, ...STATS]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais).toHaveLength(1);
    expect(r.essais[0].echantillon).toBe("14");
  });

  it("tolère un réordonnancement des colonnes", () => {
    // Le mappage se fait par le libellé, pas par la position : une nouvelle
    // version de la presse peut réordonner sans rien casser en silence.
    const ordre = [7, 0, 19, 1];
    const r = lireResultats([ordre.map((i) => ENTETES[i]), ordre.map((i) => ESSAI[i])]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].contrainteKpa).toBeCloseTo(196.328, 3);
    expect(r.essais[0].tempsDeCureJours).toBe(29);
  });

  it("accepte une virgule décimale (locale du poste)", () => {
    const l = [...ESSAI];
    l[7] = "196,328";
    const r = lireResultats([ENTETES, l]);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.essais[0].contrainteKpa).toBeCloseTo(196.328, 3);
  });

  it("refuse un classeur sans colonne de contrainte", () => {
    const r = lireResultats([["Sample", "Autre chose"], ["1", 2]]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("Contrainte");
  });

  it("refuse un classeur vide", () => {
    expect(lireResultats([]).ok).toBe(false);
  });
});

describe("presse-urstm — courbe", () => {
  const entetes = ["Time (s)", "Load (N)", "Displacement (mm)", "Stress (kPa)", "Strain (%)"];

  it("lit les points et ignore les lignes non numériques", () => {
    const pts = lireCourbe([
      entetes, [0.001, 2.27, 0, 4.98, 0], ["", "", "", "", ""], [0.002, 3.69, 0, 8.1, 0],
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0].contrainteKpa).toBeCloseTo(4.98, 2);
  });

  it("rend un tableau vide si la feuille n'est pas une courbe", () => {
    // La courbe est un bonus : son absence ne doit jamais faire échouer
    // l'import de la mesure, qui est l'essentiel.
    expect(lireCourbe([["a", "b"], [1, 2]])).toEqual([]);
  });
});

describe("presse-urstm — réduction de la courbe", () => {
  function courbe(n: number): PointCourbe[] {
    return Array.from({ length: n }, (_, i) => ({
      tempsS: i / 1000, chargeN: i, deplacementMm: i / 100,
      // Cloche : la contrainte monte puis redescend, comme un essai réel.
      contrainteKpa: 200 - Math.abs(i - Math.floor(n * 0.7)) / 10,
      deformationPct: i / 1000,
    }));
  }
  const plusHaut = (a: PointCourbe[]) => a.reduce((m, p) => Math.max(m, p.contrainteKpa), -Infinity);

  it("ne touche pas une courbe déjà courte", () => {
    expect(reduireCourbe(courbe(50), 200)).toHaveLength(50);
  });

  it("ramène les 153 196 points d'un essai réel sous le plafond", () => {
    const r = reduireCourbe(courbe(153196), 200);
    expect(r.length).toBeLessThanOrEqual(203); // 200 + premier, dernier, max
    expect(r.length).toBeGreaterThan(150);
  });

  it("conserve le premier, le dernier et le point de contrainte MAXIMALE", () => {
    // Le maximum porte l'UCS : un pas régulier pourrait le rater, et la
    // courbe réduite sous-estimerait alors la résistance mesurée.
    const c = courbe(153196);
    const r = reduireCourbe(c, 200);
    expect(plusHaut(r)).toBe(plusHaut(c));
    expect(r[0]).toEqual(c[0]);
    expect(r[r.length - 1]).toEqual(c[c.length - 1]);
  });

  it("ne rend QUE des points réellement mesurés — aucune moyenne", () => {
    // Moyenner fabriquerait des couples (contrainte, déformation) que la
    // presse n'a jamais enregistrés : ce serait inventer de la mesure.
    const c = courbe(5000);
    const vus = new Set(c.map((p) => JSON.stringify(p)));
    for (const p of reduireCourbe(c, 100)) {
      expect(vus.has(JSON.stringify(p))).toBe(true);
    }
  });

  it("rend les points dans l'ordre chronologique", () => {
    const r = reduireCourbe(courbe(10000), 100);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].tempsS).toBeGreaterThan(r[i - 1].tempsS);
    }
  });
});
