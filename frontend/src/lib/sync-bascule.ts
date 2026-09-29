// frontend/src/lib/sync-bascule.ts
// Changement de compte dans un même navigateur. Règle : la sauvegarde en
// ligne fonctionne TOUJOURS pour le compte connecté.
//
// Le stockage local reflète le compte connecté. Quand un autre compte se
// connecte :
// - le travail du compte précédent quitte l'écran. S'il est entièrement en
//   ligne, il n'y a rien à garder ici. S'il reste des modifications non
//   envoyées, ou des courbes de presse (qui ne vont pas en ligne), il est
//   MIS DE CÔTÉ sur cet appareil et retrouvé à la prochaine connexion de ce
//   compte ici ;
// - le nouveau compte retrouve ce qui avait été mis de côté pour lui, sinon
//   son travail redescend du serveur.
// Jamais le travail d'un compte n'est envoyé sous un autre.
//
// Les accès au stockage sont INJECTÉS : testable en node.

import type { Gachee } from "./gachee";
import type { SavedResult } from "./store";
import { creerDepotLocal } from "./sync-local";
import { cleDoc, etatInitial, nombreEnAttente, type EtatSync } from "./sync-moteur";

/** Ce qu'un compte laisse de côté sur cet appareil en cédant la place. */
export interface MiseDeCote {
  etat: EtatSync;
  resultats: SavedResult[];
  gachees: Gachee[];
}

export interface StockageComptes {
  lireEtat: () => EtatSync;
  ecrireEtat: (e: EtatSync) => boolean;
  lireResultats: () => SavedResult[];
  ecrireResultats: (x: SavedResult[]) => boolean;
  lireGachees: () => Gachee[];
  ecrireGachees: (x: Gachee[]) => boolean;
  lireMiseDeCote: (uid: string) => MiseDeCote | null;
  ecrireMiseDeCote: (uid: string, m: MiseDeCote) => boolean;
  supprimerMiseDeCote: (uid: string) => void;
  /** Les annotations lues appartiennent au compte précédent. */
  viderAnnotations: () => void;
}

export type ResultatBascule =
  | { ok: true; change: false }
  | { ok: true; change: true; misDeCote: boolean; restaure: boolean }
  | { ok: false; raison: "stockage" };

function fusionner<T extends { id: string }>(prioritaires: T[], autres: T[]): T[] {
  const ids = new Set(prioritaires.map((x) => x.id));
  return [...prioritaires, ...autres.filter((x) => !ids.has(x.id))];
}

export function basculerCompte(s: StockageComptes, nouvelUid: string): ResultatBascule {
  const ancien = s.lireEtat();
  if (ancien.uid === null || ancien.uid === nouvelUid) return { ok: true, change: false };
  const ancienUid = ancien.uid;

  // Les documents du compte précédent : ceux que SON dépôt liste (les
  // résultats d'un tiers et les ids hors format restent où ils sont).
  const depot = creerDepotLocal({
    uid: () => ancienUid,
    lireResultats: s.lireResultats, ecrireResultats: () => false,
    lireGachees: s.lireGachees, ecrireGachees: () => false,
    apresEcriture: () => {},
  });
  const local = depot.lister();
  const siens = (kind: "resultat" | "gachee", id: string) => local.has(cleDoc(kind, id));
  const R = s.lireResultats();
  const G = s.lireGachees();
  const sesResultats = R.filter((r) => siens("resultat", r.id));
  const sesGachees = G.filter((g) => siens("gachee", g.id));
  const aDesCourbes = sesGachees.some((g) => (g.eprouvettes ?? []).some((e) => e.essai?.courbe || e.essai?.courbeInfo));
  const aMettreDeCote = nombreEnAttente(ancien, local) > 0 || aDesCourbes;

  // 1. Mettre de côté D'ABORD : si l'écriture échoue, rien n'a bougé.
  if (aMettreDeCote && !s.ecrireMiseDeCote(ancienUid, { etat: ancien, resultats: sesResultats, gachees: sesGachees })) {
    return { ok: false, raison: "stockage" };
  }

  // 2. Le nouveau compte : ce qui l'attendait ici, sinon rien (le serveur le rendra).
  const attente = s.lireMiseDeCote(nouvelUid);
  const resteR = R.filter((r) => !siens("resultat", r.id));
  const resteG = G.filter((g) => !siens("gachee", g.id));
  const nouveauxR = attente ? fusionner(attente.resultats, resteR) : resteR;
  const nouvellesG = attente ? fusionner(attente.gachees, resteG) : resteG;
  const nouvelEtat: EtatSync = attente && attente.etat.uid === nouvelUid
    ? attente.etat
    : { ...etatInitial(), uid: nouvelUid };

  if (!s.ecrireResultats(nouveauxR) || !s.ecrireGachees(nouvellesG)) {
    // Stockage refusé en cours de route : on remet le compte précédent en
    // place. Ses documents mis de côté restent aussi, sans dommage.
    s.ecrireResultats(R);
    s.ecrireGachees(G);
    return { ok: false, raison: "stockage" };
  }
  if (!s.ecrireEtat(nouvelEtat)) {
    s.ecrireResultats(R);
    s.ecrireGachees(G);
    return { ok: false, raison: "stockage" };
  }
  if (attente) s.supprimerMiseDeCote(nouvelUid);
  s.viderAnnotations();
  return { ok: true, change: true, misDeCote: aMettreDeCote, restaure: !!attente };
}
