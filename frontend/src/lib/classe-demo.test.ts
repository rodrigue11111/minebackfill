import { describe, expect, it } from "vitest";
import { classeDemo, marquerCsvDemo, marquerJsonDemo, MENTION_DEMO, sourceDemo, ID_PROF_DEMO } from "./classe-demo";
import { cleLigne, regrouper, type EtudiantClasse } from "./classe";
import { comparerClasse } from "./classe-comparaison";
import { alertesClasse } from "./classe-alertes";
import { echeancierClasse } from "./classe-echeancier";
import { aRevoir, indexerRevues, infoRevue } from "./revues";
import { composantsDepuisRecette, parametresDepuisRecette, type Gachee } from "./gachee";
import { nomLiant } from "./liants";
import type { SavedResult } from "./store";
import RECETTES from "./classe-demo-recettes.json";

// Midi local : la démonstration est relative à aujourd'hui.
const MAINTENANT = new Date(2026, 9, 26, 12);
const d = classeDemo(MAINTENANT);
const etudiants = regrouper(d.lignes, d.profils, d.sessions, d.sessions[0].id);
const comparaison = comparerClasse(etudiants);
const alertes = alertesClasse(etudiants, { maintenant: MAINTENANT, comparaison, sessionActiveAffichee: true, debutSessionActive: d.sessions[0].debut });
const gachees = etudiants.flatMap((e) => e.gachees.map((g) => ({ e, g })));
const gacheeDe = (etu: string, cle: string) => gachees.find((x) => x.g.id === `demo-${etu}-${cle}-gachee`)!.g;

describe("classe fictive", () => {
  it("déterministe pour une date donnée ; 6 étudiants, l'enseignant à part", () => {
    expect(JSON.stringify(classeDemo(MAINTENANT))).toBe(JSON.stringify(d));
    expect(etudiants.map((e) => e.nom)).toEqual(["Alice Tremblay", "Bruno Gagnon", "Chloé Roy", "David Côté", "Émilie Bouchard", "Félix Gauthier"]);
    expect(d.profils.find((p) => p.id === ID_PROF_DEMO)?.role).toBe("prof");
    expect(etudiants.every((e) => e.email?.endsWith("@demo.invalid"))).toBe(true);
  });

  it("chaque gâchée reprend sa recette calculée : paramètres et cibles de pesée", () => {
    for (const { e, g } of gachees) {
      const res = e.resultats.find((r) => r.id === g.formulationId) as SavedResult;
      const recette = res.recipes[g.recetteIndex];
      expect(g.parametres).toEqual(parametresDepuisRecette(recette));
      expect(g.composants.map((c) => [c.cle, c.cibleKg])).toEqual(
        composantsDepuisRecette(recette, nomLiant(res.general, res.catalogue_liants ?? [])).map((c) => [c.cle, c.cibleKg]));
    }
    expect(gachees).toHaveLength(10);
    expect(Object.keys(RECETTES.formulations)).toHaveLength(5);
  });
});

