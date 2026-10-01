import { describe, expect, it } from "vitest";
import { regrouper, type LigneClasse, type ProfilClasse } from "./classe";
import { comparerClasse } from "./classe-comparaison";
import { alertesClasse } from "./classe-alertes";
import type { LigneAnnotation } from "./classe-reseau";
import { documentRapportClasse, documentRapportEtudiant, nombrePdf, pourPdf, type ContexteRapport } from "./rapport-classe";
import { construirePdf } from "./rapport-classe-pdf";
import { TIRET } from "./format";

const A = "a", B = "b", C = "c", PROF = "p";
const profils: ProfilClasse[] = [
  { id: A, email: "alice@x.ca", display_name: "Alice Tremblay", role: "etudiant" },
  { id: B, email: "bruno@x.ca", display_name: "Bruno Côté", role: "etudiant" },
  { id: C, email: null, display_name: "Chloé Œuvray", role: "etudiant" },
];
const jour = (m: number, j: number) => new Date(2026, m - 1, j, 12).toISOString();
function gachee(id: string, kpa: number[], extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: jour(9, 10), statut: "terminee", formulationLabel: "Formule « A »", categorie: "RPC",
    recetteIndex: 0, tolerancePct: 2, ajustements: [], parametres: { cwPct: 75, bwPct: 5 },
    composants: [{ cle: "liant", label: "Liant", cibleKg: 5, peseeKg: 5.4 }],
    eprouvettes: kpa.map((k, i) => ({ id: `${id}-${i}`, code: `G-${id}-E0${i}`, couleLe: jour(9, 10), ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: k } })),
    ...extra,
  };
}
const ligne = (p: string, contenu: { id: string }, kind: "gachee" | "resultat" = "gachee"): LigneClasse =>
  ({ proprietaire: p, kind, id: contenu.id, rev: 1, maj: "2026-10-01T10:00:00.000000+00:00", cree: "c", supprime: false, contenu });

const etudiants = regrouper([
  ligne(A, gachee("a1", [1000, 1100])),
  ligne(A, { id: "r1", savedAt: jour(9, 9), label: "Formule A", category: "RPC", method: "dosage_cw", recipes: [{}] } as never, "resultat"),
  ligne(B, gachee("b1", [900])),
  ligne(B, gachee("b1c", [900], { conflit: { de: "b1", le: "x" } })),
  ligne(C, gachee("c1", [400])),
], profils, [], "toutes");
const annotations: LigneAnnotation[] = [
  { id: "n1", owner_id: A, auteur_id: PROF, target_kind: "gachee", target_id: "a1", target_rev: 1, ancre: "G-a1-E01", texte: "Écart ≥ 10 % ?", deleted: false, created_at: jour(10, 2), updated_at: jour(10, 3), lu_le: jour(10, 3) },
  { id: "n2", owner_id: A, auteur_id: A, target_kind: "gachee", target_id: "a1", target_rev: 1, ancre: null, texte: "Oui, la presse — voir σ.", deleted: false, created_at: jour(10, 4), updated_at: jour(10, 4), lu_le: null },
];
const comparaison = comparerClasse(etudiants);
const ctx: ContexteRapport = {
  session: "Automne 2026", genereLe: new Date(2026, 9, 20), moi: PROF, annotations, comparaison,
  alertes: alertesClasse(etudiants, { maintenant: new Date(2026, 9, 20), comparaison, sessionActiveAffichee: false }),
};
const texteDe = (d: ReturnType<typeof documentRapportClasse>) => JSON.stringify(d.blocs);

describe("rapport de session — modèle", () => {
  it("synthèse puis un chapitre par étudiant, chacun sur une nouvelle page", () => {
    const d = documentRapportClasse(etudiants, ctx);
    expect(d.titre).toBe("Rapport de session");
    expect(d.sousTitre).toContain("Automne 2026");
    expect(d.blocs.filter((b) => b.type === "saut")).toHaveLength(3);
    const titres1 = d.blocs.filter((b) => b.type === "titre" && b.niveau === 1).map((b) => (b as { texte: string }).texte);
    expect(titres1).toEqual(["Synthèse de la classe", "Alice Tremblay", "Bruno Côté", "Chloé Œuvray"]);
    expect(texteDe(d)).toContain("3 étudiants · 3 gâchées · 1 résultat · 4 essais valides");
  });

  it("aucune médiane, aucune moyenne entre gâchées : l'étendue seulement", () => {
    const t = texteDe(documentRapportClasse(etudiants, ctx));
    expect(t).toContain("Étendue de l'UCS (kPa)");
    expect(t).toContain("400 à 1 050");
    // Le mot peut décrire un seuil ; une VALEUR de médiane, jamais.
    expect(t).not.toMatch(/médiane[^"]*kPa/);
    expect(t).not.toMatch(/[Mm]édiane du groupe/);
  });

  it("chapitre d'un étudiant : gâchées, UCS par âge, résultats, alertes, fil avec lectures", () => {
    const d = documentRapportEtudiant(etudiants[0], ctx);
    expect(d.titre).toBe("Rapport individuel : Alice Tremblay");
    const t = texteDe(d);
    expect(t).toContain("28 j : 1 050 ± 71 (n=2)");
    expect(t).toContain("Pesée hors tolérance");
    expect(t).toContain("Formule A");
    expect(t).toContain("Vous");
    expect(t).toContain("Oui, la presse");
    expect(t).not.toContain("copie de conflit");
    const bruno = texteDe(documentRapportEtudiant(etudiants[1], ctx));
    expect(bruno).toContain("+ 1 copie de conflit, non comptée");
  });

  it("étudiant sans document : un chapitre court", () => {
    const vide = regrouper([], [{ id: "z", email: null, display_name: "Zoé", role: "etudiant" }], [], "toutes");
    expect(texteDe(documentRapportEtudiant(vide[0], ctx))).toContain("Aucun document en ligne");
  });
});

describe("rapport de session — texte pour la police du PDF", () => {
  it("garde le français et les signes WinAnsi, remplace le reste", () => {
    expect(pourPdf("Écart « œuvre » — l’été… 50 %")).toBe("Écart « œuvre » — l’été… 50 %");
    expect(pourPdf("≥ 10 · σ = 3 · 1 234 · −5 · CO₂ · →")).toBe(">= 10 · s = 3 · 1 234 · -5 · CO2 · ->");
    expect(pourPdf("漢")).toBe("?");
    for (const c of pourPdf("Chloé Œuvray ≥ σ ₃ → ∞ 😀")) {
      const code = c.codePointAt(0)!;
      expect(code <= 0xff || "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".includes(c)).toBe(true);
    }
  });

  it("nombres à la française, sans séparateur de locale", () => {
    expect(nombrePdf(1234.567, 1)).toBe("1 234,6");
    expect(nombrePdf(-0.04, 1)).toBe("0,0");
    expect(nombrePdf(-12, 0)).toBe("-12");
    expect(nombrePdf(null)).toBe(TIRET);
  });
});

describe("rapport de session — PDF (essai de fumée sous Node)", () => {
  it("produit un PDF de plusieurs pages, texte en WinAnsi (jamais en UCS-2)", async () => {
    const doc = await construirePdf(documentRapportClasse(etudiants, ctx));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(4);
    const brut = doc.output();
    expect(brut.startsWith("%PDF-")).toBe(true);
    expect(brut).not.toContain("\u0000");
    expect(brut).toContain("Chloé \u008cuvray"); // Œ = 0x8C en WinAnsi
  });
});
