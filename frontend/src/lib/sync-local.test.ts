import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";
import { empreinte } from "./sync-empreinte";
import { cycle, etatInitial, type EtatSync, type Kind } from "./sync-moteur";
import { canoniqueGachee, canoniqueResultat, creerDepotLocal, type SourcesLocales } from "./sync-local";
import { FauxServeur, FauxTransport } from "./sync-faux-serveur";
import { planifierCourbes } from "./sync-courbes";
import { courbesOrphelines } from "./courbes";

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

const X = "2026-10-01T10:00:00.000Z";
const Y = "2026-10-02T15:30:00.000Z";

/** L'éprouvette de la gâchée désigne l'import `importeLe` (null : aucun import), avec ces champs locaux de courbe. */
function avecImport(g: Gachee, importeLe: string | null, champs: Record<string, unknown>): Gachee {
  const [e] = g.eprouvettes;
  const essai: Record<string, unknown> = { ...e.essai };
  delete essai.courbe;
  delete essai.courbeInfo;
  delete essai.sourcePresse;
  if (importeLe) essai.sourcePresse = { fichier: "p.xlsx", echantillon: "1", importeLe };
  return { ...g, eprouvettes: [{ ...e, essai: { ...essai, ...champs } }] } as Gachee;
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

  it("la référence d'une courbe rangée hors de la gâchée (courbeInfo) reste locale aussi", () => {
    const g = gachee("g1");
    (g.eprouvettes[0].essai as Record<string, unknown>).courbeInfo = { nbPoints: 151 };
    expect((canoniqueGachee(g) as Gachee).eprouvettes[0].essai).not.toHaveProperty("courbeInfo");
    expect(empreinte(canoniqueGachee(g))).toBe(empreinte(canoniqueGachee(gachee("g1"))));
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

  it("une version reçue garde la référence locale de courbe (courbeInfo)", () => {
    const { s, depot } = stockage();
    const local = gachee("g1", "local");
    (local.eprouvettes[0].essai as Record<string, unknown>).courbeInfo = { nbPoints: 151 };
    s.gachees = [local];
    const D = depot.lister().get("gachee:g1")!;
    depot.appliquer([{ type: "ecrire", kind: "gachee", id: "g1", contenu: canoniqueGachee(gachee("g1", "serveur")), attendu: D.empreinte }]);
    expect(s.gachees[0].eprouvettes[0].essai?.courbeInfo).toEqual({ nbPoints: 151 });
  });

  it("courbe réattachée seulement à une éprouvette du MÊME import ; réimportée ailleurs ou import retiré : plus de courbe", () => {
    const cas: [string, Record<string, unknown>, string | null, boolean][] = [
      // [cas, champs locaux, import reçu, réattachée ?]
      ["référence vérifiée, même import", { courbeInfo: { nbPoints: 151, importeLe: X } }, X, true],
      ["référence vérifiée, réimportée ailleurs", { courbeInfo: { nbPoints: 151, importeLe: X } }, Y, false],
      ["référence vérifiée, import retiré", { courbeInfo: { nbPoints: 151, importeLe: X } }, null, false],
      ["ancienne référence, même import désigné", { courbeInfo: { nbPoints: 151 } }, X, true],
      ["ancienne référence, réimportée ailleurs", { courbeInfo: { nbPoints: 151 } }, Y, false],
      ["courbe dans la gâchée, réimportée ailleurs", { courbe }, Y, false],
      ["courbe dans la gâchée, même import", { courbe }, X, true],
    ];
    for (const [nom, champs, recuImporte, attendu] of cas) {
      const { s, depot } = stockage();
      s.gachees = [avecImport(gachee("g1", "local"), X, champs)];
      const D = depot.lister().get("gachee:g1")!;
      const recu = canoniqueGachee(avecImport(gachee("g1", "serveur"), recuImporte, {}));
      depot.appliquer([{ type: "ecrire", kind: "gachee", id: "g1", contenu: recu, attendu: D.empreinte }]);
      const essai = s.gachees[0].eprouvettes[0].essai as Record<string, unknown>;
      expect([nom, Object.keys(champs).every((k) => k in essai)]).toEqual([nom, attendu]);
      if (!attendu) expect([nom, "courbe" in essai || "courbeInfo" in essai]).toEqual([nom, false]);
    }
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

  it("la copie de conflit garde aussi la référence au magasin (courbeInfo) : rien à balayer", () => {
    const { s, depot } = stockage();
    s.gachees = [avecImport(gachee("g1", "local"), X, { courbeInfo: { nbPoints: 151, importeLe: X } })];
    const D = depot.lister().get("gachee:g1")!;
    const copie = depot.copieDeConflit("gachee", D.contenu, "g1.conflit.ab12", "2026-09-28T12:00:00.000Z") as Gachee;
    expect(copie.eprouvettes[0].essai?.courbeInfo).toEqual({ nbPoints: 151, importeLe: X });
    expect(courbesOrphelines([`g1-e1:${X}`], [copie])).toEqual([]);
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

  it("B lit la courbe en ligne (import X), puis A réimporte (Y) : B perd sa référence et n'envoie rien", async () => {
    const serveur = new FauxServeur();
    const opt = { maintenant: () => "2026-09-28T12:00:00.000Z", alea: () => "zz01" };
    const A = stockage();
    const B = stockage();
    let eA: EtatSync = { ...etatInitial(), uid: "u1" };
    let eB: EtatSync = { ...etatInitial(), uid: "u1" };
    const tA = new FauxTransport(serveur, "u1", () => "u1");
    const tB = new FauxTransport(serveur, "u1", () => "u1");

    A.s.gachees = [avecImport(gachee("g1"), X, { courbeInfo: { nbPoints: 151, importeLe: X } })];
    eA = (await cycle(eA, tA, A.depot, opt)).etat;
    eB = (await cycle(eB, tB, B.depot, opt)).etat;
    // B lit la courbe X en ligne et la range : sa référence nomme l'import X.
    B.s.gachees = [avecImport(B.s.gachees[0], X, { courbeInfo: { nbPoints: 151, importeLe: X } })];
    expect(planifierCourbes(B.s.gachees, eB, { envoyees: {}, bloquees: {} }).map((p) => p.cle)).toEqual([`g1-e1:${X}`]);

    // A réimporte : la gâchée désigne Y.
    A.s.gachees = [avecImport(A.s.gachees[0], Y, { courbeInfo: { nbPoints: 140, importeLe: Y } })];
    await cycle(eA, tA, A.depot, opt);
    eB = (await cycle(eB, tB, B.depot, opt)).etat;
    const essaiB = B.s.gachees[0].eprouvettes[0].essai!;
    expect(essaiB.sourcePresse?.importeLe).toBe(Y);
    expect(essaiB.courbeInfo).toBeUndefined(); // l'écran propose « Courbe en ligne : afficher » (Y)
    expect(planifierCourbes(B.s.gachees, eB, { envoyees: {}, bloquees: {} })).toEqual([]);
    expect(courbesOrphelines([`g1-e1:${X}`], B.s.gachees)).toEqual([`g1-e1:${X}`]);
  });
});
