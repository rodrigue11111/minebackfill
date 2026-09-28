// frontend/src/lib/presse-fichier.ts
// Adaptateur : transforme un fichier .xlsx de presse en lignes brutes, puis
// délègue l'interprétation au module PUR presse-urstm.ts.
//
// La séparation est volontaire. Tout ce qui décide (quelle colonne est quoi,
// quelles lignes écarter, comment réduire la courbe) vit dans un module sans
// dépendance, testable en node. Ici il ne reste que la plomberie exceljs, qui
// ne se teste qu'avec un vrai fichier.
//
// exceljs est importé DYNAMIQUEMENT, comme partout ailleurs dans ce dépôt
// (rrc-export.ts, ResultsPanel.tsx) : la bibliothèque pèse lourd et n'a rien
// à faire dans le bundle initial.

import { lireResultats, lireCourbe, reduireCourbe, type EssaiPresse, type PointCourbe } from "./presse-urstm";

export interface ClasseurPresse {
  essais: EssaiPresse[];
  /** Courbe par numéro d'échantillon, déjà réduite. Vide si le classeur n'en
   *  contient pas — c'est un bonus, pas une condition. */
  courbes: Map<string, PointCourbe[]>;
  /** Nombre de points AVANT réduction, par échantillon : sert à dire
   *  honnêtement à l'écran ce qui a été écarté. */
  pointsOrigine: Map<string, number>;
}

export type LectureClasseur =
  | { ok: true; classeur: ClasseurPresse }
  | { ok: false; erreur: string };

/** Nom de feuille de courbe : la presse la nomme « Sample <n> ». */
function echantillonDeLaFeuille(nom: string): string | null {
  const m = /^\s*sample\s+(\S+)\s*$/i.exec(nom);
  return m ? m[1] : null;
}

export async function lireClasseurPresse(
  fichier: File,
  maxPointsCourbe = 150,
): Promise<LectureClasseur> {
  let wb: { worksheets: { name: string; eachRow: (cb: (row: { values: unknown[] }) => void) => void }[] };
  try {
    const ExcelJS = await import("exceljs");
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(await fichier.arrayBuffer());
    wb = classeur as unknown as typeof wb;
  } catch {
    return { ok: false, erreur: "Fichier illisible : ce n'est pas un classeur Excel valide." };
  }

  // exceljs indexe `row.values` à partir de 1 (l'indice 0 est vide) : on
  // décale, sinon toutes les colonnes glissent d'un cran.
  const lignesDe = (nomFeuille: string): unknown[][] => {
    const ws = wb.worksheets.find((w) => w.name === nomFeuille);
    if (!ws) return [];
    const out: unknown[][] = [];
    ws.eachRow((row) => out.push((row.values as unknown[]).slice(1)));
    return out;
  };

  const feuilleResultats = wb.worksheets.find((w) => /result/i.test(w.name))?.name;
  if (!feuilleResultats) {
    return { ok: false, erreur: "Aucune feuille « Results » : ce classeur ne vient pas de la presse." };
  }

  const lu = lireResultats(lignesDe(feuilleResultats));
  if (!lu.ok) return { ok: false, erreur: lu.erreur };

  const courbes = new Map<string, PointCourbe[]>();
  const pointsOrigine = new Map<string, number>();
  for (const ws of wb.worksheets) {
    const ech = echantillonDeLaFeuille(ws.name);
    if (!ech) continue;
    const pts = lireCourbe(lignesDe(ws.name));
    if (pts.length === 0) continue;
    pointsOrigine.set(ech, pts.length);
    courbes.set(ech, reduireCourbe(pts, maxPointsCourbe));
  }

  return { ok: true, classeur: { essais: lu.essais, courbes, pointsOrigine } };
}
