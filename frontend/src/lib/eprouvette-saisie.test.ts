import { describe, expect, it } from "vitest";
import {
  appliquerSaisieEssai, avisDateEssai, basculerEcrasement, dateEssaiParDefaut, grouperEprouvettes, groupesOuvertsParDefaut,
  messageRetraitEprouvette, mesureEcrasement, type Eprouvette,
} from "./eprouvette";
import { messageSuppressionGachee } from "./gachee";

// Saisie directe de l'essai et regroupement par âge (2026-10-26).
const MAINTENANT = new Date(2026, 9, 26, 15, 30); // 26 oct. 2026, après-midi
const midi = (a: number, m: number, j: number) => new Date(a, m, j, 12).toISOString();

const ep = (p: Partial<Eprouvette> = {}): Eprouvette => ({
  id: "e1", code: "G-01-E01", couleLe: midi(2026, 9, 1), ageJours: 28, statut: "en_cure", ...p,
});

describe("passage automatique en « écrasée » : déclencheur précis", () => {
  it("une charge positive passe l'éprouvette en écrasée, datée du jour", () => {
    const r = appliquerSaisieEssai(ep(), { chargeKn: 12 }, MAINTENANT);
    expect(r.statut).toBe("ecrase");
    expect(r.essai?.chargeKn).toBe(12);
    expect(r.essai?.date).toBe(midi(2026, 9, 26));
  });

  it("une contrainte directe positive aussi", () => {
    expect(appliquerSaisieEssai(ep(), { contrainteKpaSaisie: 850 }, MAINTENANT).statut).toBe("ecrase");
  });

  it("charge 0, champ vidé ou autre champ : l'éprouvette reste en cure", () => {
    for (const patch of [{ chargeKn: 0 }, { chargeKn: undefined }, { contrainteKpaSaisie: 0 }, { contrainteKpaSaisie: undefined },
      { masseG: 1800 }, { presse: "MTS" }, { date: midi(2026, 9, 26) }, { modeRuptureCode: "cone" as const }, { diametreMm: 76.2 }]) {
      const r = appliquerSaisieEssai(ep(), patch, MAINTENANT);
      expect(r.statut, JSON.stringify(patch)).toBe("en_cure");
    }
    expect(mesureEcrasement({ chargeKn: Number.NaN })).toBe(false);
    expect(mesureEcrasement({ chargeKn: -3 })).toBe(false);
  });

  it("la saisie est gardée même sans changement de statut", () => {
    const r = appliquerSaisieEssai(ep(), { masseG: 1800 }, MAINTENANT);
    expect(r.essai?.masseG).toBe(1800);
    expect(r.essai?.date).toBeUndefined();
  });

  it("déjà écrasée : statut et date inchangés", () => {
    const e = ep({ statut: "ecrase", essai: { date: midi(2026, 9, 29), chargeKn: 10 } });
    const r = appliquerSaisieEssai(e, { chargeKn: 11 }, MAINTENANT);
    expect(r.statut).toBe("ecrase");
    expect(r.essai?.date).toBe(midi(2026, 9, 29));
  });

  it("date d'essai déjà saisie : gardée à l'écrasement", () => {
    const e = ep({ essai: { date: midi(2026, 9, 29) } });
    expect(appliquerSaisieEssai(e, { chargeKn: 9 }, MAINTENANT).essai?.date).toBe(midi(2026, 9, 29));
  });

  it("diamètre repris du moule s'il manque, gardé s'il est saisi", () => {
    const e = ep({ mouleDiametreMm: 76.2, mouleHauteurMm: 152.4 });
    expect(appliquerSaisieEssai(e, { chargeKn: 9 }, MAINTENANT).essai?.diametreMm).toBe(76.2);
    expect(appliquerSaisieEssai({ ...e, essai: { diametreMm: 75 } }, { chargeKn: 9 }, MAINTENANT).essai?.diametreMm).toBe(75);
  });

  it("effacer la charge après coup ne remet pas en cure", () => {
    const e = appliquerSaisieEssai(ep(), { chargeKn: 9 }, MAINTENANT);
    expect(appliquerSaisieEssai(e, { chargeKn: undefined }, MAINTENANT).statut).toBe("ecrase");
  });
});

