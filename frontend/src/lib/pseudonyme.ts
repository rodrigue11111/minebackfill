// frontend/src/lib/pseudonyme.ts
// Pseudonyme stable d'un compte, pour les exports de recherche (jeu d'essais).
//
// Règle : « op- » suivi des 12 premiers caractères hexadécimaux du SHA-256 de
// l'identifiant du compte (UUID Supabase, en texte). Le même compte garde le
// même pseudonyme d'un export à l'autre, ce qui permet de suivre un opérateur
// sans le nommer. C'est une PSEUDONYMISATION, pas une anonymisation : qui
// détient la liste des comptes (l'enseignant) peut refaire la correspondance.
//
// Le préfixe « op- » empêche un tableur de lire le pseudonyme comme un nombre
// (« 12e456… » deviendrait une notation scientifique). La même règle devra
// être reprise côté SQL si un accès direct est ouvert un jour :
//   'op-' || left(encode(extensions.digest(id::text, 'sha256'), 'hex'), 12)

/** Pseudonyme d'un identifiant de compte (crypto.subtle : navigateur et Node). */
export async function pseudonyme(id: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)));
  return `op-${[...octets.slice(0, 6)].map((o) => o.toString(16).padStart(2, "0")).join("")}`;
}

/** Pseudonymes de plusieurs comptes (identifiant -> pseudonyme). */
export async function pseudonymes(ids: Iterable<string>): Promise<Map<string, string>> {
  const uniques = [...new Set(ids)];
  const valeurs = await Promise.all(uniques.map(pseudonyme));
  return new Map(uniques.map((id, i) => [id, valeurs[i]]));
}
