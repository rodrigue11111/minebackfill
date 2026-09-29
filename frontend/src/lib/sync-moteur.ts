// frontend/src/lib/sync-moteur.ts
// Moteur de synchronisation v2 — logique PURE. Il ne connaît ni Supabase ni
// localStorage : le transport (réseau) et le dépôt (stockage local) lui sont
// INJECTÉS. Tout ce qui décide vit ici et se teste en node, contre le faux
// serveur de sync-faux-serveur.ts qui reproduit la sémantique du SQL.
//
// Principes (le pourquoi : docs/HISTORIQUE_EXTENSIBILITE.md, « Synchronisation
// v2 ») :
// - Local d'abord : le stockage local reste la vérité de l'écran ; le moteur
//   rapproche local et serveur, il ne bloque jamais la saisie.
// - « À envoyer » se DÉDUIT : un document dont l'empreinte diffère de celle
//   de la dernière version serveur connue (K) doit être envoyé.
// - Suppressions EXPLICITES (T) : un document absent localement n'est JAMAIS
//   pris pour une suppression. Une clé vidée par un bug n'efface rien en
//   ligne ; au contraire, le moteur restaure.
// - Écriture conditionnelle : on écrit « par-dessus la révision vue ». Le
//   serveur refuse sinon et rend sa ligne : aucun écrasement silencieux.
// - Conflit réel : on garde les DEUX versions (copie marquée).

import { empreinte } from "./sync-empreinte";

/* ── Types ───────────────────────────────────────────────────────────────── */

export type Kind = "resultat" | "gachee";

/** Clé d'un document dans l'état : « kind:id » (l'id peut contenir « : »). */
export function cleDoc(kind: Kind, id: string): string {
  return `${kind}:${id}`;
}
export function decomposerCle(cle: string): { kind: Kind; id: string } {
  const i = cle.indexOf(":");
  return { kind: cle.slice(0, i) as Kind, id: cle.slice(i + 1) };
}

/** Une ligne telle que la rend le serveur (lire_docs, ou ecrire_doc en conflit). */
export interface LigneServeur {
  kind: Kind;
  id: string;
  rev: number;
  /** Horodatage serveur, rendu TEL QUEL dans le curseur (jamais converti). */
  maj: string;
  supprime: boolean;
  contenu: unknown;
}

/** Position de lecture. Opaque : on ne compare jamais ses dates côté client. */
export interface Curseur {
  maj: string;
  kind: string;
  id: string;
}

/** Un document local, sous sa forme CANONIQUE (celle qui est envoyée). */
export interface DocLocal {
  kind: Kind;
  id: string;
  contenu: unknown;
  empreinte: string;
}

/** Ce que ce navigateur sait de la version serveur d'un document (K). */
export interface EtatDoc {
  /** Révision serveur connue ; null = jamais confirmée par le serveur. */
  rev: number | null;
  /** Empreinte du contenu serveur à cette révision ; null = supprimé en ligne. */
  empreinte: string | null;
  /**
   * Empreintes d'envois restés SANS RÉPONSE (réseau coupé après l'envoi) :
   * le serveur les a peut-être appliqués. Quand l'un d'eux revient à la
   * lecture, c'est notre propre écriture — pas un conflit. 5 au plus.
   */
  incertains?: string[];
}

export interface EtatSync {
  v: 1;
  /** Compte auquel CE stockage local est lié (null = jamais lié). */
  uid: string | null;
  curseur: Curseur | null;
  docs: Record<string, EtatDoc>;
  /** Suppressions locales à transmettre (T). */
  suppressions: Record<string, true>;
  /** Documents refusés par le serveur, bloqués jusqu'à ce qu'ils changent. */
  bloques: Record<string, { empreinte: string; code: string }>;
}

export function etatInitial(): EtatSync {
  return { v: 1, uid: null, curseur: null, docs: {}, suppressions: {}, bloques: {} };
}

/** Opération appliquée au stockage local, GARDÉE : `attendu` est l'empreinte
 *  que le document doit encore avoir (null = il doit être absent). Si
 *  l'utilisateur l'a modifié entre-temps, l'opération est ignorée. */
