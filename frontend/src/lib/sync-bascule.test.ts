import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";
import { basculerCompte, type MiseDeCote, type StockageComptes } from "./sync-bascule";
import { cycle, etatInitial, marquerSuppression, type EtatSync } from "./sync-moteur";
import { creerDepotLocal } from "./sync-local";
import { FauxServeur, FauxTransport } from "./sync-faux-serveur";

// Un navigateur : stockage local en mémoire, avec des écritures qui peuvent
// échouer (stockage plein), et ses mises de côté par compte.
function navigateur() {
  const n = {
    etat: etatInitial() as EtatSync,
    resultats: [] as SavedResult[],
    gachees: [] as Gachee[],
    cote: new Map<string, MiseDeCote>(),
    plein: false,
    annotationsVidees: 0,
  };
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const s: StockageComptes = {
    lireEtat: () => clone(n.etat),
    ecrireEtat: (e) => { if (n.plein) return false; n.etat = clone(e); return true; },
    lireResultats: () => clone(n.resultats),
    ecrireResultats: (x) => { if (n.plein) return false; n.resultats = clone(x); return true; },
    lireGachees: () => clone(n.gachees),
    ecrireGachees: (x) => { if (n.plein) return false; n.gachees = clone(x); return true; },
    lireMiseDeCote: (uid) => (n.cote.has(uid) ? clone(n.cote.get(uid)!) : null),
    ecrireMiseDeCote: (uid, m) => { if (n.plein) return false; n.cote.set(uid, clone(m)); return true; },
    supprimerMiseDeCote: (uid) => { n.cote.delete(uid); },
    viderAnnotations: () => { n.annotationsVidees++; },
  };
  const depot = () => creerDepotLocal({
    uid: () => n.etat.uid, lireResultats: s.lireResultats, ecrireResultats: s.ecrireResultats,
    lireGachees: s.lireGachees, ecrireGachees: s.ecrireGachees, apresEcriture: () => {},
  });
  return { n, s, depot };
}

const res = (id: string, ownerId?: string) =>
  ({ id, savedAt: "2026-09-29T12:00:00.000Z", label: id, category: "RPC", method: "cw", general: {}, recipes: [], ownerId }) as unknown as SavedResult;
const gach = (id: string, courbe = false) => ({
  id, code: `G-${id}`, creeLe: "2026-09-29T12:00:00.000Z", statut: "brouillon", formulationLabel: "M", categorie: "RPC",
  recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [],
  eprouvettes: courbe ? [{ id: `${id}-e1`, code: "E1", couleLe: "x", ageJours: 28, statut: "ecrase", essai: { courbeInfo: { nbPoints: 150 } } }] : [],
}) as unknown as Gachee;

const opt = { maintenant: () => "2026-09-29T12:00:00.000Z", alea: () => "ab12" };

async function synchroniser(nav: ReturnType<typeof navigateur>, serveur: FauxServeur, session: string) {
  const t = new FauxTransport(serveur, session, () => nav.n.etat.uid ?? "");
  const r = await cycle(nav.n.etat, t, nav.depot(), opt);
  nav.n.etat = r.etat;
  return r;
}

