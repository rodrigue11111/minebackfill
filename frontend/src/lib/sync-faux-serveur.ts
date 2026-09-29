// frontend/src/lib/sync-faux-serveur.ts
// Doublures de test du moteur de synchronisation (sync-moteur.ts) : un faux
// serveur qui reproduit la SÉMANTIQUE de supabase/schema.sql (user_docs,
// ecrire_doc, lire_docs), un faux transport pour y accéder avec des pannes
// injectables, et un faux dépôt local en mémoire.
//
// Ce fichier n'est importé que par les tests : il n'entre pas dans le bundle.
// Toute évolution du SQL doit se refléter ici, sinon les tests du moteur
// prouveraient quelque chose sur un serveur qui n'existe pas.

import { empreinte } from "./sync-empreinte";
import {
  cleDoc, ErreurSync,
  type Curseur, type DepotLocal, type DocLocal, type Envoi, type IssueOperation,
  type Kind, type LigneServeur, type OperationLocale, type ReponseEcriture, type Transport,
} from "./sync-moteur";

const RE_ID = /^[A-Za-z0-9_.:-]{1,100}$/;
const BASE_MS = Date.UTC(2026, 8, 1);

/** Horodatage à la microseconde, au format rendu par PostgREST. */
export function formaterMaj(us: number): string {
  const ms = Math.floor(us / 1000);
  const iso = new Date(BASE_MS + ms).toISOString(); // …SS.mmmZ
  return `${iso.slice(0, 23)}${String(us % 1000).padStart(3, "0")}+00:00`;
}
export function lireMaj(maj: string): number {
  const ms = Date.parse(`${maj.slice(0, 23)}Z`) - BASE_MS;
  return ms * 1000 + Number(maj.slice(23, 26));
}

interface Ligne {
  uid: string;
  kind: string;
  id: string;
  rev: number;
  t: number;
  deleted: boolean;
  payload: unknown;
  visible: boolean;
}

function comparer(a: [number, string, string], b: [number, string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
  return 0;
}

/** Inverse l'ordre des clés à tous les niveaux, comme jsonb peut le faire. */
function reordonner(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(reordonner);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    const r: Record<string, unknown> = {};
    for (const k of Object.keys(o).reverse()) r[k] = reordonner(o[k]);
    return r;
  }
  return x;
}

export class FauxServeur {
  private lignes = new Map<string, Ligne>();
  private seq = 0;
  /** Horloge en microsecondes. */
  private t = 0;
  /** Plafond de lignes par réponse (max_rows de PostgREST). */
  maxLignes = Infinity;
  /** Horloge figée : toutes les écritures reçoivent le même instant. */
  figer = false;
  /** Les écritures deviennent invisibles jusqu'à liberer() (transaction lente). */
  retenir = false;
  /** Rend les contenus avec les clés dans un autre ordre (jsonb). */
  melangerCles = false;

  avancer(secondes: number): void {
    this.t += Math.round(secondes * 1e6);
  }

  liberer(): void {
    this.retenir = false;
    for (const l of this.lignes.values()) l.visible = true;
  }

  private tic(): number {
    if (!this.figer) this.t += 1;
    return this.t;
  }

  private versLigneServeur(l: Ligne): LigneServeur {
    const contenu = l.deleted ? null : JSON.parse(JSON.stringify(l.payload));
    return {
      kind: l.kind as Kind, id: l.id, rev: l.rev, maj: formaterMaj(l.t),
      supprime: l.deleted, contenu: this.melangerCles ? reordonner(contenu) : contenu,
    };
  }

  /** ecrire_doc : `session` = auth.uid() ; `attendu` = p_attendu. */
  ecrire(session: string, attendu: string, e: Envoi): ReponseEcriture {
    if (attendu !== session) throw new ErreurSync("session", "28000");
    if (!RE_ID.test(e.id)) throw new ErreurSync("permanente", "23514");
    const k = `${session}\u0000${e.kind}\u0000${e.id}`;
    const existante = this.lignes.get(k);
    const payload = e.supprime ? null : JSON.parse(JSON.stringify(e.contenu));
    if (e.baseRev === null) {
      if (existante) return { ok: false, ligne: this.versLigneServeur(existante) };
      const l: Ligne = {
        uid: session, kind: e.kind, id: e.id, rev: ++this.seq, t: this.tic(),
        deleted: e.supprime, payload, visible: !this.retenir,
      };
      this.lignes.set(k, l);
      return { ok: true, rev: l.rev, maj: formaterMaj(l.t) };
    }
    if (!existante || existante.rev !== e.baseRev) {
      return { ok: false, ligne: existante ? this.versLigneServeur(existante) : null };
    }
    existante.rev = ++this.seq;
    existante.t = this.tic();
    existante.deleted = e.supprime;
    existante.payload = payload;
    existante.visible = !this.retenir;
    return { ok: true, rev: existante.rev, maj: formaterMaj(existante.t) };
  }

