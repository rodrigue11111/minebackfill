import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { regrouper, essaiValide, type LigneClasse, type ProfilClasse } from "./classe";
import { contrainteKpa } from "./eprouvette";
import { pseudonyme, pseudonymes } from "./pseudonyme";
import {
  COLONNES_ESSAIS, COLONNES_GACHEES, COLONNES_MATERIAUX, DICTIONNAIRE_VERSION, TABLES,
  construireJeuEssais, dictionnaire, jeuEssaisJson, lignesCsvDictionnaire, lignesCsvTable, type NomTable,
} from "./jeu-essais";
import { versCsv } from "./export-fig";
import type { GranulatItem, ResiduItem } from "./materials";
import type { LiantCatalogueItem } from "./store";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const profils: ProfilClasse[] = [
  { id: A, email: "alice@x.ca", display_name: "Alice Tremblay", role: "etudiant" },
  { id: B, email: "bruno@x.ca", display_name: "Bruno Gagnon", role: "etudiant" },
  { id: "p", email: "prof@x.ca", display_name: "Prof", role: "prof" },
];
const sessions = [{ id: "A2026", nom: "Automne 2026", debut: "2026-09-01", fin: "2026-12-23" }];
const catalogues = {
  residus: [{ id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, provenance: "LaRonde", origine: "officiel", d50_um: 18.5, p20_pct: 52.3, soufre_pct: 12.1, mineralogie: "Pyrite" }] as ResiduItem[],
  granulats: [] as GranulatItem[],
  liants: [
    { id: "liant_cp10", code: "CP10", nom: "Ciment Portland GU (anc. type 10)", gs: 3.15 },
    { id: "liant_slag", code: "SLAG", nom: "Laitier de haut fourneau (GGBFS)", gs: 2.84 },
  ] as LiantCatalogueItem[],
};
const jour = (m: number, j: number) => new Date(2026, m - 1, j, 12).toISOString();

// Alice : une gâchée avec fiche d'essai, et sa copie de conflit (à exclure).
const gA = {
  id: "gA", code: "G-20260910-01", creeLe: jour(9, 10), statut: "terminee", formulationLabel: "Formule d'Alice", formulationId: "rA",
  categorie: "RPC", recetteIndex: 0, tolerancePct: 2, ajustements: [], sessionId: "A2026", solverVersion: "gramme-1.0",
  observations: "Alice a malaxé deux fois.", lotLiant: "=L-42",
  parametres: { cwPct: 75, bwPct: 5, wcRatio: 7.1, wPct: 33.3 },
  composants: [{ cle: "liant", label: "Liant", cibleKg: 5, peseeKg: 5.4 }],
  materiaux: { residu: { id: "res_laronde", nom: "Résidus LaRonde", gs: 3.1, w0Pct: 25 }, liants: [{ id: "liant_cp10", code: "CP10", fractionPct: 80 }, { code: "SLAG", fractionPct: 20 }], eau: { type: "robinet" } },
  cure: { mode: "chambre_humide", temperatureC: 23 },
  eprouvettes: [
    { id: "a1", code: "G-20260910-01-E01", couleLe: jour(9, 10), ageJours: 7, statut: "ecrase", mouleDiametreMm: 50, mouleHauteurMm: 100,
      essai: { date: jour(9, 17), chargeKn: 1, diametreMm: 50, contrainteKpaSaisie: 219.3, masseG: 412.5, modeRuptureCode: "cone",
        sourcePresse: { fichier: "alice-presse.xlsx", echantillon: "3", importeLe: jour(9, 17), operateur: "Alice T.", commentaires: "Alice" } } },
    { id: "a2", code: "G-20260910-01-E02", couleLe: jour(9, 10), ageJours: 7, statut: "ecrase",
      essai: { chargeKn: 1, diametreMm: 50, exclu: true, justificationExclusion: "fissure au démoulage" } },
    { id: "a3", code: "G-20260910-01-E03", couleLe: jour(9, 10), ageJours: 28, statut: "en_cure" },
  ],
};
const gAconflit = { ...gA, id: "gA-c", conflit: { de: "gA", le: jour(9, 11) } };
const rA = { id: "rA", savedAt: jour(9, 9), label: "Formule d'Alice", category: "RPC", general: { operator_name: "Alice Tremblay", binders: [] }, recipes: [] };

