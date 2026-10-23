// frontend/src/lib/maintien-supabase.ts
// Anti-pause Supabase, déclenché CHAQUE JOUR par Vercel (frontend/vercel.json,
// route /api/maintien-supabase). L'offre gratuite met le projet en pause après
// environ 7 jours sans activité ; la tâche GitHub qui faisait ce travail
// (supabase-keepalive.yml, gardée en seconde sécurité) n'a plus été lancée par
// GitHub entre le 24 septembre et le 23 octobre 2026, sans aucun avertissement.
//
// Même requête que la tâche GitHub : une vraie lecture en base (catalogues
// officiels, lisibles sans compte par la RLS), pas un simple ping HTTP. Seul un
// 2xx prouve que la requête a atteint la base.

export interface ResultatMaintien {
  ok: boolean;
  /** Code HTTP de Supabase, null si la requête n'a pas abouti. */
  statut: number | null;
  message: string;
}

type Recuperer = (url: string, init: { headers: Record<string, string>; cache: "no-store" }) => Promise<{ status: number }>;

export async function maintenirSupabase(
  url: string | undefined,
  cle: string | undefined,
  recuperer: Recuperer = fetch,
): Promise<ResultatMaintien> {
  if (!url || !cle) {
    return { ok: false, statut: null, message: "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY absente : la base n'est PAS maintenue active." };
  }
  try {
    const r = await recuperer(`${url.replace(/\/+$/, "")}/rest/v1/official_catalogs?select=id&limit=1`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      cache: "no-store",
    });
    if (r.status >= 200 && r.status < 300) return { ok: true, statut: r.status, message: "Base interrogée : activité enregistrée." };
    if (r.status >= 400 && r.status < 500) {
      return { ok: false, statut: r.status, message: `Requête refusée (HTTP ${r.status}) : vérifier l'URL et la clé anon dans Vercel.` };
    }
    return { ok: false, statut: r.status, message: `Projet injoignable (HTTP ${r.status}), probablement en pause : supabase.com, le projet, « Restore ».` };
  } catch (e) {
    return { ok: false, statut: null, message: `Projet injoignable : ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Appel autorisé ? Si CRON_SECRET est défini dans Vercel, Vercel l'envoie dans
 * l'en-tête Authorization de ses tâches planifiées, et tout autre appel est
 * refusé. Sans CRON_SECRET, la route reste ouverte : elle ne fait qu'une
 * lecture publique, sans effet ni donnée sensible.
 */
export function appelAutorise(secret: string | undefined, authorization: string | null): boolean {
  return !secret || authorization === `Bearer ${secret}`;
}
