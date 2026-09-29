import { beforeEach, describe, expect, it } from "vitest";
import { etatInitial, type EtatSync } from "./sync-moteur";
import {
  CLE_ETAT_SYNC, chargerEtatSync, marquerSuppressionLocale, reporterSuppressions, sauverEtatSync,
} from "./sync-etat";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

const lie = (uid: string): EtatSync => ({ ...etatInitial(), uid });

describe("sync-etat — persistance", () => {
  it("aller-retour, dans une enveloppe versionnée", () => {
    const e = { ...lie("u1"), docs: { "gachee:g1": { rev: 3, empreinte: "abc" } } };
    expect(sauverEtatSync(e)).toBe(true);
    expect(chargerEtatSync()).toEqual(e);
    expect(JSON.parse(localStorage.getItem(CLE_ETAT_SYNC)!).v).toBe(1);
  });

  it("absent ou corrompu : état initial (non lié)", () => {
    expect(chargerEtatSync()).toEqual(etatInitial());
    localStorage.setItem(CLE_ETAT_SYNC, JSON.stringify({ v: 1, data: { v: 1, uid: 42 } }));
    expect(chargerEtatSync()).toEqual(etatInitial());
  });
});

describe("sync-etat — suppressions", () => {
  it("sans compte lié, supprimer ne pose rien", () => {
    marquerSuppressionLocale("gachee", "g1");
    expect(chargerEtatSync().suppressions).toEqual({});
  });

  it("compte lié : la suppression est posée", () => {
    sauverEtatSync(lie("u1"));
    marquerSuppressionLocale("resultat", "r1");
    expect(chargerEtatSync().suppressions).toEqual({ "resultat:r1": true });
  });

  it("une suppression posée PENDANT un cycle n'est pas perdue quand le cycle sauve son état", () => {
    const depart = { ...lie("u1"), suppressions: { "gachee:a": true as const } };
    sauverEtatSync(depart);
    // Pendant le cycle, l'utilisateur supprime g2.
    marquerSuppressionLocale("gachee", "g2");
    // Le cycle a traité « a » (retirée) et ne connaît pas g2.
    const fin = { ...depart, suppressions: {} };
    const sauve = reporterSuppressions(depart, chargerEtatSync(), fin);
    expect(sauve.suppressions).toEqual({ "gachee:g2": true });
  });

  it("sans suppression nouvelle, l'état du cycle est gardé tel quel", () => {
    const depart = lie("u1");
    const fin = { ...depart, curseur: { maj: "m", kind: "gachee", id: "g" } };
    expect(reporterSuppressions(depart, depart, fin)).toBe(fin);
  });
});
