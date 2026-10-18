import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agesClasse, avecFormulationsDeToutesSessions, eprouvettesAvecCourbe, essaiValide, exportClasse, fusionnerLignes, gacheesRetenues, nomEtudiant, nuageClasse,
  regrouper, remplacerLigne,
  type LigneClasse, type ProfilClasse,
} from "./classe";
import { annotationsDe, fusionnerAnnotations, migrerAnnotationV1, nonLuesDeLEnseignant, type Annotation } from "./annotations";
import {
  ErreurClasse, lireAnnotationsClasse, lireClasse, lireComptes, lireCourbe, lireCourbesClasse, lireDocComplet, lireMesAnnotations, messageErreurClasse, repondreAnnotation, retirerAnnotation,
} from "./classe-reseau";
import { confirmationAction } from "@/components/classe/OngletComptes";
import type { Eprouvette } from "./eprouvette";

const A = "aaaaaaaa-0000", B = "bbbbbbbb-0000", P = "pppppppp-0000";
const profils: ProfilClasse[] = [
  { id: A, email: "a@x.ca", display_name: "Alice Tremblay", role: "etudiant" },
  { id: B, email: "b@x.ca", display_name: null, role: "etudiant" },
  { id: P, email: "prof@x.ca", display_name: "Prof", role: "prof" },
  { id: "c", email: null, display_name: null, role: "etudiant" },
];

// Gâchée minimale : éprouvettes écrasées à 28 j, paramètres de formulation figés.
function gachee(id: string, bw: number, kpa: number[], extra: Record<string, unknown> = {}) {
  return {
    id, code: `G-${id}`, creeLe: "2026-10-01T12:00:00.000Z", statut: "terminee", formulationLabel: "M", categorie: "RPC",
    recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [],
    parametres: { cwPct: 75, wcRatio: 7, bwPct: bw, wPct: 33 },
    eprouvettes: kpa.map((k, i) => ({ id: `${id}-e${i}`, code: `G-${id}-E0${i}`, couleLe: "2026-10-01T12:00:00.000Z", ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: k } })),
    ...extra,
  };
}

function ligne(proprietaire: string, kind: "resultat" | "gachee", contenu: { id: string }, p: Partial<LigneClasse> = {}): LigneClasse {
  return { proprietaire, kind, id: contenu.id, rev: 1, maj: "2026-10-02T10:00:00.000000+00:00", cree: "x", supprime: false, contenu, ...p };
}