describe("changement de compte dans un même navigateur", () => {
  it("même compte, ou jamais lié : rien ne bouge", () => {
    const { n, s } = navigateur();
    expect(basculerCompte(s, "u1")).toEqual({ ok: true, change: false });
    n.etat = { ...etatInitial(), uid: "u1" };
    expect(basculerCompte(s, "u1")).toEqual({ ok: true, change: false });
  });

  it("tout est en ligne : le travail de A quitte l'écran sans être gardé, B démarre lié", async () => {
    const serveur = new FauxServeur();
    const nav = navigateur();
    nav.n.etat = { ...etatInitial(), uid: "A" };
    nav.n.resultats = [res("rA")];
    nav.n.gachees = [gach("gA")];
    await synchroniser(nav, serveur, "A");
    const r = basculerCompte(nav.s, "B");
    expect(r).toEqual({ ok: true, change: true, misDeCote: false, restaure: false });
    expect(nav.n.resultats).toEqual([]);
    expect(nav.n.gachees).toEqual([]);
    expect(nav.n.etat.uid).toBe("B");
    expect(nav.n.cote.size).toBe(0);
    expect(nav.n.annotationsVidees).toBe(1);
    // B synchronise : rien de A ne part sous B.
    await synchroniser(nav, serveur, "B");
    expect(serveur.vivants("B").size).toBe(0);
  });

  it("modifications non envoyées de A : mises de côté, puis retrouvées et envoyées quand A revient", async () => {
    const serveur = new FauxServeur();
    const nav = navigateur();
    nav.n.etat = { ...etatInitial(), uid: "A" };
    nav.n.resultats = [res("rA")];
    await synchroniser(nav, serveur, "A");
    // A travaille hors ligne puis se déconnecte : rien n'est parti.
    nav.n.gachees = [gach("gA-hors-ligne")];
    nav.n.etat = marquerSuppression(nav.n.etat, "resultat", "rA");
    nav.n.resultats = [];

    expect(basculerCompte(nav.s, "B")).toMatchObject({ ok: true, misDeCote: true });
    expect(nav.n.gachees).toEqual([]);
    // B travaille et synchronise sous son propre compte.
    nav.n.resultats = [res("rB")];
    await synchroniser(nav, serveur, "B");
    expect([...serveur.vivants("B").keys()]).toEqual(["resultat:rB"]);

    // A revient : son travail en attente réapparaît et part enfin.
    expect(basculerCompte(nav.s, "A")).toMatchObject({ ok: true, restaure: true });
    expect(nav.n.gachees.map((g) => g.id)).toEqual(["gA-hors-ligne"]);
    expect(nav.n.resultats).toEqual([]);
    await synchroniser(nav, serveur, "A");
    expect([...serveur.vivants("A").keys()]).toEqual(["gachee:gA-hors-ligne"]);
    expect(serveur.supprimes("A")).toEqual(["resultat:rA"]);
    // Rien de B n'est passé chez A, ni l'inverse.
    expect([...serveur.vivants("B").keys()]).toEqual(["resultat:rB"]);
    expect(nav.n.cote.has("A")).toBe(false);
    expect(nav.n.cote.has("B")).toBe(false); // B était entièrement en ligne
  });

  it("des courbes de presse (qui ne vont pas en ligne) : mises de côté même si tout est synchronisé", async () => {
    const serveur = new FauxServeur();
    const nav = navigateur();
    nav.n.etat = { ...etatInitial(), uid: "A" };
    nav.n.gachees = [gach("gA", true)];
    await synchroniser(nav, serveur, "A");
    expect(basculerCompte(nav.s, "B")).toMatchObject({ ok: true, misDeCote: true });
    expect(nav.n.cote.get("A")!.gachees[0].eprouvettes[0].essai?.courbeInfo).toEqual({ nbPoints: 150 });
  });

  it("le résultat d'un tiers (ancienne fusion v1) reste où il est", () => {
    const nav = navigateur();
    nav.n.etat = { ...etatInitial(), uid: "A" };
    nav.n.resultats = [res("rTiers", "C"), res("rA")];
    basculerCompte(nav.s, "B");
    expect(nav.n.resultats.map((r) => r.id)).toEqual(["rTiers"]);
  });

  it("stockage plein : rien ne bouge, l'échec est rapporté", () => {
    const nav = navigateur();
    nav.n.etat = { ...etatInitial(), uid: "A" };
    nav.n.gachees = [gach("gA-non-envoyee")];
    nav.n.plein = true;
    expect(basculerCompte(nav.s, "B")).toEqual({ ok: false, raison: "stockage" });
    expect(nav.n.etat.uid).toBe("A");
    expect(nav.n.gachees.map((g) => g.id)).toEqual(["gA-non-envoyee"]);
  });
});
