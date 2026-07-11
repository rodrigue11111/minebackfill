import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
