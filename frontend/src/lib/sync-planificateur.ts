// frontend/src/lib/sync-planificateur.ts
// Planificateur de la synchronisation : décide QUAND lancer un cycle du moteur
// (sync-moteur.ts). Horloge, minuteries et exécution sont INJECTÉES : ce module
// se teste en node avec une horloge simulée.
//
// Règles :
// - Un seul cycle à la fois ; une demande pendant un cycle en relance un après.
// - Après une modification : envoi 5 s après la DERNIÈRE frappe, mais jamais
//   plus de 30 s après la première (une saisie continue part quand même).
// - Onglet masqué (fermeture, changement d'application) : envoi immédiat des
//   modifications en attente.
// - Retour sur l'onglet : une lecture, au plus une fois par minute.
// - Toutes les 10 min : une lecture (un seul appareil par étudiant, pas
//   besoin de temps réel).
// - Panne réseau : réessai à 5 s, 10 s, 20 s… jusqu'à 10 min.
// - Coupe-circuit : plus de 20 cycles QUI ÉCRIVENT en une minute trahit une
//   boucle (bogue) — la saisie, avec son anti-rebond de 5 s, en produit au
//   plus 12. La synchronisation se met alors en pause 10 min plutôt que de
//   consommer le quota gratuit. On compte les cycles et non les écritures :
//   le premier envoi d'un étudiant (100 résultats d'un coup) est légitime et
//   ne doit pas être freiné.
// - Session inattendue : arrêt jusqu'à un nouveau démarrage.

import { delaiReessai, type ResultatCycle } from "./sync-moteur";

export type StatutSync =
  | "inactif" | "a_jour" | "en_attente" | "en_cours" | "hors_ligne" | "erreur" | "pause";

export interface EtatPlanificateur {
  statut: StatutSync;
  /** Instant (ms) du dernier cycle réussi. */
  derniereReussite: number | null;
  erreur: { nature: string; code: string } | null;
}

export interface OptionsPlanificateur {
  /** Exécute UN cycle (et persiste l'état) ; `budget` = envois autorisés dans ce cycle. */
  executer: (budget: number) => Promise<ResultatCycle>;
  /** Documents qui attendent un envoi (pour distinguer « à jour » et « en attente »). */
  compterEnAttente: () => number;
  maintenant: () => number;
  programmer: (f: () => void, ms: number) => unknown;
  annuler: (id: unknown) => void;
  /** Aléa ∈ [0,1) pour la gigue des réessais. */
  alea: () => number;
  surChangement: (e: EtatPlanificateur) => void;
  delais?: Partial<typeof DELAIS>;
  /** Cycles qui écrivent, par minute, au-delà desquels on se met en pause. */
  maxCyclesEcrivantsParMinute?: number;
  /** Envois au plus par cycle. */
  budgetParCycle?: number;
}

const DELAIS = {
  antiRebond: 5000,
  maxAttente: 30000,
  retour: 60000,
  periode: 600000,
  relance: 1000,
  pause: 600000,
};

export interface Planificateur {
  demarrer: () => void;
  arreter: () => void;
  signalerModification: () => void;
  signalerMasquage: () => void;
  signalerRetour: () => void;
  /** Bouton « Synchroniser maintenant ». */
  forcer: () => void;
  etat: () => EtatPlanificateur;
}

