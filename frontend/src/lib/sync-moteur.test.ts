import { beforeEach, describe, expect, it } from "vitest";
import { empreinte } from "./sync-empreinte";
import {
  cleDoc, cycle, deciderLiaison, delaiReessai, etatInitial, marquerSuppression, nombreEnAttente,
  type Avis, type EtatSync, type OptionsCycle, type ResultatCycle,
} from "./sync-moteur";
import { FauxDepot, FauxServeur, FauxTransport } from "./sync-faux-serveur";

// Scénarios du plan (annexe B). Chaque navigateur a son stockage local et son
// état ; ils partagent un faux serveur qui reproduit supabase/schema.sql.

let compteurAlea = 0;

class Navigateur {
  depot: FauxDepot;
  etat: EtatSync;
  transport: FauxTransport;
  avis: Avis[] = [];
  private n = 0;

  constructor(public nom: string, serveur: FauxServeur, opts: { uid?: string | null; session?: string; depot?: FauxDepot } = {}) {
    this.depot = opts.depot ?? new FauxDepot();
    this.etat = { ...etatInitial(), uid: opts.uid === undefined ? "u1" : opts.uid };
    this.transport = new FauxTransport(serveur, opts.session ?? "u1", () => this.etat.uid ?? "");
  }

  /** Crée ou modifie un document (contenu toujours nouveau). */
  ecrire(id: string, kind: "gachee" | "resultat" = "gachee"): unknown {
    const c = { id, titre: `${this.nom}-${++this.n}` };
    this.depot.docs.set(cleDoc(kind, id), c);
    return c;
  }

  supprimer(id: string, kind: "gachee" | "resultat" = "gachee"): void {
    this.depot.docs.delete(cleDoc(kind, id));
    this.etat = marquerSuppression(this.etat, kind, id);
  }

  contenu(id: string, kind: "gachee" | "resultat" = "gachee"): unknown {
    return this.depot.docs.get(cleDoc(kind, id));
  }

  async sync(o: Partial<OptionsCycle> = {}): Promise<ResultatCycle> {
    const r = await cycle(this.etat, this.transport, this.depot, {
      maintenant: () => "2026-09-28T12:00:00.000Z",
      alea: () => (++compteurAlea).toString(36).padStart(4, "0"),
      ...o,
    });
    this.etat = r.etat;
    this.avis.push(...r.avis);
    return r;
  }
}

let serveur: FauxServeur;
beforeEach(() => { serveur = new FauxServeur(); });

function copiesDe(n: Navigateur): [string, unknown][] {
  return [...n.depot.docs].filter(([c]) => c.includes(".conflit."));
}

describe("sync — bases", () => {
  it("1. une écriture unique arrive en ligne, puis plus rien n'est envoyé", async () => {
    const A = new Navigateur("A", serveur);
    const doc = A.ecrire("g1");
    const r = await A.sync();
    expect(r.erreur).toBeNull();
    expect(r.envoyes).toBe(1);
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(doc);
    expect((await A.sync()).envoyes).toBe(0);
  });

  it("2. deux navigateurs du même compte se retrouvent", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    expect(B.contenu("g1")).toEqual(A.contenu("g1"));
    const v2 = B.ecrire("g1");
    await B.sync();
    await A.sync();
    expect(A.contenu("g1")).toEqual(v2);
  });

  it("3. relire ses propres écritures ne change rien et n'envoie rien", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    A.ecrire("r1", "resultat");
    await A.sync();
    const avant = JSON.stringify([...A.depot.docs]);
    const r = await A.sync(); // relit ses lignes grâce au recul de 120 s
    expect(r.lus).toBeGreaterThan(0);
    expect(r.envoyes).toBe(0);
    expect(JSON.stringify([...A.depot.docs])).toBe(avant);
    expect(nombreEnAttente(A.etat, A.depot.lister())).toBe(0);
  });

  it("4. un serveur qui réordonne les clés (jsonb) ne rend pas le document « modifié »", async () => {
    serveur.melangerCles = true;
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.depot.docs.set("gachee:g1", { id: "g1", a: 1, b: { c: 2, d: 3 } });
    await A.sync();
    await B.sync();
    expect(Object.keys(B.contenu("g1") as object)).toEqual(["b", "a", "id"]);
    expect((await B.sync()).envoyes).toBe(0);
    expect((await A.sync()).envoyes).toBe(0);
  });
});

