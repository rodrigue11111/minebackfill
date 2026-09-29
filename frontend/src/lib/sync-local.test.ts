import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";
import { empreinte } from "./sync-empreinte";
import { cycle, etatInitial, type EtatSync, type Kind } from "./sync-moteur";
import { canoniqueGachee, canoniqueResultat, creerDepotLocal, type SourcesLocales } from "./sync-local";
import { FauxServeur, FauxTransport } from "./sync-faux-serveur";

// Stockage local en mémoire, avec les mêmes contrats que le magasin :
// écritures qui peuvent échouer, rechargement signalé après écriture.
function stockage(uid: string | null = "u1") {
  const s = {
    resultats: [] as SavedResult[],
    gachees: [] as Gachee[],
    plein: false,
    recharges: [] as Kind[][],
  };
  const sources: SourcesLocales = {
    uid: () => uid,
    lireResultats: () => JSON.parse(JSON.stringify(s.resultats)),
    ecrireResultats: (items) => { if (s.plein) return false; s.resultats = JSON.parse(JSON.stringify(items)); return true; },
    lireGachees: () => JSON.parse(JSON.stringify(s.gachees)),
    ecrireGachees: (items) => { if (s.plein) return false; s.gachees = JSON.parse(JSON.stringify(items)); return true; },
    apresEcriture: (k) => { s.recharges.push([...k].sort()); },
  };
  return { s, depot: creerDepotLocal(sources) };
}

const courbe = [{ tempsS: 0, chargeN: 0, deplacementMm: 0, contrainteKpa: 0, deformationPct: 0 },
  { tempsS: 1, chargeN: 900, deplacementMm: 0.4, contrainteKpa: 196, deformationPct: 1.1 }];

function gachee(id: string, titre = "x", avecCourbe = false): Gachee {
  return {
    id, code: `G-${id}`, creeLe: "2026-09-28T12:00:00.000Z", statut: "terminee",
    formulationLabel: titre, categorie: "RPC", recetteIndex: 0,
    composants: [], tolerancePct: 2, ajustements: [],
    eprouvettes: [{
      id: `${id}-e1`, code: `G-${id}-E01`, couleLe: "2026-09-28T12:00:00.000Z", ageJours: 28, statut: "ecrase",
      essai: { date: "2026-10-26T12:00:00.000Z", contrainteKpaSaisie: 196, ...(avecCourbe ? { courbe } : {}) },
    }],
  } as unknown as Gachee;
}

function resultat(id: string, ownerId?: string): SavedResult {
  return { id, savedAt: "2026-09-28T12:00:00.000Z", label: id, category: "RPC", method: "cw", general: {}, recipes: [], ownerId } as unknown as SavedResult;
}

describe("sync-local — forme canonique", () => {
  it("sans ownerId ni courbes de presse", () => {
    expect(canoniqueResultat(resultat("r1", "u1"))).not.toHaveProperty("ownerId");
    const g = canoniqueGachee(gachee("g1", "x", true)) as Gachee;
    expect(g.eprouvettes[0].essai).not.toHaveProperty("courbe");
    expect(g.eprouvettes[0].essai?.contrainteKpaSaisie).toBe(196);
  });

  it("ajouter une courbe ne rend pas la gâchée « modifiée »", () => {
    expect(empreinte(canoniqueGachee(gachee("g1", "x", true)))).toBe(empreinte(canoniqueGachee(gachee("g1", "x", false))));
  });
});

