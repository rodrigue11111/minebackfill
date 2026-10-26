import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Chaque fonction réseau est remplacée par un espion : sourceSupabase doit
// appeler la fonction du même nom, avec le client en premier argument et les
// autres arguments tels quels (délégation 1 pour 1, sans changement).
vi.mock("./classe-reseau", () => {
  const noms = ["lireClasse", "lireProfils", "lireAnnotationsClasse", "lireRevuesClasse", "lireDocComplet", "lireCourbe",
    "lireCourbesClasse", "ajouterAnnotation", "retirerAnnotation", "marquerAnnotationsLues", "poserRevue", "retirerRevue",
    "lireComptes", "definirRole", "bloquerCompte"];
  return Object.fromEntries(noms.map((n) => [n, vi.fn(async (...args: unknown[]) => ({ appel: n, args }))]));
});

import * as reseau from "./classe-reseau";
import { sourceSupabase } from "./classe-source";

describe("sourceSupabase : délégation 1 pour 1 à classe-reseau.ts", () => {
  it("chaque méthode appelle la fonction du même nom avec le client et les mêmes arguments", async () => {
    const sb = { faux: true } as unknown as SupabaseClient;
    const s = sourceSupabase(sb);
    expect(s.demonstration).toBe(false);
    const appels: [keyof typeof s, unknown[]][] = [
      ["lireClasse", [{ complet: true, session: "A2026" }]],
      ["lireProfils", []],
      ["lireAnnotationsClasse", []],
      ["lireRevuesClasse", []],
      ["lireDocComplet", ["u1", "gachee", "g1"]],
      ["lireCourbe", ["u1", "e1", "2026-10-01"]],
      ["lireCourbesClasse", [true, ["u1"]]],
      ["ajouterAnnotation", [{ ownerId: "u1", auteurId: "p", kind: "gachee", id: "g1", rev: 2, ancre: null, texte: "x" }]],
      ["retirerAnnotation", ["a1"]],
      ["marquerAnnotationsLues", [["a1"]]],
      ["poserRevue", [{ ownerId: "u1", id: "g1", rev: 2, decision: "acceptee", motif: null, ecartees: [] }]],
      ["retirerRevue", ["u1", "g1"]],
      ["lireComptes", []],
      ["definirRole", ["u1", "prof"]],
      ["bloquerCompte", ["u1", true]],
    ];
    for (const [nom, args] of appels) {
      const r = await (s[nom] as (...a: unknown[]) => Promise<unknown>)(...args);
      expect(r).toEqual({ appel: nom, args: [sb, ...args] });
      expect((reseau as unknown as Record<string, ReturnType<typeof vi.fn>>)[nom]).toHaveBeenCalledWith(sb, ...args);
    }
  });
});
