import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aRevoir, cleRevue, indexerRevues, infoRevue, libelleRevue, revueClasseDepuisLigne, revueDepuisLigne, revuePerimee, type RevueClasse,
} from "./revues";
import { lireMesRevues, lireRevuesClasse, messageErreurClasse, ErreurClasse, poserRevue, retirerRevue } from "./classe-reseau";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const revue = (p: Partial<RevueClasse> = {}): RevueClasse => ({
  ownerId: A, kind: "gachee", id: "g1", rev: 5, decision: "acceptee", motif: null, ecartees: [], maj: "2026-10-02T10:00:00Z", ...p,
});

describe("revues : règles", () => {
  it("modifiée depuis la revue : révision du document plus récente que celle de la décision", () => {
    expect(revuePerimee({ rev: 5 }, 5)).toBe(false);
    expect(revuePerimee({ rev: 5 }, 6)).toBe(true);
    expect(revuePerimee({ rev: null }, 9)).toBe(false); // révision inconnue : on ne conclut rien
    expect(revuePerimee({ rev: 5 }, null)).toBe(false);
  });

  it("à revoir : gâchée terminée sans décision, ou modifiée depuis ; jamais un brouillon ni une copie de conflit", () => {
    const info = infoRevue(indexerRevues([revue()]), () => 7, A, "g1")!;
    expect(info).toMatchObject({ decision: "acceptee", perimee: true });
    expect(aRevoir({ statut: "terminee" }, undefined)).toBe(true);
    expect(aRevoir({ statut: "terminee" }, info)).toBe(true);
    expect(aRevoir({ statut: "terminee" }, { ...info, perimee: false })).toBe(false);
    expect(aRevoir({ statut: "brouillon" }, undefined)).toBe(false);
    expect(aRevoir({ statut: "terminee", conflit: { de: "g1", le: "x" } }, undefined)).toBe(false);
    expect(infoRevue(indexerRevues([revue()]), () => 5, A, "autre")).toBeUndefined();
    expect(libelleRevue({ decision: "refusee" })).toBe("Revue : refusée");
  });

  it("lignes lues : décision ou type inconnus ignorés, révision convertie", () => {
    expect(revueClasseDepuisLigne({ owner_id: A, target_kind: "gachee", target_id: "g1", target_rev: "12", decision: "refusee", motif: "x", ecartees: null, updated_at: "m" }))
      .toEqual({ ownerId: A, kind: "gachee", id: "g1", rev: 12, decision: "refusee", motif: "x", ecartees: [], maj: "m" });
    expect(revueClasseDepuisLigne({ owner_id: A, target_kind: "gachee", target_id: "g1", target_rev: null, decision: "peut-etre", motif: null, ecartees: [], updated_at: "m" })).toBeNull();
    expect(revueDepuisLigne({ cible_kind: "resultat", cible_id: "r1", cible_rev: 1, decision_revue: "acceptee", motif_revue: null, ecartees_revue: [], maj_serveur: "m" })).toBeNull();
    expect(cleRevue(A, "g1")).toBe(`${A}|g1`);
  });
});

describe("revues : réseau (faux client)", () => {
  it("enseignant : lecture paginée ; table absente (base pas à jour) → null, pas une erreur", async () => {
    const lignes = Array.from({ length: 5 }, (_, i) => ({ owner_id: A, target_kind: "gachee", target_id: `g${i}`, target_rev: i, decision: "acceptee", motif: null, ecartees: [], updated_at: `m${i}` }));
    const filtres: [string, unknown][] = [];
    const chaine = {
      select: () => chaine, order: () => chaine,
      eq: (c: string, v: unknown) => { filtres.push([c, v]); return chaine; },
      range: (de: number, a: number) => Promise.resolve({ data: lignes.slice(de, Math.min(a + 1, de + 2)), error: null }), // max_rows = 2
    };
    const r = await lireRevuesClasse({ from: () => chaine } as unknown as SupabaseClient);
    expect(r!.map((x) => x.id)).toEqual(["g0", "g1", "g2", "g3", "g4"]);
    expect(filtres[0]).toEqual(["deleted", false]);

    const absente = { select: () => absente, order: () => absente, eq: () => absente,
      range: () => Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.revues'" } }) };
    expect(await lireRevuesClasse({ from: () => absente } as unknown as SupabaseClient)).toBeNull();
    const refus = { select: () => refus, order: () => refus, eq: () => refus,
      range: () => Promise.resolve({ data: null, error: { code: "42501", message: "refusé" } }) };
    await expect(lireRevuesClasse({ from: () => refus } as unknown as SupabaseClient)).rejects.toMatchObject({ code: "42501" });
    expect(messageErreurClasse(new ErreurClasse("PGRST205", "table absente"))).toMatch(/schema\.sql/);
  });

  it("poser et retirer : paramètres envoyés, motif nettoyé, décision rendue", async () => {
    const appels: { fn: string; params: Record<string, unknown> }[] = [];
    const sb = {
      rpc(fn: string, params: Record<string, unknown>) {
        appels.push({ fn, params });
        return Promise.resolve({ data: fn === "poser_revue" ? [{ maj_serveur: "m9" }] : true, error: null });
      },
    } as unknown as SupabaseClient;
    const r = await poserRevue(sb, { ownerId: A, id: "g1", rev: 4, decision: "refusee", motif: "  Pesées incomplètes. ", ecartees: ["e1"] });
    expect(appels[0]).toEqual({ fn: "poser_revue", params: {
      p_owner: A, p_kind: "gachee", p_id: "g1", p_rev: 4, p_decision: "refusee", p_motif: "Pesées incomplètes.", p_ecartees: ["e1"],
    } });
    expect(r).toMatchObject({ decision: "refusee", motif: "Pesées incomplètes.", maj: "m9", rev: 4 });
    expect(await retirerRevue(sb, A, "g1")).toBe(true);
    expect(appels[1]).toEqual({ fn: "retirer_revue", params: { p_owner: A, p_kind: "gachee", p_id: "g1" } });
    const refus = { rpc: () => Promise.resolve({ data: null, error: { code: "22023", message: "un refus doit être motivé" } }) } as unknown as SupabaseClient;
    await expect(poserRevue(refus, { ownerId: A, id: "g1", rev: 4, decision: "refusee", motif: " ", ecartees: [] })).rejects.toMatchObject({ code: "22023" });
  });

  it("étudiant : ses revues converties ; fonction absente → null (la copie locale reste)", async () => {
    const sb = { rpc: () => Promise.resolve({ data: [{ cible_kind: "gachee", cible_id: "g1", cible_rev: "3", decision_revue: "acceptee", motif_revue: null, ecartees_revue: ["e2"], maj_serveur: "m" }], error: null }) } as unknown as SupabaseClient;
    expect(await lireMesRevues(sb, A)).toEqual([{ kind: "gachee", id: "g1", rev: 3, decision: "acceptee", motif: null, ecartees: ["e2"], maj: "m" }]);
    const absente = { rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }) } as unknown as SupabaseClient;
    expect(await lireMesRevues(absente, A)).toBeNull();
    const session = { rpc: () => Promise.resolve({ data: null, error: { code: "28000", message: "session inattendue" } }) } as unknown as SupabaseClient;
    await expect(lireMesRevues(session, A)).rejects.toMatchObject({ code: "28000" });
  });
});