// Bruno : une gâchée antérieure à la fiche d'essai (matériaux relus dans la formulation).
const rB = {
  id: "rB", savedAt: jour(9, 9), label: "Formule de Bruno", category: "RPC", selectedMaterials: { residueId: "res_laronde" },
  general: { operator_name: "Bruno Gagnon", binders: [{ id: "liant_slag", code: "SLAG", fraction_pct: 100 }] }, catalogue_liants: catalogues.liants,
  recipes: [{ bw_mass_pct: 6, solids_mass_pct: 74, wc_ratio: 6.5, w_mass_pct: 35, components: {} }],
};
const gB = {
  id: "gB", code: "G-20260912-01", creeLe: jour(9, 12), statut: "brouillon", formulationLabel: "Formule de Bruno", formulationId: "rB",
  categorie: "RPC", recetteIndex: 0, sessionId: "A2026",
  eprouvettes: [{ id: "b1", code: "G-20260912-01-E01", couleLe: jour(9, 12), ageJours: 28, statut: "ecrase", essai: { contrainteKpaSaisie: 650 } }],
};
const ligne = (proprietaire: string, kind: "resultat" | "gachee", contenu: { id: string }): LigneClasse =>
  ({ proprietaire, kind, id: contenu.id, rev: 1, maj: "m", cree: "c", supprime: false, contenu });
const etudiants = regrouper(
  [ligne(A, "resultat", rA), ligne(A, "gachee", gA), ligne(A, "gachee", gAconflit), ligne(B, "resultat", rB), ligne(B, "gachee", gB)],
  profils, sessions, "toutes",
);
const maintenant = new Date("2026-10-01T15:00:00Z");
const jeuDe = async () => construireJeuEssais({
  etudiants, sessions, sessionLibelle: "Toutes les sessions", pseudonymes: await pseudonymes(etudiants.map((e) => e.id)), catalogues, maintenant,
});

describe("pseudonyme", () => {
  it("12 caractères hexadécimaux du SHA-256, préfixés « op- » ; stable et distinct", async () => {
    // SHA-256("abc") = ba7816bf8f01cfea… (vecteur de test du NIST).
    expect(await pseudonyme("abc")).toBe("op-ba7816bf8f01");
    expect(await pseudonyme(A)).toBe(await pseudonyme(A));
    expect(await pseudonyme(A)).not.toBe(await pseudonyme(B));
    expect(await pseudonyme(A)).toMatch(/^op-[0-9a-f]{12}$/);
    expect((await pseudonymes([A, B, A])).size).toBe(2);
  });
});