export type OperationLocale =
  | { type: "ecrire"; kind: Kind; id: string; contenu: unknown; attendu: string | null }
  | { type: "retirer"; kind: Kind; id: string; attendu: string };

/** appliquee | ignoree (garde : le document a changé) | echec (stockage plein). */
export type IssueOperation = "appliquee" | "ignoree" | "echec";

export interface DepotLocal {
  /** Documents PERSISTÉS (pas l'état en mémoire), sous forme canonique. */
  lister(): Map<string, DocLocal>;
  appliquer(ops: OperationLocale[]): IssueOperation[];
  /** Copie d'un document local sous un nouvel id, marquée comme copie de conflit. */
  copieDeConflit(kind: Kind, contenu: unknown, nouvelId: string, le: string): unknown;
}

export interface Envoi {
  kind: Kind;
  id: string;
  contenu: unknown;
  /** null = création. */
  baseRev: number | null;
  supprime: boolean;
}

export type ReponseEcriture =
  | { ok: true; rev: number; maj: string }
  /** Conflit : rien n'a été écrit ; `ligne` = version serveur actuelle (null
   *  si le document n'existe pas en ligne). */
  | { ok: false; ligne: LigneServeur | null };

/**
 * transitoire : réseau, serveur indisponible — réessayer plus tard.
 * permanente  : refus du serveur (droits, contrainte, quota) — inutile de
 *               renvoyer le même contenu.
 * session     : la session n'est pas celle attendue — tout arrêter.
 */
export type NatureErreur = "transitoire" | "permanente" | "session";

export class ErreurSync extends Error {
  constructor(public nature: NatureErreur, public code: string, message?: string) {
    super(message ?? `${nature} (${code})`);
    this.name = "ErreurSync";
  }
}

export interface Transport {
  lirePage(apres: Curseur | null, reculS: number, limite: number): Promise<LigneServeur[]>;
  ecrire(envoi: Envoi): Promise<ReponseEcriture>;
}

/** Ce que l'utilisateur doit apprendre d'un cycle. */
export type Avis =
  | { type: "ressuscite"; kind: Kind; id: string }
  | { type: "suppression_annulee"; kind: Kind; id: string }
  | { type: "conflit"; kind: Kind; id: string; copieId: string }
  | { type: "suppressions_suspendues"; nombre: number }
  | { type: "refuse"; kind: Kind; id: string; code: string };

export interface OptionsCycle {
  /** Horodatage ISO de la copie de conflit. */
  maintenant: () => string;
  /** Suffixe aléatoire court (base 36) pour l'id d'une copie de conflit. */
  alea: () => string;
  /** Budget d'envois de ce cycle (coupe-circuit du planificateur). */
  maxEnvois?: number;
  /** L'utilisateur a confirmé une suppression massive. */
  confirmerSuppressions?: boolean;
  reculS?: number;
  taillePage?: number;
  maxPages?: number;
  parallelisme?: number;
}

export interface ResultatCycle {
  etat: EtatSync;
  avis: Avis[];
  erreur: null | { nature: NatureErreur | "stockage"; code: string };
  lus: number;
  envoyes: number;
  /** Il reste du travail (budget épuisé, conflits traités) : relancer bientôt. */
  aRelancer: boolean;
}

/* ── Constantes ──────────────────────────────────────────────────────────── */

/** Empreinte conventionnelle d'un envoi de SUPPRESSION. */
const SUPPR = "∅";
const MAX_INCERTAINS = 5;
/** Au-delà de 10 suppressions ET de 20 % des documents : confirmation exigée. */
const SEUIL_SUPPRESSIONS = 10;
const PART_SUPPRESSIONS = 0.2;

/* ── Décision pour une ligne serveur ─────────────────────────────────────── */

export interface Decision {
  ops: OperationLocale[];
  /** Nouvel état K du document (undefined = inchangé, null = oublié). */
  k?: EtatDoc | null;
  /** La suppression locale en attente est terminée ou annulée. */
  finSuppression?: boolean;
  avis?: Avis;
}

