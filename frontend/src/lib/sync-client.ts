// frontend/src/lib/sync-client.ts
// Raccord de la synchronisation v2 au navigateur : relie le moteur
// (sync-moteur), le dépôt local (sync-local), le transport Supabase
// (sync-supabase) et le planificateur (sync-planificateur) au magasin, aux
// événements de l'onglet et au verrou partagé entre onglets.
//
// Ce module ne DÉCIDE rien : toutes les décisions vivent dans les modules
// purs, testés en node. Ici : des branchements, et un état observable par
// l'interface (bandeau, indicateur, page Compte).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadAnnotationsFromStorage, loadGacheesFromStorage, loadSavedFromStorage,
  persistAnnotations, persistGachees, persistSaved, useStore,
} from "./store";
import { fusionnerAnnotations, type Annotation } from "./annotations";
import {
  lireMesAnnotations, marquerAnnotationsLues, messageErreurClasse, nbReponsesNonLues, repondreAnnotation, retirerAnnotation,
} from "./classe-reseau";
import {
  cleDoc, cycle, deciderLiaison, nombreEnAttente,
  type Avis, type DepotLocal, type Liaison, type ResultatCycle, type Transport,
} from "./sync-moteur";
import {
  chargerEtatSync, ecrireMiseDeCote, lireMiseDeCote, reporterSuppressions, sauverEtatSync, supprimerMiseDeCote,
} from "./sync-etat";
import { basculerCompte } from "./sync-bascule";
import { creerDepotLocal } from "./sync-local";
import { transportSupabase } from "./sync-supabase";
import { creerPlanificateur, type Planificateur, type StatutSync } from "./sync-planificateur";

/**
 * Interrupteur de secours : NEXT_PUBLIC_SYNCHRO_V2 = « false » coupe la
 * synchronisation du travail (comptes et catalogues restent actifs), sans
 * toucher au code. Absente = active. Les données restent sur chaque appareil :
 * couper ne perd rien.
 */
export const SYNCHRO_ACTIVE = (process.env.NEXT_PUBLIC_SYNCHRO_V2 ?? "").trim().toLowerCase() !== "false";

/* ── État observable ─────────────────────────────────────────────────────── */

export interface InstantaneSync {
  /** Décision de liaison pour la session courante (null = pas de session). */
  liaison: Liaison | null;
  /** L'utilisateur a choisi « Plus tard » pour le rattachement. */
  reporte: boolean;
  statut: StatutSync;
  enAttente: number;
  derniereReussite: number | null;
  erreur: { nature: string; code: string } | null;
  /** Avis des derniers cycles, à afficher puis à fermer. */
  avis: Avis[];
  /** Documents locaux concernés par un rattachement. */
  anonymes: { resultats: number; gachees: number };
  /** Commentaires non lus dont l'étudiant a fermé le bandeau (ids). */
  commentairesFermes: string[];
  /** Enseignant : réponses d'étudiants pas encore lues ; null = inconnu. */
  reponsesNonLues: number | null;
}

const INITIAL: InstantaneSync = {
  liaison: null, reporte: false, statut: "inactif", enAttente: 0,
  derniereReussite: null, erreur: null, avis: [], anonymes: { resultats: 0, gachees: 0 },
  commentairesFermes: [], reponsesNonLues: null,
};

let instantane: InstantaneSync = INITIAL;
const abonnes = new Set<() => void>();

function publier(patch: Partial<InstantaneSync>): void {
  instantane = { ...instantane, ...patch };
  for (const f of abonnes) f();
}

export function abonnerSync(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}
export function instantaneSync(): InstantaneSync {
  return instantane;
}
export function instantaneSyncServeur(): InstantaneSync {
  return INITIAL;
}

/* ── Session courante ────────────────────────────────────────────────────── */

interface Courant {
  sb: SupabaseClient;
  uid: string;
  /** Compte enseignant : compteur de réponses d'étudiants. */
  prof: boolean;
  arreterCompteur: () => void;
  depot: DepotLocal;
  transport: Transport;
  planif: Planificateur | null;
  debrancher: () => void;
}

let courant: Courant | null = null;
/** Vrai pendant qu'on recharge le magasin après une écriture de la synchro. */
let rechargementSynchro = false;
/** L'utilisateur a confirmé une suppression massive : le prochain cycle la transmet. */
let confirmerProchain = false;

