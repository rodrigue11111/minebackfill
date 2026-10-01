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
import { contrainteKpa, type Eprouvette } from "./eprouvette";
import { essaiValide } from "./classe";
import { pseudonyme } from "./pseudonyme";

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
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz,
    banned_until timestamptz
  );
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade
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
    expect(Object.keys(gb.contenu).sort()).toEqual(["composants", "id", "parametres", "sessionId"]); // pesées : alertes de tolérance
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

describe("schema.sql — réponses et accusés de lecture", () => {
  // Comptes propres à ce bloc : les tests précédents dépendent de leur ordre.
  const E1 = "00000000-0000-4000-8000-0000000000f1";
  const E2 = "00000000-0000-4000-8000-0000000000f2";
  const ins = "insert into public.annotations (owner_id, target_kind, target_id, auteur_id, texte) values ($1, 'gachee', $2, $3, $4) returning id";
  const repondre = (uid: string, id: string, texte: string, attendu = uid) =>
    comme<{ annotation_id: string }>(uid, "select annotation_id from public.repondre_annotation($1, 'gachee', $2, 1, $3)", [attendu, id, texte]);
  const fil = (uid: string) => comme<{ annotation_id: string; texte: string | null; de_moi: boolean; lu_serveur: string | null; cree_serveur: string }>(
    uid, "select annotation_id, texte, de_moi, lu_serveur::text, cree_serveur::text from public.lire_fil_annotations($1, null, null, 0, 100)", [uid]);
  const marquer = (uid: string, ids: string[]) =>
    comme<{ annotation_id: string }>(uid, "select annotation_id from public.marquer_annotations_lues($1::uuid[])", [`{${ids.join(",")}}`]);
  let commentaire = "";
  let reponse = "";

  beforeAll(async () => {
    await creerCompte(E1, "e1@exemple.ca");
    await creerCompte(E2, "e2@exemple.ca");
    await ecrire(E1, "gachee", "g1", { id: "g1" }, null);
    await ecrire(E1, "gachee", "g2", { id: "g2" }, null);
  });

  it("répondre : seulement sur son document, après un commentaire de l'enseignant", async () => {
    await expect(repondre(E1, "g1", "Avant tout commentaire")).rejects.toMatchObject({ code: "42501" });
    commentaire = (await comme<{ id: string }>(PROF, ins, [E1, "g1", PROF, "Pourquoi 31 j ?"])).rows[0].id; // garde 42P17 : toujours accepté
    reponse = (await repondre(E1, "g1", "  La presse était en panne.  ")).rows[0].annotation_id;
    expect((await db.query<{ texte: string; auteur_id: string; ancre: string | null }>(
      "select texte, auteur_id, ancre from public.annotations where id = $1", [reponse])).rows[0])
      .toEqual({ texte: "La presse était en panne.", auteur_id: E1, ancre: null });
    await expect(repondre(E2, "g1", "Chez un autre")).rejects.toMatchObject({ code: "42501" });
    await expect(repondre(E1, "g2", "Pas de commentaire ici")).rejects.toMatchObject({ code: "42501" });
    await expect(repondre(E1, "g1", "   ")).rejects.toMatchObject({ code: "22023" });
    await expect(repondre(E1, "g1", "x", E2)).rejects.toMatchObject({ code: "28000" });
    await expect(comme(null, "select * from public.repondre_annotation($1, 'gachee', 'g1', 1, 'x')", [E1])).rejects.toMatchObject({ code: "42501" });
    // L'insertion directe reste refusée à l'étudiant (RLS).
    await expect(comme(E1, ins, [E1, "g1", E1, "direct"])).rejects.toMatchObject({ code: "42501" });
  });

  it("réponse ancrée : sous la note visée ; ancre inconnue ou trop longue refusée", async () => {
    await ecrire(E1, "gachee", "g4", { id: "g4" }, null);
    const insAncre = "insert into public.annotations (owner_id, target_kind, target_id, auteur_id, texte, ancre) values ($1, 'gachee', $2, $3, $4, $5) returning id";
    await comme(PROF, insAncre, [E1, "g4", PROF, "Liant à +8 %", "Pesée : Liant"]);
    const repondreAncre = (uid: string, id: string, texte: string, ancre: string | null) =>
      comme<{ annotation_id: string }>(uid, "select annotation_id from public.repondre_annotation_ancree($1, 'gachee', $2, 1, $3, $4)", [uid, id, texte, ancre]);
    const r = (await repondreAncre(E1, "g4", "Je repèse demain.", " Pesée : Liant ")).rows[0].annotation_id;
    expect((await db.query<{ ancre: string | null; auteur_id: string }>("select ancre, auteur_id from public.annotations where id = $1", [r])).rows[0])
      .toEqual({ ancre: "Pesée : Liant", auteur_id: E1 });
    // Ancre sans commentaire de l'enseignant : refusée (pas de réponse orpheline).
    await expect(repondreAncre(E1, "g4", "Ailleurs", "G-20260929-01-E02")).rejects.toMatchObject({ code: "42501" });
    await expect(repondreAncre(E1, "g4", "Trop long", "x".repeat(201))).rejects.toMatchObject({ code: "22023" });
    // Sans ancre : même comportement que repondre_annotation (fil général).
    const g = (await repondreAncre(E1, "g4", "Merci", null)).rows[0].annotation_id;
    expect((await db.query<{ ancre: string | null }>("select ancre from public.annotations where id = $1", [g])).rows[0].ancre).toBeNull();
    // Mêmes gardes que l'ancienne fonction.
    await expect(repondreAncre(E2, "g4", "Chez un autre", "Pesée : Liant")).rejects.toMatchObject({ code: "42501" });
    await expect(comme(null, "select * from public.repondre_annotation_ancree($1, 'gachee', 'g4', 1, 'x', null)", [E1])).rejects.toMatchObject({ code: "42501" });
    await expect(comme<{ annotation_id: string }>(E1, "select annotation_id from public.repondre_annotation_ancree($1, 'gachee', 'g4', 1, 'x', null)", [E2])).rejects.toMatchObject({ code: "28000" });
  });

  it("document supprimé : plus de réponse ; plafond de réponses", async () => {
    await ecrire(E1, "gachee", "g3", { id: "g3" }, null);
    await comme(PROF, ins, [E1, "g3", PROF, "Commentaire"]);
    await db.query("update public.user_docs set deleted = true where user_id = $1 and id = 'g3'", [E1]);
    await expect(repondre(E1, "g3", "Trop tard")).rejects.toMatchObject({ code: "42501" });
    await db.query(`insert into public.annotations (owner_id, target_kind, target_id, auteur_id, texte)
                    select $1, 'gachee', 'g2', $1, 'bourrage ' || i from generate_series(1, 500) i`, [E2]);
    await ecrire(E2, "gachee", "g9", { id: "g9" }, null);
    await comme(PROF, ins, [E2, "g9", PROF, "Commentaire"]);
    await expect(repondre(E2, "g9", "501e")).rejects.toMatchObject({ code: "53400" });
    await db.query("delete from public.annotations where owner_id = $1", [E2]);
  });

  it("fil : l'ancienne lecture ne voit jamais les réponses ; la nouvelle voit tout, avec l'auteur", async () => {
    const ancienne = await comme<{ annotation_id: string }>(E1, "select annotation_id from public.lire_annotations($1, null, null, 0, 100)", [E1]);
    expect(ancienne.rows.map((x) => x.annotation_id)).toContain(commentaire);
    expect(ancienne.rows.map((x) => x.annotation_id)).not.toContain(reponse);
    const f = (await fil(E1)).rows;
    expect(f.find((x) => x.annotation_id === commentaire)).toMatchObject({ de_moi: false, lu_serveur: null });
    expect(f.find((x) => x.annotation_id === reponse)).toMatchObject({ de_moi: true, lu_serveur: null });
  });

  it("accusés de lecture : posés par le destinataire seulement, jamais à la main", async () => {
    const maj = async (id: string) => (await db.query<{ m: string }>("select updated_at::text as m from public.annotations where id = $1", [id])).rows[0].m;
    // L'étudiant marque le commentaire de l'enseignant, pas sa propre réponse.
    const avant = await maj(commentaire);
    expect((await marquer(E1, [commentaire, reponse])).rows.map((x) => x.annotation_id)).toEqual([commentaire]);
    expect(await maj(commentaire) > avant).toBe(true); // l'accusé voyage par les curseurs
    // Un autre étudiant ne marque rien ; l'enseignant marque la réponse, pas son commentaire.
    expect((await marquer(E2, [commentaire, reponse])).rows).toEqual([]);
    expect((await comme<{ n: number }>(PROF, "select public.nb_reponses_non_lues() as n")).rows[0].n).toBeGreaterThanOrEqual(1);
    expect((await marquer(PROF, [commentaire, reponse])).rows.map((x) => x.annotation_id)).toEqual([reponse]);
    expect((await marquer(PROF, [reponse])).rows).toEqual([]); // déjà lu : l'accusé reste
    await expect(comme(E1, "select public.nb_reponses_non_lues()")).rejects.toMatchObject({ code: "42501" });
    // Personne ne pose l'accusé directement (droit de colonne).
    await expect(comme(PROF, "update public.annotations set lu_le = now() where id = $1", [commentaire])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(E1, "update public.annotations set lu_le = null where id = $1", [reponse])).rejects.toMatchObject({ code: "42501" });
    const f = (await fil(E1)).rows;
    expect(f.find((x) => x.annotation_id === reponse)!.lu_serveur).not.toBeNull();
    // Un texte modifié redevient non lu.
    await comme(PROF, "update public.annotations set texte = 'Pourquoi 31 j au lieu de 28 ?' where id = $1", [commentaire]);
    expect((await db.query<{ lu_le: string | null }>("select lu_le from public.annotations where id = $1", [commentaire])).rows[0].lu_le).toBeNull();
    await expect(comme(PROF, "select * from public.marquer_annotations_lues(array_fill(gen_random_uuid(), array[501]))")).rejects.toMatchObject({ code: "22023" });
  });

  it("retrait : l'étudiant retire SA réponse, rien d'autre ; l'enseignant ne retire pas la réponse", async () => {
    const retirer = (uid: string, id: string) => comme(uid, "update public.annotations set deleted = true where id = $1", [id]);
    expect((await retirer(PROF, reponse)).affectedRows).toBe(0);
    expect((await retirer(E1, commentaire)).affectedRows).toBe(0);
    expect((await retirer(E2, reponse)).affectedRows).toBe(0);
    expect((await retirer(E1, reponse)).affectedRows).toBe(1);
    expect((await fil(E1)).rows.find((x) => x.annotation_id === reponse)!.texte).toBeNull();
  });

  it("ré-exécution du schéma : colonne et droits de colonne intacts", async () => {
    await db.exec(SCHEMA);
    await expect(comme(PROF, "update public.annotations set lu_le = now() where id = $1", [commentaire])).rejects.toMatchObject({ code: "42501" });
    expect((await comme(PROF, "update public.annotations set deleted = false where id = $1", [commentaire])).affectedRows).toBe(1);
  });
});

