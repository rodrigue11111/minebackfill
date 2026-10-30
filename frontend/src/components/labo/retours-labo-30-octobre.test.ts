// Retours du 30 octobre sur le Labo et l'Analyse : état affiché d'une
// gâchée, repères de recette, teneur en eau à l'étuve dans la gâchée,
// retrait de plusieurs éprouvettes, modification d'une éprouvette, code de
// gâchée en date locale, figures agrandies, affaissement seul dans Calculs.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EditeurGachee from "./EditeurGachee";
import ResumeCalcul from "./ResumeCalcul";
import Pesees from "./Pesees";
import FigurePng from "@/components/analyse/FigurePng";
import MesuresLabo from "@/components/mix/MesuresLabo";
import { etatGachee, resumeParametres, type Gachee } from "@/lib/gachee";
import { etuveIncoherente, majEtuve, mesuresEtuve } from "@/lib/mesures-pate";
import { choixMouleDe, messageRetraitEprouvettes, patchMoule, type Eprouvette } from "@/lib/eprouvette";
import type { SavedResult } from "@/lib/store";

const coulee = new Date(2026, 9, 29, 12).toISOString();
const ep = (id: string, p: Partial<Eprouvette> = {}): Eprouvette =>
  ({ id, code: `G-20261029-01-${id}`, couleLe: coulee, ageJours: 7, statut: "en_cure", ...p }) as Eprouvette;

describe("état affiché d'une gâchée", () => {
  it("brouillon sans éprouvette ; en attente d'écrasement avec la prochaine échéance ; écrasements faits ; terminée", () => {
    expect(etatGachee({ statut: "brouillon", eprouvettes: [] }).libelle).toBe("Brouillon");
    const enCure = etatGachee({ statut: "brouillon", eprouvettes: [ep("E01", { ageJours: 28 }), ep("E02", { ageJours: 7 })] });
    expect(enCure.libelle).toBe("En attente d'écrasement");
    expect(enCure.detail).toBe("Prochain écrasement le 5 novembre (2 éprouvettes en cure).");
    expect(etatGachee({ statut: "brouillon", eprouvettes: [ep("E01", { statut: "ecrase" })] }).etat).toBe("ecrasee");
    expect(etatGachee({ statut: "terminee", eprouvettes: [ep("E01")] }).libelle).toBe("Terminée");
  });
});

describe("repères d'une recette", () => {
  it("Cw, Bw, E/L, et Am en RPG ; vide sans valeur", () => {
    expect(resumeParametres({ cwPct: 70, bwPct: 4.5, wcRatio: 14.705 })).toBe("Cw 70 % · Bw 4,5 % · E/L 14,71");
    expect(resumeParametres({ cwPct: 75, bwPct: 5, wcRatio: 6.7, amPct: 30 })).toBe("Cw 75 % · Bw 5 % · E/L 6,7 · Am 30 %");
    expect(resumeParametres(undefined)).toBe("");
  });

  it("le calcul choisi : projet, liants, moules, repères et lien qui s'ouvre à côté", () => {
    const calcul = {
      id: "sr1", label: "Calcul 2", category: "RPC", method: "dosage_cw", savedAt: "2026-10-29T23:05:00",
      general: { project_name: "Master 1", residue_id: "R-2547", binders: [{ code: "GU", fraction_pct: 20 }, { code: "GGBFS", fraction_pct: 80 }] },
      inputs: { desired_qty: 9 },
      recipes: [{ solids_mass_pct: 70, bw_mass_pct: 4.5, wc_ratio: 14.71 }, { solids_mass_pct: 70, bw_mass_pct: 3, wc_ratio: 22.06 }],
    } as unknown as SavedResult;
    const html = renderToStaticMarkup(createElement(ResumeCalcul, {
      calcul, recetteIndex: 1, catalogue: [{ id: "l1", code: "GU", nom: "Ciment GU", gs: 3.15 }],
    }));
    expect(html).toContain("Calcul 2");
    expect(html).toContain("Dosage selon Cw");
    expect(html).toContain("Master 1");
    expect(html).toContain("Ciment GU 20 % · GGBFS 80 %");
    expect(html).toContain("9 par recette");
    expect(html).toContain("Recette 2</dt><dd>Cw 70 % · Bw 3 % · E/L 22,06");
    expect(html).toContain('href="/historique?resultat=sr1" target="_blank"');
  });
});

