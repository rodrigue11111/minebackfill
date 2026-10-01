// Garde du vocabulaire : échoue si un libellé retiré revient dans le code de
// l'interface ou des exports. Les termes à employer sont dans lib/glossaire.ts ;
// cette liste dit seulement ce qui ne doit PLUS apparaître.
//
// Exemptés : les tests, le glossaire lui-même (il cite les anciens noms comme
// synonymes), le catalogue de formules (symboles et notations du cours,
// formulas-data.ts), les types générés, et la page /industrie (non liée, hors
// du périmètre de la refonte).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RACINE = fileURLToPath(new URL("..", import.meta.url));

const EXEMPTES = [
  /\.test\.tsx?$/,
  /^lib[\\/]glossaire\.ts$/,
  /^lib[\\/]formulas-data\.ts$/,
  /^lib[\\/]api-types\.gen\.ts$/,
  /^lib[\\/]industrie_helpers\.ts$/,
  /^app[\\/]industrie[\\/]/,
  /^components[\\/]industrie[\\/]/,
];

/** Ancien libellé -> ce qui le remplace (pour le message d'échec). */
const RETIRES: [RegExp, string][] = [
  [/Rapport E\/C/, "Rapport eau/liant E/L"],
  [/rapport eau\/ciment/i, "rapport eau/liant"],
  [/Ajustement pour slump/, "Modèle prédictif (affaissement)"],
  [/Slump (mesuré|cible)|Cible de slump|Affaissement slump/, "Affaissement mesuré / visé"],
  [/[aA]grégat(?!ion)/, "granulat"],
  [/Mix Design Tool/, "Formulation des remblais"],
  [/Paste Aggregate Fill/, "Remblai en pâte granulaire"],
  [/Gs_backfill/, "Densité relative Gs du remblai"],
  [/\btailings\b/i, "résidus"],
  [/Masse volumique spécifique/, "Densité relative (sans unité)"],
  [/% massique de liant dans le mélange/, "masse de liant / masse sèche de résidu"],
  [/Facteur de sécurité \(multiplicateur\)/, "Facteur de perte κ"],
  [/Quantité \(nb\. de moules\)/, "Nombre de moules par recette"],
  [/Remblai pâte granulaire/, "Remblai en pâte granulaire"],
  [/Résultats RRC \/ CRF|RRC \/ CRF|RRC\/CRF/, "RRC"],
  [/"Cw%"|"Bw%"|[CB]w%/, "Cw / Bw sans « % » collé au symbole"],
  [/Ciment \$\{/, "nomLiant() (« Liant n » en repli)"],
];

/** Noms de liants v2 : seulement dans la table de migration du magasin. */
const ANCIENS_LIANTS: [RegExp, string][] = [
  [/"Fly Ash"|"Ciment CP10"|"Ciment CP50"/, "noms normalisés du catalogue (v3)"],
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const SOURCES = fichiers(RACINE)
  .map((chemin) => ({ rel: relative(RACINE, chemin).split(sep).join("/"), chemin }))
  .filter(({ rel }) => !EXEMPTES.some((re) => re.test(rel)));

describe("terminologie — les anciens libellés ne reviennent pas", () => {
  it("parcourt bien le code de l'interface", () => {
    expect(SOURCES.some((f) => f.rel === "lib/report-schema.ts")).toBe(true);
    expect(SOURCES.some((f) => f.rel === "app/guide/page.tsx")).toBe(true);
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  it("aucun libellé retiré", () => {
    const trouves: string[] = [];
    for (const { rel, chemin } of SOURCES) {
      const lignes = readFileSync(chemin, "utf8").split("\n");
      lignes.forEach((ligne, i) => {
        for (const [re, remplacant] of RETIRES) {
          if (re.test(ligne)) trouves.push(`${rel}:${i + 1} « ${ligne.trim().slice(0, 90)} » -> ${remplacant}`);
        }
        if (rel !== "lib/store.tsx") {
          for (const [re, remplacant] of ANCIENS_LIANTS) {
            if (re.test(ligne)) trouves.push(`${rel}:${i + 1} -> ${remplacant}`);
          }
        }
      });
    }
    expect(trouves).toEqual([]);
  });
});