describe("schema.sql — comptes (enseignant)", () => {
  // Comptes propres à ce bloc ; PROF n'y change jamais de rôle ni n'est bloqué.
  const K1 = "00000000-0000-4000-8000-0000000000f5";
  const K2 = "00000000-0000-4000-8000-0000000000f6";
  const P3 = "00000000-0000-4000-8000-0000000000f3";
  const P4 = "00000000-0000-4000-8000-0000000000f4";
  const role = async (id: string) => (await db.query<{ role: string }>("select role from public.profiles where id = $1", [id])).rows[0].role;
  const definir = (uid: string, compte: string, r: string) => comme(uid, "select public.definir_role($1, $2)", [compte, r]);
  const bloquer = (uid: string, compte: string, b: boolean) => comme(uid, "select public.bloquer_compte($1, $2)", [compte, b]);

  beforeAll(async () => {
    for (const [id, email] of [[K1, "k1@exemple.ca"], [K2, "k2@exemple.ca"], [P3, "p3@exemple.ca"], [P4, "p4@exemple.ca"]]) await creerCompte(id, email);
    await db.query("update public.profiles set role = 'prof' where id in ($1, $2)", [P3, P4]);
    await ecrire(K1, "gachee", "k1g", { id: "k1g" }, null);
    await ecrire(K1, "resultat", "k1r", { id: "k1r" }, null);
  });

  it("lister_comptes : réservé à l'enseignant ; comptes, rôles, volume de travail", async () => {
    const q = "select compte_id, courriel, compte_role, nb_resultats, nb_gachees, bloque_jusqu_a from public.lister_comptes()";
    await expect(comme(K1, q)).rejects.toMatchObject({ code: "42501" });
    await expect(comme(null, q)).rejects.toMatchObject({ code: "42501" });
    const r = await comme<{ compte_id: string; courriel: string; compte_role: string; nb_resultats: number; nb_gachees: number; bloque_jusqu_a: string | null }>(PROF, q);
    expect(r.rows.find((x) => x.compte_id === K1)).toMatchObject({ courriel: "k1@exemple.ca", compte_role: "etudiant", nb_resultats: 1, nb_gachees: 1, bloque_jusqu_a: null });
    expect(r.rows.find((x) => x.compte_id === P3)?.compte_role).toBe("prof");
    // auth.users reste invisible en direct.
    await expect(comme(PROF, "select id from auth.users")).rejects.toMatchObject({ code: "42501" });
  });

  it("definir_role : par un enseignant, jamais sur soi ; nommé, il lit la classe", async () => {
    await expect(definir(K2, K1, "prof")).rejects.toMatchObject({ code: "42501" }); // un étudiant ne nomme personne
    await expect(definir(K1, K1, "prof")).rejects.toMatchObject({ code: "42501" }); // ni lui-même
    await expect(definir(PROF, PROF, "etudiant")).rejects.toMatchObject({ code: "42501" }); // l'enseignant ne se retire pas
    await expect(definir(PROF, K1, "admin")).rejects.toMatchObject({ code: "22023" });
    await expect(definir(PROF, "00000000-0000-4000-8000-00000000dead", "prof")).rejects.toMatchObject({ code: "P0002" });
    await definir(PROF, K1, "prof");
    expect(await role(K1)).toBe("prof");
    await comme(K1, "select * from public.lire_docs_classe(null, null, null, null, 0, 10, false, null)");
    await definir(PROF, K1, "etudiant");
    expect(await role(K1)).toBe("etudiant");
    await expect(comme(K1, "select * from public.lire_docs_classe(null, null, null, null, 0, 10, false, null)")).rejects.toMatchObject({ code: "42501" });
  });

  it("deux enseignants : le premier retire l'autre, qui ne peut plus rien", async () => {
    await definir(P3, P4, "etudiant");
    await expect(definir(P4, P3, "etudiant")).rejects.toMatchObject({ code: "42501" });
    expect(await role(P3)).toBe("prof");
  });

  it("bloquer_compte : connexion refusée (ban fini), sessions supprimées, réversible", async () => {
    await db.query("insert into auth.sessions (user_id) values ($1), ($1)", [K2]);
    await expect(bloquer(K1, K2, true)).rejects.toMatchObject({ code: "42501" }); // un étudiant ne bloque pas
    await expect(bloquer(PROF, PROF, true)).rejects.toMatchObject({ code: "42501" }); // pas soi-même
    await expect(bloquer(PROF, P3, true)).rejects.toMatchObject({ code: "42501" }); // pas un enseignant
    await bloquer(PROF, K2, true);
    const u = (await db.query<{ ok: boolean; fini: boolean }>(
      "select banned_until > now() + interval '99 years' as ok, isfinite(banned_until) as fini from auth.users where id = $1", [K2])).rows[0];
    expect(u).toEqual({ ok: true, fini: true });
    expect((await db.query("select 1 from auth.sessions where user_id = $1", [K2])).rows).toHaveLength(0);
    const liste = await comme<{ compte_id: string; bloque_jusqu_a: string | null }>(PROF, "select compte_id, bloque_jusqu_a from public.lister_comptes()");
    expect(liste.rows.find((x) => x.compte_id === K2)!.bloque_jusqu_a).not.toBeNull();
    await expect(definir(PROF, K2, "prof")).rejects.toMatchObject({ code: "22023" }); // bloqué : pas de promotion
    await bloquer(PROF, K2, false);
    expect((await db.query<{ b: string | null }>("select banned_until as b from auth.users where id = $1", [K2])).rows[0].b).toBeNull();
    await expect(bloquer(PROF, "00000000-0000-4000-8000-00000000dead", true)).rejects.toMatchObject({ code: "P0002" });
  });
});

