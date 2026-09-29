import { beforeEach, describe, expect, it } from "vitest";
import {
  clesEnEchecDEcriture, ecouterEchecsDEcriture, ecrireLocal, loadVersioned, persistVersioned,
} from "./persisted";

// Le module garde `typeof window === "undefined"` (SSR-safe) et lit le global
// `localStorage`. On fournit les deux en mémoire pour l'environnement node.
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

const identite = (d: unknown) => d;

describe("persisted — persistance versionnée", () => {
  it("aller-retour d'une valeur enveloppée", () => {
    persistVersioned("k", 1, { a: 1, b: [2, 3] });
    expect(loadVersioned("k", 1, identite, null)).toEqual({ a: 1, b: [2, 3] });
    // L'enveloppe { v, data } est bien celle stockée.
    expect(JSON.parse(localStorage.getItem("k")!)).toEqual({ v: 1, data: { a: 1, b: [2, 3] } });
  });

  it("clé absente renvoie le fallback", () => {
    expect(loadVersioned("absent", 1, identite, "def")).toBe("def");
  });

  it("valeur brute (pré-versionnage) traitée comme v0 puis migrée", () => {
    localStorage.setItem("k", JSON.stringify([1, 2, 3])); // pas d'enveloppe
    const migrer = (d: unknown, from: number) => {
      expect(from).toBe(0);
      return (d as number[]).map((x) => x * 10);
    };
    expect(loadVersioned("k", 1, migrer, [])).toEqual([10, 20, 30]);
  });

  it("même version : aucune migration appelée", () => {
    persistVersioned("k", 2, "x");
    const migrer = () => { throw new Error("ne doit pas migrer"); };
    expect(loadVersioned("k", 2, migrer, "def")).toBe("x");
  });

  it("JSON corrompu renvoie le fallback", () => {
    localStorage.setItem("k", "{pas du json");
    expect(loadVersioned("k", 1, identite, "def")).toBe("def");
  });

  it("SSR (window indéfini) : fallback en lecture, aucune écriture", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    persistVersioned("k", 1, "x");
    expect((globalThis as unknown as { localStorage: MemStorage }).localStorage.getItem("k")).toBeNull();
    expect(loadVersioned("k", 1, identite, "def")).toBe("def");
  });
});

// Stockage qui refuse toute écriture sur les clés listées, comme un navigateur
// dont le quota est atteint (QuotaExceededError).
class StockagePlein extends MemStorage {
  refuse = new Set<string>();
  setItem(k: string, v: string) {
    if (this.refuse.has(k)) throw new Error("QuotaExceededError");
    super.setItem(k, v);
  }
}

describe("persisted — échecs d'écriture signalés", () => {
  let st: StockagePlein;
  beforeEach(() => {
    st = new StockagePlein();
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = st;
    // Repart d'un état propre : une écriture réussie retire la clé des échecs.
    for (const k of clesEnEchecDEcriture()) ecrireLocal(k, "");
  });

  it("une écriture réussie renvoie true et ne signale rien", () => {
    expect(persistVersioned("k", 1, [1])).toBe(true);
    expect(ecrireLocal("brut", "x")).toBe(true);
    expect(clesEnEchecDEcriture()).toEqual([]);
  });

  it("un quota atteint renvoie false et la clé est signalée", () => {
    st.refuse.add("minebackfill_gachees");
    expect(persistVersioned("minebackfill_gachees", 2, [{ id: "g1" }])).toBe(false);
    expect(clesEnEchecDEcriture()).toEqual(["minebackfill_gachees"]);
    // L'ancienne valeur n'a pas été remplacée par une valeur partielle.
    expect(st.getItem("minebackfill_gachees")).toBeNull();
  });

  it("l'alerte disparaît dès qu'une écriture réussit à nouveau sur la même clé", () => {
    st.refuse.add("a");
    ecrireLocal("a", "1");
    ecrireLocal("b", "1");
    expect(clesEnEchecDEcriture()).toEqual(["a"]);
    st.refuse.delete("a"); // de la place a été libérée
    expect(ecrireLocal("a", "2")).toBe(true);
    expect(clesEnEchecDEcriture()).toEqual([]);
  });

  it("les abonnés sont prévenus à chaque changement, et seulement alors", () => {
    const recus: (readonly string[])[] = [];
    const arreter = ecouterEchecsDEcriture((c) => recus.push(c));
    st.refuse.add("a");
    ecrireLocal("a", "1");
    ecrireLocal("a", "2"); // toujours en échec : pas de nouvelle notification
    st.refuse.delete("a");
    ecrireLocal("a", "3");
    ecrireLocal("a", "4"); // toujours réussie : pas de nouvelle notification
    arreter();
    st.refuse.add("a");
    ecrireLocal("a", "5"); // désabonné
    expect(recus).toEqual([["a"], []]);
  });

  it("l'instantané garde la même référence tant que rien ne change", () => {
    const avant = clesEnEchecDEcriture();
    ecrireLocal("x", "1");
    expect(clesEnEchecDEcriture()).toBe(avant);
  });

  it("côté serveur : false, sans rien signaler", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(persistVersioned("k", 1, "x")).toBe(false);
    expect(ecrireLocal("k", "x")).toBe(false);
    expect(clesEnEchecDEcriture()).toEqual([]);
  });
});