function connu(K: EtatDoc | undefined): K is EtatDoc & { rev: number } {
  return !!K && K.rev !== null;
}

/**
 * Décide quoi faire d'une ligne serveur L, sachant K (version serveur connue),
 * T (suppression locale en attente) et D (document local). Pure.
 */
export function deciderLigne(
  L: LigneServeur,
  K: EtatDoc | undefined,
  T: boolean,
  D: DocLocal | undefined,
  copie: (D: DocLocal) => { id: string; contenu: unknown },
): Decision {
  const Lf = L.supprime ? null : empreinte(L.contenu);
  const marque = L.supprime ? SUPPR : (Lf as string);
  const ecrireL = (attendu: string | null): OperationLocale =>
    ({ type: "ecrire", kind: L.kind, id: L.id, contenu: L.contenu, attendu });
  const kL: EtatDoc = { rev: L.rev, empreinte: Lf };

  // 0. Notre propre écriture, dont la réponse s'était perdue.
  if (K?.incertains?.includes(marque)) {
    return { ops: [], k: kL, finSuppression: L.supprime && T ? true : undefined };
  }

  // 1. Version déjà connue (ou plus ancienne : relue par le recul).
  if (connu(K) && L.rev <= K.rev) {
    // Seule exception : le document a disparu localement SANS suppression
    // explicite (clé vidée, import partiel) — on le restaure, mais uniquement
    // depuis la version la plus récente.
    if (L.rev === K.rev && !L.supprime && !D && !T) return { ops: [ecrireL(null)], k: kL };
    return { ops: [] };
  }

  // 2. Version plus récente que K (ou document jamais synchronisé).
  const propre = !!D && connu(K) && D.empreinte === K.empreinte;

  if (L.supprime) {
    if (T) return { ops: [], k: kL, finSuppression: true }; // supprimé des deux côtés
    if (!D) return { ops: [], k: kL };
    if (propre) return { ops: [{ type: "retirer", kind: L.kind, id: L.id, attendu: D.empreinte }], k: kL };
    // Supprimé ailleurs, mais modifié ici : on GARDE la version locale, qui
    // sera renvoyée par-dessus la suppression.
    return { ops: [], k: kL, avis: { type: "ressuscite", kind: L.kind, id: L.id } };
  }

  if (T) {
    // Le serveur a une révision plus récente d'un document supprimé ici.
    // Contenu inchangé (simple réécriture) : la suppression tient, elle sera
    // renvoyée sur la nouvelle révision. Contenu modifié ailleurs : on ne
    // détruit pas ce travail — la suppression locale est annulée.
    if (connu(K) && K.empreinte === Lf) return { ops: [], k: kL };
    return {
      ops: [ecrireL(null)], k: kL, finSuppression: true,
      avis: { type: "suppression_annulee", kind: L.kind, id: L.id },
    };
  }
  if (!D) return { ops: [ecrireL(null)], k: kL };
  if (D.empreinte === Lf) return { ops: [], k: kL };
  if (propre) return { ops: [ecrireL(D.empreinte)], k: kL };
  // Modifié ici, mais le serveur n'a pas changé de CONTENU : pas de conflit,
  // la version locale sera renvoyée sur la nouvelle révision.
  if (connu(K) && K.empreinte === Lf) return { ops: [], k: kL };

  // Conflit réel : la version serveur prend la place, la version locale est
  // conservée sous un nouvel id (et envoyée au cycle suivant).
  const c = copie(D);
  return {
    ops: [ecrireL(D.empreinte), { type: "ecrire", kind: D.kind, id: c.id, contenu: c.contenu, attendu: null }],
    k: kL,
    avis: { type: "conflit", kind: L.kind, id: L.id, copieId: c.id },
  };
}

/* ── Utilitaires d'état ──────────────────────────────────────────────────── */

function cloner(e: EtatSync): EtatSync {
  return JSON.parse(JSON.stringify(e)) as EtatSync;
}

