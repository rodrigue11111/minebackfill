import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";
import { empreinte } from "./sync-empreinte";
import {
  cleDoc, cycle, ErreurSync, etatInitial, marquerSuppression,
  type Curseur, type EtatSync, type Envoi, type LigneServeur, type ReponseEcriture, type Transport,
} from "./sync-moteur";
import { FauxDepot } from "./sync-faux-serveur";

// Banc d'essai du SQL : supabase/schema.sql exécuté pour de vrai, dans
// PostgreSQL compilé en WebAssembly (PGlite). Ce que ce fichier prouve, la CI
// le reprouve à chaque exécution — là où la v1 ne se vérifiait qu'à la main.
//
// L'environnement Supabase est reconstitué au minimum : rôles anon /
// authenticated, schéma auth, auth.uid() lu dans le réglage
// request.jwt.claim.sub (comme PostgREST), droits par défaut de Supabase
// (tout accordé à anon et authenticated : seule la RLS protège — c'est
// précisément ce qu'il faut tester).
//
// Limite : PGlite n'est pas PostgREST. Le format JSON des réponses et la
// troncature max_rows sont couverts par le faux serveur (sync-faux-serveur.ts).

const SCHEMA = readFileSync(fileURLToPath(new URL("../../../supabase/schema.sql", import.meta.url)), "utf8");

