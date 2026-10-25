import { describe, expect, it } from "vitest";
import {
  artefactDepuisFigure, ETAT_FIGURE_INITIAL, figureDepuisArtefact, figurePerimee, reduireFigure,
  type ActionFigure, type EtatFigure, type FigureCourbes,
} from "./analyse-figure";
import { lireArtefact } from "./analyse-artefact";
import type { InstantaneAnalyse } from "./analyse-instantane";
import { RECIPE_COLORS } from "./recipe-theme";
import { TIRETS_VARIANTE } from "./analyse-variantes";

const instantane = (id: string): InstantaneAnalyse => ({
  date: "2026-10-25T15:00:00Z", categorie: "RPC", methode: "Balayage selon la méthode Cw",
  parametre: { label: "Taux massique de liant Bw", min: 1, max: 10, points: 3 },
  recette: { gsResidu: 3.05, w0Pct: 20, cwPct: 75, srPct: 100, bwPct: 5 },
  liants: [{ code: "GU", gs: 3.15, fractionPct: 100 }],
  constantes: { packLabel: "Feuille gramme", masseVolEau: 1000, gravite: 9.81, facteurCone: 2.335, coeffSlump: 4950000, constSlump: 235.5122, conventionGs: "recalcule", regleLiant: "residu_ajoute" },
  versionSolveur: "gramme-1.1",
  volumeM3: 0.0123,
  source: { id, libelle: `Calcul ${id}`, sauveLe: "2026-10-25T14:03:00Z", methode: "Dosage selon E/L", recette: 1, nbRecettes: 3 },
});
const balayage = (k: number) => ({ category: "RPC", param: "binder_mass_pct", x: [1, 5.5, 10], series: { wc_ratio: [10 + k, 8 + k, 6 + k] } });
const figure = (id: string, empreinte: string | null = `e-${id}`): FigureCourbes => ({
  resultats: [balayage(0)], variantes: null, instantane: instantane(id), empreinte, rechargee: false,
});
const jouer = (...actions: ActionFigure[]): EtatFigure => actions.reduce(reduireFigure, ETAT_FIGURE_INITIAL);

describe("cycle des requêtes : une réponse tardive ne prend jamais la nouvelle sélection", () => {
  it("réponse de la dernière requête : acceptée, avec la provenance de SON départ", () => {
    const e = jouer({ type: "depart", seq: 1 }, { type: "reponse", seq: 1, figure: figure("A") });
    expect(e.enCours).toBe(false);
    expect(e.figure?.instantane.source?.id).toBe("A");
  });

  it("changement de calcul ou de recette pendant la requête : sa réponse est ignorée, la figure précédente reste", () => {
    const avant = jouer({ type: "depart", seq: 1 }, { type: "reponse", seq: 1, figure: figure("A") });
    const e = [{ type: "depart", seq: 2 }, { type: "annuler", seq: 3 }, { type: "reponse", seq: 2, figure: figure("A-tardif") }]
      .reduce((x, a) => reduireFigure(x, a as ActionFigure), avant);
    expect(e.enCours).toBe(false);
    expect(e.figure?.instantane.source?.id).toBe("A");
  });

  it("changement de paramètre pendant la requête : figure retirée, réponse ignorée", () => {
    const e = jouer({ type: "depart", seq: 1 }, { type: "effacer", seq: 2 }, { type: "reponse", seq: 1, figure: figure("A") });
    expect(e.figure).toBeNull();
  });

  it("fichier rechargé pendant la requête : le fichier reste affiché", () => {
    const fichier = { ...figure("F", null), rechargee: true };
    const e = jouer({ type: "depart", seq: 1 }, { type: "charger", seq: 2, figure: fichier }, { type: "reponse", seq: 1, figure: figure("A") });
    expect(e.figure).toBe(fichier);
  });

  it("échec : aucune figure ancienne ne reste ; un échec tardif est ignoré", () => {
    const e = jouer({ type: "depart", seq: 1 }, { type: "reponse", seq: 1, figure: figure("A") }, { type: "depart", seq: 2 }, { type: "echec", seq: 2, message: "Erreur." });
    expect(e).toMatchObject({ figure: null, erreur: "Erreur.", enCours: false });
    const f = jouer({ type: "depart", seq: 1 }, { type: "annuler", seq: 2 }, { type: "echec", seq: 1, message: "Tard." });
    expect(f.erreur).toBeNull();
  });

  it("calcul supprimé ailleurs pendant la requête : la figure garde sa provenance et s'affiche périmée", () => {
    // Aucune action : la sélection retombe sur un autre calcul sans événement.
    const e = jouer({ type: "depart", seq: 1 }, { type: "reponse", seq: 1, figure: figure("A", "e-A") });
    expect(e.figure?.instantane.source?.id).toBe("A");
    expect(figurePerimee(e.figure, "e-B")).toBe(true);
    expect(figurePerimee(e.figure, "e-A")).toBe(false);
  });

  it("une figure de fichier n'est jamais périmée ; pas de figure, rien de périmé", () => {
    expect(figurePerimee({ ...figure("F", null), rechargee: true }, "autre")).toBe(false);
    expect(figurePerimee(null, "x")).toBe(false);
  });
});

describe("fichier JSON : aller-retour complet d'une comparaison", () => {
  it("trois variantes : résultats, numéros, légendes, couleurs, tirets et provenance restitués", () => {
    const variantes = [
      { recette: 2, label: "R2 (Cw 76,1 %)", couleur: RECIPE_COLORS[1], tirets: TIRETS_VARIANTE[0] },
      { recette: 1, label: "R1 (Cw 74,2 %)", couleur: RECIPE_COLORS[0], tirets: TIRETS_VARIANTE[1] },
      { recette: 3, label: "R3 (Cw 77 %)", couleur: RECIPE_COLORS[2], tirets: TIRETS_VARIANTE[2] },
    ];
    const f: FigureCourbes = { ...figure("A"), resultats: [balayage(0), balayage(1), balayage(2)], variantes };
    const lu = lireArtefact(JSON.stringify(artefactDepuisFigure(f)));
    if (!lu.ok) throw new Error(lu.erreur);
    const g = figureDepuisArtefact(lu.artefact);
    expect(g.resultats).toEqual(f.resultats);
    expect(g.variantes).toEqual(variantes);
    expect(g.instantane).toEqual(f.instantane);
    expect(g).toMatchObject({ rechargee: true, empreinte: null });
  });

  it("une seule courbe : pas de variantes", () => {
    const lu = lireArtefact(JSON.stringify(artefactDepuisFigure(figure("A"))));
    if (!lu.ok) throw new Error(lu.erreur);
    expect(figureDepuisArtefact(lu.artefact).variantes).toBeNull();
  });

  it("ancien fichier /2 sans numéros de recette : légendes reprises, couleurs selon la position", () => {
    const ancien = {
      format: "minebackfill-analyse-courbes/2",
      instantane: { ...instantane("A"), source: undefined, volumeM3: undefined, methode: "Dosage selon Cw" },
      resultats: [balayage(0), balayage(1)],
      variantes: ["Bw 4,5 %", "Bw 6 %"],
    };
    const lu = lireArtefact(JSON.stringify(ancien));
    if (!lu.ok) throw new Error(lu.erreur);
    const g = figureDepuisArtefact(lu.artefact);
    expect(g.variantes?.map((v) => [v.recette, v.label, v.couleur])).toEqual([[null, "Bw 4,5 %", RECIPE_COLORS[0]], [null, "Bw 6 %", RECIPE_COLORS[1]]]);
  });
});