function ajouterIncertain(etat: EtatSync, cle: string, marque: string): void {
  const K = etat.docs[cle] ?? (etat.docs[cle] = { rev: null, empreinte: null });
  const l = (K.incertains ?? []).filter((m) => m !== marque);
  l.push(marque);
  K.incertains = l.slice(-MAX_INCERTAINS);
}

function retirerIncertain(etat: EtatSync, cle: string, marque: string): void {
  const K = etat.docs[cle];
  if (!K?.incertains) return;
  K.incertains = K.incertains.filter((m) => m !== marque);
  if (K.incertains.length === 0) delete K.incertains;
  // Entrée créée uniquement pour porter un envoi incertain : on l'oublie.
  if (K.rev === null && !K.incertains) delete etat.docs[cle];
}

/**
 * Pose une suppression locale à transmettre. Sans compte lié, rien : en
 * anonyme, supprimer reste une affaire purement locale.
 */
export function marquerSuppression(etat: EtatSync, kind: Kind, id: string): EtatSync {
  if (etat.uid === null) return etat;
  const e = cloner(etat);
  e.suppressions[cleDoc(kind, id)] = true;
  return e;
}

/** Nombre de documents (et de suppressions) qui attendent un envoi. */
export function nombreEnAttente(etat: EtatSync, local: Map<string, DocLocal>): number {
  let n = Object.keys(etat.suppressions).filter((c) => !local.has(c)).length;
  for (const [c, D] of local) {
    const b = etat.bloques[c];
    if (b && b.empreinte === D.empreinte) continue;
    const K = etat.docs[c];
    if (!connu(K) || K.empreinte !== D.empreinte) n++;
  }
  return n;
}

/* ── Liaison du stockage local à un compte ──────────────────────────────── */

export type Liaison =
  /** Pas de session : rien à synchroniser. */
  | "aucune_session"
  /** Stockage lié à ce compte : synchroniser. */
  | "synchroniser"
  /** Jamais lié, sans données locales : lier directement. */
  | "lier"
  /** Jamais lié, avec des données locales : demander avant de les rattacher. */
  | "proposer_rattachement"
  /** Stockage lié à un AUTRE compte : refuser, et l'expliquer. */
  | "autre_compte";

export function deciderLiaison(lieA: string | null, session: string | null, aDesDonnees: boolean): Liaison {
  if (!session) return "aucune_session";
  if (lieA === session) return "synchroniser";
  if (lieA !== null) return "autre_compte";
  return aDesDonnees ? "proposer_rattachement" : "lier";
}

/** Délai avant réessai : 5 s × 2^n, plafonné à 10 min, ± 20 % (alea ∈ [0,1)). */
export function delaiReessai(tentative: number, alea: number): number {
  const base = Math.min(5000 * 2 ** Math.max(0, tentative), 600000);
  return Math.round(base * (0.8 + 0.4 * alea));
}

/* ── Cycle ───────────────────────────────────────────────────────────────── */

type Traitement = "ok" | "echec_stockage";

/** Applique un lot de lignes serveur au dépôt local et met l'état à jour. */
function traiterLignes(
  lignes: LigneServeur[],
  etat: EtatSync,
  depot: DepotLocal,
  opt: OptionsCycle,
  avis: Avis[],
): Traitement {
  const local = depot.lister();
  const copie = (D: DocLocal) => {
    const id = `${D.id.slice(0, 80)}.conflit.${opt.alea()}`;
    return { id, contenu: depot.copieDeConflit(D.kind, D.contenu, id, opt.maintenant()) };
  };
  const decisions = lignes.map((L) => {
    const c = cleDoc(L.kind, L.id);
    return { c, d: deciderLigne(L, etat.docs[c], !!etat.suppressions[c], local.get(c), copie) };
  });

  const ops = decisions.flatMap((x) => x.d.ops);
  const issues = ops.length > 0 ? depot.appliquer(ops) : [];
  if (issues.includes("echec")) return "echec_stockage";

  let i = 0;
  for (const { c, d } of decisions) {
    const miennes = issues.slice(i, i + d.ops.length);
    i += d.ops.length;
    // Garde déclenchée : le document a changé pendant le cycle. On ne touche
    // pas à K ; l'envoi qui suivra se heurtera au serveur et redécidera.
    if (miennes.includes("ignoree")) continue;
    if (d.k === null) delete etat.docs[c];
    else if (d.k !== undefined) etat.docs[c] = d.k;
    if (d.finSuppression) delete etat.suppressions[c];
    if (d.avis) avis.push(d.avis);
  }
  return "ok";
}