describe("comparaison", () => {
  const groupe = (cw: number, bw: number, cat = "RPC") => comparaison.groupes.find((g) => g.categorie === cat && g.cwArrondi === cw && g.bwArrondi === bw)!;

  it("3 groupes : Bw 5 % (4 étudiants, médiane à 28 j), Bw 3 % (3 étudiants), RPG (2 étudiants, sans médiane)", () => {
    expect(comparaison.groupes).toHaveLength(3);
    expect(groupe(75, 5).nbEtudiants).toBe(4);
    expect(groupe(75, 5).parAge.find((a) => a.ageJours === 28)?.repere?.nGachees).toBe(4);
    expect(groupe(75, 3).nbEtudiants).toBe(3);
    expect(groupe(75, 3).parAge.find((a) => a.ageJours === 7)?.repere).not.toBeNull();
    expect(groupe(78, 4, "RPG").nbEtudiants).toBe(2);
    expect(groupe(78, 4, "RPG").parAge.every((a) => a.repere === null)).toBe(true);
  });

  it("l'éprouvette exclue n'influence ni la moyenne ni la médiane", () => {
    const sans = (gs: EtudiantClasse[]) => gs.map((e) => ({
      ...e, gachees: e.gachees.map((g) => ({ ...g, eprouvettes: g.eprouvettes.filter((ep) => !ep.essai?.exclu) })),
    }));
    const exclues = gachees.flatMap(({ g }) => g.eprouvettes.filter((ep) => ep.essai?.exclu));
    expect(exclues).toHaveLength(1);
    const age7 = (c: ReturnType<typeof comparerClasse>) => c.groupes.find((g) => g.bwArrondi === 5)!.parAge.find((a) => a.ageJours === 7)!;
    const avec = age7(comparaison), retiree = age7(comparerClasse(sans(etudiants)));
    expect(avec.repere?.medianeKpa).toBe(retiree.repere?.medianeKpa);
    expect(avec.lignes.map((l) => l.moyenneKpa)).toEqual(retiree.lignes.map((l) => l.moyenneKpa));
    expect(avec.lignes.find((l) => l.etudiant === "Chloé Roy")?.nExclus).toBe(1);
  });

  it("la gâchée loin sous le groupe (environ −35 %) déclenche l'alerte « écart au groupe », et elle seule", () => {
    const ecarts = alertes.filter((a) => a.type === "ecart_groupe");
    expect(ecarts.length).toBeGreaterThan(0);
    expect(new Set(ecarts.map((a) => a.cible?.id))).toEqual(new Set([gacheeDe("demo-etu-david", "laronde_bw5").id]));
    const l28 = groupe(75, 5).parAge.find((a) => a.ageJours === 28)!.lignes.find((l) => l.etudiant === "David Côté")!;
    expect(l28.ecartMedianePct).toBeLessThan(-30);
  });
});

