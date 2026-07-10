// frontend/src/lib/persisted.ts
// Persistance localStorage VERSIONNÉE. Chaque valeur est enveloppée dans
// { v, data } : le numéro de version permet de migrer les données au
// chargement quand le schéma évolue, sans jamais casser d'anciennes données.
// Une valeur brute (sans enveloppe) est traitée comme la version 0 et migrée.
// SSR-safe : aucun accès à localStorage côté serveur.

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

/** Écrit une valeur versionnée. Silencieux en cas de quota/navigation privée. */
export function persistVersioned<T>(key: string, version: number, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ v: version, data }));
  } catch {
    /* quota atteint ou stockage bloqué : ignoré silencieusement */
  }
}