function memeCurseur(a: Curseur, b: Curseur): boolean {
  return a.maj === b.maj && a.kind === b.kind && a.id === b.id;
}

/**
 * Un cycle complet : lire ce qui a changé en ligne, l'appliquer, puis envoyer
 * ce qui a changé ici. L'état reçu n'est pas modifié : le résultat porte le
 * nouvel état, à persister par l'appelant.
 */
export async function cycle(
  etatDepart: EtatSync,
  transport: Transport,
  depot: DepotLocal,
  opt: OptionsCycle,
): Promise<ResultatCycle> {
  const etat = cloner(etatDepart);
  const avis: Avis[] = [];
  const reculS = opt.reculS ?? 120;
  const taillePage = opt.taillePage ?? 100;
  const maxPages = opt.maxPages ?? 50;
  let lus = 0;
  let envoyes = 0;
  const fin = (erreur: ResultatCycle["erreur"], aRelancer = false): ResultatCycle =>
    ({ etat, avis, erreur, lus, envoyes, aRelancer });

  // A. Un document connu en ligne a disparu localement, sans suppression
  // explicite : ce n'est JAMAIS une suppression. On relit tout pour le
  // restaurer.
  let local = depot.lister();
  let curseur = etat.curseur;
  for (const [c, K] of Object.entries(etat.docs)) {
    if (connu(K) && K.empreinte !== null && !local.has(c) && !etat.suppressions[c]) {
      curseur = null;
      break;
    }
  }

  // B. Lecture, page par page, jusqu'à une page VIDE : une page courte ne
  // prouve rien (le serveur peut tronquer sous la limite demandée).
  let recul = curseur ? reculS : 0;
  let precedent: Curseur | null = null;
  for (let p = 0; p < maxPages; p++) {
    let page: LigneServeur[];
    try {
      page = await transport.lirePage(curseur, recul, taillePage);
    } catch (e) {
      // Une erreur de lecture n'est JAMAIS « rien en ligne » : on s'arrête
      // sans rien appliquer de cette page ni envoyer.
      return fin(erreurDe(e));
    }
    recul = 0;
    if (page.length === 0) break;
    const d = page[page.length - 1];
    const suivant: Curseur = { maj: d.maj, kind: d.kind, id: d.id };
    // Serveur qui ne fait pas avancer la lecture : on s'arrête plutôt que boucler.
    if (precedent && memeCurseur(suivant, precedent)) break;
    if (traiterLignes(page, etat, depot, opt, avis) === "echec_stockage") {
      return fin({ nature: "stockage", code: "quota" });
    }
    lus += page.length;
    precedent = suivant;
    curseur = suivant;
    etat.curseur = suivant;
  }

  // C. Envois.
  local = depot.lister();
  type Tache = { c: string; envoi: Envoi; marque: string };
  const creationsMaj: Tache[] = [];
  for (const [c, D] of local) {
    const b = etat.bloques[c];
    if (b) {
      if (b.empreinte === D.empreinte) continue; // toujours refusé tel quel
      delete etat.bloques[c]; // modifié depuis le refus : on retente
    }
    const K = etat.docs[c];
    if (connu(K) && K.empreinte === D.empreinte) continue;
    creationsMaj.push({
      c,
      envoi: { kind: D.kind, id: D.id, contenu: D.contenu, baseRev: connu(K) ? K.rev : null, supprime: false },
      marque: D.empreinte,
    });
  }

  let suppressions: Tache[] = [];
  for (const c of Object.keys(etat.suppressions)) {
    if (local.has(c)) { delete etat.suppressions[c]; continue; } // recréé depuis
    const K = etat.docs[c];
    const { kind, id } = decomposerCle(c);
    if (!connu(K)) {
      // Jamais confirmé en ligne. Si un envoi est resté sans réponse, il a
      // peut-être été appliqué : on envoie une suppression « de création »,
      // que le serveur refusera (en rendant la ligne) si le document existe.
      if (K?.incertains?.length) {
        suppressions.push({ c, envoi: { kind, id, contenu: null, baseRev: null, supprime: true }, marque: SUPPR });
      } else {
        delete etat.suppressions[c];
      }
      continue;
    }
    if (K.empreinte === null) { delete etat.suppressions[c]; continue; } // déjà supprimé en ligne
    suppressions.push({ c, envoi: { kind, id, contenu: null, baseRev: K.rev, supprime: true }, marque: SUPPR });
  }

  const vivants = Object.values(etat.docs).filter((K) => connu(K) && K.empreinte !== null).length;
  if (
    !opt.confirmerSuppressions &&
    suppressions.length > SEUIL_SUPPRESSIONS &&
    suppressions.length > PART_SUPPRESSIONS * vivants
  ) {
    avis.push({ type: "suppressions_suspendues", nombre: suppressions.length });
    suppressions = [];
  }

  const toutes = [...creationsMaj, ...suppressions];
  const budget = Math.max(0, opt.maxEnvois ?? Infinity);
  const file = toutes.slice(0, budget);
  let restants = toutes.length - file.length;
  const conflits: LigneServeur[] = [];
  // Objet mutable : les envois parallèles le modifient (arrêt, erreur).
  const ctl: { arret: boolean; erreur: ResultatCycle["erreur"] } = { arret: false, erreur: null };

  const envoyerUne = async (t: Tache) => {
    ajouterIncertain(etat, t.c, t.marque);
    let r: ReponseEcriture;
    try {
      r = await transport.ecrire(t.envoi);
    } catch (e) {
      const err = erreurDe(e);
      if (err.nature === "transitoire") {
        // L'envoi a PEUT-ÊTRE été appliqué : l'empreinte reste « incertaine ».
        ctl.erreur ??= err;
        ctl.arret = true;
      } else if (err.nature === "session") {
        retirerIncertain(etat, t.c, t.marque);
        ctl.erreur = err;
        ctl.arret = true;
      } else {
        retirerIncertain(etat, t.c, t.marque);
        etat.bloques[t.c] = { empreinte: t.marque, code: err.code };
        avis.push({ type: "refuse", kind: t.envoi.kind, id: t.envoi.id, code: err.code });
      }
      return;
    }
    if (r.ok) {
      etat.docs[t.c] = { rev: r.rev, empreinte: t.envoi.supprime ? null : t.marque };
      if (t.envoi.supprime) delete etat.suppressions[t.c];
      envoyes++;
      return;
    }
    // Conflit : rien n'a été écrit.
    retirerIncertain(etat, t.c, t.marque);
    if (r.ligne) {
      conflits.push(r.ligne);
    } else {
      // Le document n'existe pas (ou plus) en ligne : l'état était faux.
      // On l'oublie ; un document local sera recréé au cycle suivant.
      delete etat.docs[t.c];
      if (t.envoi.supprime) delete etat.suppressions[t.c];
      restants++;
    }
  };

  let suivant = 0;
  const travailleur = async () => {
    while (!ctl.arret && suivant < file.length) {
      const t = file[suivant++];
      await envoyerUne(t);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opt.parallelisme ?? 4) }, travailleur));
  if (ctl.arret) restants += file.length - suivant;

  // D. Les conflits se décident comme des lignes lues.
  if (conflits.length > 0 && ctl.erreur?.nature !== "session") {
    if (traiterLignes(conflits, etat, depot, opt, avis) === "echec_stockage") {
      return fin({ nature: "stockage", code: "quota" }, true);
    }
  }
  return fin(ctl.erreur, restants > 0 || conflits.length > 0);
}

function erreurDe(e: unknown): { nature: NatureErreur; code: string } {
  if (e instanceof ErreurSync) return { nature: e.nature, code: e.code };
  return { nature: "transitoire", code: "inconnu" };
}