describe("sync-local — dépôt", () => {
  it("liste les documents du compte ; ignore ceux d'un autre compte et les ids hors format", () => {
    const { s, depot } = stockage("u1");
    s.resultats = [resultat("r1", "u1"), resultat("r2"), resultat("r3", "u2"), resultat("id invalide")];
    s.gachees = [gachee("g1")];
    expect([...depot.lister().keys()].sort()).toEqual(["gachee:g1", "resultat:r1", "resultat:r2"]);
  });

  it("écrire une version reçue réattache les courbes locales", () => {
    const { s, depot } = stockage();
    s.gachees = [gachee("g1", "local", true)];
    const D = depot.lister().get("gachee:g1")!;
    const recu = canoniqueGachee(gachee("g1", "serveur")) as Gachee;
    expect(depot.appliquer([{ type: "ecrire", kind: "gachee", id: "g1", contenu: recu, attendu: D.empreinte }])).toEqual(["appliquee"]);
    expect(s.gachees[0].formulationLabel).toBe("serveur");
    expect(s.gachees[0].eprouvettes[0].essai?.courbe).toEqual(courbe);
    expect(s.recharges).toEqual([["gachee"]]);
  });

  it("un résultat reçu est estampillé au compte lié", () => {
    const { s, depot } = stockage("u1");
    depot.appliquer([{ type: "ecrire", kind: "resultat", id: "r1", contenu: canoniqueResultat(resultat("r1")), attendu: null }]);
    expect(s.resultats[0].ownerId).toBe("u1");
  });

  it("garde : un document modifié entre-temps n'est pas écrasé", () => {
    const { s, depot } = stockage();
    s.gachees = [gachee("g1", "a")];
    const avant = depot.lister().get("gachee:g1")!.empreinte;
    s.gachees = [gachee("g1", "b")]; // l'utilisateur tape
    const r = depot.appliquer([{ type: "retirer", kind: "gachee", id: "g1", attendu: avant }]);
    expect(r).toEqual(["ignoree"]);
    expect(s.gachees).toHaveLength(1);
    expect(s.recharges).toEqual([]);
  });

  it("un résultat d'un autre compte n'est jamais écrasé ni retiré", () => {
    const { s, depot } = stockage("u1");
    s.resultats = [resultat("r9", "u2")];
    const r = depot.appliquer([{ type: "ecrire", kind: "resultat", id: "r9", contenu: { id: "r9" }, attendu: null }]);
    expect(r).toEqual(["ignoree"]);
    expect(s.resultats[0].ownerId).toBe("u2");
  });

  it("stockage plein : « echec », rien n'est rechargé", () => {
    const { s, depot } = stockage();
    s.plein = true;
    const r = depot.appliquer([{ type: "ecrire", kind: "gachee", id: "g1", contenu: gachee("g1"), attendu: null }]);
    expect(r).toEqual(["echec"]);
    expect(s.recharges).toEqual([]);
  });

  it("la copie de conflit garde les courbes de l'original et porte la marque", () => {
    const { s, depot } = stockage();
    s.gachees = [gachee("g1", "local", true)];
    const D = depot.lister().get("gachee:g1")!;
    const copie = depot.copieDeConflit("gachee", D.contenu, "g1.conflit.ab12", "2026-09-28T12:00:00.000Z") as Gachee;
    expect(copie.id).toBe("g1.conflit.ab12");
    expect(copie.conflit).toEqual({ de: "g1", le: "2026-09-28T12:00:00.000Z" });
    expect(copie.eprouvettes[0].essai?.courbe).toEqual(courbe);
  });
});

describe("sync-local — avec le moteur", () => {
  it("les courbes restent sur l'appareil, et survivent à une mise à jour venue d'ailleurs", async () => {
    const serveur = new FauxServeur();
    const opt = { maintenant: () => "2026-09-28T12:00:00.000Z", alea: () => "zz01" };
    const X = stockage();
    const Y = stockage();
    let eX: EtatSync = { ...etatInitial(), uid: "u1" };
    let eY: EtatSync = { ...etatInitial(), uid: "u1" };
    const tX = new FauxTransport(serveur, "u1", () => "u1");
    const tY = new FauxTransport(serveur, "u1", () => "u1");

    X.s.gachees = [gachee("g1", "v1", true)];
    eX = (await cycle(eX, tX, X.depot, opt)).etat;
    expect(JSON.stringify(serveur.vivants("u1").get("gachee:g1"))).not.toContain("contrainteKpa\":196,\"deformationPct");
    eY = (await cycle(eY, tY, Y.depot, opt)).etat;
    expect(Y.s.gachees[0].eprouvettes[0].essai?.courbe).toBeUndefined();

    // Y modifie la gâchée ; X la reçoit et GARDE sa courbe.
    Y.s.gachees = [{ ...Y.s.gachees[0], observations: "fissure au sommet" }];
    await cycle(eY, tY, Y.depot, opt);
    eX = (await cycle(eX, tX, X.depot, opt)).etat;
    expect(X.s.gachees[0].observations).toBe("fissure au sommet");
    expect(X.s.gachees[0].eprouvettes[0].essai?.courbe).toEqual(courbe);
    // Et rien ne repart : la courbe n'est pas une modification.
    expect((await cycle(eX, tX, X.depot, opt)).envoyes).toBe(0);
  });
});
