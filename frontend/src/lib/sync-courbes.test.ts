import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import { cleCourbe, cleImport, type CourbeColonnes } from "./courbes";
import { ErreurSync } from "./sync-moteur";
import { empreinte } from "./sync-empreinte";
import { canoniqueGachee } from "./sync-local";
import {
  contenuCourbe, cycleCourbes, envoyerCourbe, etatCourbesInitial, oublierPurgees, planifierCourbes,
  type EcrireCourbe, type EtatCourbes,
} from "./sync-courbes";

const courbe = (n: number): CourbeColonnes => ({ v: 1, t: [0, n], f: [0, 10 * n], d: [0, 0.1], s: [0, 5 * n], e: [0, 0.1] });
const SANS_IMPORT = "sans-import";
/** Éprouvette importée (import `importeLe`) ; `courbeDe` : import dont vient la courbe rangée ici
 *  (SANS_IMPORT : référence sans import, origine inconnue ; null : aucune courbe). */
const ep = (id: string, importeLe: string | null, courbeDe: string | null = importeLe, nbPoints = 2) => ({
  id, code: id, couleLe: "2026-09-25T12:00:00Z", ageJours: 7, statut: "ecrase" as const,
  essai: {
    contrainteKpaSaisie: 400,
    ...(importeLe !== null ? { sourcePresse: { fichier: "p.xlsx", echantillon: "1", importeLe } } : {}),
    ...(courbeDe === null ? {} : { courbeInfo: { nbPoints, ...(courbeDe !== SANS_IMPORT ? { importeLe: courbeDe } : {}) } }),
  },
});
const gachee = (id: string, eprouvettes: ReturnType<typeof ep>[], conflit = false) =>
  ({ id, code: id, creeLe: "x", statut: "terminee", formulationLabel: "F", categorie: "RPC", recetteIndex: 0, tolerancePct: 2,
    composants: [], ajustements: [], eprouvettes, ...(conflit ? { conflit: { de: "g1", le: "x" } } : {}) }) as unknown as Gachee;
/** État de synchronisation : ces gâchées sont en ligne, à jour (même empreinte que la version locale). */
const enLigne = (...gs: Gachee[]) => ({ docs: Object.fromEntries(gs.map((g) => [`gachee:${g.id}`, { rev: 1, empreinte: empreinte(canoniqueGachee(g)) }])) });

/** Faux serveur : mêmes règles qu'ecrire_doc pour le type « courbe ». */
function serveur() {
  const lignes = new Map<string, { rev: number; contenu: unknown; supprime: boolean }>();
  let rev = 100;
  const appels: { id: string; baseRev: number | null }[] = [];
  const ecrire: EcrireCourbe = async (id, contenu, baseRev) => {
    appels.push({ id, baseRev });
    const l = lignes.get(id);
    if (baseRev === null) {
      if (l) return { ok: false, ligne: { rev: l.rev, supprime: l.supprime, contenu: l.contenu } };
      lignes.set(id, { rev: ++rev, contenu: JSON.parse(JSON.stringify(contenu)), supprime: false });
      return { ok: true, rev };
    }
    if (!l) return { ok: false, ligne: null };
    if (l.rev !== baseRev) return { ok: false, ligne: { rev: l.rev, supprime: l.supprime, contenu: l.contenu } };
    lignes.set(id, { rev: ++rev, contenu: JSON.parse(JSON.stringify(contenu)), supprime: false });
    return { ok: true, rev };
  };
  return { lignes, ecrire, appels };
}

const X = "2026-10-01T10:00:00.000Z";
const Y = "2026-10-02T15:30:00.000Z";

