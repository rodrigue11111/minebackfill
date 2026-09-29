// frontend/src/lib/courbes-idb.ts
// Magasin des courbes dans IndexedDB (base « minebackfill », magasin
// « courbes », clé = id d'éprouvette). Adaptateur mince : la logique vit dans
// courbes.ts. Se vérifie dans un vrai navigateur (Node n'a pas IndexedDB).

import type { CourbeColonnes, MagasinCourbes } from "./courbes";

const BASE = "minebackfill";
const VERSION = 1;
const MAGASIN = "courbes";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, VERSION);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(MAGASIN)) r.result.createObjectStore(MAGASIN);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error ?? new Error("IndexedDB : ouverture impossible"));
    r.onblocked = () => ko(new Error("IndexedDB : base bloquée par un autre onglet"));
  });
}

/** Une transaction ; résolue quand elle est VALIDÉE (oncomplete), pas avant. */
async function transaction<T>(
  mode: IDBTransactionMode,
  f: (m: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await ouvrir();
  try {
    return await new Promise<T | undefined>((ok, ko) => {
      const tx = db.transaction(MAGASIN, mode);
      const req = f(tx.objectStore(MAGASIN));
      tx.oncomplete = () => ok(req ? req.result : undefined);
      tx.onerror = () => ko(tx.error ?? new Error("IndexedDB : transaction en échec"));
      tx.onabort = () => ko(tx.error ?? new Error("IndexedDB : transaction annulée"));
    });
  } finally {
    db.close();
  }
}

/** Magasin IndexedDB, ou null si le navigateur n'en offre pas. */
export function magasinIndexedDb(): MagasinCourbes | null {
  if (typeof indexedDB === "undefined") return null;
  return {
    async lire(id) {
      const v = await transaction<CourbeColonnes | undefined>("readonly", (m) => m.get(id) as IDBRequest<CourbeColonnes | undefined>);
      return v ?? null;
    },
    async ecrire(entrees) {
      await transaction("readwrite", (m) => { for (const [id, c] of entrees) m.put(c, id); });
    },
    async supprimer(ids) {
      await transaction("readwrite", (m) => { for (const id of ids) m.delete(id); });
    },
  };
}