describe("classe — regroupement", () => {
  it("tous les étudiants apparaissent, même sans document ; le prof et les suppressions non", () => {
    const l = [
      ligne(A, "gachee", gachee("g1", 5, [400, 420])),
      ligne(A, "resultat", { id: "r1", savedAt: "2026-10-01T12:00:00Z", recipes: [] } as never),
      ligne(B, "gachee", gachee("g2", 7, [600]), { supprime: true, contenu: null }),
      ligne(P, "gachee", gachee("gp", 5, [1])),
    ];
    const e = regrouper(l, profils, [], "toutes");
    expect(e.map((x) => x.nom)).toEqual(["Alice Tremblay", "b@x.ca", "Compte c"]);
    expect(e[0]).toMatchObject({ nbEssais: 2 });
    expect(e[0].resultats).toHaveLength(1);
    expect(e[1].gachees).toHaveLength(0);
  });

  it("filtre de session appliqué aux documents", () => {
    const sessions = [{ id: "A2026", nom: "Automne 2026", debut: "2026-09-01", fin: "2026-12-23" }];
    const l = [
      ligne(A, "gachee", gachee("g1", 5, [400])),
      ligne(A, "gachee", gachee("g0", 5, [400], { creeLe: "2026-07-15T12:00:00.000Z" })),
    ];
    expect(regrouper(l, profils, sessions, "A2026")[0].gachees.map((g) => g.id)).toEqual(["g1"]);
    expect(regrouper(l, profils, sessions, "sans")[0].gachees.map((g) => g.id)).toEqual(["g0"]);
  });

  it("une seule règle de comptage : écrasée, mesurée, non exclue ; copies de conflit à part", () => {
    const ep = (p: Partial<Eprouvette>): Eprouvette => ({ id: "e", code: "E", couleLe: "x", ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 500 }, ...p });
    expect(essaiValide(ep({}))).toBe(true);
    expect(essaiValide(ep({ statut: "en_cure" }))).toBe(false); // remise en cure : l'essai reste, hors statistiques
    expect(essaiValide(ep({ essai: { contrainteKpaSaisie: 500, exclu: true } }))).toBe(false);
    expect(essaiValide(ep({ essai: {} }))).toBe(false);

    const g = gachee("g1", 5, [400, 420]);
    g.eprouvettes.push({ id: "g1-e9", code: "G-g1-E09", couleLe: "2026-10-01T12:00:00.000Z", ageJours: 7, statut: "ecrase", essai: { contrainteKpaSaisie: 1, exclu: true } } as never);
    const copie = gachee("g1c", 5, [400, 420], { conflit: { de: "g1", le: "2026-10-03T00:00:00Z" } });
    const [e] = regrouper([ligne(A, "gachee", g), ligne(A, "gachee", copie)], profils, [], "toutes");
    expect(e.gachees).toHaveLength(2); // la copie reste visible dans le détail…
    expect(gacheesRetenues(e).map((x) => x.id)).toEqual(["g1"]); // … mais ne compte pas
    expect(e.nbEssais).toBe(2);
    expect(agesClasse([e])).toEqual([28]); // 7 j n'a qu'un essai exclu : pas d'âge à proposer
  });

  it("documents allégés normalisés : jamais de tableau manquant", () => {
    const leger = { id: "gl", code: "G-gl", creeLe: "2026-10-01T12:00:00.000Z", categorie: "RPC" };
    const [e] = regrouper([ligne(A, "gachee", leger)], profils, [], "toutes");
    expect(e.gachees[0]).toMatchObject({ composants: [], eprouvettes: [], ajustements: [] });
  });

  it("lectures répétées : la révision la plus haute gagne", () => {
    let m = fusionnerLignes(new Map(), [ligne(A, "gachee", gachee("g1", 5, [1]), { rev: 3 })]);
    m = fusionnerLignes(m, [ligne(A, "gachee", gachee("g1", 6, [1]), { rev: 2 })]);
    expect((m.get(`${A}|gachee|g1`)!.contenu as { parametres: { bwPct: number } }).parametres.bwPct).toBe(5);
  });

  it("nom : nom affiché, sinon courriel, sinon début d'identifiant", () => {
    expect(nomEtudiant(profils[0], A)).toBe("Alice Tremblay");
    expect(nomEtudiant(undefined, "12345678-abcd")).toBe("Compte 12345678");
  });
});

describe("classe — figure", () => {
  it("un point par gâchée, étudiant par étudiant ; copies de conflit exclues", () => {
    const l = [
      ligne(A, "gachee", gachee("g1", 5, [400, 420])),
      ligne(A, "gachee", gachee("g1.conflit.x", 5, [999], { conflit: { de: "g1", le: "x" } })),
      // Même id de gâchée chez B : aucune confusion possible.
      ligne(B, "gachee", gachee("g1", 7, [600])),
    ];
    const e = regrouper(l, profils, [], "toutes");
    const n = nuageClasse(e, "bwPct", 28);
    expect(n.points.map((p) => [p.etudiant, p.x, p.moyenneKpa])).toEqual([["Alice Tremblay", 5, 410], ["b@x.ca", 7, 600]]);
    expect(new Set(n.points.map((p) => p.id)).size).toBe(2);
    expect(agesClasse(e)).toEqual([28]);
  });

  it("export : structure versionnée, un bloc par étudiant", () => {
    const e = regrouper([ligne(A, "gachee", gachee("g1", 5, [1]))], profils, [], "toutes");
    const x = exportClasse(e, "toutes", new Date("2026-10-03T00:00:00Z")) as { type: string; version: number; etudiants: unknown[] };
    expect(x.type).toBe("export-classe");
    expect(x.version).toBe(1);
    expect(x.etudiants).toHaveLength(3);
  });
});

describe("annotations — fusion", () => {
  const a = (id: string, maj: string, p: Partial<Annotation> = {}): Annotation =>
    ({ id, cibleKind: "gachee", cibleId: "g1", cibleRev: 1, ancre: null, texte: "t", supprime: false, maj, auteur: "enseignant", creeLe: maj, luLe: null, ...p });

  it("la version la plus récente gagne ; une annotation retirée disparaît", () => {
    let l = fusionnerAnnotations([], [a("1", "2026-10-01"), a("2", "2026-10-02")]);
    l = fusionnerAnnotations(l, [a("1", "2026-10-03", { texte: "modifié" }), a("2", "2026-10-04", { supprime: true, texte: null })]);
    expect(l.map((x) => [x.id, x.texte])).toEqual([["1", "modifié"]]);
    expect(annotationsDe(l, "gachee", "g1")).toHaveLength(1);
    expect(annotationsDe(l, "resultat", "g1")).toHaveLength(0);
  });
});

