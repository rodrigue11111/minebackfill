import { describe, expect, it } from "vitest";
import { regrouper, type LigneClasse, type ProfilClasse } from "./classe";
import { comparerClasse } from "./classe-comparaison";
import { alertesClasse, libellesSeuils, SEUILS_ALERTES, type Alerte, type TypeAlerte } from "./classe-alertes";

const A = "a", B = "b", C = "c";
const profils: ProfilClasse[] = [
  { id: A, email: null, display_name: "Alice", role: "etudiant" },
  { id: B, email: null, display_name: "Bruno", role: "etudiant" },
  { id: C, email: null, display_name: "Chloé", role: "etudiant" },
];
// Tout se passe en septembre-octobre 2026, dates locales à midi.
const jour = (m: number, j: number, h = 12) => new Date(2026, m - 1, j, h).toISOString();
const maintenant = new Date(2026, 9, 20, 9); // 20 octobre, 9 h

type Ep = { code: string; age?: number; coule?: string; statut?: "ecrase" | "en_cure"; essai?: Record<string, unknown> };
function gachee(id: string, eps: Ep[], extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: jour(9, 1), statut: "terminee", formulationLabel: "M", categorie: "RPC",
    recetteIndex: 0, tolerancePct: 2, ajustements: [], composants: [],
    parametres: { cwPct: 75, bwPct: 5 },
    eprouvettes: eps.map((e, i) => ({ id: `${id}-${i}`, code: e.code, couleLe: e.coule ?? jour(9, 1), ageJours: e.age ?? 28, statut: e.statut ?? "ecrase", essai: e.essai })),
    ...extra,
  };
}
const ligne = (proprietaire: string, contenu: { id: string }, maj = "2026-10-19T10:00:00.000000+00:00"): LigneClasse =>
  ({ proprietaire, kind: "gachee", id: contenu.id, rev: 1, maj, cree: "c", supprime: false, contenu });

function alertes(l: LigneClasse[], o: Partial<Parameters<typeof alertesClasse>[1]> = {}): Alerte[] {
  const etudiants = regrouper(l, profils, [], "toutes");
  return alertesClasse(etudiants, { maintenant, comparaison: comparerClasse(etudiants), sessionActiveAffichee: false, ...o });
}
const types = (a: Alerte[]): TypeAlerte[] => a.map((x) => x.type);

