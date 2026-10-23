import { describe, expect, it } from "vitest";
import { resumeClasse } from "./classe-resume";
import type { EtudiantClasse } from "./classe";
import type { EcheanceClasse } from "./classe-echeancier";
import type { LigneAnnotation } from "./classe-reseau";
import type { InfoRevue } from "./revues";

const etudiant = (id: string, nbEssais: number, gachees: { conflit?: boolean; eprouvettes?: unknown[] }[]) =>
  ({ id, nom: id, email: null, resultats: [], gachees, nbEssais, derniereActivite: null }) as unknown as EtudiantClasse;
const echeance = (classe: EcheanceClasse["classe"]) => ({ classe }) as EcheanceClasse;

describe("résumé de la classe", () => {
  it("essais valides et gâchées (copies de conflit exclues)", () => {
    const r = resumeClasse([etudiant("a", 3, [{}, { conflit: true }]), etudiant("b", 2, [{}, {}])], [], []);
    expect(r.essaisValides).toBe(5);
    expect(r.gachees).toBe(3);
    expect(r.essaisHorsFenetre).toBe(0);
  });

  it("essais valides hors fenêtre d'âge : comptés, et dénombrés à part (copies de conflit exclues)", () => {
    const ep = (date: string) => ({ id: date, code: "E", couleLe: "2026-09-01T12:00:00.000Z", ageJours: 28, statut: "ecrase",
      essai: { contrainteKpaSaisie: 900, date } });
    const g = { eprouvettes: [ep("2026-09-01T12:00:00.000Z"), ep("2026-09-29T12:00:00.000Z")] }; // 0 j puis 28 j
    const r = resumeClasse([etudiant("a", 2, [g, { ...g, conflit: true }])], [], []);
    expect([r.essaisValides, r.essaisHorsFenetre]).toEqual([2, 1]);
  });

  it("à écraser = en retard + aujourd'hui ; le reste attend", () => {
    const r = resumeClasse([], [echeance("retard"), echeance("aujourdhui"), echeance("aujourdhui"), echeance("proche"), echeance("planifie")], []);
    expect(r.aEcraser).toBe(3);
    expect(r.enRetard).toBe(1);
  });

  it("réponses d'étudiants non lues seulement (pas les commentaires de l'enseignant)", () => {
    const a = (owner: string, auteur: string, lu: string | null) =>
      ({ id: `${owner}${auteur}${lu}`, owner_id: owner, auteur_id: auteur, lu_le: lu }) as unknown as LigneAnnotation;
    const r = resumeClasse([], [], [a("e1", "e1", null), a("e1", "e1", "2026-10-01"), a("e1", "prof", null)]);
    expect(r.reponsesNonLues).toBe(1);
  });
});

describe("résumé : gâchées à revoir", () => {
  const e = (gachees: { id: string; statut: string; conflit?: unknown }[]) =>
    ({ id: "e1", nom: "e1", email: null, resultats: [], gachees, nbEssais: 0, derniereActivite: null }) as unknown as EtudiantClasse;
  const info = (perimee: boolean): InfoRevue => ({ decision: "acceptee", motif: null, ecartees: [], maj: "m", perimee, aRafraichir: false });

  it("terminées sans décision ou modifiées depuis ; null quand les revues sont indisponibles", () => {
    const etu = e([
      { id: "a", statut: "terminee" }, { id: "b", statut: "terminee" }, { id: "c", statut: "terminee" },
      { id: "d", statut: "brouillon" }, { id: "x", statut: "terminee", conflit: { de: "a" } },
    ]);
    const revues: Record<string, InfoRevue> = { b: info(false), c: info(true) };
    expect(resumeClasse([etu], [], [], (_o, id) => revues[id]).aRevoir).toBe(2); // a (sans décision) et c (modifiée)
    expect(resumeClasse([etu], [], []).aRevoir).toBeNull();
  });
});