describe("sync — concurrence", () => {
  it("5. modifications hors ligne des deux côtés : les deux versions sont gardées", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    const vA = A.ecrire("g1");
    const vB = B.ecrire("g1") as Record<string, unknown>;
    await A.sync();
    await B.sync();
    // La version en ligne (A) prend la place ; celle de B devient une copie.
    expect(B.contenu("g1")).toEqual(vA);
    const copies = copiesDe(B);
    expect(copies).toHaveLength(1);
    expect(copies[0][1]).toMatchObject({ titre: vB.titre, conflit: { de: "g1" } });
    expect(B.avis.map((a) => a.type)).toContain("conflit");
    // La copie part en ligne et arrive chez A.
    await B.sync();
    await A.sync();
    expect(copiesDe(A)).toHaveLength(1);
    expect(serveur.vivants("u1").size).toBe(2);
  });

  it("6. deux onglets sans verrou : un seul document en ligne, aucune copie", async () => {
    const depot = new FauxDepot();
    const O1 = new Navigateur("O1", serveur, { depot });
    const O2 = new Navigateur("O2", serveur, { depot });
    depot.docs.set("gachee:g1", { id: "g1", titre: "x" });
    await Promise.all([O1.sync(), O2.sync()]);
    // Les deux onglets écrivent le même état : le dernier gagne.
    O1.etat = O2.etat;
    expect(serveur.vivants("u1").size).toBe(1);
    expect(copiesDe(O1)).toHaveLength(0);
    expect((await O1.sync()).envoyes).toBe(0);
  });

  it("7. réponse perdue : l'écriture relue est reconnue comme la sienne", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    A.transport.reponsesPerdues = 1;
    const r1 = await A.sync();
    expect(r1.erreur?.nature).toBe("transitoire");
    expect(serveur.vivants("u1").size).toBe(1); // appliquée malgré tout
    const r2 = await A.sync();
    expect(r2.erreur).toBeNull();
    expect(r2.envoyes).toBe(0);
    expect(copiesDe(A)).toHaveLength(0);
    expect(A.avis).toEqual([]);
  });

  it("7b. réponse perdue puis nouvelle saisie : envoyée sans conflit", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    A.transport.reponsesPerdues = 1;
    await A.sync();
    const v2 = A.ecrire("g1");
    await A.sync();
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(v2);
    expect(copiesDe(A)).toHaveLength(0);
  });

  it("8. saisie pendant la lecture : rien n'est perdu", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    const vB = B.ecrire("g1");
    await B.sync();
    let tape: unknown = null;
    A.transport.pendantLecture = () => {
      A.transport.pendantLecture = null;
      tape = A.ecrire("g1");
    };
    await A.sync();
    expect(A.contenu("g1")).toEqual(vB);
    expect(copiesDe(A).map(([, c]) => (c as { titre: string }).titre)).toEqual([(tape as { titre: string }).titre]);
  });

  it("9. saisie pendant l'envoi : la nouvelle version part au cycle suivant", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    let v2: unknown = null;
    A.transport.pendantEcriture = () => {
      A.transport.pendantEcriture = null;
      v2 = A.ecrire("g1");
    };
    await A.sync();
    expect(nombreEnAttente(A.etat, A.depot.lister())).toBe(1);
    await A.sync();
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(v2);
    expect(copiesDe(A)).toHaveLength(0);
  });

  it("10. validation tardive : rattrapée sous 120 s ; au-delà, limite connue", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    // Sous le recul : g2 est horodatée, mais visible seulement plus tard.
    serveur.retenir = true;
    B.ecrire("g2");
    await B.sync();
    serveur.retenir = false;
    serveur.avancer(30);
    B.ecrire("g3");
    await B.sync();
    await A.sync(); // le curseur de A dépasse l'instant de g2
    expect(A.contenu("g2")).toBeUndefined();
    serveur.liberer();
    await A.sync();
    expect(A.contenu("g2")).toBeDefined();

    // Au-delà du recul (transaction validée plus de 120 s après son
    // horodatage) : manquée. Limite assumée — une écriture de document dure
    // quelques millisecondes.
    serveur.retenir = true;
    B.ecrire("g4");
    await B.sync();
    serveur.retenir = false;
    serveur.avancer(200);
    B.ecrire("g5");
    await B.sync();
    await A.sync();
    serveur.liberer();
    await A.sync();
    expect(A.contenu("g5")).toBeDefined();
    expect(A.contenu("g4")).toBeUndefined();
  });
});