describe("teneur en eau de la pâte à l'étuve, dans la gâchée", () => {
  const etuve = { tareG: 2278.8, mhG: 2947.3, msG: 2831.8 }; // exemple de la feuille Intra 2017
  it("les masses complètes fixent Cw ; incohérentes, elles le disent", () => {
    expect(mesuresEtuve(etuve).cw).toBeCloseTo(82.72, 2);
    expect(etuveIncoherente({ tareG: 10, mhG: 5, msG: 8 })).toBe(true);
    expect(etuveIncoherente({ tareG: 10 })).toBe(false);
  });

  it("majEtuve : Cw suit les masses ; un Cw fixé par elles s'efface si elles cessent d'être complètes ; un Cw saisi reste", () => {
    const complet = majEtuve({}, etuve);
    expect(complet.cwMesurePct).toBeCloseTo(82.72, 2);
    expect(majEtuve(complet, { msG: undefined }).cwMesurePct).toBeUndefined();
    expect(majEtuve({ cwMesurePct: 74 }, { tareG: 2278.8 }).cwMesurePct).toBe(74);
  });

  it("l'éditeur montre les trois masses et le Cw qu'elles donnent", () => {
    const g = {
      id: "g1", code: "G-20261029-01", creeLe: coulee, statut: "brouillon", formulationLabel: "Calcul 2", categorie: "RPC",
      recetteIndex: 0, tolerancePct: 2, ajustements: [], composants: [], eprouvettes: [], etuvePate: etuve,
    } as unknown as Gachee;
    const html = renderToStaticMarkup(createElement(EditeurGachee, {
      gachee: g, maintenant: new Date(2026, 9, 30, 9), annotations: [], connecte: false,
      onMaj: () => {}, onRetour: () => {}, onSupprimer: () => {},
    }));
    expect(html).toContain("Tare + pâte humide m_h (g)");
    expect(html).toContain("Tare + pâte sèche m_s (g)");
    expect(html).toContain("Calculé à partir des masses : (m_s − tare) / (m_h − tare).");
    expect(html).toContain("82,72");
  });

  it("Calculs (essai-erreur) : l'affaissement seul, et la pesée à l'étuve renvoyée au Labo", () => {
    const html = renderToStaticMarkup(createElement(MesuresLabo, { numRecipes: 1, mesures: [], onChange: () => {} }));
    expect(html).toContain("Affaissement mesuré");
    expect(html).not.toContain("Tare + pâte humide");
    expect(html).toContain("dans la gâchée, au Labo");
    // Masses saisies ici auparavant : gardées en lecture.
    const ancien = renderToStaticMarkup(createElement(MesuresLabo, {
      numRecipes: 1, mesures: [{ tare: 2278.8, mh: 2947.3, ms: 2831.8 }], onChange: () => {},
    }));
    expect(ancien).toContain("Cw mesuré : 82,72 %");
  });
});

describe("éprouvettes : retrait groupé, moule d'une éprouvette existante", () => {
  it("message du retrait groupé : nombre, et mesures perdues", () => {
    expect(messageRetraitEprouvettes([ep("E01"), ep("E02"), ep("E03")])).toBe("Retirer ces 3 éprouvettes ?");
    expect(messageRetraitEprouvettes([ep("E01", { statut: "ecrase", essai: { contrainteKpaSaisie: 400 } }), ep("E02")]))
      .toBe("Retirer ces 2 éprouvettes ? L'une d'elles a des mesures, qui seront perdues.");
    expect(messageRetraitEprouvettes([ep("E01")])).toBe("Retirer l'éprouvette G-20261029-01-E01 ?");
  });

  it("choix du moule d'une éprouvette : proposé, calcul, enregistré, actuel hors liste, texte", () => {
    expect(choixMouleDe({ mouleDiametreMm: 76.2, mouleHauteurMm: 152.4 }, undefined, [])).toBe("1");
    expect(choixMouleDe({ mouleDiametreMm: 60, mouleHauteurMm: 120 }, { diametreMm: 60, hauteurMm: 120 }, [])).toBe("calcul");
    expect(choixMouleDe({ mouleDiametreMm: 38, mouleHauteurMm: 76 }, undefined, [{ id: "m1", c: { diametreMm: 38, hauteurMm: 76 } }])).toBe("perso:m1");
    expect(choixMouleDe({ mouleDiametreMm: 42, mouleHauteurMm: 84 }, undefined, [])).toBe("actuel");
    expect(choixMouleDe({ moule: "cube 50 mm" }, undefined, [])).toBe("autre");
    expect(choixMouleDe({}, undefined, [])).toBe("");
    expect(patchMoule({ diametreMm: 50, hauteurMm: 100 })).toEqual({ mouleDiametreMm: 50, mouleHauteurMm: 100, moule: undefined });
    expect(patchMoule(undefined, "  cube  ")).toEqual({ mouleDiametreMm: undefined, mouleHauteurMm: undefined, moule: "cube" });
  });
});

describe("pesées : l'unité n'est plus écrite deux fois", () => {
  it("le champ n'affiche plus « g » en texte indicatif", () => {
    const g = {
      id: "g1", code: "G-20261029-01", creeLe: coulee, statut: "brouillon", formulationLabel: "Calcul 2", categorie: "RPC",
      recetteIndex: 0, tolerancePct: 2, ajustements: [], eprouvettes: [], composants: [{ cle: "residu", label: "Résidu humide", cibleKg: 10.5394 }],
    } as unknown as Gachee;
    const html = renderToStaticMarkup(createElement(Pesees, { gachee: g, onPesee: () => {}, onTolerance: () => {} }));
    expect(html).toContain("labo-pesee-unite");
    expect(html).not.toContain('placeholder="g"');
  });
});

describe("Analyse : figure agrandie", () => {
  it("bouton « Agrandir » seulement quand une vue agrandie est fournie", () => {
    const avec = renderToStaticMarkup(createElement(FigurePng, { nom: "f", agrandi: createElement("svg"), titre: "Rapport E/L" }, createElement("svg")));
    const sans = renderToStaticMarkup(createElement(FigurePng, { nom: "f" }, createElement("svg")));
    expect(avec).toContain(">Agrandir<");
    expect(sans).not.toContain("Agrandir");
  });
});
