import { beforeEach, describe, expect, it } from "vitest";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

import { useStore, prixPourLiant } from "./store";

const s = () => useStore.getState();

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  s().loadCatalogue();
  useStore.setState({ binderPrices: [] });
});

describe("prix des liants par id", () => {
  it("setBinderPrice enregistre l'id du liant (résolu via le catalogue)", () => {
    s().setBinderPrice("CP10", 0.2);
    const p = s().binderPrices.find((x) => x.code === "CP10");
    expect(p?.id).toBe("liant_cp10");
    expect(p?.price_per_kg).toBe(0.2);
  });

  it("le prix survit au renommage du code (correspondance par id)", () => {
    s().ajouterLiant(); // liant « perso » (non verrouillé)
    const idx = s().catalogue_liants.length - 1;
    const codeInitial = s().catalogue_liants[idx].code;
    s().setBinderPrice(codeInitial, 0.5);

    s().modifierLiant(idx, { code: "RENOMME" });
    const renomme = s().catalogue_liants[idx];
    expect(renomme.code).toBe("RENOMME");
    // Le prix n'est pas orphelin : retrouvé par l'id du liant.
    expect(prixPourLiant(s().binderPrices, renomme)).toBe(0.5);
  });

  it("prixPourLiant : id d'abord, repli sur le code", () => {
    const prices = [{ id: "liant_x", code: "OLD", price_per_kg: 0.3 }];
    expect(prixPourLiant(prices, { id: "liant_x", code: "NOUVEAU" })).toBe(0.3); // par id
    expect(prixPourLiant(prices, { id: "autre", code: "OLD" })).toBe(0.3);       // repli code
    expect(prixPourLiant(prices, { id: "rien", code: "rien" })).toBe(0);
  });
});
