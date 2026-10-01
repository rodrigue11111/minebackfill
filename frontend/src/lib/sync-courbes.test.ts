import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import type { CourbeColonnes } from "./courbes";
import { ErreurSync } from "./sync-moteur";
import {
  contenuCourbe, cycleCourbes, envoyerCourbe, etatCourbesInitial, planifierCourbes, signatureCourbe,
  type EcrireCourbe, type EtatCourbes,
} from "./sync-courbes";

const courbe = (n: number): CourbeColonnes => ({ v: 1, t: [0, n], f: [0, 10 * n], d: [0, 0.1], s: [0, 5 * n], e: [0, 0.1] });
const ep = (id: string, importeLe: string | null, nbPoints = 2) => ({
  id, code: id, couleLe: "2026-09-25T12:00:00Z", ageJours: 7, statut: "ecrase" as const,
  essai: importeLe === null ? { contrainteKpaSaisie: 400 } : { contrainteKpaSaisie: 400, courbeInfo: { nbPoints }, sourcePresse: { fichier: "p.xlsx", echantillon: "1", importeLe } },
});
const gachee = (id: string, eprouvettes: ReturnType<typeof ep>[], conflit = false) =>
  ({ id, code: id, creeLe: "x", statut: "terminee", formulationLabel: "F", categorie: "RPC", recetteIndex: 0, tolerancePct: 2,
    composants: [], ajustements: [], eprouvettes, ...(conflit ? { conflit: { de: "g1", le: "x" } } : {}) }) as unknown as Gachee;
const enLigne = (...ids: string[]) => ({ docs: Object.fromEntries(ids.map((id) => [`gachee:${id}`, { rev: 1, empreinte: "e" }])) });

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

describe("courbes en ligne : planification", () => {
  it("seulement les gâchées déjà en ligne, sans copie de conflit ; une courbe locale par éprouvette", () => {
    const gs = [
      gachee("g1", [ep("e1", "i1"), ep("e2", null)]),
      gachee("g2", [ep("e3", "i1")]), // pas encore en ligne
      gachee("g1c", [ep("e1", "i1")], true),
    ];
    const p = planifierCourbes(gs, enLigne("g1", "g1c"), etatCourbesInitial("u"));
    expect(p).toEqual([{ eprouvetteId: "e1", gacheeId: "g1", signature: "i1|2", baseRev: null }]);
  });

  it("déjà envoyée : rien ; nouvel import (signature changée) : renvoi sur la révision connue ; budget", () => {
    const etat: EtatCourbes = { ...etatCourbesInitial("u"), envoyees: { e1: { rev: 7, signature: "i1|2" }, e2: { rev: 8, signature: "i1|2" } } };
    const gs = [gachee("g1", [ep("e1", "i1"), ep("e2", "i2", 151), ep("e3", "i1"), ep("e4", "i1")])];
    expect(planifierCourbes(gs, enLigne("g1"), etat)).toEqual([
      { eprouvetteId: "e2", gacheeId: "g1", signature: "i2|151", baseRev: 8 },
      { eprouvetteId: "e3", gacheeId: "g1", signature: "i1|2", baseRev: null },
      { eprouvetteId: "e4", gacheeId: "g1", signature: "i1|2", baseRev: null },
    ]);
    expect(planifierCourbes(gs, enLigne("g1"), etat, 2)).toHaveLength(2);
    expect(planifierCourbes(gs, enLigne("g1"), { ...etat, bloquees: { e3: "i1|2" } }).map((x) => x.eprouvetteId)).toEqual(["e2", "e4"]);
    expect(signatureCourbe(undefined)).toBe("|0");
  });
});

describe("courbes en ligne : envoi", () => {
  const p = { eprouvetteId: "e1", gacheeId: "g1", signature: "s", baseRev: null };
  const contenu = contenuCourbe(p, courbe(1));

  it("création ; réponse perdue (même contenu déjà en ligne) : révision retenue, sans réécriture", async () => {
    const s = serveur();
    const rev = await envoyerCourbe(s.ecrire, p, contenu);
    expect(rev).toBe(101);
    expect(s.lignes.get("e1")!.contenu).toMatchObject({ eprouvetteId: "e1", gacheeId: "g1", s: [0, 5] });
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(101);
    expect(s.appels).toHaveLength(2); // pas de troisième écriture
  });

  it("contenu différent en ligne (autre import) ou courbe retirée : réécrite sur la révision lue", async () => {
    const s = serveur();
    s.lignes.set("e1", { rev: 50, contenu: contenuCourbe(p, courbe(9)), supprime: false });
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(101);
    expect(s.appels.map((a) => a.baseRev)).toEqual([null, 50]);
    s.lignes.set("e1", { rev: 60, contenu: null, supprime: true });
    expect(await envoyerCourbe(s.ecrire, p, contenu)).toBe(102);
  });

  it("renvoi après un nouvel import : révision qui a bougé, ou document disparu", async () => {
    const s = serveur();
    s.lignes.set("e1", { rev: 70, contenu: contenuCourbe(p, courbe(3)), supprime: false });
    expect(await envoyerCourbe(s.ecrire, { ...p, baseRev: 65 }, contenu)).toBe(101);
    const vide = serveur();
    expect(await envoyerCourbe(vide.ecrire, { ...p, baseRev: 65 }, contenu)).toBe(101);
    expect(vide.appels.map((a) => a.baseRev)).toEqual([65, null]);
  });
});

describe("courbes en ligne : un cycle", () => {
  const gs = [gachee("g1", [ep("e1", "i1"), ep("e2", "i1"), ep("e3", "i1")])];
  const magasin = new Map([["e1", courbe(1)], ["e3", courbe(3)]]); // e2 : pas sur cet appareil

  it("envoie, retient les révisions, saute ce que le magasin n'a pas, ne touche pas l'état d'entrée", async () => {
    const s = serveur();
    const etat = etatCourbesInitial("u");
    const r = await cycleCourbes({ gachees: gs, etatSync: enLigne("g1"), etat, lire: async (id) => magasin.get(id) ?? null, ecrire: s.ecrire });
    expect(r.envoyees).toBe(2);
    expect(r.etat.envoyees).toEqual({ e1: { rev: 101, signature: "i1|2" }, e3: { rev: 102, signature: "i1|2" } });
    expect(etat.envoyees).toEqual({});
    const encore = await cycleCourbes({ gachees: gs, etatSync: enLigne("g1"), etat: r.etat, lire: async (id) => magasin.get(id) ?? null, ecrire: s.ecrire });
    expect(encore.envoyees).toBe(0);
  });

  it("refus définitif : courbe bloquée (pas de nouvel essai) ; erreur passagère : arrêt du cycle", async () => {
    let n = 0;
    const refuse: EcrireCourbe = async () => { n++; throw new ErreurSync("permanente", "53400", "quota"); };
    const r = await cycleCourbes({ gachees: gs, etatSync: enLigne("g1"), etat: etatCourbesInitial("u"), lire: async (id) => magasin.get(id) ?? null, ecrire: refuse });
    expect(r.etat.bloquees).toEqual({ e1: "i1|2", e3: "i1|2" });
    expect(n).toBe(2);
    let m = 0;
    const coupe: EcrireCourbe = async () => { m++; throw new ErreurSync("transitoire", "reseau"); };
    const r2 = await cycleCourbes({ gachees: gs, etatSync: enLigne("g1"), etat: etatCourbesInitial("u"), lire: async (id) => magasin.get(id) ?? null, ecrire: coupe });
    expect(m).toBe(1);
    expect(r2.etat.envoyees).toEqual({});
    expect(r2.etat.bloquees).toEqual({});
  });
});
