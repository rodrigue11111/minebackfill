// Garde : aucun nom des classeurs du professeur dans un texte affiché ou
// exporté (demande de l'utilisateur, 2026-10-26 : « pas besoin de mentionner
// les feuilles Intra 2017 ou quoi dans le site »). Les classeurs restent la
// référence de validation : leurs noms vivent dans les commentaires, les
// tests d'or et la documentation, que cette garde ne lit pas.
//
// Même parcours que typographie.test.ts : l'arbre syntaxique TypeScript, les
// seuls textes (chaînes, gabarits, texte JSX), pas les commentaires. Les
// identifiants enregistrés (« intra2017 », « gramme-1.1 ») ne sont pas des
// mentions : ils restent dans les données, et l'écran les traduit
// (libelleVersion, lib/conventions.ts).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ANCIENS_NOMS_LIANTS_EXEMPLE } from "./exemple";

const RACINES = [
  { nom: "frontend", dossier: fileURLToPath(new URL("..", import.meta.url)) },
  { nom: "portail", dossier: fileURLToPath(new URL("../../../portail/src", import.meta.url)) },
];

const EXEMPTES = [/\.test\.tsx?$/, /^frontend\/lib\/api-types\.gen\.ts$/];

/** Textes permis tels quels : les anciens noms de l'exemple, gardés pour les renommer. */
const PERMIS: { fichier: string; texte: string }[] = Object.values(ANCIENS_NOMS_LIANTS_EXEMPLE)
  .map((texte) => ({ fichier: "frontend/lib/exemple.ts", texte }));

/** « classeur » seul reste permis : un classeur de presse est un fichier de l'étudiant. */
const MENTIONS = /Intra 2017|Belem 2016|feuilles? de calcul|feuille de référence|classeurs? (?:de référence|du professeur|de l'enseignant)|Feuille (?:tonne|gramme)/i;

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

function mentions(rel: string, chemin: string): Trouve[] {
  const source = readFileSync(chemin, "utf8");
  const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true,
    chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const trouves: Trouve[] = [];
  const visiter = (n: ts.Node) => {
    if (NOEUDS_TEXTE.has(n.kind)) {
      const texte = (n as ts.LiteralLikeNode).text;
      if (MENTIONS.test(texte)) {
        trouves.push({ rel, ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, texte });
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return trouves;
}

const TOUS = SOURCES.flatMap(({ rel, chemin }) => mentions(rel, chemin));
const estPermis = (t: Trouve) => PERMIS.some((p) => p.fichier === t.rel && p.texte === t.texte);

describe("aucun nom de classeur dans les textes affichés (2026-10-26)", () => {
  it("le parcours couvre bien les deux applications", () => {
    expect(SOURCES.some((s) => s.rel.startsWith("frontend/"))).toBe(true);
    expect(SOURCES.some((s) => s.rel.startsWith("portail/"))).toBe(true);
  });

  it("aucune mention, hors anciens noms de l'exemple", () => {
    const fautifs = TOUS.filter((t) => !estPermis(t)).map((t) => `${t.rel}:${t.ligne} « ${t.texte.slice(0, 90)} »`);
    expect(fautifs).toEqual([]);
  });

  it("la garde voit une mention dans un texte, pas dans un commentaire", () => {
    const sf = (code: string) => {
      const chemin = "x.ts";
      const f = ts.createSourceFile(chemin, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const t: string[] = [];
      const v = (n: ts.Node) => { if (NOEUDS_TEXTE.has(n.kind) && MENTIONS.test((n as ts.LiteralLikeNode).text)) t.push((n as ts.LiteralLikeNode).text); ts.forEachChild(n, v); };
      v(f);
      return t;
    };
    expect(sf('const a = "Feuille tonne (Intra 2017)";')).toHaveLength(1);
    expect(sf("// classeur de référence Intra 2017\nconst a = 1;")).toHaveLength(0);
    expect(sf('const a = "intra2017-1.0"; const b = "un classeur de presse";')).toHaveLength(0);
  });
});
