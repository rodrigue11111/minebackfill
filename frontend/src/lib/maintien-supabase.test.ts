import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { appelAutorise, maintenirSupabase } from "./maintien-supabase";

// Anti-pause quotidien (Vercel) : la tâche GitHub n'était plus lancée depuis
// le 24 septembre 2026 sans que rien ne le signale.

describe("maintien de la base Supabase", () => {
  it("vraie lecture des catalogues, avec la clé anon ; 2xx = activité enregistrée", async () => {
    const appels: { url: string; headers: Record<string, string> }[] = [];
    const r = await maintenirSupabase("https://abc.supabase.co/", "cle-anon", async (url, init) => {
      appels.push({ url, headers: init.headers });
      return { status: 200 };
    });
    expect(r).toEqual({ ok: true, statut: 200, message: "Base interrogée : activité enregistrée." });
    expect(appels).toEqual([{ url: "https://abc.supabase.co/rest/v1/official_catalogs?select=id&limit=1",
      headers: { apikey: "cle-anon", Authorization: "Bearer cle-anon" } }]);
  });

  it("échecs dits clairement : configuration absente, clé refusée, projet en pause ou injoignable", async () => {
    expect((await maintenirSupabase(undefined, "k")).ok).toBe(false);
    const avec = (status: number) => maintenirSupabase("https://abc.supabase.co", "k", async () => ({ status }));
    expect(await avec(401)).toMatchObject({ ok: false, statut: 401, message: expect.stringContaining("Requête refusée") });
    expect(await avec(540)).toMatchObject({ ok: false, statut: 540, message: expect.stringContaining("en pause") });
    const panne = await maintenirSupabase("https://abc.supabase.co", "k", async () => { throw new Error("fetch failed"); });
    expect(panne).toMatchObject({ ok: false, statut: null, message: "Projet injoignable : fetch failed" });
  });

  it("CRON_SECRET défini : seul l'appel de Vercel passe ; sinon la route reste ouverte (lecture publique)", () => {
    expect(appelAutorise("s3cret", "Bearer s3cret")).toBe(true);
    expect(appelAutorise("s3cret", null)).toBe(false);
    expect(appelAutorise("s3cret", "Bearer autre")).toBe(false);
    expect(appelAutorise(undefined, null)).toBe(true);
  });

  it("vercel.json planifie la route chaque jour (au plus une fois par jour sur l'offre gratuite)", () => {
    const conf = JSON.parse(readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(conf.crons).toEqual([{ path: "/api/maintien-supabase", schedule: "0 11 * * *" }]);
  });
});
