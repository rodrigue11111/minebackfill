// Garde du vouvoiement : le site s'adresse au lecteur par « vous », partout
// (décision de l'utilisateur, 2026-10-25). Quelques textes tutoyaient encore
// (« Choisis d'abord… », « Ajoute ce que tu as versé… »).
//
// Garde CIBLÉE, et non une analyse grammaticale : un impératif en « -e »
// (« Recharge la catégorie… ») est aussi une 3e personne descriptive, correcte
// dans une infobulle. On cherche donc seulement ce qui s'adresse SANS AMBIGUÏTÉ
// au lecteur (pronoms « tu », « toi », « ton », « ta », « tes », élision « t' »,
// « -toi ») et la liste des phrases déjà corrigées (régressions connues).
//
// Même parcours que typographie.test.ts : l'arbre syntaxique TypeScript, les
// textes seulement (chaînes, gabarits, texte JSX), pas les commentaires ; les
// valeurs de className sont ignorées (« ui-ton-alerte »).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINES = [
  { nom: "frontend", dossier: fileURLToPath(new URL("..", import.meta.url)) },
  { nom: "portail", dossier: fileURLToPath(new URL("../../../portail/src", import.meta.url)) },
];

const EXEMPTES = [/\.test\.tsx?$/, /^frontend\/lib\/api-types\.gen\.ts$/];

/** Textes permis tels quels (fichier, contenu exact du texte). Vide : aucune exception. */
const PERMIS: { fichier: string; texte: string }[] = [];

/** Formes qui s'adressent sans ambiguïté au lecteur par « tu ». */
const TUTOIEMENT: RegExp[] = [
  // Pronoms et possessifs, en mot isolé (ni lettre ni trait d'union autour).
  /(?<![\p{L}\p{N}_-])(?:tu|toi|ton|ta|tes)(?![\p{L}\p{N}_-])/iu,
  // Élision : « t'as », « t'en » (l'apostrophe peut être écrite &apos; en JSX).
  /(?<![\p{L}])t(?:'|’|&apos;)(?=\p{L})/iu,
  // Impératif pronominal : « Assure-toi ».
  /\p{L}-toi(?![\p{L}])/iu,
];

/** Phrases corrigées le 2026-10-25 : leur forme tutoyée ne doit pas revenir. */
const REGRESSIONS = [
  "Choisis d'abord", "Renseigne d'abord", "Renseigne le Gs", "Visualise ta", "fais varier",
  "Vérifie la recette", "Sélectionne au moins", "puis lance le calcul", "Réessaie", "Utilise plutôt",
  "Écrase une éprouvette", "saisis sa charge", "Saisis une charge", "mais indique pourquoi",
  "Choisis un âge", "Ajoute ce que", "Ajoute le liant", "corrige-le",
];

/** Formes fautives trouvées dans un texte (vide : rien à signaler). */
export function tutoiements(texte: string): string[] {
  const t = texte.replace(/&apos;/g, "'");
  const trouves: string[] = [];
  for (const re of TUTOIEMENT) {
    const m = re.exec(texte) ?? re.exec(t);
    if (m) trouves.push(m[0]);
  }
  for (const r of REGRESSIONS) if (t.includes(r)) trouves.push(r);
  return trouves;
}

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

interface Trouve { rel: string; ligne: number; texte: string; formes: string[] }

function textesTutoyes(rel: string, chemin: string): Trouve[] {
  const source = readFileSync(chemin, "utf8");
  const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true,
    chemin.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const trouves: Trouve[] = [];
  const visiter = (n: ts.Node) => {
    // Une classe CSS n'est pas un texte adressé au lecteur.
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === "className") return;
    if (NOEUDS_TEXTE.has(n.kind)) {
      const texte = (n as ts.LiteralLikeNode).text;
      const formes = tutoiements(texte);
      if (formes.length) trouves.push({ rel, ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, texte, formes });
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return trouves;
}

const TOUS = SOURCES.flatMap(({ rel, chemin }) => textesTutoyes(rel, chemin));
const estPermis = (t: Trouve) => PERMIS.some((p) => p.fichier === t.rel && p.texte === t.texte);

describe("vouvoiement : le site s'adresse au lecteur par « vous »", () => {
  it("parcourt bien MineBackfill et le portail", () => {
    const rels = new Set(SOURCES.map((s) => s.rel));
    expect(rels.has("frontend/app/analyse/page.tsx")).toBe(true);
    expect(rels.has("frontend/components/labo/EditeurGachee.tsx")).toBe(true);
    expect(rels.has("portail/app/page.tsx")).toBe(true);
    expect(SOURCES.length).toBeGreaterThan(150);
  });

  it("aucun texte affiché ou exporté ne tutoie", () => {
    const fautifs = TOUS.filter((t) => !estPermis(t))
      .map((t) => `${t.rel}:${t.ligne} [${t.formes.join(", ")}] « ${t.texte.trim().replace(/\s+/g, " ").slice(0, 90)} »`);
    expect(fautifs).toEqual([]);
  });

  it("les exceptions permises existent encore (sinon, les retirer de la liste)", () => {
    for (const p of PERMIS) expect(TOUS.some((t) => t.rel === p.fichier && t.texte === p.texte), p.fichier).toBe(true);
  });

  it("attrape le tutoiement, ignore les infobulles descriptives et les mots voisins", () => {
    for (const fautif of [
      "Visualise ta recette", "Tu peux recalculer", "t'as oublié le Gs", "Si t&apos;as un doute",
      "Assure-toi du contenant", "Choisis d'abord un calcul", "puis corrige-le.", "Ajoute ce que tu as versé",
    ]) expect([fautif, tutoiements(fautif).length > 0]).toEqual([fautif, true]);
    for (const correct of [
      "Recharge la catégorie, la méthode et les résultats", "Rouvre un balayage exporté en JSON",
      "Ajoute une entrée officielle", "bouton", "pâte", "état", "tâche", "ui-ton-alerte", "Tonne", "Taux",
      "Choisissez d'abord un calcul sauvegardé", "aujourd'hui", "l'écart", "qu'une recette",
    ]) expect([correct, tutoiements(correct)]).toEqual([correct, []]);
  });
});
