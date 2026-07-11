import { beforeEach, describe, expect, it } from "vitest";
import { loadVersioned, persistVersioned } from "./persisted";

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
