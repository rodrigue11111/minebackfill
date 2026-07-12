import { describe, expect, it } from "vitest";
import {
  lireConfigAssistant, verifierProf, construireCorps, construireTitre,
  creerIssue, type ConfigAssistant,
} from "./assistant";

const CFG: ConfigAssistant = {
  token: "ghp_test", repo: "proprio/depot",
  supabaseUrl: "https://demo.supabase.co", supabaseAnon: "anon",
};

// Faux fetch séquencé par URL.
function fauxFetch(reponses: Record<string, { status: number; json: unknown }>) {
  const appels: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    appels.push({ url: u, init });
    const cle = Object.keys(reponses).find((k) => u.includes(k));
    const rep = cle ? reponses[cle] : { status: 404, json: {} };
    return {
      ok: rep.status >= 200 && rep.status < 300,
      status: rep.status,
      json: async () => rep.json,
    } as Response;
  }) as typeof fetch;
  return { impl, appels };
}

describe("assistant — configuration", () => {
  it("null si une variable serveur manque (fonctionnalité inerte)", () => {
    expect(lireConfigAssistant({})).toBeNull();
    expect(lireConfigAssistant({ ASSISTANT_GITHUB_TOKEN: "t" })).toBeNull();
  });
  it("configurée quand les 4 variables sont présentes", () => {
    expect(lireConfigAssistant({
      ASSISTANT_GITHUB_TOKEN: "t", ASSISTANT_GITHUB_REPO: "a/b",
      NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
    })).not.toBeNull();
  });
});

describe("assistant — vérification du rôle CÔTÉ SERVEUR", () => {
  it("accepte un prof (jeton valide + profil role=prof)", async () => {
    const { impl } = fauxFetch({
      "/auth/v1/user": { status: 200, json: { id: "u1", email: "prof@x.ca" } },
      "/rest/v1/profiles": { status: 200, json: [{ role: "prof" }] },
    });
    expect(await verifierProf(CFG, "jeton", impl)).toEqual({ email: "prof@x.ca" });
  });
  it("refuse un étudiant (403 côté route)", async () => {
    const { impl } = fauxFetch({
      "/auth/v1/user": { status: 200, json: { id: "u2", email: "etu@x.ca" } },
      "/rest/v1/profiles": { status: 200, json: [{ role: "etudiant" }] },
    });
    expect(await verifierProf(CFG, "jeton", impl)).toBeNull();
  });
  it("refuse un jeton invalide", async () => {
    const { impl } = fauxFetch({ "/auth/v1/user": { status: 401, json: {} } });
    expect(await verifierProf(CFG, "mauvais", impl)).toBeNull();
    expect(await verifierProf(CFG, "", impl)).toBeNull();
  });
});

describe("assistant — construction des messages GitHub", () => {
  it("le corps mentionne @claude UNE fois, en tête, et retire celles de l'utilisateur", () => {
    const corps = construireCorps("@claude corrige @CLAUDE le bouton", "prof@x.ca");
    expect(corps.startsWith("@claude\n\n")).toBe(true);
    expect(corps.match(/@claude/gi)?.length).toBe(1);
    expect(corps).toContain("corrige  le bouton");
    expect(corps).toContain("prof@x.ca");
  });
  it("le titre est la première ligne, bornée à 80 caractères", () => {
    expect(construireTitre("Ajoute le liant GUb-SF\ndetails...")).toBe("Ajoute le liant GUb-SF");
    expect(construireTitre("x".repeat(200)).length).toBe(80);
  });
  it("créerIssue poste sur le bon dépôt avec le label assistant-site", async () => {
    const { impl, appels } = fauxFetch({
      "api.github.com/repos/proprio/depot/issues": {
        status: 201, json: { number: 42, html_url: "https://github.com/x/42" },
      },
    });
    const r = await creerIssue(CFG, "Ma demande", "prof@x.ca", impl);
    expect(r).toEqual({ numero: 42, url: "https://github.com/x/42" });
    const body = JSON.parse(String(appels[0].init?.body)) as { body: string; labels: string[] };
    expect(body.body).toContain("@claude");
    expect(body.labels).toContain("assistant-site");
    expect(String(appels[0].init?.headers && (appels[0].init!.headers as Record<string, string>).Authorization)).toContain("ghp_test");
  });
});