describe("sync — suppressions", () => {
  it("11. une suppression faite hors ligne ne réapparaît jamais", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    A.transport.coupe = true;
    A.supprimer("g1");
    await A.sync();
    await B.sync();
    A.transport.coupe = false;
    await A.sync();
    await B.sync();
    expect(B.contenu("g1")).toBeUndefined();
    for (let i = 0; i < 3; i++) { await A.sync(); await B.sync(); }
    expect(A.contenu("g1")).toBeUndefined();
    expect(B.contenu("g1")).toBeUndefined();
    expect(serveur.supprimes("u1")).toEqual(["gachee:g1"]);
  });

  it("12. supprimé ici, modifié ailleurs : la suppression est annulée, avec avis", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    A.supprimer("g1");
    const vB = B.ecrire("g1");
    await B.sync();
    await A.sync();
    expect(A.contenu("g1")).toEqual(vB);
    expect(A.avis).toContainEqual({ type: "suppression_annulee", kind: "gachee", id: "g1" });
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(vB);
  });

  it("13. modifié ici, supprimé ailleurs : le travail est gardé, avec avis", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    A.ecrire("g1");
    await A.sync();
    await B.sync();
    B.supprimer("g1");
    await B.sync();
    const vA = A.ecrire("g1");
    await A.sync();
    expect(A.avis).toContainEqual({ type: "ressuscite", kind: "gachee", id: "g1" });
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(vA);
    await B.sync();
    expect(B.contenu("g1")).toEqual(vA);
  });

  it("14. recréer un document supprimé, sous le même id", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    await A.sync();
    A.supprimer("g1");
    await A.sync();
    expect(serveur.vivants("u1").size).toBe(0);
    const v = A.ecrire("g1");
    await A.sync();
    expect(serveur.vivants("u1").get("gachee:g1")).toEqual(v);
    const C = new Navigateur("C", serveur);
    await C.sync();
    expect(C.contenu("g1")).toEqual(v);
  });

  it("15. clé locale vidée par un bug : zéro suppression, les 40 documents reviennent", async () => {
    const A = new Navigateur("A", serveur);
    for (let i = 0; i < 40; i++) A.ecrire(`g${i}`);
    await A.sync();
    A.depot.docs.clear();
    const r = await A.sync();
    expect(r.envoyes).toBe(0);
    expect(serveur.supprimes("u1")).toEqual([]);
    expect(A.depot.docs.size).toBe(40);
  });

  it("16. suppressions massives : suspendues jusqu'à confirmation", async () => {
    const A = new Navigateur("A", serveur);
    for (let i = 0; i < 30; i++) A.ecrire(`g${i}`);
    await A.sync();
    for (let i = 0; i < 20; i++) A.supprimer(`g${i}`);
    await A.sync();
    expect(A.avis).toContainEqual({ type: "suppressions_suspendues", nombre: 20 });
    expect(serveur.vivants("u1").size).toBe(30);
    await A.sync({ confirmerSuppressions: true });
    expect(serveur.vivants("u1").size).toBe(10);
    // Quelques suppressions : aucune confirmation demandée.
    for (let i = 20; i < 25; i++) A.supprimer(`g${i}`);
    await A.sync();
    expect(serveur.vivants("u1").size).toBe(5);
  });

  it("une suppression d'un document jamais envoyé ne part pas en ligne", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    A.supprimer("g1");
    const r = await A.sync();
    expect(r.envoyes).toBe(0);
    expect(A.etat.suppressions).toEqual({});
    expect(serveur.supprimes("u1")).toEqual([]);
  });
});