  /** lire_docs. */
  lire(session: string, attendu: string, apres: Curseur | null, reculS: number, limite: number): LigneServeur[] {
    if (attendu !== session) throw new ErreurSync("session", "28000");
    const borne: [number, string, string] = apres
      ? [lireMaj(apres.maj) - Math.max(0, reculS) * 1e6, apres.kind, apres.id]
      : [-Infinity, "", ""];
    const n = Math.min(Math.max(limite, 1), 500, this.maxLignes);
    return [...this.lignes.values()]
      .filter((l) => l.uid === session && l.kind !== "courbe" && l.visible)
      .filter((l) => comparer([l.t, l.kind, l.id], borne) > 0)
      .sort((a, b) => comparer([a.t, a.kind, a.id], [b.t, b.kind, b.id]))
      .slice(0, n)
      .map((l) => this.versLigneServeur(l));
  }

  /** Documents vivants d'un utilisateur : id -> contenu. */
  vivants(uid: string): Map<string, unknown> {
    const r = new Map<string, unknown>();
    for (const l of this.lignes.values()) {
      if (l.uid === uid && !l.deleted) r.set(cleDoc(l.kind as Kind, l.id), l.payload);
    }
    return r;
  }

  /** Clés supprimées (tombstones) d'un utilisateur. */
  supprimes(uid: string): string[] {
    return [...this.lignes.values()]
      .filter((l) => l.uid === uid && l.deleted)
      .map((l) => cleDoc(l.kind as Kind, l.id));
  }
}

/** Transport vers le faux serveur, avec pannes injectables. */
export class FauxTransport implements Transport {
  /** Réseau coupé : tout appel échoue (transitoire). */
  coupe = false;
  /** Nombre de prochaines lectures qui échouent. */
  echecsLecture = 0;
  /** Nombre de prochaines écritures APPLIQUÉES dont la réponse se perd. */
  reponsesPerdues = 0;
  /** Refus permanent (code) pour certains envois. */
  refuser: ((e: Envoi) => string | null) | null = null;
  /** Appelé pendant une lecture, avant la réponse (l'utilisateur tape). */
  pendantLecture: (() => void) | null = null;
  /** Appelé pendant une écriture, après son application (l'utilisateur tape). */
  pendantEcriture: ((e: Envoi) => void) | null = null;
  lectures = 0;
  ecritures = 0;

  constructor(private serveur: FauxServeur, public session: string, public attendu: () => string) {}

  async lirePage(apres: Curseur | null, reculS: number, limite: number): Promise<LigneServeur[]> {
    await Promise.resolve();
    this.lectures++;
    if (this.coupe) throw new ErreurSync("transitoire", "reseau");
    if (this.echecsLecture > 0) {
      this.echecsLecture--;
      throw new ErreurSync("transitoire", "503");
    }
    const page = this.serveur.lire(this.session, this.attendu(), apres, reculS, limite);
    this.pendantLecture?.();
    return page;
  }

  async ecrire(e: Envoi): Promise<ReponseEcriture> {
    await Promise.resolve();
    this.ecritures++;
    if (this.coupe) throw new ErreurSync("transitoire", "reseau");
    const code = this.refuser?.(e);
    if (code) throw new ErreurSync("permanente", code);
    const r = this.serveur.ecrire(this.session, this.attendu(), e);
    this.pendantEcriture?.(e);
    await Promise.resolve();
    if (this.reponsesPerdues > 0) {
      this.reponsesPerdues--;
      throw new ErreurSync("transitoire", "reponse_perdue");
    }
    return r;
  }
}

/** Dépôt local en mémoire. Les contenus y sont déjà sous forme canonique. */
export class FauxDepot implements DepotLocal {
  docs = new Map<string, unknown>();
  /** Stockage plein : toute écriture échoue. */
  plein = false;
  /** Copies de conflit créées : empreinte source -> empreinte copie. */
  copies: { source: string; copie: string }[] = [];

  lister(): Map<string, DocLocal> {
    const r = new Map<string, DocLocal>();
    for (const [c, contenu] of this.docs) {
      const i = c.indexOf(":");
      r.set(c, { kind: c.slice(0, i) as Kind, id: c.slice(i + 1), contenu, empreinte: empreinte(contenu) });
    }
    return r;
  }

  appliquer(ops: OperationLocale[]): IssueOperation[] {
    return ops.map((op) => {
      const c = cleDoc(op.kind, op.id);
      const actuel = this.docs.has(c) ? empreinte(this.docs.get(c)) : null;
      if (actuel !== op.attendu) return "ignoree";
      if (this.plein) return "echec";
      if (op.type === "ecrire") this.docs.set(c, JSON.parse(JSON.stringify(op.contenu)));
      else this.docs.delete(c);
      return "appliquee";
    });
  }

  copieDeConflit(_kind: Kind, contenu: unknown, nouvelId: string, le: string): unknown {
    const source = contenu as Record<string, unknown>;
    const copie = { ...source, id: nouvelId, conflit: { de: source.id, le } };
    this.copies.push({ source: empreinte(contenu), copie: empreinte(copie) });
    return copie;
  }
}