describe("alertes, échéancier et revues", () => {
  it("chaque cas voulu donne son alerte", () => {
    const types = new Set(alertes.map((a) => a.type));
    for (const t of ["echeance_depassee", "pesee_hors_tolerance", "age_hors_fenetre", "cv_eleve", "ecart_groupe", "inactif"]) {
      expect([t, types.has(t as never)]).toEqual([t, true]);
    }
    expect(types.has("masse_hors_labo")).toBe(false);
    expect(types.has("ecrasee_sans_mesure")).toBe(false);
    expect(alertes.find((a) => a.type === "inactif")?.etudiant).toBe("Félix Gauthier");
  });

  it("échéancier : en retard, aujourd'hui, dans 3 jours", () => {
    const e = echeancierClasse(etudiants, MAINTENANT);
    expect(e.some((x) => x.classe === "retard")).toBe(true);
    expect(e.some((x) => x.classe === "aujourdhui")).toBe(true);
    expect(e.some((x) => x.classe === "proche" && x.joursRestants === 3)).toBe(true);
  });

  it("revues : une acceptée, une refusée, une périmée ; des gâchées terminées à revoir", () => {
    const revues = indexerRevues(d.revues);
    const revs = new Map(d.lignes.map((l) => [cleLigne(l), l.rev]));
    const info = (g: Gachee, etu: string) => infoRevue(revues, (o, id) => revs.get(cleLigne({ proprietaire: o, kind: "gachee", id })), etu, g.id);
    const gA = gacheeDe("demo-etu-alice", "laronde_bw5"), gA3 = gacheeDe("demo-etu-alice", "laronde_bw3"), gD = gacheeDe("demo-etu-david", "laronde_bw5");
    expect(info(gA, "demo-etu-alice")).toMatchObject({ decision: "acceptee", perimee: false });
    expect(info(gD, "demo-etu-david")).toMatchObject({ decision: "refusee" });
    expect(info(gA3, "demo-etu-alice")).toMatchObject({ decision: "acceptee", perimee: true });
    const aRevoirCodes = gachees.filter(({ e, g }) => aRevoir(g, info(g, e.id))).map(({ g }) => g.formulationLabel);
    expect(aRevoirCodes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("source en mémoire", () => {
  it("revues, commentaires et « lu » simulés ; rôles refusés ; une nouvelle source repart de zéro", async () => {
    const s = sourceDemo(d);
    expect(s.demonstration).toBe(true);
    const gB = gacheeDe("demo-etu-bruno", "laronde_bw5");
    await s.poserRevue({ ownerId: "demo-etu-bruno", id: gB.id, rev: 1, decision: "acceptee", motif: null, ecartees: [] });
    expect((await s.lireRevuesClasse())?.some((r) => r.id === gB.id)).toBe(true);
    expect(await s.retirerRevue("demo-etu-bruno", gB.id)).toBe(true);
    const note = await s.ajouterAnnotation({ ownerId: "demo-etu-bruno", auteurId: ID_PROF_DEMO, kind: "gachee", id: gB.id, rev: 1, ancre: null, texte: "Bien vu." });
    expect((await s.lireAnnotationsClasse()).some((a) => a.id === note.id)).toBe(true);
    await s.retirerAnnotation(note.id);
    expect((await s.lireAnnotationsClasse()).some((a) => a.id === note.id)).toBe(false);
    const lus = await s.marquerAnnotationsLues(["demo-note-2"]);
    expect(lus.map((x) => x.id)).toEqual(["demo-note-2"]);
    await expect(s.definirRole("demo-etu-alice", "prof")).rejects.toThrow("Démonstration");
    await expect(s.bloquerCompte("demo-etu-alice", true)).rejects.toThrow("Démonstration");
    expect(await s.lireCourbe("demo-etu-alice", "x", undefined)).toBeNull();
    // Une nouvelle source : rien de ce qui précède n'a été gardé.
    const neuve = sourceDemo(classeDemo(MAINTENANT));
    expect((await neuve.lireAnnotationsClasse()).find((a) => a.id === "demo-note-2")?.lu_le).toBeNull();
    expect((await neuve.lireRevuesClasse())?.some((r) => r.id === gB.id)).toBe(false);
  });

  it("lecture allégée comme le serveur ; document complet à l'ouverture", async () => {
    const s = sourceDemo(d);
    const lignes = await s.lireClasse({ complet: false, session: null });
    const g = lignes.find((l) => l.kind === "gachee")!;
    expect((g.contenu as Record<string, unknown>).protocolesSnapshot).toBeUndefined();
    const complet = await s.lireDocComplet(g.proprietaire, "gachee", g.id);
    expect((complet?.contenu as Record<string, unknown>).protocolesSnapshot).toBeDefined();
  });
});

describe("exports marqués dans leur contenu", () => {
  it("CSV : mention en première ligne ; JSON : propriété demonstration", () => {
    expect(marquerCsvDemo([["a", 1]])[0][0]).toBe(`# ${MENTION_DEMO}`);
    expect(marquerJsonDemo({ x: 1 })).toEqual({ x: 1, demonstration: { fictif: true, note: MENTION_DEMO } });
    expect(MENTION_DEMO).toContain("sans valeur expérimentale");
  });
});

describe("quel que soit le jour d'ouverture", () => {
  it("mêmes groupes et mêmes cas, y compris autour des changements d'heure", () => {
    for (const m of [new Date(2026, 2, 8, 9), new Date(2026, 10, 1, 23), new Date(2027, 0, 15, 0, 30), new Date(2026, 6, 1, 12)]) {
      const dd = classeDemo(m);
      const et = regrouper(dd.lignes, dd.profils, dd.sessions, dd.sessions[0].id);
      const comp = comparerClasse(et);
      const al = alertesClasse(et, { maintenant: m, comparaison: comp, sessionActiveAffichee: true, debutSessionActive: dd.sessions[0].debut });
      const ech = echeancierClasse(et, m);
      expect([m.toISOString(), comp.groupes.length]).toEqual([m.toISOString(), 3]);
      expect([m.toISOString(), new Set(al.map((a) => a.type)).size]).toEqual([m.toISOString(), 6]);
      expect([m.toISOString(), ech.some((x) => x.classe === "aujourdhui"), ech.some((x) => x.classe === "retard")]).toEqual([m.toISOString(), true, true]);
    }
  });
});