describe("sync — transport", () => {
  it("17. erreur de lecture : rien n'est appliqué ni envoyé (régression v1 « cloud vide »)", async () => {
    const A = new Navigateur("A", serveur);
    const B = new Navigateur("B", serveur);
    for (const id of ["g1", "g2", "g3"]) A.ecrire(id);
    await A.sync();
    await B.sync();
    B.supprimer("g1");
    await B.sync();
    const curseur = A.etat.curseur;
    A.ecrire("g2");
    A.transport.echecsLecture = 1;
    const r = await A.sync();
    expect(r.erreur).toEqual({ nature: "transitoire", code: "503" });
    expect(A.depot.docs.size).toBe(3);
    expect(A.etat.curseur).toEqual(curseur);
    expect(r.envoyes).toBe(0);
    await A.sync();
    expect(A.contenu("g1")).toBeUndefined();
  });

  it("18. serveur plafonné à 3 lignes par réponse : tout est lu quand même", async () => {
    serveur.maxLignes = 3;
    const B = new Navigateur("B", serveur);
    for (let i = 0; i < 10; i++) B.ecrire(`g${i}`);
    await B.sync();
    const A = new Navigateur("A", serveur);
    const r = await A.sync();
    expect(r.lus).toBe(10);
    expect(A.depot.docs.size).toBe(10);
  });

  it("19. 500 lignes horodatées au même instant : ni perte ni doublon", async () => {
    serveur.figer = true;
    const B = new Navigateur("B", serveur);
    for (let i = 0; i < 500; i++) B.ecrire(`g${String(i).padStart(3, "0")}`);
    await B.sync();
    const A = new Navigateur("A", serveur);
    const r = await A.sync();
    expect(r.lus).toBe(500);
    expect(A.depot.docs.size).toBe(500);
  });

  it("20. refus permanent : bloqué jusqu'à modification ; panne transitoire : renvoyé", async () => {
    const A = new Navigateur("A", serveur);
    A.ecrire("g1");
    A.ecrire("g2");
    A.transport.refuser = (e) => (e.id === "g2" ? "53400" : null);
    await A.sync();
    expect(A.avis).toContainEqual({ type: "refuse", kind: "gachee", id: "g2", code: "53400" });
    const avant = A.transport.ecritures;
    await A.sync();
    expect(A.transport.ecritures).toBe(avant); // pas de renvoi à l'identique
    A.transport.refuser = null;
    A.ecrire("g2");
    await A.sync();
    expect(serveur.vivants("u1").has("gachee:g2")).toBe(true);

    // Panne transitoire pendant l'envoi : le document reste à envoyer.
    A.ecrire("g3");
    A.transport.pendantLecture = () => { A.transport.coupe = true; };
    const r = await A.sync();
    expect(r.erreur?.nature).toBe("transitoire");
    A.transport.pendantLecture = null;
    A.transport.coupe = false;
    await A.sync();
    expect(serveur.vivants("u1").has("gachee:g3")).toBe(true);
    expect(copiesDe(A)).toHaveLength(0);
  });

  it("21. session inattendue (28000) : le cycle s'arrête, rien n'est écrit", async () => {
    const A = new Navigateur("A", serveur, { uid: "u1", session: "u2" });
    A.ecrire("g1");
    const r = await A.sync();
    expect(r.erreur).toEqual({ nature: "session", code: "28000" });
    expect(serveur.vivants("u1").size + serveur.vivants("u2").size).toBe(0);
  });

  it("stockage local plein : le cycle s'arrête sans avancer", async () => {
    const B = new Navigateur("B", serveur);
    B.ecrire("g1");
    await B.sync();
    const A = new Navigateur("A", serveur);
    A.depot.plein = true;
    const r = await A.sync();
    expect(r.erreur).toEqual({ nature: "stockage", code: "quota" });
    expect(A.etat.curseur).toBeNull();
    A.depot.plein = false;
    await A.sync();
    expect(A.contenu("g1")).toBeDefined();
  });
});

describe("sync — liaison et migration", () => {
  it("22. décision de liaison du stockage local", () => {
    expect(deciderLiaison(null, null, true)).toBe("aucune_session");
    expect(deciderLiaison("u1", "u1", true)).toBe("synchroniser");
    expect(deciderLiaison(null, "u1", false)).toBe("lier");
    expect(deciderLiaison(null, "u1", true)).toBe("proposer_rattachement");
    expect(deciderLiaison("u1", "u2", false)).toBe("autre_compte");
  });

  it("23. rattachement : les données anonymes partent, celles de l'autre appareil arrivent", async () => {
    const B = new Navigateur("B", serveur);
    B.ecrire("gB");
    await B.sync();
    const A = new Navigateur("A", serveur, { uid: null });
    A.ecrire("gA1");
    A.ecrire("rA", "resultat");
    // En anonyme, supprimer ne pose aucune suppression à transmettre.
    A.ecrire("gA2");
    A.supprimer("gA2");
    expect(A.etat.suppressions).toEqual({});
    expect(deciderLiaison(A.etat.uid, "u1", A.depot.docs.size > 0)).toBe("proposer_rattachement");
    A.etat = { ...A.etat, uid: "u1" }; // l'étudiant confirme
    await A.sync();
    expect(A.depot.docs.size).toBe(3);
    expect(serveur.vivants("u1").size).toBe(3);
  });

  it("24. délai de réessai : croissant, plafonné, avec gigue bornée", () => {
    expect(delaiReessai(0, 0.5)).toBe(5000);
    expect(delaiReessai(1, 0.5)).toBe(10000);
    expect(delaiReessai(20, 0.5)).toBe(600000);
    expect(delaiReessai(0, 0)).toBe(4000);
    expect(delaiReessai(0, 0.999999)).toBeLessThanOrEqual(6000);
  });
});

