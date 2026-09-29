// frontend/src/lib/persisted.ts
// Persistance localStorage VERSIONNÉE. Chaque valeur est enveloppée dans
// { v, data } : le numéro de version permet de migrer les données au
// chargement quand le schéma évolue, sans jamais casser d'anciennes données.
// Une valeur brute (sans enveloppe) est traitée comme la version 0 et migrée.
// SSR-safe : aucun accès à localStorage côté serveur.
// Toute écriture de l'application passe par ecrireLocal() ou persistVersioned(),
// qui signalent leurs échecs (voir plus bas).

/** Migre `data` depuis `fromVersion` vers la version courante. */
export type Migration = (data: unknown, fromVersion: number) => unknown;

interface Envelope<T> {
  v: number;
  data: T;
}

function isEnvelope(x: unknown): x is Envelope<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    "v" in x &&
    "data" in x &&
    typeof (x as { v: unknown }).v === "number"
  );
}

/**
 * Lit une valeur versionnée. Renvoie `fallback` si la clé est absente,
 * illisible, ou côté serveur. Migre les versions antérieures via `migrate`.
 */
export function loadVersioned<T>(
  key: string,
  currentVersion: number,
  migrate: Migration,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;

    let version: number;
    let data: unknown;
    if (isEnvelope(parsed)) {
      version = parsed.v;
      data = parsed.data;
    } else {
      // Valeur écrite avant l'introduction du versionnage = version 0.
      version = 0;
      data = parsed;
    }

    if (version < currentVersion) {
      data = migrate(data, version);
    }
    return data as T;
  } catch {
    return fallback;
  }
}

/* ── Échecs d'écriture : signalés, jamais avalés ───────────────────────────
 * Un stockage plein ou bloqué fait échouer localStorage.setItem. Longtemps,
 * l'échec était ignoré : l'écran montrait la modification, le rechargement la
 * perdait, et rien ne l'annonçait. Une gâchée avec ses courbes de presse pèse
 * ~300 Ko ; une quinzaine suffit à approcher la limite du navigateur.
 *
 * On retient donc les clés dont la DERNIÈRE écriture a échoué. Une écriture
 * réussie sur la même clé la retire : l'alerte disparaît d'elle-même quand de
 * la place a été libérée. */
const clesEnEchec = new Set<string>();
const abonnes = new Set<(cles: readonly string[]) => void>();
// Instantané STABLE (même référence tant que rien ne change) : exigé par
// useSyncExternalStore, qui boucle si chaque lecture rend un nouveau tableau.
let instantane: readonly string[] = [];

function marquer(key: string, ok: boolean): boolean {
  const etaitEnEchec = clesEnEchec.has(key);
  if (ok) clesEnEchec.delete(key);
  else clesEnEchec.add(key);
  if (etaitEnEchec === ok) {
    instantane = [...clesEnEchec].sort();
    for (const f of abonnes) f(instantane);
  }
  return ok;
}

/** Clés dont la dernière écriture a échoué, triées (référence stable). */
export function clesEnEchecDEcriture(): readonly string[] {
  return instantane;
}

/** S'abonne aux changements de la liste des clés en échec. Renvoie le désabonnement. */
export function ecouterEchecsDEcriture(f: (cles: readonly string[]) => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}

/**
 * Écrit une chaîne telle quelle. Renvoie false si le navigateur refuse
 * (quota atteint, stockage bloqué) — et l'échec est signalé aux abonnés.
 * Côté serveur : false, sans rien signaler (aucun stockage n'existe).
 */
export function ecrireLocal(key: string, valeur: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, valeur);
    return marquer(key, true);
  } catch {
    return marquer(key, false);
  }
}

/** Écrit une valeur versionnée. Renvoie false si l'écriture a échoué (signalée). */
export function persistVersioned<T>(key: string, version: number, data: T): boolean {
  if (typeof window === "undefined") return false;
  let texte: string;
  try {
    texte = JSON.stringify({ v: version, data });
  } catch {
    return marquer(key, false);
  }
  return ecrireLocal(key, texte);
}