describe("schema.sql — revues de l'enseignant", () => {
  // Comptes propres à ce bloc ; PROF n'y change jamais de rôle.
  const R1 = "00000000-0000-4000-8000-0000000000a1";
  const R2 = "00000000-0000-4000-8000-0000000000a2";
  const poser = (uid: string | null, owner: string, id: string, decision: string, motif: string | null, ecartees: string[] = [], rev: number | null = 1) =>
    comme<{ maj_serveur: string }>(uid, "select maj_serveur::text from public.poser_revue($1, 'gachee', $2, $3, $4, $5, $6::text[])",
      [owner, id, rev, decision, motif, `{${ecartees.map((e) => `"${e}"`).join(",")}}`]);
  const retirer = (uid: string, owner: string, id: string) =>
    comme<{ r: boolean }>(uid, "select public.retirer_revue($1, 'gachee', $2) as r", [owner, id]);
  const mes = (uid: string, attendu = uid) =>
    comme<{ cible_id: string; cible_rev: string | null; decision_revue: string; motif_revue: string | null; ecartees_revue: string[] }>(
      uid, "select cible_id, cible_rev::text, decision_revue, motif_revue, ecartees_revue from public.lire_mes_revues($1)", [attendu]);
  const ligne = async (owner: string, id: string) => (await db.query<{ decision: string; motif: string | null; deleted: boolean; target_rev: string; ecartees: string[]; created_at: string; updated_at: string }>(
    "select decision, motif, deleted, target_rev::text, ecartees, created_at::text, updated_at::text from public.revues where owner_id = $1 and target_id = $2", [owner, id])).rows;

  beforeAll(async () => {
    await creerCompte(R1, "r1@exemple.ca");
    await creerCompte(R2, "r2@exemple.ca");
    await ecrire(R1, "gachee", "rg1", { id: "rg1" }, null);
    await ecrire(R1, "gachee", "rg2", { id: "rg2" }, null);
    await ecrire(R2, "gachee", "rg9", { id: "rg9" }, null);
  });

  it("l'enseignant accepte puis refuse : une seule ligne, motif nettoyé, éprouvettes écartées", async () => {
    await poser(PROF, R1, "rg1", "acceptee", null, [], 3);
    const [a] = await ligne(R1, "rg1");
    expect(a).toMatchObject({ decision: "acceptee", motif: null, deleted: false, target_rev: "3", ecartees: [] });
    await poser(PROF, R1, "rg1", "refusee", "  Pesées incomplètes.  ", ["e1", "e2"], 4);
    const lignes = await ligne(R1, "rg1");
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ decision: "refusee", motif: "Pesées incomplètes.", target_rev: "4", ecartees: ["e1", "e2"] });
    expect(lignes[0].updated_at > a.updated_at).toBe(true);
    expect(lignes[0].created_at).toBe(a.created_at);
  });

  it("contrôles : refus sans motif, décision inconnue, document absent ou supprimé, bornes", async () => {
    await expect(poser(PROF, R1, "rg2", "refusee", "   ")).rejects.toMatchObject({ code: "22023" });
    await expect(poser(PROF, R1, "rg2", "peut-etre", null)).rejects.toMatchObject({ code: "22023" });
    await expect(poser(PROF, R1, "inconnue", "acceptee", null)).rejects.toMatchObject({ code: "P0002" });
    await expect(poser(PROF, R2, "rg1", "acceptee", null)).rejects.toMatchObject({ code: "P0002" }); // le document de R1, pas de R2
    await expect(poser(PROF, R1, "rg2", "refusee", "x".repeat(2001))).rejects.toMatchObject({ code: "22023" });
    await expect(poser(PROF, R1, "rg2", "acceptee", null, Array.from({ length: 201 }, (_, i) => `e${i}`))).rejects.toMatchObject({ code: "22023" });
    await expect(poser(PROF, R1, "rg2", "acceptee", null, [""])).rejects.toMatchObject({ code: "22023" });
    await ecrire(R1, "gachee", "rg3", { id: "rg3" }, null);
    await db.query("update public.user_docs set deleted = true where user_id = $1 and id = 'rg3'", [R1]);
    await expect(poser(PROF, R1, "rg3", "acceptee", null)).rejects.toMatchObject({ code: "P0002" });
    expect(await ligne(R1, "rg2")).toEqual([]);
  });

  it("seul l'enseignant décide ; personne n'écrit dans la table directement", async () => {
    await expect(poser(R1, R1, "rg2", "acceptee", null)).rejects.toMatchObject({ code: "42501" });
    await expect(poser(R2, R1, "rg2", "acceptee", null)).rejects.toMatchObject({ code: "42501" });
    await expect(poser(null, R1, "rg2", "acceptee", null)).rejects.toMatchObject({ code: "42501" });
    const ins = "insert into public.revues (owner_id, target_kind, target_id, decision, reviewer_id) values ($1, 'gachee', 'rg2', 'acceptee', $2)";
    await expect(comme(PROF, ins, [R1, PROF])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(R1, ins, [R1, R1])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(PROF, "update public.revues set decision = 'acceptee' where owner_id = $1", [R1])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(R1, "update public.revues set motif = null where owner_id = $1", [R1])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(PROF, "delete from public.revues where owner_id = $1", [R1])).rejects.toMatchObject({ code: "42501" });
    await expect(comme(null, "select * from public.revues")).rejects.toMatchObject({ code: "42501" });
  });

  it("lecture : l'étudiant les siennes seulement, l'enseignant toutes ; session vérifiée", async () => {
    await poser(PROF, R2, "rg9", "acceptee", "Très bien documentée.");
    const r1 = (await mes(R1)).rows;
    expect(r1).toEqual([{ cible_id: "rg1", cible_rev: "4", decision_revue: "refusee", motif_revue: "Pesées incomplètes.", ecartees_revue: ["e1", "e2"] }]);
    expect((await mes(R2)).rows.map((x) => x.cible_id)).toEqual(["rg9"]);
    await expect(mes(R1, R2)).rejects.toMatchObject({ code: "28000" });
    await expect(comme(null, "select * from public.lire_mes_revues($1)", [R1])).rejects.toMatchObject({ code: "42501" });
    // Lecture directe : la RLS ne montre à l'étudiant que les siennes.
    expect((await comme<{ target_id: string }>(R1, "select target_id from public.revues")).rows.map((x) => x.target_id)).toEqual(["rg1"]);
    const prof = (await comme<{ target_id: string }>(PROF, "select target_id from public.revues order by target_id")).rows.map((x) => x.target_id);
    expect(prof).toEqual(expect.arrayContaining(["rg1", "rg9"]));
  });

  it("retrait : l'enseignant seulement ; l'étudiant ne la voit plus ; une nouvelle décision la rétablit", async () => {
    await expect(retirer(R1, R1, "rg1")).rejects.toMatchObject({ code: "42501" });
    expect((await retirer(PROF, R1, "rg1")).rows[0].r).toBe(true);
    expect((await retirer(PROF, R1, "rg1")).rows[0].r).toBe(false); // déjà retirée
    expect((await ligne(R1, "rg1"))[0].deleted).toBe(true);
    expect((await mes(R1)).rows).toEqual([]);
    await poser(PROF, R1, "rg1", "acceptee", null, [], 5);
    expect((await mes(R1)).rows).toMatchObject([{ cible_id: "rg1", decision_revue: "acceptee", motif_revue: null }]);
  });

  it("ré-exécution du schéma : décisions et droits intacts", async () => {
    await db.exec(SCHEMA);
    expect((await mes(R1)).rows.map((x) => x.decision_revue)).toEqual(["acceptee"]);
    await expect(comme(PROF, "update public.revues set decision = 'refusee' where owner_id = $1", [R1])).rejects.toMatchObject({ code: "42501" });
    await expect(poser(R1, R1, "rg2", "acceptee", null)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("schema.sql — courbes en ligne et leur nettoyage", () => {
  // Comptes propres à ce bloc.
  const C1 = "00000000-0000-4000-8000-0000000000b1";
  const C2 = "00000000-0000-4000-8000-0000000000b2";
  const courbe = (id: string, g: string) => ({ v: 1, eprouvetteId: id, gacheeId: g, t: [0, 1], f: [0, 10], d: [0, 0.1], s: [0, 5], e: [0, 0.1] });
  const vieillir = async (uid: string, ids: string[]) => {
    await db.exec("alter table public.user_docs disable trigger user_docs_normaliser");
    await db.query("update public.user_docs set updated_at = now() - interval '2 hours' where user_id = $1 and kind = 'courbe' and id = any($2)", [uid, ids]);
    await db.exec("alter table public.user_docs enable trigger user_docs_normaliser");
  };
  const etat = async (uid: string, id: string) => (await db.query<{ deleted: boolean; vide: boolean }>(
    "select deleted, payload is null as vide from public.user_docs where user_id = $1 and kind = 'courbe' and id = $2", [uid, id])).rows[0];
  const purger = (uid: string | null, attendu: string) => comme<{ n: number }>(uid, "select public.purger_mes_courbes($1) as n", [attendu]);

  beforeAll(async () => {
    await creerCompte(C1, "c1@exemple.ca");
    await creerCompte(C2, "c2@exemple.ca");
  });

  it("une courbe s'écrit comme un document ; jamais relue par la synchronisation", async () => {
    await ecrire(C1, "gachee", "cg1", { id: "cg1", eprouvettes: [{ id: "ep-1" }, { id: "ep-2" }] }, null);
    for (const id of ["ep-1", "ep-2", "ep-orpheline", "ep-recente"]) {
      expect((await ecrire(C1, "courbe", id, courbe(id, "cg1"), null))[0].ok).toBe(true);
    }
    expect((await ecrire(C2, "courbe", "ep-autre", courbe("ep-autre", "x"), null))[0].ok).toBe(true);
    expect((await lire(C1, null)).map((x) => x.doc_kind)).not.toContain("courbe");
    // Déjà en ligne : la création est refusée et la ligne serveur est rendue (réponse perdue).
    const r = await ecrire(C1, "courbe", "ep-1", courbe("ep-1", "cg1"), null);
    expect(r[0]).toMatchObject({ ok: false });
    expect(r[0].contenu_serveur).toMatchObject({ eprouvetteId: "ep-1" });
  });

  it("purge : orpheline ancienne retirée ; récente, référencée ou d'un autre compte, gardée", async () => {
    await vieillir(C1, ["ep-1", "ep-2", "ep-orpheline"]);
    await vieillir(C2, ["ep-autre"]);
    expect((await purger(C1, C1)).rows[0].n).toBe(1);
    expect(await etat(C1, "ep-orpheline")).toEqual({ deleted: true, vide: true });
    expect(await etat(C1, "ep-1")).toEqual({ deleted: false, vide: false });
    expect(await etat(C1, "ep-recente")).toEqual({ deleted: false, vide: false }); // moins d'une heure
    expect(await etat(C2, "ep-autre")).toEqual({ deleted: false, vide: false });
    expect((await purger(C1, C1)).rows[0].n).toBe(0); // rien de plus
  });

  it("gâchée supprimée : ses courbes deviennent orphelines ; une copie de conflit les garde", async () => {
    await ecrire(C1, "gachee", "cg1-conflit", { id: "cg1-conflit", conflit: { de: "cg1" }, eprouvettes: [{ id: "ep-2" }] }, null);
    const [g] = (await lire(C1, null)).filter((x) => x.doc_id === "cg1");
    await ecrire(C1, "gachee", "cg1", null, g.doc_rev, true);
    await vieillir(C1, ["ep-1", "ep-2"]);
    expect((await purger(C1, C1)).rows[0].n).toBe(1);
    expect((await etat(C1, "ep-1")).deleted).toBe(true);
    expect((await etat(C1, "ep-2")).deleted).toBe(false); // encore dans la copie de conflit
  });

  it("gardes : session vérifiée, anonyme refusé, l'enseignant ne purge que les siennes", async () => {
    await expect(purger(C1, C2)).rejects.toMatchObject({ code: "28000" });
    await expect(purger(null, C1)).rejects.toMatchObject({ code: "42501" });
    expect((await purger(PROF, PROF)).rows[0].n).toBe(0);
    expect(await etat(C2, "ep-autre")).toEqual({ deleted: false, vide: false });
  });
});

describe("schema.sql — accès direct : vues pseudonymisées des essais", () => {
  // Comptes propres à ce bloc.
  const V1 = "00000000-0000-4000-8000-0000000000c4";
  const V2 = "00000000-0000-4000-8000-0000000000c5";
  const presse = { fichier: "p.xlsx", echantillon: "1", importeLe: "2026-09-17T12:00:00Z" };
  const eprouvettes: Eprouvette[] = [
    { id: "v-e1", code: "G-1-E01", couleLe: "2026-09-10T12:00:00Z", ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 410, sourcePresse: presse } },
    { id: "v-e2", code: "G-1-E02", couleLe: "2026-09-10T12:00:00Z", ageJours: 7, statut: "ecrase", essai: { chargeKn: 1.2345, diametreMm: 50 } },
    { id: "v-e3", code: "G-1-E03", couleLe: "2026-09-10T12:00:00Z", ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 0, chargeKn: 1, diametreMm: 76.2 } },
    { id: "v-e4", code: "G-1-E04", couleLe: "2026-09-10T12:00:00Z", ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: 900, exclu: true, justificationExclusion: "fissure" } },
    { id: "v-e5", code: "G-1-E05", couleLe: "2026-09-10T12:00:00Z", ageJours: 28, statut: "en_cure", essai: { contrainteKpaSaisie: 500 } },
    { id: "v-e6", code: "G-1-E06", couleLe: "pas une date", ageJours: 28, statut: "ecrase", essai: { chargeKn: "12" as unknown as number, diametreMm: 50 } },
  ];
  const recette = (cw: number) => ({ solids_mass_pct: cw, wc_ratio: 7.1, bw_mass_pct: 5, w_mass_pct: 33.3 });
  const g1 = { id: "vg1", code: "G-1", creeLe: "2026-09-10T12:00:00Z", statut: "terminee", categorie: "RPC", sessionId: "S1",
    formulationId: "vr1", recetteIndex: 1, materiaux: { residu: { id: "res_laronde", nom: "Résidus LaRonde" } },
    cure: { mode: "chambre_humide", temperatureC: 23 }, eprouvettes };
  const essais = (uid: string | null) => comme<Record<string, unknown>>(uid,
    "select operateur, gachee_code, eprouvette_ref, ucs_kpa, ucs_source, retenu, exclu, statut, cw_pct, revue, revue_perimee, eprouvette_ecartee, courbe_en_ligne, coulee_le, charge_kn from public.vue_essais order by eprouvette_ref");
  const gachees = (uid: string | null) => comme<{ operateur: string; gachee_ref: string; cw_pct: number | null; revue: string | null; revue_perimee: boolean | null }>(uid,
    "select operateur, gachee_ref, cw_pct, revue, revue_perimee from public.vue_gachees order by gachee_ref");

  beforeAll(async () => {
    await creerCompte(V1, "v1@exemple.ca");
    await creerCompte(V2, "v2@exemple.ca");
    await ecrire(V1, "resultat", "vr1", { id: "vr1", recipes: [recette(75), recette(76)] }, null);
    await ecrire(V1, "gachee", "vg1", g1, null);
    await ecrire(V1, "gachee", "vg2", { id: "vg2", code: "G-2", statut: "brouillon", categorie: "RPC", parametres: { cwPct: 70 }, eprouvettes: [] }, null);
    await ecrire(V1, "gachee", "vg2c", { id: "vg2c", code: "G-2", conflit: { de: "vg2" }, eprouvettes: [] }, null);
    await ecrire(V2, "gachee", "vg9", { id: "vg9", code: "G-9", statut: "terminee", categorie: "RPG", eprouvettes: [] }, null);
    await ecrire(V1, "courbe", "v-e1", { v: 1, eprouvetteId: "v-e1", gacheeId: "vg1", t: [], f: [], d: [], s: [], e: [] }, null);
  });

  it("pseudonymes : même règle qu'au site ; aucun identifiant de compte exposé", async () => {
    const r = (await comme<{ p: string }>(V1, "select public.pseudonyme($1) as p", [V1])).rows[0].p;
    expect(r).toBe(await pseudonyme(V1));
    const colonnes = (await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name in ('vue_gachees', 'vue_essais')")).rows.map((x) => x.column_name);
    expect(colonnes).not.toContain("user_id");
    expect(colonnes).not.toContain("owner_id");
  });

  it("chacun ses lignes (RLS de qui lit) ; l'enseignant toute la classe ; l'anonyme rien ; copies de conflit exclues", async () => {
    expect((await gachees(V1)).rows.map((x) => x.gachee_ref)).toEqual(["vg1", "vg2"]);
    expect((await gachees(V2)).rows.map((x) => x.gachee_ref)).toEqual(["vg9"]);
    const prof = (await gachees(PROF)).rows.map((x) => x.gachee_ref);
    expect(prof).toEqual(expect.arrayContaining(["vg1", "vg2", "vg9"]));
    expect(prof).not.toContain("vg2c");
    await expect(gachees(null)).rejects.toMatchObject({ code: "42501" });
    await expect(essais(null)).rejects.toMatchObject({ code: "42501" });
    expect((await essais(V2)).rows).toEqual([]);
  });

  it("UCS et essai retenu : exactement contrainteKpa et essaiValide du site", async () => {
    const lignes = new Map((await essais(V1)).rows.map((x) => [x.eprouvette_ref as string, x]));
    // v-e6 (charge saisie en texte) est à part : la vue, plus stricte que le
    // site, ne convertit pas un texte en nombre.
    for (const e of eprouvettes.filter((x) => x.id !== "v-e6")) {
      const l = lignes.get(e.id)!;
      const attendu = e.statut === "ecrase" ? contrainteKpa(e.essai) : null;
      if (attendu === null) expect(l.ucs_kpa, e.code).toBeNull();
      else expect(l.ucs_kpa as number, e.code).toBeCloseTo(attendu, 9);
      expect(l.retenu, e.code).toBe(essaiValide(e));
    }
    expect(lignes.get("v-e1")).toMatchObject({ ucs_source: "presse", courbe_en_ligne: true });
    expect(lignes.get("v-e2")).toMatchObject({ ucs_source: "calcul_fa", courbe_en_ligne: false });
    expect(lignes.get("v-e3")!.ucs_source).toBe("calcul_fa"); // contrainte directe nulle : F / A
    expect(lignes.get("v-e4")).toMatchObject({ exclu: true, retenu: false });
    expect(lignes.get("v-e5")).toMatchObject({ ucs_kpa: null, statut: "en_cure" });
    // Valeur mal typée (texte) ou date illisible : null, jamais une erreur.
    expect(lignes.get("v-e6")).toMatchObject({ ucs_kpa: null, charge_kn: null, coulee_le: null });
  });

  it("paramètres : instantané de la gâchée, sinon recette de la formulation d'origine", async () => {
    const g = new Map((await gachees(V1)).rows.map((x) => [x.gachee_ref, x.cw_pct]));
    expect(g.get("vg1")).toBe(76); // recetteIndex 1 de vr1
    expect(g.get("vg2")).toBe(70); // instantané
  });

  it("revue de l'enseignant : décision, éprouvette écartée, « modifiée depuis »", async () => {
    const rev = (await lire(V1, null)).find((x) => x.doc_id === "vg1")!.doc_rev;
    await comme(PROF, "select * from public.poser_revue($1, 'gachee', 'vg1', $2, 'acceptee', null, $3::text[])", [V1, rev, "{v-e2}"]);
    let l = new Map((await essais(V1)).rows.map((x) => [x.eprouvette_ref as string, x]));
    expect(l.get("v-e2")).toMatchObject({ revue: "acceptee", revue_perimee: false, eprouvette_ecartee: true });
    expect(l.get("v-e1")!.eprouvette_ecartee).toBe(false);
    await ecrire(V1, "gachee", "vg1", { ...g1, statut: "brouillon" }, rev);
    l = new Map((await essais(V1)).rows.map((x) => [x.eprouvette_ref as string, x]));
    expect(l.get("v-e1")!.revue_perimee).toBe(true);
    expect((await gachees(V1)).rows.find((x) => x.gachee_ref === "vg2")).toMatchObject({ revue: null, revue_perimee: null });
  });

  it("exporter_essais : réservé à l'enseignant, filtre de session ; vues en lecture seule", async () => {
    await expect(comme(V1, "select * from public.exporter_essais(null)")).rejects.toMatchObject({ code: "42501" });
    const s1 = (await comme<{ gachee_code: string }>(PROF, "select gachee_code from public.exporter_essais('S1')")).rows;
    expect(s1.length).toBe(eprouvettes.length);
    expect(s1.every((x) => x.gachee_code === "G-1")).toBe(true);
    expect((await comme<{ n: string }>(PROF, "select count(*)::text as n from public.exporter_essais(null)")).rows[0].n)
      .toBe(String((await comme<{ n: string }>(PROF, "select count(*)::text as n from public.vue_essais")).rows[0].n));
    // Refusé deux fois : vue non modifiable, et aucun droit d'insertion.
    await expect(comme(PROF, "insert into public.vue_gachees (gachee_code) values ('x')")).rejects.toThrow(/cannot insert into view|permission denied/);
    expect((await comme<{ v: number | null }>(V1, "select public.jsonb_num('\"12\"'::jsonb) as v")).rows[0].v).toBeNull();
    expect((await comme<{ v: string | null }>(V1, "select public.jsonb_ts('\"demain\"'::jsonb) as v")).rows[0].v).toBeNull();
  });
});