describe("courbes en ligne : planification", () => {
  it("une courbe par import, id `<éprouvette>:<import>` ; seulement des gâchées en ligne ET à jour", () => {
    const g1 = gachee("g1", [ep("e1", X), ep("e2", null, null)]);
    const g2 = gachee("g2", [ep("e3", X)]); // pas encore en ligne
    const g3 = gachee("g3", [ep("e4", X)]); // en ligne, mais modifiée ici depuis
    const etatSync = enLigne(g1, g3);
    etatSync.docs["gachee:g3"].empreinte = "ancienne";
    expect(planifierCourbes([g1, g2, g3], etatSync, etatCourbesInitial()))
      .toEqual([{ cle: `e1:${X}`, eprouvetteId: "e1", gacheeId: "g1", importeLe: X }]);
    expect(cleCourbe(g1.eprouvettes[0])).toBe(cleImport("e1", X));
  });

  it("origine inconnue (référence sans import, courbe d'un autre import, ou dans la gâchée) : jamais envoyée", () => {
    const dansLaGachee = { ...ep("e4", X, null), essai: { ...ep("e4", X, null).essai, courbe: [{ tempsS: 0, chargeN: 0, deplacementMm: 0, contrainteKpa: 0, deformationPct: 0 }] } };
    const g = gachee("g1", [ep("e1", X, SANS_IMPORT), ep("e2", Y, X), ep("e3", null, SANS_IMPORT), dansLaGachee]);
    expect(planifierCourbes([g], enLigne(g), etatCourbesInitial())).toEqual([]);
  });

  it("copie de conflit comprise : même import partagé une fois ; original Y et copie X : deux documents", () => {
    const original = gachee("g1", [ep("e1", Y), ep("e2", X)]);
    const copie = { ...gachee("g1c", [ep("e1", X), ep("e2", X)], true) };
    expect(planifierCourbes([original, copie], enLigne(original, copie), etatCourbesInitial())).toEqual([
      { cle: `e1:${Y}`, eprouvetteId: "e1", gacheeId: "g1", importeLe: Y },
      { cle: `e2:${X}`, eprouvetteId: "e2", gacheeId: "g1", importeLe: X },
      { cle: `e1:${X}`, eprouvetteId: "e1", gacheeId: "g1c", importeLe: X },
    ]);
  });

  it("déjà en ligne ou bloquée : rien ; purgée par le serveur : à renvoyer", () => {
    const g = gachee("g1", [ep("e1", X), ep("e2", X), ep("e3", X)]);
    const etat: EtatCourbes = { envoyees: { [`e1:${X}`]: { rev: 7 } }, bloquees: { [`e2:${X}`]: "53400" } };
    expect(planifierCourbes([g], enLigne(g), etat).map((p) => p.cle)).toEqual([`e3:${X}`]);
    expect(planifierCourbes([g], enLigne(g), oublierPurgees(etat, [`e1:${X}`])).map((p) => p.cle)).toEqual([`e1:${X}`, `e3:${X}`]);
    expect(oublierPurgees(etat, [])).toBe(etat);
  });
});

