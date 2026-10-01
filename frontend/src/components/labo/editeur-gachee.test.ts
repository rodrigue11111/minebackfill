// Rendu de l'éditeur d'une gâchée (sans navigateur) : frise de cure, pesées
// sur bande de tolérance, note de l'enseignant en contexte, éprouvettes,
// résistance mesurée et parties du téléphone.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EditeurGachee from "./EditeurGachee";
import FormEssaiUCS from "./FormEssaiUCS";
import CourbeContrainteDeformation from "./CourbeContrainteDeformation";
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

  it("fiche d'essai : complétude dans l'en-tête, cure et rappels non bloquants", () => {
    const html = rendu();
    // Gâchée du test : seules les pesées sont complètes ; les deux éprouvettes
    // écrasées rendent le point « essais documentés » applicable (12 points).
    expect(html).toContain("Fiche : 1/12");
    expect(html).toContain("Cure des éprouvettes");
    expect(html).toContain("À compléter si vous les connaissez : ");
    expect(html).toContain("Rien n&#x27;est obligatoire.");
    expect(html).toContain("Durée de malaxage (min)");
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

describe("formulaire d'essai : conditions de l'essai", () => {
  const form = (essai: NonNullable<Gachee["eprouvettes"][number]["essai"]>, pourToutes = true) =>
    renderToStaticMarkup(createElement(FormEssaiUCS, {
      eprouvette: { id: "e1", code: "E01", couleLe: coulee, ageJours: 7, statut: "ecrase", essai },
      onChange: () => {}, onVitessePourToutes: pourToutes ? () => {} : undefined,
    }));

  it("masse, vitesse, presse et rupture codée ; vitesse recopiable", () => {
    const html = form({ contrainteKpaSaisie: 400, masseG: 412.5, vitesseChargement: { valeur: 1, unite: "kN/s" }, modeRuptureCode: "colonnaire",
      deflexionMaxMm: 0.75, sourcePresse: { fichier: "presse.xlsx", echantillon: "3", importeLe: coulee } });
    expect(html).toContain("Masse de l&#x27;éprouvette");
    expect(html).toContain("Vitesse de chargement");
    expect(html).toMatch(/<option value="kN\/s" selected="">kN\/s<\/option>/);
    expect(html).toMatch(/<option value="colonnaire" selected="">Fissures verticales \(colonnaire\)<\/option>/);
    expect(html).toContain("Appliquer cette vitesse à toutes les éprouvettes écrasées");
    expect(html).toContain("Déflexion max : <strong>0,75 mm</strong>");
    expect(html).not.toContain("Rupture (précision)");
  });

  it("ancienne saisie en texte libre : le texte reste visible ; pas de recopie sans vitesse", () => {
    const html = form({ contrainteKpaSaisie: 400, modeRupture: "cône" });
    expect(html).toContain("Rupture (précision)");
    expect(html).toContain('value="cône"');
    expect(html).not.toContain("Appliquer cette vitesse");
  });
});

describe("éditeur : matériaux choisis dans la bibliothèque", () => {
  const bibliotheque = {
    residus: [
      { id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, origine: "officiel" as const },
      { id: "res_perso", nom: "Mon résidu", gs: 3, w0_pct: 20, origine: "perso" as const },
    ],
    granulats: [{ id: "gra_laronde", nom: "Concassé LaRonde", gs: 2.8, humidite_pct: 0, origine: "officiel" as const }],
  };
  const avec = (g: Partial<Gachee>) => renderToStaticMarkup(createElement(EditeurGachee, {
    gachee: { ...gachee, ...g }, maintenant: new Date(2026, 9, 7, 9), annotations: [], connecte: true, bibliotheque,
    onMaj: () => {}, onRetour: () => {}, onSupprimer: () => {},
  }));

  it("résidu du catalogue sélectionné ; personnel signalé ; « Autre » proposé", () => {
    const html = avec({ materiaux: { residu: { id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0Pct: 25 } } });
    expect(html).toMatch(/<option value="res_laronde" selected="">Résidus LaRonde<\/option>/);
    expect(html).toContain("Mon résidu (personnel)");
    expect(html).toContain("Autre (saisie libre)");
    expect(html).not.toContain('id="residu-nom"');
    expect(html).not.toContain('id="granulat-choix"'); // RPC : pas de granulat
  });

  it("résidu saisi librement : « Autre » et son nom ; granulat en RPG", () => {
    const html = avec({ categorie: "RPG", materiaux: { residu: { nom: "R-01", gs: 3.4 } } });
    expect(html).toMatch(/<option value="autre" selected="">Autre \(saisie libre\)<\/option>/);
    expect(html).toMatch(/id="residu-nom"[^>]*value="R-01"/);
    expect(html).toContain('id="granulat-choix"');
    expect(html).toContain("Concassé LaRonde");
  });
});

describe("éditeur : revue de l'enseignant", () => {
  const avec = (revue: Parameters<typeof EditeurGachee>[0]["revue"]) => renderToStaticMarkup(createElement(EditeurGachee, {
    gachee, maintenant: new Date(2026, 9, 7, 9), annotations: [], connecte: true, revue,
    onMaj: () => {}, onRetour: () => {}, onSupprimer: () => {},
  }));

  it("refusée : pastille avec le motif en infobulle, bandeau avec le motif et les éprouvettes écartées (par code)", () => {
    const html = avec({ kind: "gachee", id: "g1", rev: 3, decision: "refusee", motif: "Pesées incomplètes.", ecartees: ["e2", "inconnue"], maj: "m" });
    expect(html).toMatch(/title="Pesées incomplètes\."[^>]*>Revue : refusée</);
    expect(html).toContain("Revue de l&#x27;enseignant : gâchée refusée.");
    expect(html).toContain("Motif : Pesées incomplètes.");
    expect(html).toContain("Éprouvette écartée par l&#x27;enseignant : G-20260929-01-E02.");
  });

  it("acceptée sans motif : la pastille seulement ; sans revue : rien", () => {
    const html = avec({ kind: "gachee", id: "g1", rev: 3, decision: "acceptee", motif: null, ecartees: [], maj: "m" });
    expect(html).toContain("Revue : acceptée");
    expect(html).not.toContain("Revue de l&#x27;enseignant");
    expect(avec(undefined)).not.toContain("Revue :");
  });
});

describe("courbe contrainte-déformation", () => {
  const essai = (p: Record<string, unknown>) => ({ contrainteKpaSaisie: 400, sourcePresse: { fichier: "p.xlsx", echantillon: "1", importeLe: coulee }, ...p });
  const form = (es: Record<string, unknown>, props: Record<string, unknown>) => renderToStaticMarkup(createElement(FormEssaiUCS, {
    eprouvette: { id: "e1", code: "E01", couleLe: coulee, ageJours: 7, statut: "ecrase", essai: essai(es) }, onChange: () => {}, ...props,
  }));
  const charger = async () => null;

  it("courbe sur cet appareil : bouton avec le nombre de points ; ailleurs : « Courbe en ligne : afficher »", () => {
    expect(form({ courbeInfo: { nbPoints: 151 } }, { chargerCourbe: charger })).toContain("Afficher la courbe (151 points)");
    const enLigne = form({}, { chargerCourbe: charger, chercherCourbeEnLigne: charger });
    expect(enLigne).toContain("Courbe en ligne : afficher");
    expect(form({}, { chargerCourbe: charger })).not.toContain("Courbe en ligne"); // hors connexion
    expect(renderToStaticMarkup(createElement(FormEssaiUCS, {
      eprouvette: { id: "e2", code: "E02", couleLe: coulee, ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 400 } },
      onChange: () => {}, chercherCourbeEnLigne: charger,
    }))).not.toContain("Courbe en ligne"); // saisie à la main : pas de courbe à chercher
  });

  it("le tracé : axes nommés, maximum marqué, description accessible", () => {
    const pts = [0, 0.1, 0.2, 0.3].map((e, i) => ({ tempsS: i, chargeN: i * 10, deplacementMm: i / 10, deformationPct: e, contrainteKpa: [0, 300, 412, 380][i] }));
    const svg = renderToStaticMarkup(createElement(CourbeContrainteDeformation, { points: pts, titre: "Éprouvette E01" }));
    expect(svg).toContain("Déformation (%)");
    expect(svg).toContain("Contrainte (kPa)");
    expect(svg).toContain("Maximum : 412 kPa à 0,20 %");
    expect(svg).toContain('role="img"');
    expect(renderToStaticMarkup(createElement(CourbeContrainteDeformation, { points: pts.slice(0, 1), titre: "x" }))).toContain("Courbe sans points exploitables");
  });
});
