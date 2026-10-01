import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import {
  courbeDepuisContenu, courbesAOublier, courbesOrphelines, creerMagasinMemoire, decoderCourbe, deplacerCourbes, encoderCourbe,
  idsCourbes, lignesCsvCourbe, nbPointsCourbe, resoudreCourbesImportees, type MagasinCourbes,
} from "./courbes";
import { jsonCanonique } from "./sync-empreinte";

const pts = Array.from({ length: 151 }, (_, i) => ({
  tempsS: i * 1.08, chargeN: 900 * Math.sin(i / 50), deplacementMm: i * 0.0132,
  contrainteKpa: 196.328 * Math.sin(i / 50), deformationPct: i * 0.0291,
}));

function gachee(id: string, essais: Record<string, unknown>[]): Gachee {
  return {
    id, code: `G-${id}`, creeLe: "2026-10-01T12:00:00.000Z", statut: "terminee", formulationLabel: "M", categorie: "RPC",
    recetteIndex: 0, composants: [], tolerancePct: 2, ajustements: [],
    eprouvettes: essais.map((essai, i) => ({ id: `${id}-e${i}`, code: `E${i}`, couleLe: "x", ageJours: 28, statut: "ecrase", essai })),
  } as unknown as Gachee;
}

describe("courbes — encodage en colonnes", () => {
  it("aller-retour exact, valeur pour valeur", () => {
    expect(decoderCourbe(encoderCourbe(pts))).toEqual(pts);
  });

  it("plus léger que le JSON d'origine (plus de clés répétées)", () => {
    const avant = JSON.stringify(pts).length;
    const apres = JSON.stringify(encoderCourbe(pts)).length;
    expect(apres).toBeLessThan(avant * 0.6);
  });
});

describe("courbes — déplacement hors des gâchées", () => {
  it("déplace les courbes, ne laisse qu'une référence, n'altère rien d'autre", async () => {
    const m = creerMagasinMemoire();
    const g = gachee("g1", [{ contrainteKpaSaisie: 196, courbe: pts }, { contrainteKpaSaisie: 201 }]);
    const r = await deplacerCourbes([g], m);
    expect(r?.deplacees).toBe(1);
    const e0 = r!.gachees[0].eprouvettes[0].essai!;
    expect(e0.courbe).toBeUndefined();
    expect(e0.courbeInfo).toEqual({ nbPoints: 151 });
    expect(e0.contrainteKpaSaisie).toBe(196);
    expect(r!.gachees[0].eprouvettes[1]).toEqual(g.eprouvettes[1]);
    expect(decoderCourbe((await m.lire("g1-e0"))!)).toEqual(pts);
    expect(nbPointsCourbe(e0)).toBe(151);
  });

  it("rien à déplacer : null (aucune écriture)", async () => {
    expect(await deplacerCourbes([gachee("g1", [{ contrainteKpaSaisie: 1 }])], creerMagasinMemoire())).toBeNull();
  });

  it("magasin en échec : l'exception remonte, les gâchées ne sont pas touchées", async () => {
    const enPanne: MagasinCourbes = {
      lire: async () => null,
      ecrire: async () => { throw new Error("QuotaExceededError"); },
      supprimer: async () => {},
      lister: async () => [],
    };
    const g = gachee("g1", [{ courbe: pts }]);
    const copie = jsonCanonique(g);
    await expect(deplacerCourbes([g], enPanne)).rejects.toThrow();
    expect(jsonCanonique(g)).toBe(copie);
  });
});

describe("courbes — nettoyage et import", () => {
  it("une courbe encore référencée par une autre gâchée (copie de conflit) n'est pas oubliée", () => {
    const original = gachee("g1", [{ courbeInfo: { nbPoints: 151 } }]);
    const copie = { ...gachee("g1", [{ courbeInfo: { nbPoints: 151 } }]), id: "g1.conflit.ab12" } as Gachee;
    expect(idsCourbes(original)).toEqual(["g1-e0"]);
    expect(courbesAOublier(idsCourbes(copie), [original])).toEqual([]);
    expect(courbesAOublier(idsCourbes(copie), [])).toEqual(["g1-e0"]);
  });

  it("import : courbe enregistrée -> référence ; sinon remise dans la gâchée ; absente -> retirée", () => {
    const g = gachee("g1", [{ courbeInfo: { nbPoints: 151 } }, { courbeInfo: { nbPoints: 151 } }, { courbeInfo: { nbPoints: 9 } }]);
    const fichier = { "g1-e0": encoderCourbe(pts), "g1-e1": encoderCourbe(pts) };
    const [r] = resoudreCourbesImportees([g], fichier, new Set(["g1-e0"]));
    expect(r.eprouvettes[0].essai).toEqual({ courbeInfo: { nbPoints: 151 } });
    expect(r.eprouvettes[1].essai?.courbe).toEqual(pts);
    expect(r.eprouvettes[1].essai?.courbeInfo).toBeUndefined();
    expect(r.eprouvettes[2].essai).toEqual({});
  });
});

describe("courbes : magasin, orphelines, CSV", () => {
  it("le magasin liste ses courbes ; une orpheline est une courbe qu'aucune gâchée ne référence", async () => {
    const m = creerMagasinMemoire();
    await m.ecrire([["a", encoderCourbe(pts)], ["b", encoderCourbe(pts)], ["c", encoderCourbe(pts)]]);
    expect((await m.lister()).sort()).toEqual(["a", "b", "c"]);
    const g = gachee("g1", [{ courbeInfo: { nbPoints: 2 } }]);
    const idRef = g.eprouvettes[0].id;
    await m.ecrire([[idRef, encoderCourbe(pts)]]);
    expect(courbesOrphelines(await m.lister(), [g]).sort()).toEqual(["a", "b", "c"]);
    expect(courbesOrphelines([idRef], [])).toEqual([idRef]);
  });

  it("CSV d'une courbe : une colonne par grandeur, unités dans l'en-tête", () => {
    const l = lignesCsvCourbe(decoderCourbe(encoderCourbe(pts)));
    expect(l[0]).toEqual(["t_s", "f_n", "d_mm", "s_kpa", "e_pct"]);
    expect(l).toHaveLength(1 + pts.length);
  });

  it("contenu lu en ligne : les colonnes sans le rattachement ; autre chose : null", () => {
    const c = encoderCourbe(pts);
    expect(courbeDepuisContenu({ ...c, eprouvetteId: "e1", gacheeId: "g1" })).toEqual(c);
    expect(courbeDepuisContenu({ v: 2 })).toBeNull();
    expect(courbeDepuisContenu(null)).toBeNull();
  });
});