describe("date d'essai jamais antérieure à la coulée", () => {
  it("coulée passée ou du jour : date du jour", () => {
    expect(dateEssaiParDefaut(ep(), MAINTENANT)).toBe(midi(2026, 9, 26));
    expect(dateEssaiParDefaut(ep({ couleLe: midi(2026, 9, 26) }), MAINTENANT)).toBe(midi(2026, 9, 26));
  });

  it("coulée future : écrasée sans date, et l'avis le dit", () => {
    const future = ep({ couleLe: midi(2026, 10, 2) });
    expect(dateEssaiParDefaut(future, MAINTENANT)).toBeUndefined();
    const r = appliquerSaisieEssai(future, { chargeKn: 9 }, MAINTENANT);
    expect(r.statut).toBe("ecrase");
    expect(r.essai?.date).toBeUndefined();
    expect(avisDateEssai(r, MAINTENANT)).toMatch(/^Date de coulée le 2 novembre 2026, après aujourd'hui : vérifiez-la/);
  });

  it("le rond de la ligne suit la même règle", () => {
    expect(basculerEcrasement(ep({ couleLe: midi(2026, 10, 2) }), MAINTENANT).essai?.date).toBeUndefined();
    const b = basculerEcrasement(ep(), MAINTENANT);
    expect(b.statut).toBe("ecrase");
    expect(b.essai?.date).toBe(midi(2026, 9, 26));
    expect(basculerEcrasement(b, MAINTENANT)).toMatchObject({ statut: "en_cure", essai: { date: midi(2026, 9, 26) } });
  });

  it("avis : rien en cure ni avec une date ; « Indiquez la date » sinon", () => {
    expect(avisDateEssai(ep(), MAINTENANT)).toBeNull();
    expect(avisDateEssai(ep({ statut: "ecrase", essai: { date: midi(2026, 9, 26) } }), MAINTENANT)).toBeNull();
    expect(avisDateEssai(ep({ statut: "ecrase", essai: {} }), MAINTENANT)).toBe("Indiquez la date d'essai.");
  });
});

describe("regroupement par âge de cure", () => {
  const liste: Eprouvette[] = [
    ep({ id: "a", code: "G-01-E05", ageJours: 56 }),
    ep({ id: "b", code: "G-01-E02", ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: 1000 } }),
    ep({ id: "c", code: "G-01-E01", ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: 1100 } }),
    ep({ id: "d", code: "G-01-E04", ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 400 } }),
    ep({ id: "e", code: "G-01-E06", ageJours: 56 }),
    ep({ id: "f", code: "G-01-E07", ageJours: 28, couleLe: midi(2026, 9, 10) }),
  ];

  it("un groupe par âge et jour de coulée, triés par échéance ; éprouvettes par code", () => {
    const g = grouperEprouvettes(liste);
    expect(g.map((x) => `${x.ageJours} j`)).toEqual(["7 j", "28 j", "28 j", "56 j"]);
    expect(g[1].eprouvettes.map((e) => e.code)).toEqual(["G-01-E01", "G-01-E02"]);
    expect(g[1]).toMatchObject({ ecrasees: 2, moyenneKpa: 1050 });
    expect(g[3]).toMatchObject({ ecrasees: 0, moyenneKpa: null });
    expect(g.flatMap((x) => x.eprouvettes)).toHaveLength(liste.length);
  });

  it("ouvert par défaut : le prochain groupe à écraser, et ceux qui portent une note", () => {
    const g = grouperEprouvettes(liste);
    const ouverts = groupesOuvertsParDefaut(g);
    expect([...ouverts]).toEqual([g[2].cle]);
    expect(groupesOuvertsParDefaut(g, new Set(["G-01-E04"])).has(g[0].cle)).toBe(true);
  });

  it("un groupe unique est toujours ouvert ; tout écrasé : aucun autre", () => {
    const seul = grouperEprouvettes([liste[1], liste[2]]);
    expect(groupesOuvertsParDefaut(seul).has(seul[0].cle)).toBe(true);
    const ecrases = grouperEprouvettes([liste[1], liste[3]]);
    expect(groupesOuvertsParDefaut(ecrases).size).toBe(0);
  });
});

