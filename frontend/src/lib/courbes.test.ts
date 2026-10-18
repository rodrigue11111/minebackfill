import { describe, expect, it } from "vitest";
import type { Gachee } from "./gachee";
import {
  appliquerImportPresse, cleAffectation, cleCourbe, clesCourbes, courbeDepuisContenu, courbesAOublier, courbesOrphelines, courbesRetenues, creerMagasinMemoire, decoderCourbe,
  deplacerCourbes, encoderCourbe, lignesCsvCourbe, nbPointsCourbe, origineNonVerifiee, origineVerifiee, resoudreCourbesImportees,
  type MagasinCourbes,
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

const X = "2026-10-01T10:00:00.000Z";
const Y = "2026-10-02T15:30:00.000Z";
const presse = (importeLe: string) => ({ sourcePresse: { fichier: "p.xlsx", echantillon: "1", importeLe } });

describe("courbes — identité par import", () => {
  it("clé `<éprouvette>:<import>` quand l'import est connu ; sinon l'ancienne clé (origine inconnue)", () => {
    const g = gachee("g1", [
      { ...presse(X), courbeInfo: { nbPoints: 151, importeLe: X } }, // vérifiée
      { ...presse(Y), courbeInfo: { nbPoints: 151 } }, // rangée avant : origine inconnue
      { ...presse(Y), courbe: pts }, // encore dans la gâchée : origine inconnue
      { ...presse(Y), courbeInfo: { nbPoints: 151, importeLe: X } }, // autre import que celui désigné
      { ...presse(X) }, // pas de courbe ici
    ]);
    const [a, b, c, d, e] = g.eprouvettes;
    expect([a, b, c, d].map(cleCourbe)).toEqual([`g1-e0:${X}`, "g1-e1", "g1-e2", `g1-e3:${X}`]);
    expect(clesCourbes(g)).toEqual([`g1-e0:${X}`, "g1-e1", "g1-e2", `g1-e3:${X}`]);
    expect([a, b, c, d, e].map((x) => origineVerifiee(x.essai))).toEqual([true, false, false, false, false]);
    expect([a, b, c, d, e].map((x) => origineNonVerifiee(x.essai))).toEqual([false, true, true, true, false]);
  });
});

describe("courbes — nettoyage et import", () => {
  it("une courbe encore référencée par une autre gâchée (copie de conflit du même import) n'est pas oubliée", () => {
    const original = gachee("g1", [{ ...presse(X), courbeInfo: { nbPoints: 151, importeLe: X } }]);
    const copie = { ...gachee("g1", [{ ...presse(X), courbeInfo: { nbPoints: 151, importeLe: X } }]), id: "g1.conflit.ab12" } as Gachee;
    expect(courbesAOublier(clesCourbes(copie), [original])).toEqual([]);
    expect(courbesAOublier(clesCourbes(copie), [])).toEqual([`g1-e0:${X}`]);
    // Copie d'un AUTRE import : sa courbe n'est pas celle de l'original.
    const copieY = { ...gachee("g1", [{ ...presse(Y), courbeInfo: { nbPoints: 151, importeLe: Y } }]), id: "g1.conflit.cd34" } as Gachee;
    expect(courbesAOublier(clesCourbes(copieY), [original])).toEqual([`g1-e0:${Y}`]);
  });

  it("orphelines : l'ancienne clé reste tant que l'éprouvette garde une courbe d'origine inconnue ; balayée après réimport", () => {
    const avant = gachee("g1", [{ ...presse(X), courbeInfo: { nbPoints: 151 } }]);
    expect(courbesOrphelines(["g1-e0", "autre"], [avant])).toEqual(["autre"]);
    const apres = gachee("g1", [{ ...presse(Y), courbeInfo: { nbPoints: 151, importeLe: Y } }]);
    expect(courbesOrphelines(["g1-e0", `g1-e0:${Y}`], [apres])).toEqual(["g1-e0"]);
    // Original Y et copie X : les deux courbes restent.
    const copie = { ...gachee("g1", [{ ...presse(X), courbeInfo: { nbPoints: 151, importeLe: X } }]), id: "g1.conflit.ab12" } as Gachee;
    expect(courbesOrphelines([`g1-e0:${X}`, `g1-e0:${Y}`], [apres, copie])).toEqual([]);
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

  it("import d'un fichier à clés par import : chaque courbe sous la clé de sa référence", () => {
    const g = gachee("g1", [{ ...presse(X), courbeInfo: { nbPoints: 151, importeLe: X } }, { ...presse(Y), courbeInfo: { nbPoints: 151, importeLe: Y } }]);
    // Le fichier n'a que la courbe de e0 (sous sa clé par import) ; une courbe
    // sous l'ancienne clé de e1 ne vaut pas pour l'import Y.
    const fichier = { [`g1-e0:${X}`]: encoderCourbe(pts), "g1-e1": encoderCourbe(pts) };
    const [r] = resoudreCourbesImportees([g], fichier, new Set());
    expect(r.eprouvettes[0].essai?.courbe).toEqual(pts);
    expect(r.eprouvettes[1].essai?.courbe).toBeUndefined();
    expect(r.eprouvettes[1].essai?.courbeInfo).toBeUndefined();
  });
});

describe("courbes — import de presse", () => {
  const sp = (importeLe: string) => ({ fichier: "p.xlsx", echantillon: "1", importeLe });

  it("courbe enregistrée sous la clé de son import ; réimport : l'ancienne clé devient inutile", () => {
    const g = gachee("g1", [{ sourcePresse: sp(X), courbeInfo: { nbPoints: 151, importeLe: X }, masseG: 410 }]);
    const a = { eprouvetteId: "g1-e0", essai: { contrainteKpaSaisie: 300, sourcePresse: sp(Y), courbe: pts } };
    const r = appliquerImportPresse(g.eprouvettes, [a], new Set([cleAffectation(a)]));
    expect(cleAffectation(a)).toBe(`g1-e0:${Y}`);
    expect(r.eprouvettes[0].statut).toBe("ecrase");
    expect(r.eprouvettes[0].essai).toEqual({ masseG: 410, contrainteKpaSaisie: 300, sourcePresse: sp(Y), courbeInfo: { nbPoints: 151, importeLe: Y } });
    expect(r.anciennes).toEqual([`g1-e0:${X}`]);
  });

  it("réimport SANS courbe (case décochée) : ni courbe ni référence de l'ancien import", () => {
    const g = gachee("g1", [{ sourcePresse: sp(X), courbeInfo: { nbPoints: 151 } }, { sourcePresse: sp(X), courbe: pts }]);
    const r = appliquerImportPresse(g.eprouvettes, [
      { eprouvetteId: "g1-e0", essai: { sourcePresse: sp(Y) } },
      { eprouvetteId: "g1-e1", essai: { sourcePresse: sp(Y) } },
    ], new Set());
    for (const e of r.eprouvettes) {
      expect(e.essai).not.toHaveProperty("courbeInfo");
      expect(e.essai).not.toHaveProperty("courbe");
    }
    expect(r.anciennes).toEqual(["g1-e0", "g1-e1"]);
  });

  it("magasin indisponible : la courbe reste dans la gâchée (origine inconnue) ; éprouvette non affectée : intacte", () => {
    const g = gachee("g1", [{ sourcePresse: sp(X), courbeInfo: { nbPoints: 151, importeLe: X } }, { contrainteKpaSaisie: 5 }]);
    const r = appliquerImportPresse(g.eprouvettes, [{ eprouvetteId: "g1-e0", essai: { sourcePresse: sp(Y), courbe: pts } }], new Set(),
      (_e, essai) => (essai.diametreMm ? {} : { diametreMm: 76.2 }));
    expect(r.eprouvettes[0].essai).toEqual({ sourcePresse: sp(Y), courbe: pts, diametreMm: 76.2 });
    expect(r.eprouvettes[1]).toBe(g.eprouvettes[1]);
    expect(r.anciennes).toEqual([`g1-e0:${X}`]);
  });
});

describe("courbes en ligne retenues pour les exports", () => {
  it("celle de l'import désigné ; à défaut l'ancien document (non vérifié) ; jamais celle d'un import révolu", () => {
    const docs = [
      { proprietaire: "A", eprouvetteId: "e1", importeLe: Y, id: `e1:${Y}` },
      { proprietaire: "A", eprouvetteId: "e1", importeLe: X, id: `e1:${X}` }, // import révolu
      { proprietaire: "A", eprouvetteId: "e1", importeLe: null, id: "e1" }, // ancien document
      { proprietaire: "A", eprouvetteId: "e2", importeLe: null, id: "e2" },
      { proprietaire: "A", eprouvetteId: "e3", importeLe: X, id: `e3:${X}` }, // e3 désigne Y : rien
      { proprietaire: "B", eprouvetteId: "e1", importeLe: Y, id: `e1:${Y}` }, // autre compte, non exporté
    ];
    const r = courbesRetenues(docs, [
      { proprietaire: "A", eprouvetteId: "e1", importeLe: Y },
      { proprietaire: "A", eprouvetteId: "e1", importeLe: X }, // copie de conflit de l'import X
      { proprietaire: "A", eprouvetteId: "e2", importeLe: X },
      { proprietaire: "A", eprouvetteId: "e3", importeLe: Y },
    ]);
    expect(r.map((c) => [c.id, c.origineNonVerifiee])).toEqual([[`e1:${Y}`, false], [`e1:${X}`, false], ["e2", true]]);
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
