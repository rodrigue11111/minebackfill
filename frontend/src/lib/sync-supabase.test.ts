import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurSync } from "./sync-moteur";
import { classerErreur, transportSupabase } from "./sync-supabase";

// Faux client : enregistre les appels RPC et rend des réponses préparées.
function fauxClient(reponses: Record<string, unknown>) {
  const appels: { fn: string; params: Record<string, unknown>; signal: boolean }[] = [];
  const sb = {
    rpc(fn: string, params: Record<string, unknown>) {
      return {
        abortSignal(signal: AbortSignal) {
          appels.push({ fn, params, signal: signal instanceof AbortSignal });
          const r = reponses[fn];
          return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
        },
      };
    },
  } as unknown as SupabaseClient;
  return { sb, appels };
}

describe("sync-supabase — lecture", () => {
  it("rend le curseur tel quel et traduit les lignes", async () => {
    const maj = "2026-09-28T23:52:11.119123+00:00";
    const { sb, appels } = fauxClient({
      lire_docs: {
        data: [
          { doc_kind: "gachee", doc_id: "g1", doc_rev: 12, maj_serveur: maj, supprime: false, contenu: { id: "g1" } },
          { doc_kind: "inconnu", doc_id: "x", doc_rev: 13, maj_serveur: maj, supprime: false, contenu: {} },
        ],
        error: null,
      },
    });
    const t = transportSupabase(sb, () => "u1");
    const page = await t.lirePage({ maj, kind: "gachee", id: "g0" }, 120, 100);
    expect(appels[0]).toEqual({
      fn: "lire_docs",
      params: { p_attendu: "u1", p_apres_maj: maj, p_apres_kind: "gachee", p_apres_id: "g0", p_recul_s: 120, p_limite: 100 },
      signal: true,
    });
    expect(page).toEqual([{ kind: "gachee", id: "g1", rev: 12, maj, supprime: false, contenu: { id: "g1" } }]);
  });

  it("une erreur de lecture est levée, jamais rendue comme une page vide", async () => {
    const { sb } = fauxClient({ lire_docs: { data: null, error: { code: "PGRST202", message: "fonction absente" } } });
    await expect(transportSupabase(sb, () => "u1").lirePage(null, 0, 100))
      .rejects.toMatchObject({ nature: "transitoire", code: "PGRST202" });
  });
});

describe("sync-supabase — écriture", () => {
  it("succès, conflit avec ligne, conflit sans ligne", async () => {
    const e = { kind: "gachee" as const, id: "g1", contenu: { id: "g1" }, baseRev: 3, supprime: false };
    let c = fauxClient({ ecrire_doc: { data: [{ ok: true, rev_serveur: 4, maj_serveur: "m4", supprime_serveur: false, contenu_serveur: null }], error: null } });
    expect(await transportSupabase(c.sb, () => "u1").ecrire(e)).toEqual({ ok: true, rev: 4, maj: "m4" });
    expect(c.appels[0].params).toEqual({ p_attendu: "u1", p_kind: "gachee", p_id: "g1", p_payload: { id: "g1" }, p_base_rev: 3, p_supprime: false });

    c = fauxClient({ ecrire_doc: { data: [{ ok: false, rev_serveur: 5, maj_serveur: "m5", supprime_serveur: true, contenu_serveur: null }], error: null } });
    expect(await transportSupabase(c.sb, () => "u1").ecrire(e)).toEqual({
      ok: false, ligne: { kind: "gachee", id: "g1", rev: 5, maj: "m5", supprime: true, contenu: null },
    });

    c = fauxClient({ ecrire_doc: { data: [], error: null } });
    expect(await transportSupabase(c.sb, () => "u1").ecrire(e)).toEqual({ ok: false, ligne: null });
  });

  it("une suppression n'envoie aucun contenu", async () => {
    const c = fauxClient({ ecrire_doc: { data: [{ ok: true, rev_serveur: 9, maj_serveur: "m", supprime_serveur: true, contenu_serveur: null }], error: null } });
    await transportSupabase(c.sb, () => "u1").ecrire({ kind: "resultat", id: "r1", contenu: { id: "r1" }, baseRev: 8, supprime: true });
    expect(c.appels[0].params.p_payload).toBeNull();
  });

  it("réseau coupé (exception) : erreur transitoire", async () => {
    const c = fauxClient({ ecrire_doc: new TypeError("Failed to fetch") });
    await expect(transportSupabase(c.sb, () => "u1").ecrire({ kind: "gachee", id: "g1", contenu: {}, baseRev: null, supprime: false }))
      .rejects.toMatchObject({ nature: "transitoire", code: "reseau" });
  });
});

describe("sync-supabase — classement des erreurs", () => {
  it("session, refus définitifs, pannes", () => {
    expect(classerErreur({ code: "28000" }).nature).toBe("session");
    for (const code of ["42501", "23514", "53400", "22001"]) expect(classerErreur({ code }).nature).toBe("permanente");
    for (const code of ["", "PGRST301", "503", "57014"]) expect(classerErreur({ code }).nature).toBe("transitoire");
    expect(classerErreur(null)).toBeInstanceOf(ErreurSync);
  });
});
