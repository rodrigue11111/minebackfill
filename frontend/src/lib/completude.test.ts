import { describe, expect, it } from "vitest";
import { completudeGachee, listeManquants } from "./completude";
import type { Gachee } from "./gachee";
import type { Eprouvette } from "./eprouvette";

const gachee = (p: Partial<Gachee> = {}): Gachee => ({
  id: "g1", code: "G-20261001-01", creeLe: "2026-10-01T12:00:00Z", statut: "brouillon",
  formulationLabel: "Test", categorie: "RPC", recetteIndex: 0,
  composants: [{ cle: "residu", label: "Résidu humide", cibleKg: 10 }, { cle: "liant", label: "Liant", cibleKg: 1 }],
  tolerancePct: 2, ajustements: [], eprouvettes: [], ...p,
});
const ep = (code: string, age: number, p: Partial<Eprouvette> = {}): Eprouvette => ({
  id: code, code, couleLe: "2026-10-01T12:00:00Z", ageJours: age, statut: "en_cure", ...p,
});
const etat = (g: Gachee, cle: string) => completudeGachee(g).items.find((i) => i.cle === cle)?.etat;

describe("completudeGachee", () => {
  it("gâchée neuve : les points sur les éprouvettes et les essais sont sans objet", () => {
    const c = completudeGachee(gachee());
    expect(c.items).toHaveLength(12);
    expect(etat(gachee(), "moules")).toBe("sans_objet");
    expect(etat(gachee(), "replicats")).toBe("sans_objet");
    expect(etat(gachee(), "essais")).toBe("sans_objet");
    expect(c.total).toBe(9);
    expect(c.renseignes).toBe(0);
    expect(c.pct).toBe(0);
  });

  it("chaque champ de la fiche coche son point", () => {
    const g = gachee({
      materiaux: { residu: { nom: "Résidus LaRonde" }, eau: { type: "robinet" } },
      lotLiant: "L-42",
      composants: [{ cle: "residu", label: "Résidu", cibleKg: 10, peseeKg: 10.02 }],
      w0MesurePct: 24, slumpMesureMm: 180, malaxageDureeMin: 5,
      cure: { mode: "chambre_humide", temperatureC: 23 },
    });
    const c = completudeGachee(g);
    expect(c.manquants).toEqual([]);
    expect(c.renseignes).toBe(9);
    expect(c.pct).toBe(100);
  });

  it("le lot de résidu suffit à identifier le résidu ; une chaîne vide ne compte pas", () => {
    expect(etat(gachee({ lotResidu: "R-7" }), "residu")).toBe("ok");
    expect(etat(gachee({ lotResidu: "  " }), "residu")).toBe("manque");
  });

  it("pesées : toutes ou rien ; sans composant, sans objet", () => {
    expect(etat(gachee({ composants: [{ cle: "a", label: "A", cibleKg: 1, peseeKg: 1 }, { cle: "b", label: "B", cibleKg: 1 }] }), "pesees")).toBe("manque");
    expect(etat(gachee({ composants: [] }), "pesees")).toBe("sans_objet");
  });

  it("éprouvettes : moule nominal ou texte libre ; deux réplicats par âge", () => {
    const g = gachee({ eprouvettes: [ep("E01", 7, { mouleDiametreMm: 50 }), ep("E02", 7, { moule: "cylindre maison" }), ep("E03", 28)] });
    expect(etat(g, "moules")).toBe("manque");
    expect(etat(g, "replicats")).toBe("manque");
    const g2 = gachee({ eprouvettes: [ep("E01", 7, { mouleDiametreMm: 50 }), ep("E02", 7, { mouleDiametreMm: 50 })] });
    expect(etat(g2, "moules")).toBe("ok");
    expect(etat(g2, "replicats")).toBe("ok");
  });

  it("essais : date, vitesse et mode de rupture (code ou texte) sur chaque éprouvette écrasée", () => {
    const essai = { date: "2026-10-08T12:00:00Z", contrainteKpaSaisie: 400, vitesseChargement: { valeur: 1, unite: "mm/min" as const } };
    const sansRupture = gachee({ eprouvettes: [ep("E01", 7, { statut: "ecrase", essai })] });
    expect(etat(sansRupture, "essais")).toBe("manque");
    const avecCode = gachee({ eprouvettes: [ep("E01", 7, { statut: "ecrase", essai: { ...essai, modeRuptureCode: "cone" } }), ep("E02", 28)] });
    expect(etat(avecCode, "essais")).toBe("ok");
    const ancienTexte = gachee({ eprouvettes: [ep("E01", 7, { statut: "ecrase", essai: { ...essai, modeRupture: "cône" } })] });
    expect(etat(ancienTexte, "essais")).toBe("ok");
  });

  it("ancienne gâchée sans tableaux : ne lève pas", () => {
    const vieille = { id: "v", code: "G-1", statut: "terminee" } as unknown as Gachee;
    expect(() => completudeGachee(vieille)).not.toThrow();
    expect(completudeGachee(vieille).items).toHaveLength(12);
  });
});

describe("listeManquants", () => {
  it("phrase lisible, au plus quatre points nommés", () => {
    const c = completudeGachee(gachee());
    expect(listeManquants(c)).toBe("résidu identifié, lot de liant, type d'eau, pesées réelles complètes et 5 autres");
    const g = gachee({
      materiaux: { residu: { nom: "R" }, eau: { type: "robinet" } }, lotLiant: "L", w0MesurePct: 1, slumpMesureMm: 1,
      malaxageDureeMin: 1, composants: [], cure: { mode: "immersion" },
    });
    expect(listeManquants(completudeGachee(g))).toBe("température de cure");
    expect(listeManquants({ ...completudeGachee(g), manquants: [] })).toBe("");
  });
});
