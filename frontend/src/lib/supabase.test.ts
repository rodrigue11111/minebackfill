import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attributsCookie, creerStockageCookie, nettoyerValeurEnv } from "./supabase";

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

  it("tolère des variables polluées par le copier-coller (client non nul)", async () => {
    // Pollution VUE EN PRODUCTION : tabulation devant l'URL, clé collée 4 fois
    // avec retours à la ligne — cassait fetch (« Invalid value » en en-tête).
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "\thttps://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "cle-demo\ncle-demo\ncle-demo\ncle-demo");
    const { getSupabase } = await import("./supabase");
    expect(getSupabase()).not.toBeNull();
  });
});

describe("nettoyerValeurEnv — tolérance aux accidents de copier-coller", () => {
  it("retire la tabulation/espaces autour d'une URL", () => {
    expect(nettoyerValeurEnv("\thttps://x.supabase.co ")).toBe("https://x.supabase.co");
  });

  it("ne garde qu'une copie d'une clé collée plusieurs fois (retours à la ligne)", () => {
    expect(nettoyerValeurEnv("sb_pub_abc\nsb_pub_abc\nsb_pub_abc\nsb_pub_abc")).toBe("sb_pub_abc");
  });

  it("retire les guillemets autour de la valeur", () => {
    expect(nettoyerValeurEnv('"sb_pub_abc"')).toBe("sb_pub_abc");
    expect(nettoyerValeurEnv("'https://x.co'")).toBe("https://x.co");
  });

  it("valeur vide ou blanche -> undefined (client désactivé, pas d'erreur)", () => {
    expect(nettoyerValeurEnv("")).toBeUndefined();
    expect(nettoyerValeurEnv("   \n\t ")).toBeUndefined();
    expect(nettoyerValeurEnv(undefined)).toBeUndefined();
  });

  it("valeur déjà propre : inchangée", () => {
    expect(nettoyerValeurEnv("sb_publishable_abc-DEF_123")).toBe("sb_publishable_abc-DEF_123");
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
        if (ma && ma.split("=")[1] === "0") {
          jar.delete(nom);
          return;
        }
        // Comportement des VRAIS navigateurs : un cookie dont nom+valeur
        // dépasse 4096 octets est REJETÉ EN SILENCE. C'est le comportement qui
        // a causé le bug « rôle toujours étudiant » — ne pas l'assouplir.
        if (nom.length + valeur.length > 4096) return;
        jar.set(nom, valeur);
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
    const grand = "x".repeat(8000); // 3 morceaux de 3200 après encodage
    st().setItem("pb_auth", grand);
    expect([...jar.keys()]).toContain("pb_auth.0");
    expect([...jar.keys()]).toContain("pb_auth.2");
    expect(st().getItem("pb_auth")).toBe(grand);
  });

  it("round-trip d'une session réaliste (JSON dense en guillemets) sans dépasser 4096 octets par cookie", () => {
    // Reproduit le bug d'origine : le JSON de session Supabase est plein de
    // caractères que l'encodage triple (`"` -> %22). L'ancien découpage (avant
    // encodage) produisait ici un cookie > 4096 octets, rejeté par le
    // navigateur -> session illisible -> requêtes anonymes -> RLS cache tout.
    const session = JSON.stringify({
      access_token: "eyJhbGciOiJFUzI1NiJ9." + "A".repeat(600) + ".sig",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: 1753142400,
      refresh_token: "rt-3xemple",
      user: {
        id: "2e119616-685e-4e45-9efa-0ae6e54ff463",
        aud: "authenticated",
        role: "authenticated",
        email: "prof@exemple.ca",
        app_metadata: { provider: "email", providers: ["email"] },
        // Métadonnées denses : dans « {"k0":0,"k1":1,…} », 6 caractères sur 8
        // sont triplés par l'encodage — c'est ce qui faisait déborder l'ancien
        // découpage (morceau de 3072 caractères -> cookie > 4096 octets).
        user_metadata: Object.fromEntries(
          Array.from({ length: 150 }, (_, i) => [`k${i}`, i]),
        ),
        identities: Array.from({ length: 4 }, (_, i) => ({
          identity_id: `id-${i}-0a1b2c3d4e5f6a7b8c9d0e1f`,
          provider: "email",
          identity_data: { email: "prof@exemple.ca", email_verified: false, phone_verified: false },
          last_sign_in_at: "2026-07-22T00:00:00.000000Z",
        })),
      },
    });
    st().setItem("pb_auth", session);
    // Chaque cookie écrit respecte la limite navigateur.
    for (const [k, v] of jar.entries()) {
      expect(k.length + v.length).toBeLessThanOrEqual(4096);
    }
    // Et la session se relit à l'identique (aucun morceau rejeté).
    expect(st().getItem("pb_auth")).toBe(session);
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

  it("relit les cookies écrits par l'ancienne version (morceaux encodés séparément)", () => {
    // L'ancien setItem encodait CHAQUE morceau ; enc(a) + enc(b) reste un
    // encodage valide de a + b, donc le nouveau getItem (recolle puis décode
    // une fois) doit les lire tels quels.
    jar.set("pb_auth.0", encodeURIComponent('{"a":1,'));
    jar.set("pb_auth.1", encodeURIComponent('"b":"é"}'));
    expect(st().getItem("pb_auth")).toBe('{"a":1,"b":"é"}');
  });

  it("cookie corrompu (séquence %XX tronquée) : null, sans exception", () => {
    // Héritage possible de l'ancienne version : morceau rejeté par le
    // navigateur -> reconstruction invalide. Doit valoir « pas de session ».
    jar.set("pb_auth.0", "abc%2");
    expect(st().getItem("pb_auth")).toBeNull();
  });
});