describe("jeu d'essais pseudonymisé", () => {
  it("aucun nom, courriel ni texte qui nomme quelqu'un, en JSON comme en CSV", async () => {
    const j = await jeuDe();
    const tout = JSON.stringify(jeuEssaisJson(j)) + (["essais", "gachees", "materiaux"] as NomTable[]).map((t) => versCsv(lignesCsvTable(j, t))).join("\n");
    for (const interdit of [/alice/i, /bruno/i, /tremblay/i, /gagnon/i, /@x\.ca/, /Formule d/, /malaxé deux fois/]) expect(tout).not.toMatch(interdit);
    expect(j.essais.every((l) => /^op-[0-9a-f]{12}$/.test(String(l.operateur)))).toBe(true);
  });

  it("opérateurs dans l'ordre des pseudonymes, jamais des noms ; copies de conflit exclues", async () => {
    const j = await jeuDe();
    const ops = j.gachees.map((l) => String(l.operateur));
    expect(ops).toEqual([...ops].sort());
    expect(j.gachees.map((l) => l.gachee_code).sort()).toEqual(["G-20260910-01", "G-20260912-01"]);
    expect(j.essais).toHaveLength(4); // 3 chez Alice (sans la copie), 1 chez Bruno
    expect(j.manifeste).toMatchObject({
      type: "jeu-essais", nb_operateurs: 2, nb_gachees: 2, nb_eprouvettes: 4, nb_essais_retenus: 2,
      dictionnaire_version: DICTIONNAIRE_VERSION, session: "Toutes les sessions", versions_solveur: ["gramme-1.0"],
      exporte_le: "2026-10-01T15:00:00.000Z",
    });
    expect(j.manifeste.textes_libres).toContain("exclusion_motif");
  });

  it("UCS et essais retenus : mêmes règles que l'application", async () => {
    const j = await jeuDe();
    const parCode = new Map(j.essais.map((l) => [l.eprouvette_code, l]));
    for (const e of etudiants.flatMap((x) => x.gachees.filter((g) => !g.conflit).flatMap((g) => g.eprouvettes))) {
      const l = parCode.get(e.code)!;
      expect(l.ucs_kpa).toBe(e.statut === "ecrase" ? contrainteKpa(e.essai) : null);
      expect(l.retenu).toBe(essaiValide(e));
    }
    expect(parCode.get("G-20260910-01-E01")).toMatchObject({ ucs_source: "presse", import_presse: true, masse_g: 412.5, rupture_code: "cone", moule_diametre_mm: 50 });
    expect(parCode.get("G-20260910-01-E02")).toMatchObject({ ucs_source: "calcul_fa", retenu: false, exclu: true, exclusion_motif: "fissure au démoulage" });
    expect(parCode.get("G-20260910-01-E03")).toMatchObject({ ucs_kpa: null, ucs_source: null, retenu: false, statut: "en_cure", essai_le: null });
    expect(parCode.get("G-20260912-01-E01")).toMatchObject({ ucs_source: "saisie", ucs_kpa: 650 });
  });

  it("fiche d'essai, et repli sur la formulation pour une gâchée antérieure", async () => {
    const j = await jeuDe();
    const a = j.gachees.find((l) => l.gachee_code === "G-20260910-01")!;
    expect(a).toMatchObject({
      materiaux_source: "fiche", residu_ref: "res_laronde", liant1_code: "CP10", liant1_pct: 80, liant2_code: "SLAG", liants: "CP10 80 % + SLAG 20 %",
      eau_type: "robinet", cure_mode: "chambre_humide", cure_temperature_c: 23, cw_pct: 75, pesees_hors_tolerance: 1,
      nb_eprouvettes: 3, nb_ecrasees: 2, nb_retenues: 1, session: "Automne 2026", recette: 1,
    });
    const b = j.gachees.find((l) => l.gachee_code === "G-20260912-01")!;
    expect(b).toMatchObject({ materiaux_source: "formulation", residu_ref: "res_laronde", liant1_code: "SLAG", liant1_pct: 100, cw_pct: 74, pesees_hors_tolerance: null });
    // Table materiaux : un résidu (catalogue, deux gâchées), deux liants joints par leur code.
    expect(j.materiaux).toEqual([
      expect.objectContaining({ type: "residu", ref: "res_laronde", source: "catalogue", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, nb_gachees: 2 }),
      expect.objectContaining({ type: "liant", ref: "CP10", source: "catalogue", nom: "Ciment Portland GU (anc. type 10)", nb_gachees: 1 }),
      expect.objectContaining({ type: "liant", ref: "SLAG", source: "catalogue", nb_gachees: 2 }),
    ]);
  });

  it("caractérisation du résidu lue dans le catalogue de l'enseignant (essais et materiaux)", async () => {
    const j = await jeuDe();
    const e1 = j.essais.find((l) => l.eprouvette_code === "G-20260910-01-E01")!;
    expect(e1).toMatchObject({ residu_d50_um: 18.5, residu_p20_pct: 52.3, residu_soufre_pct: 12.1, residu_d90_um: null, residu_muscovite_pct: null });
    const residu = j.materiaux.find((l) => l.type === "residu")!;
    expect(residu).toMatchObject({ d50_um: 18.5, p20_pct: 52.3, mineralogie: "Pyrite", d10_um: null, dmax_mm: null });
    const liant = j.materiaux.find((l) => l.type === "liant")!;
    expect(liant).toMatchObject({ d50_um: null, mineralogie: null });
  });

  it("revue de l'enseignant : colonnes, et export limité aux gâchées acceptées non modifiées", async () => {
    const ps = await pseudonymes(etudiants.map((e) => e.id));
    const revues: Record<string, { decision: "acceptee" | "refusee"; perimee: boolean; ecartees: string[] }> = {
      gA: { decision: "acceptee", perimee: false, ecartees: ["a2"] },
      gB: { decision: "acceptee", perimee: true, ecartees: [] },
    };
    const revueDe = (_o: string, id: string) => (revues[id] ? { ...revues[id], motif: null, maj: "m" } : undefined);
    const tout = construireJeuEssais({ etudiants, sessions, sessionLibelle: "x", pseudonymes: ps, catalogues, maintenant, revueDe });
    const a = tout.essais.find((l) => l.eprouvette_code === "G-20260910-01-E02")!;
    expect(a).toMatchObject({ revue: "acceptee", revue_perimee: false, eprouvette_ecartee: true });
    expect(tout.essais.find((l) => l.eprouvette_code === "G-20260912-01-E01")).toMatchObject({ revue: "acceptee", revue_perimee: true, eprouvette_ecartee: false });
    expect(tout.manifeste.selection).toMatch(/^toutes les gâchées/);
    const acceptees = construireJeuEssais({ etudiants, sessions, sessionLibelle: "x", pseudonymes: ps, catalogues, maintenant, revueDe, seulementAcceptees: true });
    expect(acceptees.gachees.map((l) => l.gachee_code)).toEqual(["G-20260910-01"]); // gB modifiée depuis : écartée
    expect(acceptees.manifeste).toMatchObject({ nb_gachees: 1, nb_operateurs: 1, nb_eprouvettes: 3 });
    expect(acceptees.manifeste.selection).toMatch(/acceptées/);
    // Sans revues (base pas à jour) : colonnes vides.
    const sans = await jeuDe();
    expect(sans.essais[0]).toMatchObject({ revue: null, revue_perimee: null, eprouvette_ecartee: null });
  });

  it("courbe_en_ligne : vrai ou faux selon les courbes lues en ligne ; vide si inconnu", async () => {
    const ps = await pseudonymes(etudiants.map((e) => e.id));
    const j = construireJeuEssais({ etudiants, sessions, sessionLibelle: "x", pseudonymes: ps, catalogues, maintenant, courbesEnLigne: new Set([`${A}|a1`]) });
    const parCode = new Map(j.essais.map((l) => [l.eprouvette_code, l]));
    expect(parCode.get("G-20260910-01-E01")!.courbe_en_ligne).toBe(true);
    expect(parCode.get("G-20260910-01-E02")!.courbe_en_ligne).toBe(false);
    expect((await jeuDe()).essais[0].courbe_en_ligne).toBeNull();
    expect(JSON.stringify(jeuEssaisJson(j))).not.toContain(A); // le compte ne sort jamais
  });

  it("gâchée très ancienne ou allégée : aucun tableau manquant ne fait planter", async () => {
    const vieux = regrouper([ligne(A, "gachee", { id: "gx", code: "G-X", creeLe: jour(9, 1), categorie: "RPC" } as never)], profils, sessions, "toutes");
    const j = construireJeuEssais({ etudiants: vieux, sessions, sessionLibelle: "x", pseudonymes: await pseudonymes([A, B]), catalogues, maintenant });
    expect(j.gachees).toHaveLength(1);
    expect(j.gachees[0]).toMatchObject({ materiaux_source: null, pesees_hors_tolerance: null, nb_eprouvettes: 0 });
    expect(j.essais).toHaveLength(0);
  });

  it("sans pseudonyme, pas d'export (jamais de repli sur le nom)", () => {
    expect(() => construireJeuEssais({ etudiants, sessions, sessionLibelle: "x", pseudonymes: new Map(), catalogues, maintenant })).toThrow(/Pseudonyme manquant/);
  });

  it("CSV : en-tête = clés du dictionnaire, booléens oui / non, virgule décimale, formules neutralisées", async () => {
    const j = await jeuDe();
    const l = lignesCsvTable(j, "essais");
    expect(l[0]).toEqual(COLONNES_ESSAIS.map((k) => k.cle));
    const e1 = l.find((x) => x[l[0].indexOf("eprouvette_code")] === "G-20260910-01-E01")!;
    expect(e1[l[0].indexOf("retenu")]).toBe("oui");
    expect(e1[l[0].indexOf("lot_liant")]).toBe("'=L-42");
    expect(versCsv([e1])).toContain(";219,3;presse;oui;non;");
    expect(lignesCsvTable(j, "gachees")[0]).toEqual(COLONNES_GACHEES.map((k) => k.cle));
    expect(lignesCsvTable(j, "materiaux")[0]).toEqual(COLONNES_MATERIAUX.map((k) => k.cle));
  });
});

