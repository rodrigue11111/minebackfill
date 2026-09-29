// frontend/src/lib/sync-empreinte.ts
// Empreinte d'un document : sert à savoir, SANS instrumenter le reste de
// l'application, si un document a changé depuis sa dernière synchronisation.
// On compare l'empreinte du document local à celle de la version serveur
// connue ; différentes = il reste quelque chose à envoyer.
//
// Le JSON doit être CANONIQUE, parce que le serveur (jsonb) ne rend pas les
// clés dans l'ordre où on les a écrites : sans tri, un document relu depuis
// le serveur paraîtrait modifié et serait renvoyé indéfiniment.

/**
 * JSON canonique : mêmes règles que JSON.stringify pour les feuilles (undefined
 * retiré des objets, NaN/Infinity -> null, toJSON appelé), clés d'objets triées
 * à tous les niveaux, ordre des tableaux conservé.
 */
export function jsonCanonique(x: unknown): string {
  const texte = JSON.stringify(x);
  // JSON.stringify(undefined) renvoie undefined : on le traite comme null,
  // comme le ferait jsonb.
  if (texte === undefined) return "null";
  return JSON.stringify(trier(JSON.parse(texte)));
}

function trier(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(trier);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) r[k] = trier(o[k]);
    return r;
  }
  return x;
}

/**
 * cyrb53 (domaine public) : hachage 53 bits, rapide, sans dépendance. Ce n'est
 * PAS un hachage cryptographique — il ne protège de rien ; il distingue des
 * versions d'un même document, où une collision est hors d'atteinte.
 */
function cyrb53(s: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Empreinte d'un contenu : 14 caractères hexadécimaux, stable à l'ordre des clés près. */
export function empreinte(x: unknown): string {
  return cyrb53(jsonCanonique(x)).toString(16).padStart(14, "0");
}
