import { describe, expect, it } from "vitest";
import { regrouper, type LigneClasse, type ProfilClasse } from "./classe";
import {
  arrondiDemiPoint, cleFormulation, comparerClasse, libelleGroupe, mediane, MIN_GACHEES_REPERE,
} from "./classe-comparaison";

const A = "a", B = "b", C = "c";
const profils: ProfilClasse[] = [
  { id: A, email: null, display_name: "Alice", role: "etudiant" },
  { id: B, email: null, display_name: "Bruno", role: "etudiant" },
  { id: C, email: null, display_name: "Chloé", role: "etudiant" },
];

function gachee(id: string, p: { cw?: number; bw?: number; cat?: string }, kpa: number[], extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: "2026-10-01T12:00:00.000Z", statut: "terminee", formulationLabel: "M", categorie: p.cat ?? "RPC",
    recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [],
    parametres: { cwPct: p.cw, bwPct: p.bw, wcRatio: 7 },
    eprouvettes: kpa.map((k, i) => ({ id: `${id}-e${i}`, code: `G-${id}-E0${i}`, couleLe: "2026-10-01T12:00:00.000Z", ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: k } })),
    ...extra,
  };
}
const ligne = (proprietaire: string, contenu: { id: string }): LigneClasse =>
  ({ proprietaire, kind: "gachee", id: contenu.id, rev: 1, maj: "m", cree: "c", supprime: false, contenu });
const classe = (...l: LigneClasse[]) => regrouper(l, profils, [], "toutes");