describe("courbes en ligne : envoi", () => {
  const p = { cle: `e1:${X}`, eprouvetteId: "e1", gacheeId: "g1", importeLe: X };
  const contenu = contenuCourbe(p, courbe(1));

  it("création : le document porte son rattachement et son import", async () => {
    const s = serveur();
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(101);
    expect(s.lignes.get(`e1:${X}`)!.contenu).toMatchObject({ eprouvetteId: "e1", gacheeId: "g1", importeLe: X, s: [0, 5] });
  });

  it("même identifiant déjà en ligne (réponse perdue, autre appareil) : révision retenue, JAMAIS réécrit", async () => {
    const s = serveur();
    s.lignes.set(`e1:${X}`, { rev: 50, contenu: contenuCourbe(p, courbe(9)), supprime: false });
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(50);
    expect(s.appels).toEqual([{ id: `e1:${X}`, baseRev: null }]);
    expect(s.lignes.get(`e1:${X}`)!.contenu).toMatchObject({ s: [0, 45] }); // intact
  });

  it("retiré par le nettoyage : recréé ; réponse sans ligne : à reprendre", async () => {
    const s = serveur();
    s.lignes.set(`e1:${X}`, { rev: 60, contenu: null, supprime: true });
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(101);
    expect(s.appels.map((a) => a.baseRev)).toEqual([null, 60]);
    const vide: EcrireCourbe = async () => ({ ok: false, ligne: null });
    expect(await envoyerCourbe(vide, p, contenu)).toBeNull();
  });

  it("A réimporte entre la planification et l'écriture de B : deux documents, la gâchée désigne celui de A", async () => {
    const s = serveur();
    // B planifie la courbe de l'import X, telle que la gâchée la désigne chez lui.
    const chezB = gachee("g1", [ep("e1", X)]);
    const [planB] = planifierCourbes([chezB], enLigne(chezB), etatCourbesInitial());
    // Pendant ce temps, A réimporte (Y) et envoie sa courbe.
    const chezA = gachee("g1", [ep("e1", Y)]);
    const [planA] = planifierCourbes([chezA], enLigne(chezA), etatCourbesInitial());
    expect(await envoyerCourbe(s.ecrire, planA, contenuCourbe(planA, courbe(2)))).toBe(101);
    // B écrit ensuite : son document ne touche pas celui de A.
    expect(await envoyerCourbe(s.ecrire, planB, contenuCourbe(planB, courbe(1)))).toBe(102);
    expect([...s.lignes.keys()].sort()).toEqual([`e1:${X}`, `e1:${Y}`]);
    // Un lecteur calcule l'identifiant depuis la gâchée courante (celle de A).
    expect(s.lignes.get(cleImport("e1", chezA.eprouvettes[0].essai!.sourcePresse!.importeLe))!.contenu).toMatchObject({ importeLe: Y, s: [0, 10] });
  });
});

describe("courbes en ligne : un cycle", () => {
  const g = gachee("g1", [ep("e1", X), ep("e2", X), ep("e3", X)]);
  const magasin = new Map([[`e1:${X}`, courbe(1)], [`e3:${X}`, courbe(3)]]); // e2 : pas sur cet appareil
  const lire = async (cle: string) => magasin.get(cle) ?? null;

  it("envoie, retient les révisions, saute ce que le magasin n'a pas, ne touche pas l'état d'entrée", async () => {
    const s = serveur();
    const etat = etatCourbesInitial();
    const r = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat, lire, ecrire: s.ecrire });
    expect(r).toMatchObject({ envoyees: 2, reste: 0, budgetEpuise: false });
    expect(r.etat.envoyees).toEqual({ [`e1:${X}`]: { rev: 101 }, [`e3:${X}`]: { rev: 102 } });
    expect(etat.envoyees).toEqual({});
    const encore = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat: r.etat, lire, ecrire: s.ecrire });
    expect(encore.envoyees).toBe(0);
  });

  it("budget : seuls les envois réels comptent ; le reste est compté et le cycle demande une relance", async () => {
    const s = serveur();
    const r = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat: etatCourbesInitial(), lire, ecrire: s.ecrire, budget: 1 });
    expect(r).toMatchObject({ envoyees: 1, reste: 2, budgetEpuise: true }); // e2 (absente) n'a rien coûté, mais e3 attend
    const suite = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat: r.etat, lire, ecrire: s.ecrire, budget: 1 });
    expect(suite).toMatchObject({ envoyees: 1, reste: 0, budgetEpuise: false });
  });

  it("refus définitif : courbe bloquée ; erreur passagère : arrêt du cycle, tout reste à envoyer", async () => {
    let n = 0;
    const refuse: EcrireCourbe = async () => { n++; throw new ErreurSync("permanente", "53400", "quota"); };
    const r = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat: etatCourbesInitial(), lire, ecrire: refuse });
    expect(r.etat.bloquees).toEqual({ [`e1:${X}`]: "53400", [`e3:${X}`]: "53400" });
    expect(n).toBe(2);
    expect(r.reste).toBe(0);
    let m = 0;
    const coupe: EcrireCourbe = async () => { m++; throw new ErreurSync("transitoire", "reseau"); };
    const r2 = await cycleCourbes({ gachees: [g], etatSync: enLigne(g), etat: etatCourbesInitial(), lire, ecrire: coupe });
    expect(m).toBe(1);
    expect(r2.etat).toEqual(etatCourbesInitial());
    expect(r2.reste).toBe(3);
  });
});