const SUPABASE_MINIMAL = `
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const PROF = "00000000-0000-4000-8000-0000000000ff";

let db: PGlite;

/** Exécute `sql` en tant qu'utilisateur (uid) ou anonyme (null), dans une transaction. */
async function comme<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx: Transaction) => {
    await tx.exec(`set local role ${uid === null ? "anon" : "authenticated"}`);
    if (uid) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    return tx.query<T>(sql, params);
  });
}

interface RepEcriture { ok: boolean; rev_serveur: unknown; maj_serveur: string; supprime_serveur: boolean; contenu_serveur: unknown }

async function ecrire(uid: string, kind: string, id: string, payload: unknown, baseRev: number | null, supprime = false, attendu = uid) {
  const r = await comme<RepEcriture>(uid,
    "select ok, rev_serveur, maj_serveur::text as maj_serveur, supprime_serveur, contenu_serveur from public.ecrire_doc($1, $2, $3, $4::jsonb, $5, $6)",
    [attendu, kind, id, payload === null ? null : JSON.stringify(payload), baseRev, supprime]);
  return r.rows.map((x) => ({ ...x, rev_serveur: x.rev_serveur === null ? null : Number(x.rev_serveur) }));
}

interface RepLecture { doc_kind: string; doc_id: string; doc_rev: unknown; maj: string; supprime: boolean; contenu: unknown }

async function lire(uid: string, apres: Curseur | null, reculS = 0, limite = 100) {
  const r = await comme<RepLecture>(uid,
    "select doc_kind, doc_id, doc_rev, maj_serveur::text as maj, supprime, contenu from public.lire_docs($1, $2::timestamptz, $3, $4, $5, $6)",
    [uid, apres?.maj ?? null, apres?.kind ?? null, apres?.id ?? null, reculS, limite]);
  return r.rows.map((x) => ({ ...x, doc_rev: Number(x.doc_rev) }));
}

async function creerCompte(id: string, email: string, meta: unknown = {}) {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
    [id, email, JSON.stringify(meta)]);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_MINIMAL);
  await db.exec("set timezone = 'UTC'");
  await db.exec(SCHEMA);
  await db.exec(SCHEMA); // ré-exécutable
  await creerCompte(A, "a@exemple.ca", { display_name: "  Alice  ", role: "prof" });
  await creerCompte(B, "b@exemple.ca");
  await creerCompte(PROF, "prof@exemple.ca");
  await db.query("update public.profiles set role = 'prof' where id = $1", [PROF]);
}, 60000);

describe("schema.sql — inscription et profils", () => {
  it("le profil est créé ; seul le nom est lu dans les métadonnées saisies", async () => {
    const r = await db.query<{ role: string; display_name: string }>(
      "select role, display_name from public.profiles where id = $1", [A]);
    expect(r.rows[0]).toEqual({ role: "etudiant", display_name: "Alice" });
  });

  it("definir_nom change le nom, et seulement lui", async () => {
    await comme(B, "select public.definir_nom($1)", ["Bruno"]);
    await expect(comme(B, "select public.definir_nom($1)", ["x".repeat(81)])).rejects.toMatchObject({ code: "22001" });
    // Aucune politique UPDATE : un étudiant ne se promeut pas.
    const maj = await comme(B, "update public.profiles set role = 'prof' where id = $1", [B]);
    expect(maj.affectedRows).toBe(0);
    const r = await db.query<{ role: string; display_name: string }>(
      "select role, display_name from public.profiles where id = $1", [B]);
    expect(r.rows[0]).toEqual({ role: "etudiant", display_name: "Bruno" });
  });
});

describe("schema.sql — code enseignant", () => {
  // Code de TEST : le vrai code n'est jamais écrit dans le dépôt.
  const CODE = "Code-De-Test-2026";
  const meta = (id: string) => db.query<{ m: Record<string, unknown> }>(
    "select raw_user_meta_data as m from auth.users where id = $1", [id]);
  const role = async (id: string) => (await db.query<{ role: string }>(
    "select role from public.profiles where id = $1", [id])).rows[0]?.role;

  it("le bon code donne « prof », une seule fois ; le code ne reste pas sur le compte", async () => {
    await db.query("select public.definir_code_enseignant($1)", [CODE]);
    const P1 = "00000000-0000-4000-8000-0000000000e1";
    const P2 = "00000000-0000-4000-8000-0000000000e2";
    await creerCompte(P1, "prof1@exemple.ca", { display_name: "Prof", code_enseignant: CODE });
    expect(await role(P1)).toBe("prof");
    expect((await meta(P1)).rows[0].m).toEqual({ display_name: "Prof" });
    // Déjà utilisé : le même code ne sert plus.
    await creerCompte(P2, "prof2@exemple.ca", { code_enseignant: CODE });
    expect(await role(P2)).toBe("etudiant");
  });

  it("un mauvais code (ou un rôle glissé dans les métadonnées) donne « etudiant »", async () => {
    await db.query("select public.definir_code_enseignant($1, 2)", [CODE]);
    const E1 = "00000000-0000-4000-8000-0000000000e3";
    await creerCompte(E1, "e1@exemple.ca", { code_enseignant: "Mauvais-Code-1", role: "prof" });
    expect(await role(E1)).toBe("etudiant");
    expect((await meta(E1)).rows[0].m).not.toHaveProperty("code_enseignant");
    const r = await db.query<{ n: number }>("select utilisations_restantes as n from public.code_enseignant");
    expect(r.rows[0].n).toBe(2); // un essai raté ne consomme rien
  });

  it("ni l'application ni un anonyme ne peuvent lire ou poser le code", async () => {
    for (const qui of [A, null]) {
      await expect(comme(qui, "select * from public.code_enseignant")).rejects.toMatchObject({ code: "42501" });
      await expect(comme(qui, "select public.definir_code_enseignant('Nouveau-Code-99')")).rejects.toMatchObject({ code: "42501" });
    }
    await expect(db.query("select public.definir_code_enseignant('court')")).rejects.toMatchObject({ code: "22023" });
  });
});

describe("schema.sql — ecrire_doc", () => {
  it("création, conflit, mise à jour, révision obsolète, suppression", async () => {
    const [c] = await ecrire(A, "gachee", "e1", { id: "e1", v: 1 }, null);
    expect(c.ok).toBe(true);
    const rev1 = c.rev_serveur as number;

    // Recréer = conflit : rien n'est écrit, la ligne serveur est rendue.
    const [c2] = await ecrire(A, "gachee", "e1", { id: "e1", v: 99 }, null);
    expect(c2).toMatchObject({ ok: false, rev_serveur: rev1, contenu_serveur: { id: "e1", v: 1 } });

    const [m] = await ecrire(A, "gachee", "e1", { id: "e1", v: 2 }, rev1);
    expect(m.ok).toBe(true);
    const rev2 = m.rev_serveur as number;
    expect(rev2).toBeGreaterThan(rev1);

    // Écrire par-dessus une révision périmée : refusé, ligne actuelle rendue.
    const [o] = await ecrire(A, "gachee", "e1", { id: "e1", v: 3 }, rev1);
    expect(o).toMatchObject({ ok: false, rev_serveur: rev2, contenu_serveur: { id: "e1", v: 2 } });

    // Suppression : le contenu est EFFACÉ, la trace reste.
    const [s] = await ecrire(A, "gachee", "e1", { id: "e1", v: 2 }, rev2, true);
    expect(s).toMatchObject({ ok: true, supprime_serveur: true });
    const l = await db.query<{ deleted: boolean; payload: unknown }>(
      "select deleted, payload from public.user_docs where user_id = $1 and id = 'e1'", [A]);
    expect(l.rows[0]).toEqual({ deleted: true, payload: null });

    // Mise à jour d'un document inexistant : conflit sans ligne.
    expect(await ecrire(A, "gachee", "absent", { v: 1 }, 5)).toEqual([]);
  });

  it("session inattendue (p_attendu ≠ auth.uid()) : 28000, rien n'est écrit", async () => {
    await expect(ecrire(A, "gachee", "e2", { v: 1 }, null, false, B)).rejects.toMatchObject({ code: "28000" });
    const n = await db.query("select 1 from public.user_docs where id = 'e2'");
    expect(n.rows).toHaveLength(0);
  });

  it("anonyme : aucune fonction d'écriture ni de lecture", async () => {
    await expect(comme(null, "select * from public.ecrire_doc($1, 'gachee', 'x', '{}'::jsonb, null, false)", [A]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(comme(null, "select * from public.user_docs")).rejects.toMatchObject({ code: "42501" });
    // Les catalogues officiels restent lisibles sans compte.
    await expect(comme(null, "select * from public.official_catalogs")).resolves.toBeDefined();
  });

  it("contraintes : id hors format, contenu trop gros", async () => {
    await expect(ecrire(A, "gachee", "a b", { v: 1 }, null)).rejects.toMatchObject({ code: "23514" });
    await expect(ecrire(A, "gachee", "gros", { x: "y".repeat(270000) }, null)).rejects.toMatchObject({ code: "23514" });
    await expect(ecrire(A, "inconnu", "k1", { v: 1 }, null)).rejects.toMatchObject({ code: "23514" });
  });

  it("quota de 25 Mo par compte : dépasser est refusé, supprimer reste possible", async () => {
    const [c] = await ecrire(B, "resultat", "q1", { v: 1 }, null);
    await db.query("update public.user_usage set octets = 25 * 1024 * 1024 - 10 where user_id = $1", [B]);
    await expect(ecrire(B, "resultat", "q2", { texte: "x".repeat(100) }, null)).rejects.toMatchObject({ code: "53400" });
    const [s] = await ecrire(B, "resultat", "q1", null, c.rev_serveur as number, true);
    expect(s.ok).toBe(true);
    await db.query("update public.user_usage set octets = 0 where user_id = $1", [B]);
  });
});

describe("schema.sql — RLS et triggers", () => {
  it("un étudiant ne voit ni ne touche le travail d'un autre", async () => {
    await ecrire(A, "resultat", "ra", { id: "ra" }, null);
    expect((await comme(B, "select id from public.user_docs where user_id = $1", [A])).rows).toEqual([]);
    expect((await lire(B, null)).map((l) => l.doc_id)).not.toContain("ra");
    // Insertion directe au nom d'autrui : refusée par la RLS.
    await expect(comme(B, "insert into public.user_docs (user_id, kind, id, payload) values ($1, 'resultat', 'pirate', '{}')", [A]))
      .rejects.toMatchObject({ code: "42501" });
    // Aucune suppression physique, même de ses propres lignes.
    await expect(comme(A, "delete from public.user_docs where user_id = $1", [A])).rejects.toMatchObject({ code: "42501" });
  });

  it("le serveur pose rev et updated_at, et la clé est immuable", async () => {
    const [c] = await ecrire(A, "resultat", "rt", { id: "rt" }, null);
    await comme(A, "update public.user_docs set rev = 1, updated_at = '2000-01-01' where user_id = $1 and id = 'rt'", [A]);
    const r = await db.query<{ rev: unknown; updated_at: Date }>(
      "select rev, updated_at from public.user_docs where user_id = $1 and id = 'rt'", [A]);
    expect(Number(r.rows[0].rev)).toBeGreaterThan(c.rev_serveur as number);
    expect(r.rows[0].updated_at.getUTCFullYear()).toBeGreaterThan(2000);
    await expect(comme(A, "update public.user_docs set id = 'autre' where user_id = $1 and id = 'rt'", [A]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("l'ancienne table saved_results est gelée", async () => {
    await expect(comme(A, "insert into public.saved_results (id, user_id, payload) values ('sr_x', $1, '{}')", [A]))
      .rejects.toMatchObject({ code: "42501" });
  });
});

describe("schema.sql — lecture par curseur", () => {
  it("250 documents lus par pages de 100 : ni perte ni doublon, puis page vide", async () => {
    const U = "00000000-0000-4000-8000-000000000250";
    await creerCompte(U, "pages@exemple.ca");
    for (let i = 0; i < 250; i++) await ecrire(U, "gachee", `p${String(i).padStart(3, "0")}`, { i }, null);
    await ecrire(U, "gachee", "p000", { i: -1 }, null); // conflit : aucune ligne de plus
    // Contenu vide sans « supprimé » : refusé par la contrainte, pas par le conflit.
    await expect(ecrire(U, "gachee", "p000", null, null)).rejects.toMatchObject({ code: "23514" });
    const vus = new Set<string>();
    let curseur: Curseur | null = null;
    for (let p = 0; p < 10; p++) {
      const page = await lire(U, curseur);
      if (page.length === 0) break;
      for (const l of page) {
        expect(vus.has(l.doc_id)).toBe(false);
        vus.add(l.doc_id);
      }
      const d = page[page.length - 1];
      curseur = { maj: d.maj, kind: d.doc_kind, id: d.doc_id };
    }
    expect(vus.size).toBe(250);
    // Le recul relit les dernières secondes.
    expect((await lire(U, curseur, 120)).length).toBeGreaterThan(0);
    // Limite plafonnée à 500.
    expect((await lire(U, null, 0, 100000)).length).toBe(250);
  });

  it("les courbes ne sont jamais lues par lire_docs", async () => {
    await ecrire(A, "courbe", "c1", { points: [1, 2, 3] }, null);
    expect((await lire(A, null)).map((l) => l.doc_kind)).not.toContain("courbe");
  });
});

describe("schema.sql — enseignant et annotations", () => {
  it("lire_docs_classe : réservée au prof, projection allégée, filtre de session", async () => {
    await ecrire(B, "gachee", "gb", {
      id: "gb", sessionId: "A2026", parametres: { cw: 75 }, composants: [1], ajustements: [2], protocolesSnapshot: [3],
    }, null);
    await ecrire(B, "resultat", "rb", { id: "rb", recipes: [1], inputs: { x: 1 }, constantes: {}, catalogue_liants: [] }, null);
    const q = "select proprietaire, doc_kind, doc_id, contenu from public.lire_docs_classe(null, null, null, null, 0, 500, $1, $2)";
    await expect(comme(A, q, [false, null])).rejects.toMatchObject({ code: "42501" });
    const r = await comme<{ proprietaire: string; doc_id: string; contenu: Record<string, unknown> }>(PROF, q, [false, null]);
    const gb = r.rows.find((x) => x.doc_id === "gb")!;
    expect(gb.proprietaire).toBe(B);
    expect(Object.keys(gb.contenu).sort()).toEqual(["id", "parametres", "sessionId"]);
    const rb = r.rows.find((x) => x.doc_id === "rb")!;
    expect(Object.keys(rb.contenu).sort()).toEqual(["id", "recipes"]);
    expect(r.rows.map((x) => x.doc_id)).toContain("ra"); // tous les étudiants
    const complet = await comme<{ doc_id: string; contenu: Record<string, unknown> }>(PROF, q, [true, null]);
    expect(complet.rows.find((x) => x.doc_id === "gb")!.contenu).toHaveProperty("composants");
    const autreSession = await comme<{ doc_id: string }>(PROF, q, [false, "H2027"]);
    expect(autreSession.rows.map((x) => x.doc_id)).not.toContain("gb");
    expect(autreSession.rows.map((x) => x.doc_id)).toContain("rb"); // sans session : inclus
  });

  it("annotations : écrites par le prof, lues par le seul propriétaire", async () => {
    const ins = "insert into public.annotations (owner_id, target_kind, target_id, auteur_id, texte) values ($1, $2, $3, $4, $5) returning id";
    const r = await comme<{ id: string }>(PROF, ins, [B, "gachee", "gb", PROF, "Vérifier la cure à 28 j."]);
    const idAnn = r.rows[0].id;
    // Un étudiant n'annote pas ; on n'annote pas un document inexistant ;
    // on n'écrit pas au nom d'un autre auteur.
    await expect(comme(A, ins, [B, "gachee", "gb", A, "x"])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(PROF, ins, [B, "gachee", "inexistant", PROF, "x"])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(PROF, ins, [B, "gachee", "gb", A, "x"])).rejects.toMatchObject({ code: "42501" });

    const lireAnn = "select annotation_id, cible_id, texte, supprime from public.lire_annotations($1, null, null, 0, 100)";
    expect((await comme(B, lireAnn, [B])).rows).toMatchObject([{ cible_id: "gb", texte: "Vérifier la cure à 28 j.", supprime: false }]);
    expect((await comme(A, lireAnn, [A])).rows).toEqual([]);
    await expect(comme(A, lireAnn, [B])).rejects.toMatchObject({ code: "28000" });

    // Seuls le texte et le retrait changent ; retirée, elle ne montre plus son texte.
    await expect(comme(PROF, "update public.annotations set owner_id = $1 where id = $2", [A, idAnn]))
      .rejects.toMatchObject({ code: "42501" });
    await comme(PROF, "update public.annotations set deleted = true where id = $1", [idAnn]);
    expect((await comme(B, lireAnn, [B])).rows).toMatchObject([{ texte: null, supprime: true }]);
  });

  it("catalogue « sessions » : publiable par le prof seulement", async () => {
    const q = "insert into public.official_catalogs (id, data) values ('sessions', $1::jsonb)";
    await expect(comme(A, q, [JSON.stringify({ v: 1, data: [] })])).rejects.toMatchObject({ code: "42501" });
    await comme(PROF, q, [JSON.stringify({ v: 1, data: [{ id: "A2026" }] })]);
  });
});

describe("schema.sql — reprise de saved_results (v1)", () => {
  it("reprise unique, sans ownerId ; ré-exécution sans doublon ni résurrection", async () => {
    const U = "00000000-0000-4000-8000-0000000000c1";
    await creerCompte(U, "v1@exemple.ca");
    await db.query("insert into public.saved_results (id, user_id, payload) values ('sr_1', $1, $2::jsonb), ('sr 2', $1, '{}')",
      [U, JSON.stringify({ id: "sr_1", label: "Mélange", ownerId: U })]);
    await db.exec(SCHEMA);
    const r = await db.query<{ id: string; payload: Record<string, unknown> }>(
      "select id, payload from public.user_docs where user_id = $1", [U]);
    expect(r.rows).toEqual([{ id: "sr_1", payload: { id: "sr_1", label: "Mélange" } }]);
    // L'id hors format n'est pas repris : le contrôle du README le compte.
    const nonRepris = await db.query<{ n: unknown }>(`select count(*) as n from public.saved_results s where not exists (
      select 1 from public.user_docs d where d.user_id = s.user_id and d.kind = 'resultat' and d.id = s.id)`);
    expect(Number(nonRepris.rows[0].n)).toBe(1);
    // L'étudiant supprime le résultat repris ; relancer le script ne le fait pas revenir.
    const [l] = await lire(U, null);
    await ecrire(U, "resultat", "sr_1", null, l.doc_rev, true);
    await db.exec(SCHEMA);
    const apres = await db.query<{ deleted: boolean }>("select deleted from public.user_docs where user_id = $1 and id = 'sr_1'", [U]);
    expect(apres.rows).toEqual([{ deleted: true }]);
  });
});

/* ── Le moteur contre le VRAI SQL ────────────────────────────────────────── */

const PERMANENTS = new Set(["42501", "23514", "53400", "22001", "23502", "22P02"]);

class TransportPglite implements Transport {
  constructor(private uid: string, private attendu: () => string) {}

  private erreur(e: unknown): ErreurSync {
    const code = (e as { code?: string }).code ?? "inconnu";
    if (code === "28000") return new ErreurSync("session", code);
    return new ErreurSync(PERMANENTS.has(code) ? "permanente" : "transitoire", code);
  }

  async lirePage(apres: Curseur | null, reculS: number, limite: number): Promise<LigneServeur[]> {
    try {
      const r = await comme<RepLecture>(this.uid,
        "select doc_kind, doc_id, doc_rev, maj_serveur::text as maj, supprime, contenu from public.lire_docs($1, $2::timestamptz, $3, $4, $5, $6)",
        [this.attendu(), apres?.maj ?? null, apres?.kind ?? null, apres?.id ?? null, reculS, limite]);
      return r.rows.map((x) => ({
        kind: x.doc_kind as LigneServeur["kind"], id: x.doc_id, rev: Number(x.doc_rev),
        maj: x.maj, supprime: x.supprime, contenu: x.contenu,
      }));
    } catch (e) { throw this.erreur(e); }
  }

  async ecrire(e: Envoi): Promise<ReponseEcriture> {
    let rows: Awaited<ReturnType<typeof ecrire>>;
    try {
      rows = await ecrire(this.uid, e.kind, e.id, e.supprime ? null : e.contenu, e.baseRev, e.supprime, this.attendu());
    } catch (err) { throw this.erreur(err); }
    const x = rows[0];
    if (!x) return { ok: false, ligne: null };
    if (x.ok) return { ok: true, rev: x.rev_serveur as number, maj: x.maj_serveur };
    return {
      ok: false,
      ligne: {
        kind: e.kind, id: e.id, rev: x.rev_serveur as number, maj: x.maj_serveur,
        supprime: x.supprime_serveur, contenu: x.contenu_serveur,
      },
    };
  }
}

class NavigateurReel {
  depot = new FauxDepot();
  etat: EtatSync;
  transport: TransportPglite;
  private n = 0;
  constructor(public nom: string, uid: string) {
    this.etat = { ...etatInitial(), uid };
    this.transport = new TransportPglite(uid, () => this.etat.uid ?? "");
  }
  ecrire(id: string) {
    const c = { id, titre: `${this.nom}-${++this.n}` };
    this.depot.docs.set(cleDoc("gachee", id), c);
    return c;
  }
  supprimer(id: string) {
    this.depot.docs.delete(cleDoc("gachee", id));
    this.etat = marquerSuppression(this.etat, "gachee", id);
  }
  async sync() {
    const r = await cycle(this.etat, this.transport, this.depot, {
      maintenant: () => "2026-09-28T12:00:00.000Z",
      alea: () => Math.random().toString(36).slice(2, 6),
      confirmerSuppressions: true,
    });
    this.etat = r.etat;
    return r;
  }
}

describe("moteur de synchronisation contre le vrai SQL", () => {
  it("deux navigateurs : création, conflit gardé en copie, suppression propagée", async () => {
    const U = "00000000-0000-4000-8000-0000000000d1";
    await creerCompte(U, "moteur@exemple.ca");
    const X = new NavigateurReel("X", U);
    const Y = new NavigateurReel("Y", U);
    X.ecrire("g1");
    expect((await X.sync()).erreur).toBeNull();
    await Y.sync();
    expect(Y.depot.docs.get("gachee:g1")).toEqual(X.depot.docs.get("gachee:g1"));
    const vx = X.ecrire("g1");
    Y.ecrire("g1");
    await X.sync();
    await Y.sync();
    expect(Y.depot.docs.get("gachee:g1")).toEqual(vx);
    expect([...Y.depot.docs.keys()].filter((k) => k.includes(".conflit."))).toHaveLength(1);
    Y.supprimer("g1");
    await Y.sync();
    await X.sync();
    expect(X.depot.docs.has("gachee:g1")).toBe(false);
    for (const n of [X, Y]) expect((await n.sync()).envoyes).toBe(0);
  });

  it("propriété : 3 navigateurs, 150 opérations aléatoires, convergence", async () => {
    const U = "00000000-0000-4000-8000-0000000000d2";
    await creerCompte(U, "propriete@exemple.ca");
    let a = 7;
    const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
    const navs = ["P", "Q", "R"].map((n) => new NavigateurReel(n, U));
    for (let pas = 0; pas < 150; pas++) {
      const nav = navs[Math.floor(rnd() * 3)];
      const x = rnd();
      if (x < 0.4) nav.ecrire(`g${Math.floor(rnd() * 6)}`);
      else if (x < 0.5) {
        const cles = [...nav.depot.docs.keys()];
        if (cles.length) nav.supprimer(cles[Math.floor(rnd() * cles.length)].slice("gachee:".length));
      } else await nav.sync();
    }
    for (let tour = 0; tour < 5; tour++) for (const nav of navs) await nav.sync();
    const enLigne = await db.query<{ id: string; payload: unknown }>(
      "select id, payload from public.user_docs where user_id = $1 and not deleted", [U]);
    const attendu = new Map(enLigne.rows.map((r) => [`gachee:${r.id}`, empreinte(r.payload)]));
    for (const nav of navs) {
      expect(new Map([...nav.depot.docs].map(([k, c]) => [k, empreinte(c)]))).toEqual(attendu);
      expect((await nav.sync()).envoyes).toBe(0);
    }
  }, 60000);
});
