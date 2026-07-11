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

  it("prixPourLiant : id d'abord, repli sur le code (entrées héritées sans id)", () => {
    const prices = [{ id: "liant_x", code: "OLD", price_per_kg: 0.3 }];
    expect(prixPourLiant(prices, { id: "liant_x", code: "NOUVEAU" })).toBe(0.3); // par id
    // Repli code : seulement vers une entrée SANS id (héritée) — une entrée
    // rattachée par id à un AUTRE liant ne doit pas être facturée.
    expect(prixPourLiant(prices, { id: "autre", code: "OLD" })).toBe(0);
    expect(prixPourLiant([{ code: "OLD", price_per_kg: 0.25 }], { id: "autre", code: "OLD" })).toBe(0.25);
    expect(prixPourLiant(prices, { id: "rien", code: "rien" })).toBe(0);
  });

  it("id exact plus loin dans le tableau bat un repli code plus tot (bug revue #2)", () => {
    // L1 renomme B1->B1X garde son entree {id a, code B1} ; L2 porte desormais B1.
    const prices = [
      { id: "a", code: "B1", price_per_kg: 0.3 },
      { id: "b", code: "B2", price_per_kg: 0.5 },
    ];
    expect(prixPourLiant(prices, { id: "b", code: "B1" })).toBe(0.5);
  });

  it("setBinderPrice ne supprime pas le prix rattache par id d'un autre liant (bug revue #3)", () => {
    // L1 (code B1) recoit un prix, puis est renomme B2 ; un nouveau liant
    // reprend le code libre B1. Fixer le prix du nouveau ne doit pas effacer
    // celui de L1 (rattache par id).
    s().ajouterLiant();
    const i1 = s().catalogue_liants.length - 1;
    const code1 = s().catalogue_liants[i1].code;
    const id1 = s().catalogue_liants[i1].id;
    s().setBinderPrice(code1, 0.3);
    s().modifierLiant(i1, { code: "B2_RENOMME" });

    s().ajouterLiant();
    const i2 = s().catalogue_liants.length - 1;
    s().modifierLiant(i2, { code: code1 }); // reutilise l'ancien code
    s().setBinderPrice(code1, 0.4);

    const prices = s().binderPrices;
    expect(prixPourLiant(prices, { id: id1, code: "B2_RENOMME" })).toBe(0.3); // conserve
    expect(prixPourLiant(prices, s().catalogue_liants[i2])).toBe(0.4);
  });

  it("setBinderPrice fusionne dans le stockage, pas la liste memoire (bug revue #4)", () => {
    // Un prix utilisateur est enregistre ; la memoire contient une liste de
    // demonstration NON persistee. Modifier UN prix ne doit persister que ce
    // changement — pas ecraser le stockage avec toute la liste demo.
    s().setBinderPrice("CP10", 0.9); // prix utilisateur persiste
    useStore.setState({
      binderPrices: [
        { code: "GU", price_per_kg: 0.195 },
        { code: "GGBFS", price_per_kg: 0.21 },
      ],
    }); // simulate fillTestData (demo en memoire seulement)
    s().setBinderPrice("GU", 0.2);

    const stored = JSON.parse(localStorage.getItem("minebackfill_binder_prices")!);
    const codes = stored.map((p: { code: string }) => p.code).sort();
    expect(codes).toEqual(["CP10", "GU"]); // pas de GGBFS : la demo n'a pas fui
    expect(stored.find((p: { code: string }) => p.code === "CP10").price_per_kg).toBe(0.9);
    // La memoire garde la demo (GGBFS) avec le GU mis a jour.
    const mem = s().binderPrices;
    expect(mem.find((p) => p.code === "GGBFS")?.price_per_kg).toBe(0.21);
    expect(mem.find((p) => p.code === "GU")?.price_per_kg).toBe(0.2);
  });
});
