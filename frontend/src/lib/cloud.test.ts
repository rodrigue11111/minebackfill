import { describe, it, expect, vi } from "vitest";
import { fetchCatalogueOfficiel, publierCatalogue } from "./cloud";
import type { SupabaseClient } from "@supabase/supabase-js";

// Faux client Supabase minimal (chaînage from().select().eq()...)
// pour tester les fonctions à client injecté sans réseau.
function fauxClient(reponses: Record<string, unknown>): SupabaseClient {
  return {
    from(table: string) {
      const chain = {
        _table: table,
        select() { return chain; },
        eq() { return chain; },
        order() { return chain; },
        limit() { return Promise.resolve(reponses[`${table}.list`] ?? { data: [], error: null }); },
        maybeSingle() { return Promise.resolve(reponses[`${table}.single`] ?? { data: null, error: null }); },
        upsert(row: unknown) { reponses[`${table}.upserted`] = row; return Promise.resolve({ error: null }); },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("fonctions cloud à client injecté", () => {
  it("publierCatalogue envoie l'enveloppe et l'auteur", async () => {
    const rep: Record<string, unknown> = {};
    const sb = fauxClient(rep);
    const res = await publierCatalogue(sb, "liants", { v: 2, data: [] }, "prof-1");
    expect(res.error).toBeNull();
    expect(rep["official_catalogs.upserted"]).toMatchObject({ id: "liants", data: { v: 2, data: [] }, updated_by: "prof-1" });
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
