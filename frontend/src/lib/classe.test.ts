import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agesClasse, essaiValide, exportClasse, fusionnerLignes, gacheesRetenues, nomEtudiant, nuageClasse, regrouper,
  type LigneClasse, type ProfilClasse,
} from "./classe";
import { annotationsDe, fusionnerAnnotations, type Annotation } from "./annotations";
import { ErreurClasse, lireAnnotationsClasse, lireClasse, lireDocComplet, lireMesAnnotations, messageErreurClasse } from "./classe-reseau";
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
    ({ id, cibleKind: "gachee", cibleId: "g1", cibleRev: 1, ancre: null, texte: "t", supprime: false, maj, ...p });

  it("la version la plus récente gagne ; une annotation retirée disparaît", () => {
    let l = fusionnerAnnotations([], [a("1", "2026-10-01"), a("2", "2026-10-02")]);
    l = fusionnerAnnotations(l, [a("1", "2026-10-03", { texte: "modifié" }), a("2", "2026-10-04", { supprime: true, texte: null })]);
    expect(l.map((x) => [x.id, x.texte])).toEqual([["1", "modifié"]]);
    expect(annotationsDe(l, "gachee", "g1")).toHaveLength(1);
    expect(annotationsDe(l, "resultat", "g1")).toHaveLength(0);
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
    const { sb, appels } = clientRpc({ lire_annotations: [[x("a1", "m1")], []] });
    const r = await lireMesAnnotations(sb, A, { maj: "m0", id: "a0" });
    expect(r.annotations.map((a) => a.id)).toEqual(["a1"]);
    expect(r.curseur).toEqual({ maj: "m1", id: "a1" });
    expect(appels[0].params).toMatchObject({ p_attendu: A, p_apres_maj: "m0", p_recul_s: 120 });
    expect(appels[1].params).toMatchObject({ p_recul_s: 0 });
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
});