export function creerPlanificateur(o: OptionsPlanificateur): Planificateur {
  const d = { ...DELAIS, ...o.delais };
  const maxCycles = o.maxCyclesEcrivantsParMinute ?? 20;
  const budgetParCycle = o.budgetParCycle ?? 500;

  let actif = false;
  let enCours = false;
  let aRefaire = false;
  let minuteur: unknown = null;
  let echeance = Infinity;
  let premiereModif: number | null = null;
  let derniereLecture = -Infinity;
  let tentatives = 0;
  let pauseJusqua = -Infinity;
  /** Instants des cycles qui ont écrit (fenêtre glissante d'une minute). */
  let cyclesEcrivants: number[] = [];
  let etat: EtatPlanificateur = { statut: "inactif", derniereReussite: null, erreur: null };

  const publier = (patch: Partial<EtatPlanificateur>) => {
    etat = { ...etat, ...patch };
    o.surChangement(etat);
  };

  /** Programme le prochain cycle ; garde l'échéance la plus proche. */
  const planifier = (ms: number) => {
    if (!actif) return;
    const t = o.maintenant() + Math.max(0, ms);
    if (minuteur !== null && echeance <= t) return;
    if (minuteur !== null) o.annuler(minuteur);
    echeance = t;
    minuteur = o.programmer(() => {
      minuteur = null;
      echeance = Infinity;
      void lancer();
    }, Math.max(0, ms));
  };


  async function lancer(): Promise<void> {
    if (!actif) return;
    if (enCours) { aRefaire = true; return; }
    const t0 = o.maintenant();
    if (t0 < pauseJusqua) { planifier(pauseJusqua - t0); return; }
    enCours = true;
    premiereModif = null;
    derniereLecture = t0;
    publier({ statut: "en_cours" });
    let r: ResultatCycle | null = null;
    try {
      r = await o.executer(budgetParCycle);
    } catch (e) {
      r = null;
      publier({ statut: "erreur", erreur: { nature: "interne", code: e instanceof Error ? e.message : String(e) } });
    }
    enCours = false;
    if (!actif) return;
    const t = o.maintenant();

    if (r) {
      if (r.envoyes > 0) cyclesEcrivants.push(t);
      cyclesEcrivants = cyclesEcrivants.filter((x) => t - x < 60000);
      if (r.erreur?.nature === "session") {
        // Rien ne repart tout seul : la session n'est pas celle attendue.
        publier({ statut: "erreur", erreur: r.erreur });
        actif = false;
        if (minuteur !== null) { o.annuler(minuteur); minuteur = null; echeance = Infinity; }
        return;
      }
      if (r.erreur) {
        tentatives++;
        publier({ statut: r.erreur.nature === "transitoire" ? "hors_ligne" : "erreur", erreur: r.erreur });
        planifier(delaiReessai(tentatives - 1, o.alea()));
      } else {
        tentatives = 0;
        publier({
          statut: o.compterEnAttente() > 0 ? "en_attente" : "a_jour",
          derniereReussite: t, erreur: null,
        });
        if (r.aRelancer) planifier(d.relance);
      }
      if (cyclesEcrivants.length > maxCycles) {
        // Coupe-circuit : une boucle d'écritures, pas un usage humain.
        cyclesEcrivants = [];
        pauseJusqua = t + d.pause;
        publier({ statut: "pause" });
        planifier(d.pause);
      }
    }
    if (aRefaire) { aRefaire = false; planifier(0); }
    planifier(d.periode);
  }

  return {
    demarrer() {
      if (actif) return;
      actif = true;
      tentatives = 0;
      publier({ statut: "en_cours", erreur: null });
      planifier(0);
    },
    arreter() {
      actif = false;
      if (minuteur !== null) o.annuler(minuteur);
      minuteur = null;
      echeance = Infinity;
      publier({ statut: "inactif" });
    },
    signalerModification() {
      if (!actif) return;
      const t = o.maintenant();
      premiereModif ??= t;
      if (etat.statut === "a_jour") publier({ statut: "en_attente" });
      // Anti-rebond : on REMPLACE l'échéance (repoussée à chaque frappe),
      // sans dépasser la limite comptée depuis la première modification.
      if (minuteur !== null) { o.annuler(minuteur); minuteur = null; echeance = Infinity; }
      const limite = premiereModif + d.maxAttente - t;
      planifier(Math.min(d.antiRebond, Math.max(0, limite)));
    },
    signalerMasquage() {
      if (actif && premiereModif !== null) void lancer();
    },
    signalerRetour() {
      if (actif && o.maintenant() - derniereLecture >= d.retour) void lancer();
    },
    forcer() {
      if (!actif) return;
      pauseJusqua = -Infinity;
      void lancer();
    },
    etat: () => etat,
  };
}