describe("comparaison — même formulation", () => {
  it("arrondi au demi-point", () => {
    expect(arrondiDemiPoint(75.24)).toBe(75);
    expect(arrondiDemiPoint(75.25)).toBe(75.5);
    expect(arrondiDemiPoint(74.76)).toBe(75);
    expect(cleFormulation("RPC", { cwPct: 75.3, bwPct: 4.9 })).toBe("RPC|75.5|5");
    expect(cleFormulation("RPC", { cwPct: 75 })).toBeNull();
    expect(cleFormulation("RPC", undefined)).toBeNull();
  });

  it("médiane", () => {
    expect(mediane([])).toBeNull();
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([4, 1, 3, 2])).toBe(2.5);
  });

  it("regroupe par catégorie + Cw + Bw arrondis ; un groupe exige deux étudiants", () => {
    const c = comparerClasse(classe(
      ligne(A, gachee("a1", { cw: 75.1, bw: 5 }, [1000])),
      ligne(B, gachee("b1", { cw: 74.9, bw: 5.2 }, [900])), // même demi-point
      ligne(C, gachee("c1", { cw: 75, bw: 5, cat: "RPG" }, [800])), // autre catégorie
      ligne(C, gachee("c2", { cw: 70, bw: 5 }, [700])), ligne(C, gachee("c3", { cw: 70, bw: 5 }, [710])), // un seul étudiant
    ));
    // Matériaux non renseignés : segment « ?/? » (résidu, liants), comparés entre eux seulement.
    expect(c.groupes.map((g) => [g.cle, g.nbEtudiants, g.nbGachees])).toEqual([["RPC|75|5|?/?", 2, 2]]);
    expect(libelleGroupe(c.groupes[0])).toBe("RPC · Cw 75 % · Bw 5 %");
  });

  it("une ligne par gâchée et par âge ; jamais de moyenne ; repère seulement à partir de 3 gâchées", () => {
    const deux = comparerClasse(classe(ligne(A, gachee("a1", { cw: 75, bw: 5 }, [1000, 1100])), ligne(B, gachee("b1", { cw: 75, bw: 5 }, [800]))));
    const age = deux.groupes[0].parAge[0];
    expect(age.lignes.map((l) => [l.gacheeCode, l.moyenneKpa, l.n])).toEqual([["G-a1", 1050, 2], ["G-b1", 800, 1]]);
    expect(age.repere).toBeNull(); // 2 gâchées : la médiane serait leur moyenne
    expect(age.lignes.every((l) => l.ecartMedianePct === null)).toBe(true);
    expect(Object.keys(deux.groupes[0]).some((k) => /moyenne/i.test(k))).toBe(false);

    const trois = comparerClasse(classe(
      ligne(A, gachee("a1", { cw: 75, bw: 5 }, [1000])),
      ligne(B, gachee("b1", { cw: 75, bw: 5 }, [800])),
      ligne(B, gachee("b2", { cw: 75, bw: 5 }, [1200])),
    ));
    const r = trois.groupes[0].parAge[0];
    expect(MIN_GACHEES_REPERE).toBe(3);
    expect(r.repere).toEqual({ medianeKpa: 1000, minKpa: 800, maxKpa: 1200, nGachees: 3 });
    expect(r.lignes.map((l) => l.ecartMedianePct)).toEqual([20, 0, -20]);
  });

  it("même id de formulation chez deux étudiants : chacun la sienne ; copies de conflit exclues ; sans paramètres listées", () => {
    // Pas d'instantané figé : les paramètres viennent de la formulation d'origine, chez SON auteur.
    const res = (id: string, bw: number) => ({ id, savedAt: "2026-10-01T12:00:00Z", recipes: [{ solids_mass_pct: 75, bw_mass_pct: bw }] });
    const sansInstantane = (id: string) => gachee(id, {}, [900], { parametres: undefined, formulationId: "f1" });
    const l: LigneClasse[] = [
      { ...ligne(A, res("f1", 5)), kind: "resultat" }, { ...ligne(B, res("f1", 7)), kind: "resultat" },
      ligne(A, sansInstantane("a1")), ligne(B, sansInstantane("b1")),
      ligne(C, gachee("c1", { cw: 75, bw: 5 }, [950])),
      ligne(C, gachee("c1-copie", { cw: 75, bw: 5 }, [950], { conflit: { de: "c1", le: "x" } })),
      ligne(C, gachee("c9", {}, [1])),
    ];
    const c = comparerClasse(classe(...l));
    expect(c.groupes.map((g) => g.cle)).toEqual(["RPC|75|5|?/?"]); // a1 (Bw 5) + c1 ; b1 est à Bw 7
    expect(c.groupes[0].parAge[0].lignes.map((x) => x.gacheeCode).sort()).toEqual(["G-a1", "G-c1"]);
    expect(c.sansParametres.map((x) => x.code)).toEqual(["G-c9"]);
  });

  it("critère élargi (2026-10-20) : mêmes matériaux, proportions des liants, granulat et Am en RPG", () => {
    const mat = (residu: string, liants: [string, number][], granulat?: string) => ({
      materiaux: {
        residu: { id: residu, nom: `Résidu ${residu}` },
        liants: liants.map(([id, f]) => ({ id, nom: id, fractionPct: f })),
        ...(granulat ? { granulat: { id: granulat, nom: `Granulat ${granulat}` } } : {}),
      },
    });
    const rpg = (id: string, am: number, extra: Record<string, unknown>) =>
      gachee(id, { cw: 80, bw: 4, cat: "RPG" }, [500], { ...extra, parametres: { cwPct: 80, bwPct: 4, amPct: am } });
    const c = comparerClasse(classe(
      // Même dosage, mêmes matériaux (ordre des liants indifférent, 79,8 % arrondi à 80 %) : un groupe.
      ligne(A, gachee("a1", { cw: 75, bw: 5 }, [1000], mat("r1", [["GU", 80], ["SL", 20]]))),
      ligne(B, gachee("b1", { cw: 75, bw: 5 }, [900], mat("r1", [["SL", 20.2], ["GU", 79.8]]))),
      // Même dosage, autres proportions de liant : à part (et seule).
      ligne(C, gachee("c1", { cw: 75, bw: 5 }, [800], mat("r1", [["GU", 50], ["SL", 50]]))),
      // RPG : même granulat, Am 30 et 30,2 (même demi-point) ; puis Am 40 : à part.
      ligne(A, rpg("a2", 30, mat("r1", [["GU", 100]], "g1"))),
      ligne(B, rpg("b2", 30.2, mat("r1", [["GU", 100]], "g1"))),
      ligne(C, rpg("c2", 40, mat("r1", [["GU", 100]], "g1"))),
    ));
    expect(c.groupes.map((g) => [g.cle, g.nbGachees])).toEqual([
      ["RPC|75|5|r1/GU:80+SL:20", 2],
      ["RPG|80|4|r1/GU:100/g1:30", 2],
    ]);
    expect(libelleGroupe(c.groupes[0])).toBe("RPC · Cw 75 % · Bw 5 % · Résidu r1 · GU 80 % + SL 20 %");
    expect(libelleGroupe(c.groupes[1])).toBe("RPG · Cw 80 % · Bw 4 % · Résidu r1 · GU 100 % · Granulat g1 (Am 30 %)");
  });

  it("une ligne signale ses essais hors fenêtre d'âge, sans changer la moyenne", () => {
    const tot = (id: string) => gachee(id, { cw: 75, bw: 5 }, [1000, 1200]);
    const a1 = tot("a1");
    // Écrasée le jour du coulage pour 28 j visés.
    (a1.eprouvettes[0] as Record<string, unknown>).essai = { contrainteKpaSaisie: 1000, date: "2026-10-01T12:00:00.000Z" };
    const c = comparerClasse(classe(ligne(A, a1), ligne(B, tot("b1"))));
    const l = c.groupes[0].parAge[0].lignes.find((x) => x.gacheeCode === "G-a1")!;
    expect([l.n, l.nHorsFenetre, l.moyenneKpa]).toEqual([2, 1, 1100]);
  });
});