describe("confirmations", () => {
  it("retirer une éprouvette mesurée prévient de la perte des mesures", () => {
    expect(messageRetraitEprouvette(ep())).toBe("Retirer l'éprouvette G-01-E01 ?");
    expect(messageRetraitEprouvette(ep({ essai: { chargeKn: 9 } }))).toBe("Retirer l'éprouvette G-01-E01 ? Ses mesures seront perdues.");
  });

  it("supprimer une gâchée dit ce qui part avec elle", () => {
    expect(messageSuppressionGachee({ code: "G-01", eprouvettes: [] })).toBe("Supprimer la gâchée G-01 ? Action définitive.");
    expect(messageSuppressionGachee({ code: "G-01", eprouvettes: [ep(), ep({ id: "x" })] }))
      .toBe("Supprimer la gâchée G-01 ? Ses 2 éprouvettes et leurs mesures seront supprimées, aussi en ligne si votre compte est relié. Action définitive.");
  });
});

describe("moules prévus par le calcul (2026-10-29) : rappel et avis, jamais un blocage", () => {
  it("lus dans le calcul : Cw, E/L, essai-erreur (méthode de base), ancien calcul", async () => {
    const { moulesPrevus } = await import("./gachee");
    expect(moulesPrevus({ method: "dosage_cw", inputs: { desired_qty: 9 } })).toBe(9);
    expect(moulesPrevus({ method: "wb", inputs: { desired_qty: 6 } })).toBe(6);
    expect(moulesPrevus({ method: "essai", inputs: { base_method: "wb", base_wb: { desired_qty: 4 } } })).toBe(4);
    expect(moulesPrevus({ method: "dosage_cw", inputs: {} })).toBeUndefined();
    expect(moulesPrevus({ method: "dosage_cw", inputs: { desired_qty: 0 } })).toBeUndefined();
    expect(moulesPrevus(undefined)).toBeUndefined();
  });

  it("rappel et avis : le constat, sans conclure à un manque de pâte", async () => {
    const { avisMoules, rappelMoules } = await import("./gachee");
    expect(rappelMoules(9, 6)).toBe("9 moules prévus par le calcul, 6 déjà utilisés.");
    expect(rappelMoules(1, 0)).toBe("1 moule prévu par le calcul, 0 déjà utilisé.");
    expect(avisMoules(9, 6, 3)).toBeNull();
    expect(avisMoules(9, 9, 0)).toBeNull();
    // 2026-10-30 : le total seul se lisait comme le nombre saisi.
    expect(avisMoules(9, 9, 3)).toBe("Le calcul prévoyait 9 moules. La gâchée a déjà 9 éprouvettes ; avec ces 3, elle en aura 12. Vérifiez leurs dimensions et le volume de pâte disponible.");
    expect(avisMoules(9, 9, 1)).toBe("Le calcul prévoyait 9 moules. La gâchée a déjà 9 éprouvettes ; avec celle-ci, elle en aura 10. Vérifiez leurs dimensions et le volume de pâte disponible.");
    expect(avisMoules(9, 0, 12)).toBe("Le calcul prévoyait 9 moules ; vous ajoutez 12 éprouvettes. Vérifiez leurs dimensions et le volume de pâte disponible.");
  });
});
