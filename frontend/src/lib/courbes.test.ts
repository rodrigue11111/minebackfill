import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import {
  courbesAOublier, creerMagasinMemoire, decoderCourbe, deplacerCourbes, encoderCourbe, idsCourbes,
  nbPointsCourbe, resoudreCourbesImportees, type MagasinCourbes,
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