function creerDepot(uid: string): DepotLocal {
  return creerDepotLocal({
    uid: () => uid,
    lireResultats: loadSavedFromStorage,
    ecrireResultats: persistSaved,
    lireGachees: loadGacheesFromStorage,
    ecrireGachees: persistGachees,
    apresEcriture: (kinds) => {
      rechargementSynchro = true;
      try {
        const s = useStore.getState();
        if (kinds.has("resultat")) s.loadSavedResults();
        if (kinds.has("gachee")) s.loadGachees();
      } finally {
        rechargementSynchro = false;
      }
    },
  });
}

function compterAnonymes(depot: DepotLocal): InstantaneSync["anonymes"] {
  let resultats = 0;
  let gachees = 0;
  for (const d of depot.lister().values()) {
    if (d.kind === "resultat") resultats++;
    else gachees++;
  }
  return { resultats, gachees };
}

/** Annotations : au plus une lecture toutes les 5 minutes (quota gratuit). */
const PERIODE_ANNOTATIONS_MS = 300000;
let derniereLectureAnnotations = -Infinity;

async function rafraichirAnnotations(c: Courant): Promise<void> {
  derniereLectureAnnotations = Date.now();
  const avant = loadAnnotationsFromStorage();
  try {
    const r = await lireMesAnnotations(c.sb, c.uid, avant.curseur);
    if (r.annotations.length === 0) return;
    enregistrerAnnotations(fusionnerAnnotations(avant.annotations, r.annotations), r.curseur);
  } catch {
    /* lecture en échec : on réessaiera au prochain cycle — jamais « aucune annotation » */
  }
}

/** Le fil local change (lecture, réponse, accusé) : stockage puis écran. */
function enregistrerAnnotations(annotations: Annotation[], curseur = loadAnnotationsFromStorage().curseur): void {
  persistAnnotations({ curseur, annotations });
  useStore.setState({ annotations });
}

/** L'étudiant ferme le bandeau : ces commentaires-là ne le relancent plus (jusqu'au rechargement). */
export function fermerBandeauCommentaires(ids: string[]): void {
  publier({ commentairesFermes: [...new Set([...instantane.commentairesFermes, ...ids])] });
}

/** Ids en cours de marquage : un affichage répété n'envoie qu'une demande. */
const enMarquage = new Set<string>();

/**
 * L'étudiant a sous les yeux ces commentaires de l'enseignant : accusé de
 * lecture. Hors ligne ou en échec : rien ne change, on réessaiera au prochain
 * affichage.
 */
export async function marquerCommentairesLus(ids: string[]): Promise<void> {
  const c = courant;
  const aFaire = ids.filter((id) => !enMarquage.has(id));
  if (!c || aFaire.length === 0) return;
  aFaire.forEach((id) => enMarquage.add(id));
  try {
    const lus = new Map((await marquerAnnotationsLues(c.sb, aFaire)).map((x) => [x.id, x.luLe]));
    if (lus.size === 0 || courant !== c) return;
    enregistrerAnnotations(loadAnnotationsFromStorage().annotations.map((a) => (lus.has(a.id) ? { ...a, luLe: lus.get(a.id)! } : a)));
  } catch {
    /* base pas à jour ou réseau : sans conséquence */
  } finally {
    aFaire.forEach((id) => enMarquage.delete(id));
  }
}

/** L'étudiant répond sur SON document. Rend un message d'erreur, ou null. */
export async function repondreCommentaire(kind: "resultat" | "gachee", id: string, texte: string): Promise<string | null> {
  const c = courant;
  if (!c) return "connectez-vous pour répondre";
  try {
    const rev = chargerEtatSync().docs[cleDoc(kind, id)]?.rev ?? null;
    const a = await repondreAnnotation(c.sb, { attendu: c.uid, kind, id, rev, texte });
    if (courant === c) enregistrerAnnotations(fusionnerAnnotations(loadAnnotationsFromStorage().annotations, [a]));
    return null;
  } catch (e) {
    return messageErreurClasse(e);
  }
}

/** L'étudiant retire SA réponse. Rend un message d'erreur, ou null. */
export async function retirerMaReponse(id: string): Promise<string | null> {
  const c = courant;
  if (!c) return "connectez-vous pour retirer votre réponse";
  try {
    await retirerAnnotation(c.sb, id);
    if (courant === c) enregistrerAnnotations(loadAnnotationsFromStorage().annotations.filter((a) => a.id !== id));
    return null;
  } catch (e) {
    return messageErreurClasse(e);
  }
}

