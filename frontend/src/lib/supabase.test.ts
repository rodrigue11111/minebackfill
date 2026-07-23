import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attributsCookie, creerStockageCookie } from "./supabase";

// Le client est un singleton mémoïsé au niveau module : vi.resetModules() donne
// un module frais (donc un client non résolu) à chaque test.
describe("getSupabase — désactivé sans configuration", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("renvoie null si les variables d'environnement sont absentes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { getSupabase, cloudConfigure } = await import("./supabase");
    expect(getSupabase()).toBeNull();
    expect(cloudConfigure()).toBe(false);
  });

  it("renvoie null si une seule des deux variables est présente", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { getSupabase } = await import("./supabase");
    expect(getSupabase()).toBeNull();
  });

  it("crée un client (non nul) quand les deux variables sont présentes", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-demo");
    const { getSupabase, cloudConfigure } = await import("./supabase");
    expect(getSupabase()).not.toBeNull();
    expect(cloudConfigure()).toBe(true);
  });
});

// SSO : le cookie n'est partagé entre sous-domaines qu'en production.
describe("attributsCookie — portée du cookie selon l'hôte", () => {
  it("partage sur .progicielbelem.com depuis un sous-domaine (https)", () => {
    const a = attributsCookie("minebackfill.progicielbelem.com", "https:");
    expect(a).toContain("domain=.progicielbelem.com");
    expect(a).toContain("Secure");
    expect(a).toContain("SameSite=Lax");
  });

  it("partage aussi depuis l'apex", () => {
    expect(attributsCookie("progicielbelem.com", "https:")).toContain(
      "domain=.progicielbelem.com",
    );
  });

  it("ni domaine parent ni Secure en local (localhost, http)", () => {
    const a = attributsCookie("localhost", "http:");
    expect(a).not.toContain("domain=");
    expect(a).not.toContain("Secure");
  });

  it("pas de partage sur un hôte tiers (preview *.vercel.app)", () => {
    const a = attributsCookie("mon-app.vercel.app", "https:");
    expect(a).not.toContain("domain=");
    expect(a).toContain("Secure");
  });
});

describe("creerStockageCookie — round-trip et découpage en morceaux", () => {
  let jar: Map<string, string>;

  beforeEach(() => {
    // Faux document.cookie (jar en mémoire) — l'environnement vitest est "node".
    jar = new Map<string, string>();
    const fake = {
      get cookie() {
        return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      },
      set cookie(s: string) {
        const parts = s.split(";").map((x) => x.trim());
        const i = parts[0].indexOf("=");
        const nom = parts[0].slice(0, i);
        const valeur = parts[0].slice(i + 1);
        const ma = parts.find((p) => p.toLowerCase().startsWith("max-age="));
        if (ma && ma.split("=")[1] === "0") jar.delete(nom);
        else jar.set(nom, valeur);
      },
    };
    (globalThis as unknown as { document: unknown }).document = fake;
  });

  afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  const st = () => creerStockageCookie("path=/; SameSite=Lax");

  it("écrit puis relit une valeur courte (un seul morceau)", () => {
    st().setItem("pb_auth", "abc");
    expect(st().getItem("pb_auth")).toBe("abc");
  });

  it("découpe puis reconstruit fidèlement une grande valeur", () => {
    const grand = "x".repeat(8000); // > 2 morceaux de 3072
    st().setItem("pb_auth", grand);
    expect([...jar.keys()]).toContain("pb_auth.0");
    expect([...jar.keys()]).toContain("pb_auth.2");
    expect(st().getItem("pb_auth")).toBe(grand);
  });

  it("purge les morceaux excédentaires quand la valeur rétrécit", () => {
    st().setItem("pb_auth", "y".repeat(8000)); // 3 morceaux (0,1,2)
    st().setItem("pb_auth", "court"); //           1 morceau (0)
    expect(st().getItem("pb_auth")).toBe("court");
    expect([...jar.keys()]).not.toContain("pb_auth.1");
  });

  it("removeItem supprime tous les morceaux", () => {
    st().setItem("pb_auth", "z".repeat(5000)); // 2 morceaux
    st().removeItem("pb_auth");
    expect(st().getItem("pb_auth")).toBeNull();
    expect(jar.size).toBe(0);
  });

  it("getItem renvoie null pour une clé absente", () => {
    expect(st().getItem("absente")).toBeNull();
  });

  it("préserve une valeur avec caractères spéciaux (encodage sûr)", () => {
    const v = JSON.stringify({ token: "a.b-c_d", note: "é; =%", n: 1 });
    st().setItem("pb_auth", v);
    expect(st().getItem("pb_auth")).toBe(v);
  });
});
