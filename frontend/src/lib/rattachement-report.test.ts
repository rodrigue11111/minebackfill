import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CLE_REPORT_RATTACHEMENT, DUREE_REPORT_MS, oublierReport, rattachementReporte, reporterPour,
} from "./rattachement-report";

// « Plus tard » sur le bandeau de rattachement (retour du 19 octobre 2026) :
// le choix revenait à chaque chargement de page.

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

type Global = Record<string, unknown>;
const g = globalThis as unknown as Global;
let fenetre: unknown;
let stockage: unknown;

beforeEach(() => {
  fenetre = g.window;
  stockage = g.localStorage;
  g.window = globalThis;
  g.localStorage = new MemStorage();
});
afterEach(() => {
  g.window = fenetre;
  g.localStorage = stockage;
});

describe("report du rattachement (« Plus tard »)", () => {
  const T0 = Date.UTC(2026, 9, 20, 14);

  it("mémorisé pour CE compte, pendant 12 h, en enveloppe versionnée", () => {
    expect(rattachementReporte("u1", T0)).toBe(false);
    reporterPour("u1", T0);
    expect(JSON.parse(localStorage.getItem(CLE_REPORT_RATTACHEMENT)!)).toEqual({ v: 1, data: { uid: "u1", jusqua: T0 + DUREE_REPORT_MS } });
    expect(rattachementReporte("u1", T0 + 1)).toBe(true); // rechargement de la page : le bandeau reste caché
    expect(rattachementReporte("u2", T0 + 1)).toBe(false); // autre compte sur le même appareil
    expect(rattachementReporte("u1", T0 + DUREE_REPORT_MS)).toBe(false); // 12 h plus tard : il revient
  });

  it("rattachement fait : le report est oublié ; valeur illisible : bandeau affiché", () => {
    reporterPour("u1", T0);
    oublierReport();
    expect(rattachementReporte("u1", T0 + 1)).toBe(false);
    localStorage.setItem(CLE_REPORT_RATTACHEMENT, "pas du JSON");
    expect(rattachementReporte("u1", T0 + 1)).toBe(false);
  });

  it("sans stockage (côté serveur) : jamais reporté, aucune erreur", () => {
    g.window = undefined;
    expect(rattachementReporte("u1", T0)).toBe(false);
    expect(() => oublierReport()).not.toThrow();
  });
});