describe("annotations — fil, lecture, migration", () => {
  const a = (id: string, p: Partial<Annotation> = {}): Annotation =>
    ({ id, cibleKind: "gachee", cibleId: "g1", cibleRev: 1, ancre: null, texte: "t", supprime: false, maj: "2026-10-01", auteur: "enseignant", creeLe: "2026-10-01", luLe: null, ...p });

  it("le fil suit la CRÉATION : un message lu (maj qui bouge) ne change pas de place", () => {
    const l = fusionnerAnnotations([], [
      a("q", { creeLe: "2026-10-01", maj: "2026-10-05" }), // lu le 5 : maj a bougé
      a("r", { creeLe: "2026-10-02", maj: "2026-10-02", auteur: "moi" }),
    ]);
    expect(l.map((x) => x.id)).toEqual(["q", "r"]);
  });

  it("non lus : commentaires de l'enseignant sur des documents présents ici seulement", () => {
    const toutes = [a("1"), a("2", { luLe: "2026-10-02" }), a("3", { auteur: "moi" }), a("4", { cibleId: "disparu" })];
    expect(nonLuesDeLEnseignant(toutes, (_k, id) => id !== "disparu").map((x) => x.id)).toEqual(["1"]);
  });

  it("migration v1 : l'enseignant était le seul auteur ; les champs déjà là restent", () => {
    const v1 = { id: "1", cibleKind: "gachee" as const, cibleId: "g1", cibleRev: null, ancre: null, texte: "t", supprime: false, maj: "m" };
    expect(migrerAnnotationV1(v1)).toMatchObject({ auteur: "enseignant", creeLe: "m", luLe: null });
    expect(migrerAnnotationV1({ ...v1, auteur: "moi", creeLe: "c", luLe: "l" })).toMatchObject({ auteur: "moi", creeLe: "c", luLe: "l" });
  });
});

/* ── Réseau (faux client) ────────────────────────────────────────────────── */

function clientRpc(pages: Record<string, unknown[][]>, erreur?: { code: string; message: string }) {
  const appels: { fn: string; params: Record<string, unknown> }[] = [];
  const compteurs: Record<string, number> = {};
  const sb = {
    rpc(fn: string, params: Record<string, unknown>) {
      appels.push({ fn, params });
      if (erreur) return Promise.resolve({ data: null, error: erreur });
      const i = compteurs[fn] = (compteurs[fn] ?? -1) + 1;
      return Promise.resolve({ data: pages[fn]?.[i] ?? [], error: null });
    },
  } as unknown as SupabaseClient;
  return { sb, appels };
}

describe("export JSON de la classe : courbes", () => {
  const X = "2026-10-01T10:00:00.000Z";
  const Y = "2026-10-02T15:30:00.000Z";
  const presse = (importeLe: string) => ({ essai: { sourcePresse: { fichier: "p.xlsx", echantillon: "1", importeLe } } });
  const etu = [{ id: A, nom: "A", email: null, resultats: [], nbEssais: 0, derniereActivite: null,
    gachees: [{ id: "g1", eprouvettes: [{ id: "e1", ...presse(Y) }, { id: "e2", ...presse(X) }] }] }] as unknown as Parameters<typeof exportClasse>[0];
  const courbes = [
    { proprietaire: A, eprouvetteId: "e1", gacheeId: "g1", importeLe: Y, contenu: { v: 1 } },
    { proprietaire: A, eprouvetteId: "e1", gacheeId: "g1", importeLe: X, contenu: { v: 1 } }, // import révolu
    { proprietaire: A, eprouvetteId: "e2", gacheeId: "g1", importeLe: null, contenu: { v: 1 } }, // ancien document
    { proprietaire: A, eprouvetteId: "e9", gacheeId: "g9", importeLe: X, contenu: { v: 1 } },
    { proprietaire: "autre", eprouvetteId: "e1", gacheeId: "g1", importeLe: Y, contenu: { v: 1 } },
  ];

  it("celle de l'import désigné (ou l'ancien document, marqué), sous une clé à part ; version inchangée", () => {
    const x = exportClasse(etu, "toutes", new Date("2026-10-01T00:00:00Z"), courbes) as {
      version: number; courbes: { eprouvetteId: string; proprietaire: string; importeLe: string | null; origineNonVerifiee?: boolean }[];
    };
    expect(x.version).toBe(1);
    expect(x.courbes.map((c) => [c.proprietaire, c.eprouvetteId, c.importeLe, c.origineNonVerifiee ?? false]))
      .toEqual([[A, "e1", Y, false], [A, "e2", null, true]]);
    expect(exportClasse(etu, "toutes", new Date())).not.toHaveProperty("courbes");
  });

  it("colonne courbe_en_ligne : mêmes courbes retenues", () => {
    expect([...eprouvettesAvecCourbe(etu, courbes)].sort()).toEqual([`${A}|e1`, `${A}|e2`]);
    expect([...eprouvettesAvecCourbe(etu, courbes.filter((c) => c.importeLe === X))]).toEqual([]);
  });
});