describe("dictionnaire des données", () => {
  const doc = readFileSync(fileURLToPath(new URL("../../../docs/DICTIONNAIRE_DONNEES.md", import.meta.url)), "utf-8");

  it("chaque colonne de chaque table est décrite, une seule fois par table", () => {
    for (const [table, colonnes] of Object.entries(TABLES)) {
      const cles = colonnes.map((k) => k.cle);
      expect(new Set(cles).size, table).toBe(cles.length);
      for (const k of colonnes) {
        expect(k.description.length, k.cle).toBeGreaterThan(5);
        expect(doc, `${table}.${k.cle} absent de docs/DICTIONNAIRE_DONNEES.md`).toContain(`\`${k.cle}\``);
      }
    }
    expect(dictionnaire()).toHaveLength(COLONNES_ESSAIS.length + COLONNES_GACHEES.length + COLONNES_MATERIAUX.length);
  });

  it("la version du document suit DICTIONNAIRE_VERSION", () => {
    expect(doc).toContain(`Version du dictionnaire : ${DICTIONNAIRE_VERSION}`);
  });

  it("les lignes exportées portent exactement les clés du dictionnaire", async () => {
    const j = await jeuDe();
    for (const t of Object.keys(TABLES) as NomTable[]) {
      for (const l of j[t]) expect(Object.keys(l)).toEqual(TABLES[t].map((k) => k.cle));
    }
    expect(lignesCsvDictionnaire()[0]).toEqual(["Table", "Clé", "Libellé", "Unité", "Type", "Description"]);
  });
});