/** Enseignant : relit le nombre de réponses non lues (pastille « Classe »). */
export async function rafraichirReponsesNonLues(): Promise<void> {
  const c = courant;
  if (!c?.prof) return;
  try {
    const n = await nbReponsesNonLues(c.sb);
    if (courant === c) publier({ reponsesNonLues: n });
  } catch {
    /* base pas à jour ou réseau : la pastille reste inconnue */
  }
}

/** Enseignant : relève périodique du compteur, onglet visible, au même rythme que les annotations. */
function demarrerCompteur(c: Courant): void {
  const tick = () => { if (document.visibilityState !== "hidden") void rafraichirReponsesNonLues(); };
  const id = window.setInterval(tick, PERIODE_ANNOTATIONS_MS);
  document.addEventListener("visibilitychange", tick);
  c.arreterCompteur = () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  tick();
}

function resultatVide(aRelancer: boolean): ResultatCycle {
  return { etat: chargerEtatSync(), avis: [], erreur: null, lus: 0, envoyes: 0, aRelancer };
}

async function executerCycle(c: Courant, budget: number): Promise<ResultatCycle> {
  const run = async (): Promise<ResultatCycle> => {
    const depart = chargerEtatSync();
    if (depart.uid !== c.uid) return resultatVide(false);
    const confirmer = confirmerProchain;
    confirmerProchain = false;
    const r = await cycle(depart, c.transport, c.depot, {
      maintenant: () => new Date().toISOString(),
      alea: () => Math.random().toString(36).slice(2, 6).padEnd(4, "0"),
      maxEnvois: budget,
      confirmerSuppressions: confirmer,
    });
    const fin = reporterSuppressions(depart, chargerEtatSync(), r.etat);
    sauverEtatSync(fin); // un échec (stockage plein) est signalé par le bandeau de stockage
    publier({
      enAttente: nombreEnAttente(fin, c.depot.lister()),
      ...(r.avis.length > 0 ? { avis: [...instantane.avis, ...r.avis].slice(-20) } : {}),
    });
    if (!r.erreur && Date.now() - derniereLectureAnnotations >= PERIODE_ANNOTATIONS_MS) {
      await rafraichirAnnotations(c);
    }
    return { ...r, etat: fin };
  };
  // Un seul onglet synchronise à la fois. Simple économie : la justesse
  // repose sur le contrôle de version du serveur, pas sur ce verrou.
  const verrous = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (verrous) {
    return verrous.request("minebackfill-sync", { ifAvailable: true },
      async (verrou) => (verrou ? run() : resultatVide(true)));
  }
  return run();
}

function demarrer(c: Courant): void {
  const planif = creerPlanificateur({
    executer: (budget) => executerCycle(c, budget),
    compterEnAttente: () => nombreEnAttente(chargerEtatSync(), c.depot.lister()),
    maintenant: () => Date.now(),
    programmer: (f, ms) => window.setTimeout(f, ms),
    annuler: (id) => window.clearTimeout(id as number),
    alea: Math.random,
    surChangement: (e) => publier({ statut: e.statut, derniereReussite: e.derniereReussite, erreur: e.erreur }),
  });
  c.planif = planif;

  const desabonner = useStore.subscribe((s, avant) => {
    if (rechargementSynchro) return;
    if (s.savedResults !== avant.savedResults || s.gachees !== avant.gachees) planif.signalerModification();
  });
  const surVisibilite = () => {
    if (document.visibilityState === "hidden") planif.signalerMasquage();
    else planif.signalerRetour();
  };
  const surEnLigne = () => planif.forcer();
  // Une modification faite dans un AUTRE onglet : c'est peut-être lui qui
  // tient le verrou, mais le signal ne coûte rien.
  const surStockage = (e: StorageEvent) => {
    if (e.key === "minebackfill_gachees" || e.key === "minebackfill_saved_results") planif.signalerModification();
  };
  document.addEventListener("visibilitychange", surVisibilite);
  window.addEventListener("online", surEnLigne);
  window.addEventListener("storage", surStockage);
  c.debrancher = () => {
    desabonner();
    document.removeEventListener("visibilitychange", surVisibilite);
    window.removeEventListener("online", surEnLigne);
    window.removeEventListener("storage", surStockage);
    planif.arreter();
  };
  planif.demarrer();
}

