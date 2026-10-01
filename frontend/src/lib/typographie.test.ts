// Garde typographique : aucun tiret cadratin « — » ni demi-cadratin « – » dans
// un texte affiché ou exporté, ni dans MineBackfill ni dans le portail. Ces
// tirets donnaient aux textes un air « écrit par une IA » (décision du
// 2026-09-30) : on écrit avec la ponctuation ordinaire (virgule, deux-points,
// parenthèses, point), « 3 à 10 » pour un intervalle et « − » (U+2212) pour
// un signe moins dans une formule.
//
// Seule exception : la valeur absente des tableaux et des tuiles, TIRET de
// lib/format.ts, définie à un seul endroit. Le parcours lit l'arbre syntaxique
// TypeScript : seuls les textes comptent (chaînes, gabarits, texte JSX), pas
// les commentaires ; un échappement "—" ou une entité &mdash; est vu
// comme le caractère lui-même.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { TIRET } from "./format";
import { WINANSI_EXTRA } from "./texte-pdf";

const RACINES = [
  { nom: "frontend", dossier: fileURLToPath(new URL("..", import.meta.url)) },
  { nom: "portail", dossier: fileURLToPath(new URL("../../../portail/src", import.meta.url)) },
];

const EXEMPTES = [/\.test\.tsx?$/, /^frontend\/lib\/api-types\.gen\.ts$/];

/** Textes permis tels quels (fichier, contenu exact du texte). */
const PERMIS: { fichier: string; texte: string }[] = [
  { fichier: "frontend/lib/format.ts", texte: TIRET },
  { fichier: "frontend/lib/texte-pdf.ts", texte: WINANSI_EXTRA },
];

const TIRETS = /[–—]|&(?:mdash|ndash|#821[12]|#x201[34]);/i;

const NOEUDS_TEXTE = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

const SOURCES = RACINES.flatMap(({ nom, dossier }) =>
  fichiers(dossier).map((chemin) => ({ rel: `${nom}/${relative(dossier, chemin).split(sep).join("/")}`, chemin })),
).filter(({ rel }) => !EXEMPTES.some((re) => re.test(rel)));

interface Trouve { rel: string; ligne: number; texte: string }

function textesAvecTiret(rel: string, chemin: string): Trouve[] {
  const source = readFileSync(chemin, "utf8");
  const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true,
    chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const trouves: Trouve[] = [];
  const visiter = (n: ts.Node) => {
    if (NOEUDS_TEXTE.has(n.kind)) {
      const texte = (n as ts.LiteralLikeNode).text;
      if (TIRETS.test(texte)) {
        trouves.push({ rel, ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, texte });
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return trouves;
}

const TOUS = SOURCES.flatMap(({ rel, chemin }) => textesAvecTiret(rel, chemin));
const estPermis = (t: Trouve) => PERMIS.some((p) => p.fichier === t.rel && p.texte === t.texte);

describe("typographie : pas de tiret cadratin ni demi-cadratin dans les textes", () => {
  it("parcourt bien MineBackfill et le portail", () => {
    const rels = new Set(SOURCES.map((s) => s.rel));
    expect(rels.has("frontend/app/guide/page.tsx")).toBe(true);
    expect(rels.has("frontend/lib/formulas-data.ts")).toBe(true);
    expect(rels.has("portail/app/page.tsx")).toBe(true);
    expect(SOURCES.length).toBeGreaterThan(150);
  });

  it("aucun « — » ni « – » dans un texte affiché ou exporté", () => {
    const fautifs = TOUS.filter((t) => !estPermis(t))
      .map((t) => `${t.rel}:${t.ligne} « ${t.texte.trim().replace(/\s+/g, " ").slice(0, 90)} »`);
    expect(fautifs).toEqual([]);
  });

  it("les exceptions permises existent encore (sinon, les retirer de la liste)", () => {
    for (const p of PERMIS) {
      if (!TIRETS.test(p.texte)) continue;
      expect(TOUS.some((t) => t.rel === p.fichier && t.texte === p.texte), p.fichier).toBe(true);
    }
  });

  it("aucun tiret dans une propriété CSS content", () => {
    const feuilles = [
      { rel: "frontend/app/globals.css", url: new URL("../app/globals.css", import.meta.url) },
      { rel: "portail/app/globals.css", url: new URL("../../../portail/src/app/globals.css", import.meta.url) },
    ];
    const fautifs: string[] = [];
    for (const { rel, url } of feuilles) {
      const css = readFileSync(fileURLToPath(url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/content\s*:\s*([^;}]*)/g)) {
        if (/[–—]|\\201[34]/i.test(m[1])) fautifs.push(`${rel} « ${m[0].trim()} »`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
