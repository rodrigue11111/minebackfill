// Rendu de l'éditeur d'une gâchée (sans navigateur) : frise de cure, pesées
// sur bande de tolérance, note de l'enseignant en contexte, éprouvettes,
// résistance mesurée et parties du téléphone.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EditeurGachee from "./EditeurGachee";
import type { Gachee } from "@/lib/gachee";
import type { Annotation } from "@/lib/annotations";

const coulee = new Date(2026, 8, 29, 12).toISOString();
const gachee: Gachee = {
  id: "g1", code: "G-20260929-01", creeLe: coulee, statut: "brouillon", formulationLabel: "Formule témoin",
  categorie: "RPC", recetteIndex: 0, tolerancePct: 2, ajustements: [{ id: "a1", type: "eau", masseKg: 0.4, note: "trop sec" }],
  composants: [
    { cle: "residu", label: "Résidu humide", cibleKg: 1518.3, peseeKg: 1516.8 },
    { cle: "liant", label: "Liant", cibleKg: 69, peseeKg: 74.52 },
  ],
  eprouvettes: [
    { id: "e1", code: "G-20260929-01-E01", couleLe: coulee, ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 412 } },
    { id: "e2", code: "G-20260929-01-E02", couleLe: coulee, ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 398 } },
    { id: "e3", code: "G-20260929-01-E03", couleLe: coulee, ageJours: 28, statut: "en_cure" },
  ],
  protocolesSnapshot: [{ titre: "Malaxage", contenu: "5 minutes" }],
} as Gachee;

const note = (id: string, p: Partial<Annotation>): Annotation => ({
  id, cibleKind: "gachee", cibleId: "g1", cibleRev: null, ancre: null, texte: "t", supprime: false,
  maj: "2026-10-07T13:12:00Z", auteur: "enseignant", creeLe: "2026-10-07T13:12:00Z", luLe: null, ...p,
});

const rendu = (annotations: Annotation[] = []) => renderToStaticMarkup(createElement(EditeurGachee, {
  gachee, maintenant: new Date(2026, 9, 7, 9), annotations, connecte: true,
  onMaj: () => {}, onRetour: () => {}, onSupprimer: () => {},
}));

describe("éditeur d'une gâchée", () => {
  it("en-tête, frise de cure et résistance mesurée", () => {
    const html = rendu();
    expect(html).toContain("G-20260929-01");
    expect(html).toContain("Brouillon");
    expect(html).toContain("Marquer terminée");
    expect(html).toContain("Importer un fichier de presse");
    expect(html).toContain("Jour 8 sur 28 · prochain écrasement dans 20 jours");
    expect(html).toContain("Résistance mesurée");
    expect(html).toContain("405 kPa"); // moyenne à 7 j de 412 et 398
  });

  it("pesées sur bande de tolérance : le liant à +8 % est hors tolérance", () => {
    const html = rendu();
    expect(html).toContain("La bande claire est la tolérance de ± 2 % autour de la cible");
    expect(html).toContain("+8,0 %, hors tolérance");
    expect(html).toContain("labo-bande-hors");
    expect(html).toContain("−0,1 %");
  });

  it("la note de l'enseignant sur une pesée s'affiche sous cette pesée, pas dans les échanges", () => {
    const html = rendu([note("n1", { ancre: "Pesée : Liant", texte: "Le liant est pesé à +8 % : refais la pesée." })]);
    const posNote = html.indexOf("Le liant est pesé à +8 %");
    expect(posNote).toBeGreaterThan(html.indexOf("Pesée : Liant") === -1 ? html.indexOf(">Liant<") : 0);
    expect(posNote).toBeLessThan(html.indexOf("Ajustements (essai-erreur)"));
    expect(html).toContain("Les notes de l&#x27;enseignant sont affichées sous la pesée ou l&#x27;éprouvette qu&#x27;elles visent.");
  });

  it("note sur une éprouvette : sous la ligne de l'éprouvette ; note générale : dans les échanges", () => {
    const html = rendu([
      note("n1", { ancre: "G-20260929-01-E01", texte: "Pourquoi 412 kPa ?" }),
      note("n2", { texte: "Bonne gâchée dans l'ensemble." }),
    ]);
    expect(html.indexOf("Pourquoi 412 kPa ?")).toBeGreaterThan(html.indexOf("G-20260929-01-E01"));
    expect(html.indexOf("Pourquoi 412 kPa ?")).toBeLessThan(html.indexOf("G-20260929-01-E02"));
    expect(html.indexOf("Bonne gâchée dans l&#x27;ensemble.")).toBeGreaterThan(html.indexOf("Échanges"));
  });

  it("téléphone : trois parties, chaque bloc porte la sienne (bascule en CSS)", () => {
    const html = rendu([note("n2", { texte: "général" })]);
    expect(html).toContain('data-vue="pesees"');
    expect(html).toContain('aria-label="Parties de la gâchée"');
    for (const s of ["pesees", "eprouvettes", "echanges"]) expect(html).toContain(`data-section="${s}"`);
    expect(html).toContain('aria-label="Commentaire non lu"');
  });
});