describe("alertes « à surveiller »", () => {
  it("rien à signaler sur une gâchée propre", () => {
    const g = gachee("ok", [{ code: "E1", essai: { date: jour(9, 29), contrainteKpaSaisie: 1000 } }, { code: "E2", essai: { date: jour(9, 29), contrainteKpaSaisie: 1050 } }]);
    expect(alertes([ligne(A, g)])).toEqual([]);
  });

  it("écrasement en retard : en cure après l'échéance, pas le jour même", () => {
    const g = gachee("r", [
      { code: "E1", statut: "en_cure", coule: jour(9, 20), age: 28 }, // échéance 18 octobre : 2 j de retard
      { code: "E2", statut: "en_cure", coule: jour(9, 22), age: 28 }, // échéance aujourd'hui : pas encore en retard
    ]);
    const a = alertes([ligne(A, g)]);
    expect(types(a)).toEqual(["echeance_depassee"]);
    expect(a[0].message).toContain("E1");
    expect(a[0].message).not.toContain("E2");
    expect(a[0].message).toContain("2 j de retard");
    expect(a[0].cible).toEqual({ kind: "gachee", id: "r", code: "G-r" });
  });

  it("pesée hors tolérance ; composants absents (lecture allégée ancienne) : rien", () => {
    const g = gachee("p", [], { composants: [{ cle: "liant", label: "Liant", cibleKg: 5, peseeKg: 5.3 }, { cle: "eau", label: "Eau", cibleKg: 20, peseeKg: 20.2 }] });
    const a = alertes([ligne(A, g)]);
    expect(types(a)).toEqual(["pesee_hors_tolerance"]);
    expect(a[0].message).toBe("Liant +6 % (tolérance ± 2 %).");
    expect(alertes([ligne(A, gachee("p2", [], { composants: undefined }))])).toEqual([]);
  });

  it("âge à l'essai : max(1 j, 10 %) ; la presse d'abord ; inconnu : rien", () => {
    const g = gachee("f", [
      { code: "E1", age: 28, essai: { contrainteKpaSaisie: 900, tempsDeCureReelJours: 31 } }, // +3 j > 2,8 j
      { code: "E2", age: 28, essai: { contrainteKpaSaisie: 900, tempsDeCureReelJours: 30 } }, // +2 j ≤ 2,8 j
      { code: "E3", age: 7, coule: jour(9, 1), essai: { contrainteKpaSaisie: 400, date: jour(9, 10) } }, // 9 j pour 7 : +2 > 1
      { code: "E4", age: 7, essai: { contrainteKpaSaisie: 400 } }, // pas de date : inconnu
    ]);
    const a = alertes([ligne(A, g)]).filter((x) => x.type === "age_hors_fenetre");
    expect(a).toHaveLength(1);
    expect(a[0].message).toContain("E1 écrasée à 31 j pour 28 j visés");
    expect(a[0].message).toContain("E3 écrasée à 9 j pour 7 j visés");
    expect(a[0].message).not.toContain("E2");
    expect(a[0].message).not.toContain("E4");
  });

  it("répliques dispersées : CV > 15 % avec au moins 2 valeurs retenues ; l'exclue ne compte pas", () => {
    const g = gachee("cv", [
      { code: "E1", essai: { contrainteKpaSaisie: 1000 } },
      { code: "E2", essai: { contrainteKpaSaisie: 1400 } },
      { code: "E3", essai: { contrainteKpaSaisie: 5000, exclu: true } },
    ]);
    const a = alertes([ligne(A, g)]).filter((x) => x.type === "cv_eleve");
    expect(a).toHaveLength(1);
    expect(a[0].message).toMatch(/^28 j : CV 23,6 % entre 2 répliques/);
    const unSeul = gachee("cv1", [{ code: "E1", essai: { contrainteKpaSaisie: 1000 } }]);
    expect(alertes([ligne(A, unSeul)])).toEqual([]);
  });

  it("écrasée sans mesure : après 24 h seulement", () => {
    const hier = gachee("m1", [{ code: "E1", coule: jour(9, 21), essai: { date: new Date(2026, 9, 19, 8).toISOString() } }]); // 25 h
    const ceMatin = gachee("m2", [{ code: "E1", coule: jour(9, 21), essai: { date: new Date(2026, 9, 19, 12).toISOString() } }]); // 21 h
    expect(types(alertes([ligne(A, hier)]))).toEqual(["ecrasee_sans_mesure"]);
    expect(alertes([ligne(A, ceMatin)])).toEqual([]);
  });

  it("loin du groupe : > 30 % de la médiane, groupe d'au moins 3 gâchées et 2 étudiants", () => {
    const g = (id: string, kpa: number) => gachee(id, [{ code: `${id}-E1`, essai: { contrainteKpaSaisie: kpa } }]);
    const l = [ligne(A, g("a1", 1000)), ligne(B, g("b1", 1050)), ligne(C, g("c1", 600))];
    const a = alertes(l).filter((x) => x.type === "ecart_groupe");
    expect(a.map((x) => x.etudiant)).toEqual(["Chloé"]);
    expect(a[0].message).toBe("28 j : 600 kPa, 40 % sous la médiane des 3 gâchées RPC · Cw 75 % · Bw 5 %.");
    // Deux gâchées seulement : pas de repère, pas d'alerte.
    expect(alertes([ligne(A, g("a1", 1000)), ligne(C, g("c1", 300))]).filter((x) => x.type === "ecart_groupe")).toEqual([]);
  });

  it("copies de conflit ignorées", () => {
    const copie = gachee("x", [{ code: "E1", statut: "en_cure", coule: jour(9, 1) }], { conflit: { de: "y", le: "z" } });
    expect(alertes([ligne(A, copie)])).toEqual([]);
  });

  it("inactivité : seulement pour la session en cours ; pas trop tôt dans la session", () => {
    const g = gachee("i", [], {});
    const vieux = [ligne(A, g, "2026-09-20T10:00:00.000000+00:00")];
    expect(alertes(vieux)).toEqual([]); // autre filtre que la session active
    const a = alertes(vieux, { sessionActiveAffichee: true });
    expect(types(a)).toEqual(["inactif"]);
    expect(a[0].message).toMatch(/depuis 30 j/);
    // Bruno n'a rien écrit : signalé seulement 21 j après le début de la session.
    const tot = alertes([], { sessionActiveAffichee: true, debutSessionActive: "2026-10-10" });
    expect(tot).toEqual([]);
    const tard = alertes([], { sessionActiveAffichee: true, debutSessionActive: "2026-09-01" });
    expect(tard.map((x) => x.etudiant)).toEqual(["Alice", "Bruno", "Chloé"]);
  });

  it("seuils affichés en clair", () => {
    expect(libellesSeuils()).toHaveLength(7);
    expect(libellesSeuils().join(" ")).toContain(`${SEUILS_ALERTES.cvMaxPct} %`);
  });
});
