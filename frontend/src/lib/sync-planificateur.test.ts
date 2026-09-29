import { describe, expect, it } from "vitest";
import type { ResultatCycle } from "./sync-moteur";
import { etatInitial } from "./sync-moteur";
import { creerPlanificateur, type EtatPlanificateur } from "./sync-planificateur";

// Horloge simulée : les minuteries ne partent que quand on avance le temps.
class Horloge {
  t = 0;
  private id = 0;
  private minuteries = new Map<number, { a: number; f: () => void }>();
  programmer = (f: () => void, ms: number) => {
    const id = ++this.id;
    this.minuteries.set(id, { a: this.t + ms, f });
    return id;
  };
  annuler = (id: unknown) => { this.minuteries.delete(id as number); };
  async avancer(ms: number) {
    const fin = this.t + ms;
    // Laisse d'abord aboutir les promesses en cours (fin d'un cycle).
    for (let i = 0; i < 10; i++) await Promise.resolve();
    for (;;) {
      let prochain: [number, { a: number; f: () => void }] | null = null;
      for (const e of this.minuteries) if (e[1].a <= fin && (!prochain || e[1].a < prochain[1].a)) prochain = e;
      if (!prochain) break;
      this.minuteries.delete(prochain[0]);
      this.t = prochain[1].a;
      prochain[1].f();
      for (let i = 0; i < 10; i++) await Promise.resolve();
    }
    this.t = fin;
  }
}

function resultat(p: Partial<ResultatCycle> = {}): ResultatCycle {
  return { etat: etatInitial(), avis: [], erreur: null, lus: 0, envoyes: 0, aRelancer: false, ...p };
}

function monter(reponse: () => ResultatCycle | Promise<ResultatCycle> = () => resultat()) {
  const h = new Horloge();
  const cycles: number[] = [];
  const etats: EtatPlanificateur[] = [];
  let enAttente = 0;
  const p = creerPlanificateur({
    executer: async () => { cycles.push(h.t); await Promise.resolve(); return reponse(); },
    compterEnAttente: () => enAttente,
    maintenant: () => h.t,
    programmer: h.programmer,
    annuler: h.annuler,
    alea: () => 0.5,
    surChangement: (e) => etats.push(e),
  });
  return { h, p, cycles, etats, fixerEnAttente: (n: number) => { enAttente = n; } };
}

describe("sync-planificateur", () => {
  it("un cycle au démarrage, puis toutes les 10 minutes", async () => {
    const { h, p, cycles } = monter();
    p.demarrer();
    await h.avancer(0);
    expect(cycles).toEqual([0]);
    await h.avancer(600000);
    expect(cycles).toEqual([0, 600000]);
    expect(p.etat().statut).toBe("a_jour");
  });

  it("anti-rebond : un seul envoi, 5 s après la dernière frappe", async () => {
    const { h, p, cycles } = monter();
    p.demarrer();
    await h.avancer(1000);
    for (let i = 0; i < 3; i++) { p.signalerModification(); await h.avancer(2000); }
    await h.avancer(10000);
    expect(cycles).toEqual([0, 10000]); // dernière frappe à 5 000 ms -> envoi à 10 000 ms
  });

  it("saisie continue : un envoi au plus tard 30 s après la première modification", async () => {
    const { h, p, cycles } = monter();
    p.demarrer();
    await h.avancer(1000);
    for (let i = 0; i < 15; i++) { p.signalerModification(); await h.avancer(3000); }
    expect(cycles[1]).toBeLessThanOrEqual(1000 + 30000);
  });

  it("onglet masqué : les modifications en attente partent tout de suite", async () => {
    const { h, p, cycles } = monter();
    p.demarrer();
    await h.avancer(1000);
    p.signalerModification();
    await h.avancer(100);
    p.signalerMasquage();
    await h.avancer(0);
    expect(cycles).toEqual([0, 1100]);
  });

  it("retour sur l'onglet : une lecture au plus par minute", async () => {
    const { h, p, cycles } = monter();
    p.demarrer();
    await h.avancer(30000);
    p.signalerRetour();
    await h.avancer(0);
    expect(cycles).toEqual([0]);
    await h.avancer(40000);
    p.signalerRetour();
    await h.avancer(0);
    expect(cycles).toEqual([0, 70000]);
  });

  it("panne réseau : réessais espacés (5 s, 10 s, 20 s), puis retour à la normale", async () => {
    let panne = 3;
    const { h, p, cycles, etats } = monter(() =>
      panne-- > 0 ? resultat({ erreur: { nature: "transitoire", code: "reseau" } }) : resultat());
    p.demarrer();
    await h.avancer(40000);
    expect(cycles).toEqual([0, 5000, 15000, 35000]);
    expect(etats.some((e) => e.statut === "hors_ligne")).toBe(true);
    expect(p.etat().statut).toBe("a_jour");
  });

  it("session inattendue : arrêt, plus aucun cycle automatique", async () => {
    const { h, p, cycles } = monter(() => resultat({ erreur: { nature: "session", code: "28000" } }));
    p.demarrer();
    await h.avancer(0);
    p.signalerModification();
    await h.avancer(3600000);
    expect(cycles).toEqual([0]);
    expect(p.etat().statut).toBe("erreur");
  });

  it("coupe-circuit : une boucle d'écritures met la synchronisation en pause 10 min", async () => {
    const { h, p, cycles } = monter(() => resultat({ envoyes: 1, aRelancer: true }));
    p.demarrer();
    await h.avancer(30000);
    const avantPause = cycles.length;
    expect(avantPause).toBe(21);
    expect(p.etat().statut).toBe("pause");
    await h.avancer(500000);
    expect(cycles.length).toBe(avantPause);
    await h.avancer(200000);
    expect(cycles.length).toBeGreaterThan(avantPause);
  });

  it("un seul cycle à la fois : une demande pendant un cycle en relance un après", async () => {
    let liberer: (() => void) | null = null;
    const { h, p, cycles } = monter(() => new Promise<ResultatCycle>((ok) => { liberer = () => ok(resultat()); }));
    p.demarrer();
    await h.avancer(0);
    p.forcer();
    p.forcer();
    await h.avancer(0);
    expect(cycles).toEqual([0]);
    liberer!();
    await h.avancer(0);
    expect(cycles).toEqual([0, 0]);
  });

  it("« en attente » tant qu'il reste des documents à envoyer", async () => {
    const { h, p, fixerEnAttente } = monter();
    fixerEnAttente(2);
    p.demarrer();
    await h.avancer(0);
    expect(p.etat().statut).toBe("en_attente");
    p.arreter();
    expect(p.etat().statut).toBe("inactif");
  });
});
