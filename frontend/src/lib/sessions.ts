// frontend/src/lib/sessions.ts
// Sessions de cours (« Automne 2026 »…) publiées par l'enseignant. Elles
// rangent le travail des étudiants d'une année à l'autre. Module PUR.
//
// Un document créé pendant une session porte son `sessionId`. Les documents
// plus anciens n'en ont pas : on DÉDUIT leur session de leur date, sans rien
// réécrire (additif d'abord). Hors de toute session publiée : « Sans session ».

export interface Session {
  /** Identifiant stable, court (ex. « A2026 »). */
  id: string;
  /** Libellé affiché (ex. « Automne 2026 »). */
  nom: string;
  /** Premier jour, AAAA-MM-JJ (inclus). */
  debut: string;
  /** Dernier jour, AAAA-MM-JJ (inclus). */
  fin: string;
}

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_ID = /^[A-Za-z0-9_-]{1,40}$/;

/** Erreurs d'une session saisie ; vide = valide. */
export function erreursSession(s: Session): string[] {
  const e: string[] = [];
  if (!RE_ID.test(s.id)) e.push("Identifiant : lettres, chiffres, « - » ou « _ » (40 au plus).");
  if (!s.nom.trim()) e.push("Le nom est obligatoire.");
  if (!RE_JOUR.test(s.debut) || Number.isNaN(Date.parse(s.debut))) e.push("Date de début invalide.");
  if (!RE_JOUR.test(s.fin) || Number.isNaN(Date.parse(s.fin))) e.push("Date de fin invalide.");
  if (RE_JOUR.test(s.debut) && RE_JOUR.test(s.fin) && s.fin < s.debut) e.push("La fin précède le début.");
  return e;
}

/**
 * Valide une liste venue du stockage ou du serveur : les entrées malformées
 * sont écartées (jamais d'exception), les doublons d'id aussi (le premier
 * gagne). Triée par date de début.
 */
export function validerSessions(data: unknown): Session[] {
  if (!Array.isArray(data)) return [];
  const vus = new Set<string>();
  const r: Session[] = [];
  for (const x of data) {
    const s = x as Session;
    if (!s || typeof s.id !== "string" || typeof s.nom !== "string"
      || typeof s.debut !== "string" || typeof s.fin !== "string") continue;
    if (erreursSession(s).length > 0 || vus.has(s.id)) continue;
    vus.add(s.id);
    r.push({ id: s.id, nom: s.nom.trim(), debut: s.debut, fin: s.fin });
  }
  return r.sort((a, b) => a.debut.localeCompare(b.debut) || a.id.localeCompare(b.id));
}

/** Jour local AAAA-MM-JJ d'un instant ISO (null si illisible). */
export function jourDe(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Session qui contient ce jour (la première par date de début si elles se chevauchent). */
export function sessionDuJour(sessions: Session[], jour: string | null): Session | null {
  if (!jour) return null;
  return sessions.find((s) => s.debut <= jour && jour <= s.fin) ?? null;
}

/** Session à apposer sur un document créé maintenant. */
export function sessionActive(sessions: Session[], maintenant: Date): Session | null {
  return sessionDuJour(sessions, jourDe(maintenant.toISOString()));
}

/**
 * Session d'un document : celle qu'il porte si elle est publiée, sinon celle
 * que sa date désigne, sinon null (« Sans session »).
 */
export function sessionEffective(
  doc: { sessionId?: string; date?: string },
  sessions: Session[],
): Session | null {
  if (doc.sessionId) {
    const s = sessions.find((x) => x.id === doc.sessionId);
    if (s) return s;
  }
  return sessionDuJour(sessions, jourDe(doc.date));
}

/** Valeur du filtre : une session, « sans » (aucune), ou « toutes ». */
export type FiltreSession = "toutes" | "sans" | string;

export function correspond(
  doc: { sessionId?: string; date?: string },
  sessions: Session[],
  filtre: FiltreSession,
): boolean {
  if (filtre === "toutes") return true;
  const s = sessionEffective(doc, sessions);
  return filtre === "sans" ? s === null : s?.id === filtre;
}
