import { describe, expect, it } from "vitest";
import { regrouper, type LigneClasse, type ProfilClasse } from "./classe";
import { EN_TETES_ECHEANCIER, echeancierClasse, icsClasse, lignesCsvEcheancier } from "./classe-echeancier";

const A = "a", B = "b";
const profils: ProfilClasse[] = [
  { id: A, email: null, display_name: "Alice", role: "etudiant" },
  { id: B, email: null, display_name: "=Bruno", role: "etudiant" },
];
const jour = (m: number, j: number) => new Date(2026, m - 1, j, 12).toISOString();
const maintenant = new Date(2026, 9, 20, 9); // 20 octobre

function gachee(id: string, eps: { code: string; coule: string; age: number; statut?: string }[], extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: jour(9, 1), statut: "brouillon", formulationLabel: "Formule A", categorie: "RPC",
    recetteIndex: 0, tolerancePct: 2, ajustements: [], composants: [],
    eprouvettes: eps.map((e, i) => ({ id: `${id}-${i}`, code: e.code, couleLe: e.coule, ageJours: e.age, statut: e.statut ?? "en_cure" })),
    ...extra,
  };
}
const ligne = (p: string, contenu: { id: string }): LigneClasse => ({ proprietaire: p, kind: "gachee", id: contenu.id, rev: 1, maj: "m", cree: "c", supprime: false, contenu });

describe("échéancier de la classe", () => {
  const etudiants = regrouper([
    ligne(A, gachee("a1", [
      { code: "A-E1", coule: jour(9, 20), age: 28 }, // 18 oct : en retard
      { code: "A-E2", coule: jour(9, 22), age: 28 }, // 20 oct : aujourd'hui
      { code: "A-E3", coule: jour(9, 22), age: 7, statut: "ecrase" }, // faite
    ])),
    ligne(B, gachee("b1", [
      { code: "B-E1", coule: jour(10, 1), age: 28 }, // 29 oct : dans 9 j
      { code: "B-E2", coule: jour(10, 20), age: 7 }, // 27 oct : dans 7 j
    ])),
    ligne(B, gachee("b1c", [{ code: "B-E1", coule: jour(10, 1), age: 28 }], { conflit: { de: "b1", le: "x" } })),
  ], profils, [], "toutes");

  it("éprouvettes en cure seulement, triées par échéance, avec l'étudiant ; copies exclues", () => {
    const l = echeancierClasse(etudiants, maintenant);
    expect(l.map((x) => [x.eprouvetteCode, x.etudiant, x.classe, x.joursRestants])).toEqual([
      ["A-E1", "Alice", "retard", -2],
      ["A-E2", "Alice", "aujourdhui", 0],
      ["B-E2", "=Bruno", "proche", 7],
      ["B-E1", "=Bruno", "planifie", 9],
    ]);
  });

  it("calendrier .ics : un événement par éprouvette, identifiant par étudiant", () => {
    const ics = icsClasse(echeancierClasse(etudiants, maintenant), new Date(Date.UTC(2026, 9, 20, 7)));
    const deplie = ics.replace(/\r\n[ \t]/g, "");
    expect(deplie.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(deplie).toContain("UID:a.a1-0@minebackfill");
    expect(deplie).toContain("SUMMARY:Écraser A-E1 (Alice)");
  });

  it("liste CSV, formules neutralisées", () => {
    const l = lignesCsvEcheancier(echeancierClasse(etudiants, maintenant));
    expect(l[0]).toEqual(EN_TETES_ECHEANCIER);
    expect(l[1]).toEqual(["2026-10-18", "en retard", -2, "Alice", "A-E1", 28, "G-a1", "Formule A"]);
    expect(l[3][3]).toBe("'=Bruno");
  });
});