/* ── 25. Propriété : 3 navigateurs, 300 opérations aléatoires ──────────── */

function mulberry32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sync — propriété (graines fixes)", () => {
  for (const graine of [1, 2, 3, 42, 2026]) {
    it(`25. convergence, aucune perte, cycle suivant inerte (graine ${graine})`, async () => {
      const rnd = mulberry32(graine);
      const srv = new FauxServeur();
      const navs = ["A", "B", "C"].map((n) => new Navigateur(n, srv));
      const SUPPRIME = "SUPPRIME";
      // Filiation des contenus : chaque saisie part du contenu local courant.
      const succ = new Map<string, Set<string>>();
      const arete = (de: string, vers: string) => {
        if (!succ.has(de)) succ.set(de, new Set());
        succ.get(de)!.add(vers);
      };
      const saisis = new Set<string>();
      let n = 0;

      for (let pas = 0; pas < 300; pas++) {
        const nav = navs[Math.floor(rnd() * navs.length)];
        const x = rnd();
        if (x < 0.3) {
          const id = `g${Math.floor(rnd() * 8)}`;
          const k = cleDoc("gachee", id);
          const avant = nav.depot.docs.get(k);
          const neuf = { id, n: ++n, par: nav.nom };
          if (avant !== undefined) arete(empreinte(avant), empreinte(neuf));
          nav.depot.docs.set(k, neuf);
          saisis.add(empreinte(neuf));
        } else if (x < 0.4) {
          const cles = [...nav.depot.docs.keys()];
          if (cles.length > 0) {
            const k = cles[Math.floor(rnd() * cles.length)];
            arete(empreinte(nav.depot.docs.get(k)), SUPPRIME);
            nav.supprimer(k.slice("gachee:".length));
          }
        } else if (x < 0.75) {
          nav.transport.reponsesPerdues = rnd() < 0.15 ? 1 : 0;
          await nav.sync();
        } else if (x < 0.85) {
          nav.transport.coupe = !nav.transport.coupe;
        } else {
          srv.avancer(rnd() * 5);
        }
      }

      for (const nav of navs) { nav.transport.coupe = false; nav.transport.reponsesPerdues = 0; }
      for (let tour = 0; tour < 6; tour++) {
        for (const nav of navs) await nav.sync({ confirmerSuppressions: true });
      }

      // (a) Convergence : chaque navigateur a exactement les documents en ligne.
      const enLigne = new Map([...srv.vivants("u1")].map(([k, c]) => [k, empreinte(c)]));
      for (const nav of navs) {
        const local = new Map([...nav.depot.docs].map(([k, c]) => [k, empreinte(c)]));
        expect(local).toEqual(enLigne);
      }
      // (b) Un cycle de plus ne produit rien.
      for (const nav of navs) {
        const r = await nav.sync();
        expect(r.envoyes).toBe(0);
        expect(r.avis).toEqual([]);
      }
      // (c) Aucune perte : toute saisie mène, par filiation (saisies qui en
      // partent, copies de conflit), à un contenu final ou à une suppression
      // explicite.
      for (const nav of navs) for (const c of nav.depot.copies) arete(c.source, c.copie);
      const terminaux = new Set([...enLigne.values(), SUPPRIME]);
      for (const s of saisis) {
        const vus = new Set<string>([s]);
        const file = [s];
        let atteint = false;
        while (file.length > 0 && !atteint) {
          const x = file.pop()!;
          if (terminaux.has(x)) { atteint = true; break; }
          for (const y of succ.get(x) ?? []) if (!vus.has(y)) { vus.add(y); file.push(y); }
        }
        expect(atteint, `saisie perdue : ${s}`).toBe(true);
      }
    });
  }
});
