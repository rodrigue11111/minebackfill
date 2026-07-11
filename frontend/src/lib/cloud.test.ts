import { describe, it, expect, vi } from "vitest";
import {
  fusionnerResultats, listerResultatsCloud, upsertResultatCloud,
  fetchCatalogueOfficiel,
} from "./cloud";
import type { SavedResult } from "./store";
import type { SupabaseClient } from "@supabase/supabase-js";

const sr = (id: string, savedAt: string): SavedResult =>
  ({ id, savedAt, category: "RPC", method: "dosage_cw", recipes: [], general: {} } as unknown as SavedResult);

describe("fusionnerResultats — fusion pure", () => {
  it("dédup par id : l'existant local gagne", () => {
    const local = [sr("a", "2026-01-02"), sr("b", "2026-01-01")];
    const cloud = [{ ...sr("a", "2026-01-09"), label: "cloud" } as SavedResult, sr("c", "2026-01-03")];
    const { fusionnes } = fusionnerResultats(local, cloud);
    // 3 uniques, et le "a" est la version LOCALE (pas le label cloud).
    expect(fusionnes.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
    expect((fusionnes.find((r) => r.id === "a") as { label?: string }).label).toBeUndefined();
  });

  it("trie par savedAt décroissant", () => {
    const { fusionnes } = fusionnerResultats(
      [sr("a", "2026-01-01")], [sr("b", "2026-03-01"), sr("c", "2026-02-01")]);
    expect(fusionnes.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("aPousser = résultats locaux absents du cloud", () => {
    const { aPousser } = fusionnerResultats(
      [sr("a", "2026-01-02"), sr("b", "2026-01-01")], [sr("a", "2026-01-01")]);
    expect(aPousser.map((r) => r.id)).toEqual(["b"]);
  });

  it("cloud vide : tout le local est à pousser", () => {
    const local = [sr("a", "1"), sr("b", "2")];
    const { fusionnes, aPousser } = fusionnerResultats(local, []);
    expect(fusionnes).toHaveLength(2);
    expect(aPousser).toHaveLength(2);
  });
});

// Faux client Supabase minimal (chaînage from().select()...) pour tester les
// fonctions à client injecté sans réseau.
function fauxClient(reponses: Record<string, unknown>): SupabaseClient {
  return {
    from(table: string) {
      const chain = {
        _table: table,
        select() { return chain; },
        eq() { return chain; },
        order() { return Promise.resolve(reponses[`${table}.list`] ?? { data: [], error: null }); },
        maybeSingle() { return Promise.resolve(reponses[`${table}.single`] ?? { data: null, error: null }); },
        upsert(row: unknown) { reponses[`${table}.upserted`] = row; return Promise.resolve({ error: null }); },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("fonctions cloud à client injecté", () => {
  it("listerResultatsCloud extrait les payloads", async () => {
    const sb = fauxClient({ "saved_results.list": { data: [{ payload: sr("x", "1") }, { payload: sr("y", "2") }], error: null } });
    const res = await listerResultatsCloud(sb);
    expect(res.map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("listerResultatsCloud renvoie [] en cas d'erreur", async () => {
    const sb = fauxClient({ "saved_results.list": { data: null, error: { message: "boom" } } });
    expect(await listerResultatsCloud(sb)).toEqual([]);
  });

  it("upsertResultatCloud envoie id + user_id + payload", async () => {
    const rep: Record<string, unknown> = {};
    const sb = fauxClient(rep);
    await upsertResultatCloud(sb, "user-1", sr("z", "1"));
    expect(rep["saved_results.upserted"]).toMatchObject({ id: "z", user_id: "user-1" });
  });

  it("fetchCatalogueOfficiel renvoie l'enveloppe {v,data}", async () => {
    const enveloppe = { v: 2, data: [{ id: "l1", code: "GU" }] };
    const sb = fauxClient({ "official_catalogs.single": { data: { data: enveloppe }, error: null } });
    expect(await fetchCatalogueOfficiel(sb, "liants")).toEqual(enveloppe);
  });

  it("fetchCatalogueOfficiel renvoie null si absent", async () => {
    const sb = fauxClient({ "official_catalogs.single": { data: null, error: null } });
    expect(await fetchCatalogueOfficiel(sb, "liants")).toBeNull();
  });
});

// Silence un éventuel warning console des fonctions testées.
vi.spyOn(console, "error").mockImplementation(() => {});