describe("classe-reseau", () => {
  const brut = (id: string, maj: string) => ({
    proprietaire: A, doc_kind: "gachee", doc_id: id, doc_rev: 4, maj_serveur: maj, cree_serveur: "c", supprime: false, contenu: { id },
  });

  it("lit jusqu'à une page vide, en rendant le curseur tel quel", async () => {
    const { sb, appels } = clientRpc({ lire_docs_classe: [[brut("g1", "m1"), brut("g2", "m2")], [brut("g3", "m3")], []] });
    const l = await lireClasse(sb, { complet: false, session: "A2026" });
    expect(l.map((x) => x.id)).toEqual(["g1", "g2", "g3"]);
    expect(appels[1].params).toMatchObject({ p_apres_maj: "m2", p_apres_user: A, p_apres_kind: "gachee", p_apres_id: "g2", p_session: "A2026" });
    expect(appels).toHaveLength(3);
  });

  it("une erreur est levée, jamais rendue comme une classe vide", async () => {
    const { sb } = clientRpc({}, { code: "42501", message: "réservé à l'enseignant" });
    await expect(lireClasse(sb, { complet: false, session: null })).rejects.toMatchObject({ code: "42501" });
  });

  it("annotations de l'étudiant : curseur, recul au premier appel seulement", async () => {
    const x = (id: string, maj: string) => ({ annotation_id: id, cible_kind: "gachee", cible_id: "g1", cible_rev: 2, ancre: null, texte: "t", supprime: false, maj_serveur: maj });
    const { sb, appels } = clientRpc({ lire_fil_annotations: [[x("a1", "m1")], []] });
    const r = await lireMesAnnotations(sb, A, { maj: "m0", id: "a0" });
    expect(r.annotations.map((a) => a.id)).toEqual(["a1"]);
    expect(r.curseur).toEqual({ maj: "m1", id: "a1" });
    expect(appels[0].params).toMatchObject({ p_attendu: A, p_apres_maj: "m0", p_recul_s: 120 });
    expect(appels[1].params).toMatchObject({ p_recul_s: 0 });
  });

  it("fil : auteur, création et lecture ; base pas à jour → repli sur l'ancienne lecture", async () => {
    const x = { annotation_id: "a1", cible_kind: "gachee", cible_id: "g1", cible_rev: 2, ancre: null, texte: "t", supprime: false, maj_serveur: "m1",
      de_moi: true, cree_serveur: "c1", lu_serveur: "l1" };
    const { sb } = clientRpc({ lire_fil_annotations: [[x], []] });
    expect((await lireMesAnnotations(sb, A, null)).annotations[0]).toMatchObject({ auteur: "moi", creeLe: "c1", luLe: "l1" });

    const appels: string[] = [];
    const ancienne = {
      rpc(fn: string) {
        appels.push(fn);
        if (fn === "lire_fil_annotations") return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
        return Promise.resolve({ data: appels.filter((f) => f === "lire_annotations").length === 1 ? [{ ...x, de_moi: undefined, cree_serveur: undefined, lu_serveur: undefined }] : [], error: null });
      },
    } as unknown as SupabaseClient;
    const r = await lireMesAnnotations(ancienne, A, null);
    expect(r.annotations[0]).toMatchObject({ auteur: "enseignant", creeLe: "m1", luLe: null });
    expect(appels).toEqual(["lire_fil_annotations", "lire_annotations", "lire_annotations"]);
  });

  it("réponse ancrée ; base pas à jour → repli sur la réponse au fil général", async () => {
    const ok = { annotation_id: "r1", cree_serveur: "c1", maj_serveur: "m1" };
    const appels: { fn: string; params: Record<string, unknown> }[] = [];
    const client = (absente: boolean) => ({
      rpc(fn: string, params: Record<string, unknown>) {
        appels.push({ fn, params });
        if (absente && fn === "repondre_annotation_ancree") return Promise.resolve({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
        return Promise.resolve({ data: [ok], error: null });
      },
    }) as unknown as SupabaseClient;
    const r = { attendu: A, kind: "gachee" as const, id: "g1", rev: 3, texte: " Je repèse. ", ancre: "Pesée : Liant" };
    expect(await repondreAnnotation(client(false), r)).toMatchObject({ ancre: "Pesée : Liant", texte: "Je repèse.", auteur: "moi" });
    expect(appels.map((x) => x.fn)).toEqual(["repondre_annotation_ancree"]);
    expect(appels[0].params).toMatchObject({ p_ancre: "Pesée : Liant", p_rev: 3 });

    appels.length = 0;
    expect(await repondreAnnotation(client(true), r)).toMatchObject({ ancre: null });
    expect(appels.map((x) => x.fn)).toEqual(["repondre_annotation_ancree", "repondre_annotation"]);
    expect(appels[1].params).not.toHaveProperty("p_ancre");

    appels.length = 0;
    await repondreAnnotation(client(false), { ...r, ancre: null });
    expect(appels.map((x) => x.fn)).toEqual(["repondre_annotation"]);
  });

  it("retrait : zéro ligne touchée (message d'autrui) est une ERREUR, pas un succès silencieux", async () => {
    const client = (data: unknown) => {
      const chaine = { update: () => chaine, eq: () => chaine, select: () => Promise.resolve({ data, error: null }) };
      return { from: () => chaine } as unknown as SupabaseClient;
    };
    await expect(retirerAnnotation(client([{ id: "a1" }]), "a1")).resolves.toBeUndefined();
    await expect(retirerAnnotation(client([]), "a1")).rejects.toMatchObject({ code: "aucune_ligne" });
  });

  it("annotations de la classe : on avance du nombre de lignes reçues (serveur qui tronque)", async () => {
    const lignes = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}` }));
    const plages: [number, number][] = [];
    const chaine = {
      select: () => chaine, eq: () => chaine, order: () => chaine,
      range(de: number, a: number) {
        plages.push([de, a]);
        return Promise.resolve({ data: lignes.slice(de, Math.min(a + 1, de + 3)), error: null }); // max_rows = 3
      },
    };
    const sb = { from: () => chaine } as unknown as SupabaseClient;
    const r = await lireAnnotationsClasse(sb);
    expect(r.map((x) => x.id)).toEqual(lignes.map((x) => x.id));
    expect(plages.map((p) => p[0])).toEqual([0, 3, 6, 7]);
  });

  it("document intégral : ligne lue, absent = null, erreur levée ; schéma absent expliqué", async () => {
    const filtres: [string, unknown][] = [];
    const client = (data: unknown, error: unknown = null) => {
      const chaine = {
        select: () => chaine,
        eq: (c: string, v: unknown) => { filtres.push([c, v]); return chaine; },
        maybeSingle: () => Promise.resolve({ data, error }),
      };
      return { from: () => chaine } as unknown as SupabaseClient;
    };
    const d = await lireDocComplet(client({ payload: { id: "g1" }, rev: "12", updated_at: "m", deleted: false }), A, "gachee", "g1");
    expect(d).toEqual({ contenu: { id: "g1" }, rev: 12, maj: "m", supprime: false });
    expect(filtres).toEqual([["user_id", A], ["kind", "gachee"], ["id", "g1"]]);
    expect(await lireDocComplet(client(null), A, "gachee", "g2")).toBeNull();
    await expect(lireDocComplet(client(null, { code: "42501", message: "non" }), A, "gachee", "g3")).rejects.toMatchObject({ code: "42501" });
    expect(messageErreurClasse(new ErreurClasse("PGRST202", "Could not find the function"))).toMatch(/schema\.sql/);
    expect(messageErreurClasse(new ErreurClasse("42501", "refusé"))).toBe("refusé");
  });

  it("courbe d'une éprouvette : celle de son import ; à défaut l'ancien document, non vérifié ; retirée ou absente : null", async () => {
    const X = "2026-10-01T10:00:00.000Z";
    const client = (docs: Record<string, unknown>) => {
      let id = "";
      const chaine = {
        select: () => chaine,
        eq: (col: string, v: string) => { if (col === "id") id = v; return chaine; },
        maybeSingle: () => Promise.resolve({ data: docs[id] ?? null, error: null }),
      };
      return { from: () => chaine } as unknown as SupabaseClient;
    };
    const col = { t: [0, 1], f: [0, 2], d: [0, 3], s: [0, 4], e: [0, 5] };
    const doc = (payload: unknown, rev = 3) => ({ payload, rev, updated_at: "m", deleted: payload === null });
    const parImport = { [`e1:${X}`]: doc({ v: 1, eprouvetteId: "e1", gacheeId: "g1", importeLe: X, ...col }, 7) };
    const ancien = { e1: doc({ v: 1, eprouvetteId: "e1", gacheeId: "g1", ...col }) };
    expect(await lireCourbe(client({ ...parImport, ...ancien }), A, "e1", X))
      .toEqual({ courbe: { v: 1, ...col }, cle: `e1:${X}`, rev: 7, origineNonVerifiee: false });
    expect(await lireCourbe(client(ancien), A, "e1", X)).toMatchObject({ cle: "e1", rev: 3, origineNonVerifiee: true });
    expect(await lireCourbe(client(ancien), A, "e1", undefined)).toMatchObject({ cle: "e1", origineNonVerifiee: true });
    expect(await lireCourbe(client({ e1: doc(null, 4) }), A, "e1", X)).toBeNull();
    expect(await lireCourbe(client({}), A, "e1", X)).toBeNull();
  });

  it("courbes de la classe : par compte exporté, paginées par identifiant (même si le serveur tronque), avec ou sans contenu", async () => {
    const X = "2026-10-01T10:00:00.000Z";
    const col = { v: 1, t: [], f: [], d: [], s: [], e: [] };
    const lignes: Record<string, { id: string; payload: Record<string, unknown> }[]> = {
      [A]: [
        { id: "e1", payload: { ...col, eprouvetteId: "e1", gacheeId: "g1" } },
        { id: `e2:${X}`, payload: { ...col, eprouvetteId: "e2", gacheeId: "g1", importeLe: X } },
        { id: "e3", payload: { pas: "une courbe" } },
      ],
      [B]: [{ id: "b1", payload: { ...col, eprouvetteId: "b1" } }],
    };
    const requetes: { colonnes: string; filtres: [string, unknown][]; apres: string | null }[] = [];
    const sb = {
      from: () => {
        const r = { colonnes: "", filtres: [] as [string, unknown][], apres: null as string | null };
        requetes.push(r);
        const chaine = {
          select: (c: string) => { r.colonnes = c; return chaine; },
          eq: (c: string, v: unknown) => { r.filtres.push([c, v]); return chaine; },
          gt: (_c: string, v: string) => { r.apres = v; return chaine; },
          order: () => chaine,
          limit: () => {
            const uid = r.filtres.find(([c]) => c === "user_id")![1] as string;
            const page = (lignes[uid] ?? []).filter((l) => r.apres === null || l.id > r.apres).slice(0, 2); // max_rows = 2
            const avecContenu = r.colonnes === "id,payload";
            return Promise.resolve({ data: page.map((l) => (avecContenu ? l : {
              id: l.id, eprouvetteId: l.payload.eprouvetteId ?? null, gacheeId: l.payload.gacheeId ?? null, importeLe: l.payload.importeLe ?? null,
            })), error: null });
          },
        };
        return chaine;
      },
    } as unknown as SupabaseClient;
    expect((await lireCourbesClasse(sb, true, [A])).map((c) => [c.id, c.eprouvetteId, c.gacheeId, c.importeLe]))
      .toEqual([["e1", "e1", "g1", null], [`e2:${X}`, "e2", "g1", X]]);
    expect(requetes.map((r) => r.apres)).toEqual([null, `e2:${X}`, "e3"]); // page tronquée : on continue jusqu'à la page vide
    expect(requetes[0].filtres).toEqual([["user_id", A], ["kind", "courbe"], ["deleted", false]]);
    requetes.length = 0;
    expect((await lireCourbesClasse(sb, false, [A, B, A])).map((c) => [c.proprietaire, c.eprouvetteId, c.importeLe]))
      .toEqual([[A, "e1", null], [A, "e2", X], [A, "e3", null], [B, "b1", null]]);
    expect(requetes[0].colonnes).toBe("id,eprouvetteId:payload->>eprouvetteId,gacheeId:payload->>gacheeId,importeLe:payload->>importeLe");
    expect(await lireCourbesClasse(sb, false, [])).toEqual([]);
  });

  it("comptes : lecture convertie ; droit refusé sur auth → marche à suivre dans Studio", async () => {
    const { sb } = clientRpc({ lister_comptes: [[{
      compte_id: "k", courriel: "k@x.ca", nom_affiche: null, compte_role: "prof", cree_le: "c", derniere_connexion: null,
      bloque_jusqu_a: null, nb_resultats: "2", nb_gachees: 3, derniere_activite: null,
    }]] });
    expect(await lireComptes(sb)).toEqual([{ id: "k", courriel: "k@x.ca", nom: null, role: "prof", creeLe: "c", derniereConnexion: null,
      bloqueJusquA: null, nbResultats: 2, nbGachees: 3, derniereActivite: null }]);
    expect(messageErreurClasse(new ErreurClasse("42501", "permission denied for table users"))).toMatch(/Ban user/);
    expect(messageErreurClasse(new ErreurClasse("42501", "on ne se bloque pas soi-même"))).toBe("on ne se bloque pas soi-même");
  });

  it("comptes : chaque action dit ce qu'elle fait avant de le faire", () => {
    expect(confirmationAction("nommer", "Alice")).toMatch(/verra le travail de tous les étudiants/);
    expect(confirmationAction("nommer", "Alice")).toMatch(/ne figurera plus dans la liste des étudiants/);
    expect(confirmationAction("bloquer", "Alice")).toMatch(/Rien n'est effacé/);
    expect(confirmationAction("bloquer", "Alice")).toMatch(/dans l'heure/);
    expect(confirmationAction("retirer", "Alice")).toMatch(/redevient étudiant/);
  });
});

describe("classe : export des décisions, formulations de toutes les sessions, ligne relue", () => {
  const etu = [{ id: A, nom: "A", email: null, resultats: [], nbEssais: 0, derniereActivite: null,
    gachees: [{ id: "g1", eprouvettes: [] }] }] as unknown as Parameters<typeof exportClasse>[0];

  it("JSON de la classe : clé « revues » pour les gâchées exportées seulement", () => {
    const r = (id: string, ownerId = A) => ({ ownerId, kind: "gachee" as const, id, rev: 3, decision: "refusee" as const, motif: "x", ecartees: ["e1"], maj: "m" });
    const x = exportClasse(etu, "toutes", new Date(), undefined, [r("g1"), r("g9"), r("g1", B)]) as { revues: unknown[] };
    expect(x.revues).toEqual([{ proprietaire: A, gacheeId: "g1", rev: 3, decision: "refusee", motif: "x", ecartees: ["e1"], maj: "m" }]);
    expect(exportClasse(etu, "toutes", new Date())).not.toHaveProperty("revues");
  });

  it("formulations de toutes les sessions ; ligne remplacée par la version relue", () => {
    const toutes = [{ ...etu[0], resultats: [{ id: "r-ancienne" }, { id: "r1" }] }] as unknown as Parameters<typeof exportClasse>[0];
    expect(avecFormulationsDeToutesSessions(etu, toutes)[0].resultats.map((x) => x.id)).toEqual(["r-ancienne", "r1"]);
    expect(avecFormulationsDeToutesSessions(etu, [])[0].resultats).toEqual([]);
    const l = (id: string, rev: number): LigneClasse => ({ proprietaire: A, kind: "gachee", id, rev, maj: "m", cree: "c", supprime: false, contenu: { id } });
    expect(remplacerLigne([l("g1", 1), l("g2", 1)], l("g1", 4)).map((x) => [x.id, x.rev])).toEqual([["g1", 4], ["g2", 1]]);
  });
});