/**
 * Appelé à chaque session Supabase (connexion, rechargement de page,
 * rafraîchissement de jeton). Décide de la liaison du stockage local et
 * démarre la synchronisation si elle est permise.
 */
export function connecterSynchro(sb: SupabaseClient, uid: string, o: { prof?: boolean } = {}): void {
  if (!SYNCHRO_ACTIVE || typeof window === "undefined") return;
  const prof = o.prof === true;
  if (courant?.uid === uid) {
    // Déjà en route (rafraîchissement de jeton). Le rôle, lui, a pu changer.
    if (courant.prof !== prof) {
      courant.arreterCompteur();
      courant.arreterCompteur = () => {};
      courant.prof = prof;
      if (prof) demarrerCompteur(courant);
      else publier({ reponsesNonLues: null });
    }
    return;
  }
  deconnecterSynchro();
  const c: Courant = {
    sb, uid, prof, arreterCompteur: () => {}, depot: creerDepot(uid), transport: transportSupabase(sb, () => chargerEtatSync().uid ?? ""),
    planif: null, debrancher: () => {},
  };
  courant = c;
  if (prof) demarrerCompteur(c);
  // Un autre compte que celui du stockage local : on bascule (son travail
  // est mis de côté ou déjà en ligne, celui de ce compte revient). En cas
  // d'échec (stockage plein), rien n'a bougé et la liaison le signale.
  if (chargerEtatSync().uid !== null && chargerEtatSync().uid !== uid) {
    const r = basculerCompte({
      lireEtat: chargerEtatSync, ecrireEtat: sauverEtatSync,
      lireResultats: loadSavedFromStorage, ecrireResultats: persistSaved,
      lireGachees: loadGacheesFromStorage, ecrireGachees: persistGachees,
      lireMiseDeCote, ecrireMiseDeCote, supprimerMiseDeCote,
      viderAnnotations: () => { persistAnnotations({ curseur: null, annotations: [] }); },
    }, uid);
    if (r.ok && r.change) {
      const s = useStore.getState();
      s.loadSavedResults();
      s.loadGachees();
      s.loadAnnotations();
    }
  }
  const etat = chargerEtatSync();
  const anonymes = compterAnonymes(c.depot);
  const liaison = deciderLiaison(etat.uid, uid, anonymes.resultats + anonymes.gachees > 0);
  publier({ liaison, reporte: false, anonymes, erreur: null, avis: [] });
  if (liaison === "lier") {
    sauverEtatSync({ ...etat, uid });
    publier({ liaison: "synchroniser" });
    demarrer(c);
  } else if (liaison === "synchroniser") {
    demarrer(c);
  }
}

/** Déconnexion : la synchronisation s'arrête ; les données locales restent. */
export function deconnecterSynchro(): void {
  courant?.debrancher();
  courant?.arreterCompteur();
  courant = null;
  derniereLectureAnnotations = -Infinity;
  publier({ ...INITIAL });
}

/** L'étudiant accepte de rattacher les données de cet appareil à son compte. */
export function rattacher(): boolean {
  const c = courant;
  if (!c) return false;
  const etat = chargerEtatSync();
  if (etat.uid !== null && etat.uid !== c.uid) return false;
  if (!sauverEtatSync({ ...etat, uid: c.uid })) return false;
  publier({ liaison: "synchroniser", reporte: false });
  demarrer(c);
  return true;
}

export function reporterRattachement(): void {
  publier({ reporte: true });
}

export function synchroniserMaintenant(): void {
  courant?.planif?.forcer();
}

export function confirmerSuppressions(): void {
  confirmerProchain = true;
  synchroniserMaintenant();
}

/** Annule des suppressions suspendues : les documents reviennent du serveur. */
export function annulerSuppressions(): void {
  const e = chargerEtatSync();
  sauverEtatSync({ ...e, suppressions: {} });
  retirerAvis((a) => a.type === "suppressions_suspendues");
  synchroniserMaintenant();
}

export function retirerAvis(filtre: (a: Avis) => boolean): void {
  publier({ avis: instantane.avis.filter((a) => !filtre(a)) });
}
