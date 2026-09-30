import { describe, expect, it } from "vitest";
import { friseCure, positionFrise, resumeFrise } from "./frise-cure";
import { geometrieBande, libelleEcart, DEMI_BANDE } from "./bande-tolerance";
import { ancrePesee, ancresGachee, repartirAnnotations } from "./ancres";
import type { Eprouvette } from "./eprouvette";

const coulee = new Date(2026, 8, 29, 12).toISOString();
const ep = (id: string, age: number, statut: Eprouvette["statut"] = "en_cure"): Eprouvette =>
  ({ id, code: `G-01-E${id}`, couleLe: coulee, ageJours: age, statut }) as Eprouvette;

describe("frise de cure", () => {
  const eps = [ep("1", 7, "ecrase"), ep("2", 7, "ecrase"), ep("3", 28), ep("4", 28)];

  it("un jalon par âge, du jour de coulée à la dernière échéance", () => {
    const f = friseCure(eps, new Date(2026, 9, 7, 9))!;
    expect(f.dureeJours).toBe(28);
    expect(f.jour).toBe(8);
    expect(f.jalons.map((j) => [j.ageJours, j.etat, j.nbEcrasees, j.nbEprouvettes])).toEqual([[7, "fait", 2, 2], [28, "a_venir", 0, 2]]);
    expect(f.jalons[1].position).toBe(1);
    expect(f.prochainDans).toBe(20);
    expect(resumeFrise(f)).toBe("Jour 8 sur 28 · prochain écrasement dans 20 jours");
  });

  it("échelle en racine : 7 j sur 28 j tombe à la moitié (et non au quart)", () => {
    expect(positionFrise(7, 28)).toBeCloseTo(0.5, 10);
    expect(positionFrise(0, 28)).toBe(0);
    expect(positionFrise(40, 28)).toBe(1);
  });

  it("retard et jour d'écrasement", () => {
    expect(resumeFrise(friseCure([ep("1", 7)], new Date(2026, 9, 6, 8))!)).toBe("Jour 7 sur 7 · écrasement aujourd'hui");
    const retard = friseCure([ep("1", 7)], new Date(2026, 9, 9, 8))!;
    expect(retard.jalons[0].etat).toBe("retard");
    expect(resumeFrise(retard)).toBe("Jour 10 sur 7 · écrasement en retard de 3 jours");
    expect(retard.positionAujourdhui).toBe(1);
    expect(resumeFrise(friseCure([ep("1", 7, "ecrase")], new Date(2026, 9, 9))!)).toContain("toutes les éprouvettes sont écrasées");
  });

  it("aucune éprouvette : pas de frise", () => {
    expect(friseCure([], new Date())).toBeNull();
  });
});

describe("bande de tolérance", () => {
  const c = (peseeKg?: number) => ({ cle: "liant", label: "Liant", cibleKg: 100, peseeKg });

  it("la cible au milieu, la tolérance couvre la bande claire", () => {
    const g = geometrieBande(c(100), 2);
    expect(g.position).toBeCloseTo(0.5, 10);
    expect(g.bande).toEqual({ debut: 0.5 - DEMI_BANDE, largeur: 2 * DEMI_BANDE });
    expect(geometrieBande(c(102), 2).position).toBeCloseTo(0.6, 10);
    expect(geometrieBande(c(102), 2).horsTolerance).toBe(false);
  });

  it("+8 % pour ± 2 % : à 90 % de la piste, hors tolérance (maquette)", () => {
    const g = geometrieBande(c(108), 2);
    expect(g.position).toBeCloseTo(0.9, 10);
    expect(g.horsTolerance).toBe(true);
    expect(libelleEcart(g)).toBe("+8,0 %, hors tolérance");
  });

  it("au-delà de la piste : collé au bord, « hors échelle »", () => {
    const g = geometrieBande(c(150), 2);
    expect(g.position).toBeCloseTo(0.98, 10);
    expect(g.horsEchelle).toBe(true);
    expect(geometrieBande(c(40), 2).position).toBeCloseTo(0.02, 10);
  });

  it("pas encore pesé ; tolérance nulle sans division par zéro", () => {
    expect(geometrieBande(c(undefined), 2).position).toBeNull();
    expect(libelleEcart(geometrieBande(c(undefined), 2))).toBe("pas encore pesé");
    expect(geometrieBande(c(99), 0).position).toBeCloseTo(0.4, 10);
    expect(libelleEcart(geometrieBande(c(99), 2))).toBe("−1,0 %");
  });
});

describe("ancres d'une gâchée", () => {
  const g = {
    composants: [{ cle: "residu", label: "Résidu humide", cibleKg: 1 }, { cle: "liant", label: "Liant", cibleKg: 1 }],
    eprouvettes: [ep("01", 7)],
  };

  it("pesées d'abord, puis éprouvettes", () => {
    expect(ancresGachee(g)).toEqual(["Pesée : Résidu humide", "Pesée : Liant", "G-01-E01"]);
    expect(ancrePesee("x".repeat(300)).length).toBe(200);
  });

  it("répartit le fil ; une ancre inconnue va au fil général", () => {
    const fil = [
      { id: "a", ancre: "Pesée : Liant" }, { id: "b", ancre: null }, { id: "c", ancre: "G-01-E09" }, { id: "d", ancre: "Pesée : Liant" },
    ];
    const r = repartirAnnotations(fil, ancresGachee(g));
    expect(r.parAncre.get("Pesée : Liant")?.map((x) => x.id)).toEqual(["a", "d"]);
    expect(r.general.map((x) => x.id)).toEqual(["b", "c"]);
  });
});
