// frontend/src/lib/assistant.ts
// Assistant IA « sur le site » (réservé au compte enseignant) — helpers
// CÔTÉ SERVEUR utilisés par la route /api/assistant.
//
// Architecture : le chat du site n'est qu'une FAÇADE. Chaque message crée ou
// alimente une issue GitHub mentionnant @claude ; l'IA mainteneuse
// (.github/workflows/claude.yml) travaille dans son cadre sécurisé — branche,
// Pull Request, tests d'or, aperçu Vercel — et ses réponses (commentaires
// d'issue) sont réaffichées dans le chat. Aucun secret ni aucune exécution de
// code dans le navigateur ; le jeton GitHub ne vit que dans l'environnement
// serveur (Vercel), portée minimale « Issues read/write » sur CE dépôt.
//
// Toutes les fonctions prennent fetchImpl en paramètre : testables sans réseau.

export interface ConfigAssistant {
  /** Jeton GitHub fine-grained : CE dépôt, permissions Issues read/write. */
  token: string;
  /** « proprietaire/nom » du dépôt, ex. rodrigue11111/minebackfill. */
  repo: string;
  supabaseUrl: string;
  supabaseAnon: string;
}

/** Lit la configuration serveur ; null si la fonctionnalité n'est pas activée. */
export function lireConfigAssistant(env: Record<string, string | undefined> = process.env): ConfigAssistant | null {
  const token = env.ASSISTANT_GITHUB_TOKEN;
  const repo = env.ASSISTANT_GITHUB_REPO;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !repo || !supabaseUrl || !supabaseAnon) return null;
  return { token, repo, supabaseUrl, supabaseAnon };
}

/**
 * Vérifie CÔTÉ SERVEUR que le jeton Supabase reçu appartient à un compte
 * ENSEIGNANT. On interroge Supabase avec le jeton de l'utilisateur lui-même
 * (la RLS lui permet de lire son propre profil) — aucun besoin de clé service.
 * Renvoie l'email si prof, null sinon (jeton invalide, étudiant, etc.).
 */
export async function verifierProf(
  cfg: ConfigAssistant,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ email: string | null } | null> {
  if (!accessToken) return null;
  const entetes = {
    apikey: cfg.supabaseAnon,
    Authorization: `Bearer ${accessToken}`,
  };
  const rUser = await fetchImpl(`${cfg.supabaseUrl}/auth/v1/user`, { headers: entetes });
  if (!rUser.ok) return null;
  const user = (await rUser.json()) as { id?: string; email?: string };
  if (!user.id) return null;

  const rProfil = await fetchImpl(
    `${cfg.supabaseUrl}/rest/v1/profiles?select=role&id=eq.${user.id}`,
    { headers: entetes },
  );
  if (!rProfil.ok) return null;
  const profils = (await rProfil.json()) as { role?: string }[];
  if (profils[0]?.role !== "prof") return null;
  return { email: user.email ?? null };
}

const ENTETES_GITHUB = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

/** Corps d'issue/commentaire : mention @claude + message + provenance. */
export function construireCorps(message: string, email: string | null): string {
  // On retire les mentions @claude tapées par l'utilisateur (c'est nous qui
  // la plaçons, une seule fois, en tête) puis on borne la taille.
  const propre = message.replace(/@claude/gi, "").trim().slice(0, 4000);
  const provenance = email ? `\n\n---\n_Demande envoyée depuis MineBackfill (page Assistant) par ${email}._` : "";
  return `@claude\n\n${propre}${provenance}`;
}

/** Titre d'issue : première ligne du message, bornée. */
export function construireTitre(message: string): string {
  const ligne = message.replace(/@claude/gi, "").trim().split("\n")[0].slice(0, 80);
  return ligne || "Demande de modification (assistant du site)";
}

export async function creerIssue(
  cfg: ConfigAssistant,
  message: string,
  email: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ numero: number; url: string } | { erreur: string }> {
  const r = await fetchImpl(`https://api.github.com/repos/${cfg.repo}/issues`, {
    method: "POST",
    headers: ENTETES_GITHUB(cfg.token),
    body: JSON.stringify({
      title: construireTitre(message),
      body: construireCorps(message, email),
      labels: ["assistant-site"],
    }),
  });
  if (!r.ok) return { erreur: `GitHub a refusé la création (HTTP ${r.status}).` };
  const data = (await r.json()) as { number: number; html_url: string };
  return { numero: data.number, url: data.html_url };
}

export async function commenterIssue(
  cfg: ConfigAssistant,
  numero: number,
  message: string,
  email: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { erreur: string }> {
  const r = await fetchImpl(
    `https://api.github.com/repos/${cfg.repo}/issues/${numero}/comments`,
    {
      method: "POST",
      headers: ENTETES_GITHUB(cfg.token),
      body: JSON.stringify({ body: construireCorps(message, email) }),
    },
  );
  if (!r.ok) return { erreur: `GitHub a refusé le commentaire (HTTP ${r.status}).` };
  return { ok: true };
}

export interface MessageConversation {
  auteur: string;
  corps: string;
  date: string;
}

export async function lireConversation(
  cfg: ConfigAssistant,
  numero: number,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { titre: string; etat: string; url: string; messages: MessageConversation[] }
  | { erreur: string }
> {
  const entetes = ENTETES_GITHUB(cfg.token);
  const [rIssue, rComms] = await Promise.all([
    fetchImpl(`https://api.github.com/repos/${cfg.repo}/issues/${numero}`, { headers: entetes }),
    fetchImpl(
      `https://api.github.com/repos/${cfg.repo}/issues/${numero}/comments?per_page=100`,
      { headers: entetes },
    ),
  ]);
  if (!rIssue.ok || !rComms.ok) return { erreur: "Conversation introuvable." };
  const issue = (await rIssue.json()) as {
    title: string; state: string; html_url: string; body?: string;
    user?: { login?: string }; created_at: string;
  };
  const comms = (await rComms.json()) as {
    user?: { login?: string }; body?: string; created_at: string;
  }[];
  return {
    titre: issue.title,
    etat: issue.state,
    url: issue.html_url,
    messages: [
      { auteur: issue.user?.login ?? "?", corps: issue.body ?? "", date: issue.created_at },
      ...comms.map((c) => ({
        auteur: c.user?.login ?? "?",
        corps: c.body ?? "",
        date: c.created_at,
      })),
    ],
  };
}
