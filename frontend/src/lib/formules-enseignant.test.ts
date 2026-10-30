import { beforeEach, describe, expect, it } from "vitest";
import katex from "katex";
import { FORMULAS } from "./formulas-data";
import {
  BORNES, coucheVide, fusionnerFormules, lirePublication, memeCouche, prochainIdAjoute, proprietaireFormules,
  validerCouche, vueFormules, type ContenuFiche, type CoucheFormules, type PublicationFormules,
} from "./formules-enseignant";
import { publierFormules, recevoirFormules } from "./formules-publication";
import { searchFormulas, getSuggestions } from "./formula-search";
import { OPTIONS_KATEX_SURES } from "@/components/formulas/KaTeXRenderer";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

import { useStore } from "./store";

const fiche = (p: Partial<ContenuFiche> = {}): ContenuFiche => ({
  title: "Masse de liant (version enseignant)", section: "Quantité de liant", equationLatex: "M_b = B_w M_t",
  equationPlainText: "Mb = Bw Mt", variables: [{ symbol: "M_b", description: "Masse de liant", unit: "kg" }],
  contextSnippet: "Explication.", keywords: ["liant"], ...p,
});
const pub = (couche: CoucheFormules): PublicationFormules => ({ couche, publieeLe: "2026-10-29T20:30:00.000Z", publieePar: "Prof" });

describe("fiches de l'enseignant : fusion (2026-10-29)", () => {
  it("fiche modifiée : même id, page et liens du cours ; la fiche d'origine reste jointe", () => {
    const l = fusionnerFormules(FORMULAS, { modifiees: { F009: fiche({ section: "Nouvelle section" }) }, ajoutees: [] });
    const f = l.find((x) => x.id === "F009")!;
    const cours = FORMULAS.find((x) => x.id === "F009")!;
    expect(f).toMatchObject({ origine: "modifiee", title: "Masse de liant (version enseignant)", pageNumber: cours.pageNumber });
    expect(f.derivationLinks).toEqual(cours.derivationLinks);
    expect(f.cours?.equationLatex).toBe(cours.equationLatex);
    expect(l.indexOf(f)).toBe(FORMULAS.findIndex((x) => x.id === "F009"));
  });

  it("fiche ajoutée : après le cours, sans page ni liens", () => {
    const l = fusionnerFormules(FORMULAS, { modifiees: {}, ajoutees: [{ id: "E001", ...fiche() }] });
    expect(l).toHaveLength(FORMULAS.length + 1);
    expect(l[l.length - 1]).toMatchObject({ id: "E001", origine: "ajoutee", pageNumber: null, derivationLinks: { derivedFrom: [], derivesInto: [] } });
  });

  it("couche vide : le cours tel quel ; ids E### successifs", () => {
    expect(fusionnerFormules(FORMULAS, coucheVide()).every((f) => f.origine === "cours")).toBe(true);
    expect(prochainIdAjoute(coucheVide())).toBe("E001");
    expect(prochainIdAjoute({ modifiees: {}, ajoutees: [{ id: "E001", ...fiche() }, { id: "E007", ...fiche() }] })).toBe("E008");
  });
});

describe("fiches de l'enseignant : validation", () => {
  it("id de cours inconnu, id mal formé, doublon : rejetés et nommés", () => {
    const { couche, rejets } = validerCouche({
      modifiees: { F999: fiche(), F009: fiche() },
      ajoutees: [{ id: "E001", ...fiche() }, { id: "E001", ...fiche() }, { id: "F200", ...fiche() }, { id: "e2", ...fiche() }],
    });
    expect(Object.keys(couche.modifiees)).toEqual(["F009"]);
    expect(couche.ajoutees.map((a) => a.id)).toEqual(["E001"]);
    expect(rejets.map((r) => [r.id, r.raison])).toEqual([
      ["F999", "pas une fiche du cours"], ["E001", "identifiant en double"],
      ["F200", "identifiant attendu de la forme E001"], ["e2", "identifiant attendu de la forme E001"],
    ]);
  });

  it("chaque champ trop long ou mal typé est rejeté", () => {
    const cas: Partial<Record<keyof ContenuFiche, unknown>>[] = [
      { title: "x".repeat(BORNES.titre + 1) }, { title: "  " }, { section: 3 },
      { equationLatex: "x".repeat(BORNES.equation + 1) }, { equationPlainText: "x".repeat(BORNES.texte + 1) },
      { contextSnippet: "x".repeat(BORNES.contexte + 1) }, { keywords: ["x".repeat(BORNES.motCle + 1)] },
      { keywords: Array(BORNES.motsCles + 1).fill("k") }, { variables: Array(BORNES.variables + 1).fill({ symbol: "a", description: "", unit: null }) },
      { variables: [{ symbol: "", description: "", unit: null }] }, { variables: [{ symbol: "a", description: "x".repeat(BORNES.description + 1), unit: null }] },
      { variables: [{ symbol: "a", description: "", unit: "x".repeat(BORNES.unite + 1) }] }, { variables: "pas une liste" },
    ];
    for (const c of cas) {
      const { rejets } = validerCouche({ modifiees: {}, ajoutees: [{ id: "E001", ...fiche(), ...c }] });
      expect(rejets, JSON.stringify(c).slice(0, 60)).toHaveLength(1);
    }
  });

  it("301 fiches ajoutées, 257 Ko au total : rejetés ; couche illisible : rejetée", () => {
    const trop = Array.from({ length: BORNES.ajoutees + 1 }, (_, i) => ({ id: `E${String(i + 1).padStart(3, "0")}`, ...fiche() }));
    expect(validerCouche({ modifiees: {}, ajoutees: trop }).rejets.some((r) => r.id === "*")).toBe(true);
    const lourde = Array.from({ length: 70 }, (_, i) => ({ id: `E${String(i + 1).padStart(3, "0")}`, ...fiche({ contextSnippet: "x".repeat(3900) }) }));
    expect(validerCouche({ modifiees: {}, ajoutees: lourde }).rejets.some((r) => /Ko au total/.test(r.raison))).toBe(true);
    expect(validerCouche("texte").rejets).toEqual([{ id: "*", raison: "couche illisible" }]);
  });

  it("publication : version inconnue ou un seul rejet, illisible (tout ou rien)", () => {
    const ok = { v: 1, data: pub({ modifiees: { F009: fiche() }, ajoutees: [] }) };
    expect(lirePublication(ok)?.couche.modifiees.F009.title).toBe("Masse de liant (version enseignant)");
    expect(lirePublication({ ...ok, v: 2 })).toBeNull();
    expect(lirePublication({ v: 1, data: pub({ modifiees: { F009: fiche(), F999: fiche() }, ajoutees: [] }) })).toBeNull();
    expect(lirePublication({ v: 1, data: { couche: coucheVide() } })).toBeNull();
  });

  it("comparaison stable : l'ordre des clés ne compte pas", () => {
    const a: CoucheFormules = { modifiees: { F009: fiche(), F010: fiche() }, ajoutees: [] };
    const b: CoucheFormules = { ajoutees: [], modifiees: { F010: fiche(), F009: fiche() } };
    expect(memeCouche(a, b)).toBe(true);
    expect(memeCouche(a, coucheVide())).toBe(false);
  });
});

describe("qui voit quoi : brouillon de SON propriétaire, sinon la publication, sinon le cours", () => {
  const prof = (id: string) => ({ userId: id, role: "prof" });
  const etudiant = { userId: "etu", role: "etudiant" };

  it("propriétaire : l'enseignant, « local » sans compte, jamais un étudiant", () => {
    expect(proprietaireFormules(prof("A"), false)).toBe("A");
    expect(proprietaireFormules(null, true)).toBe("local");
    expect(proprietaireFormules(etudiant, true)).toBeNull();
    expect(proprietaireFormules(null, false)).toBeNull();
  });

  it("scénario de la relecture : A modifie sans publier, l'étudiant puis B ne voient pas son brouillon, A le retrouve", () => {
    const publication = pub({ modifiees: { F010: fiche({ title: "Publiée" }) }, ajoutees: [] });
    const brouillons = { A: { modifiees: { F010: fiche({ title: "Publiée" }), F009: fiche({ title: "Brouillon de A" }) }, ajoutees: [] } };
    const titre = (v: ReturnType<typeof vueFormules>, id: string) => v.carte.get(id)!.title;
    const vueA = vueFormules(brouillons, publication, "A");
    expect(titre(vueA, "F009")).toBe("Brouillon de A");
    expect(vueA.nonPubliees).toBe(true);
    const vueEtu = vueFormules(brouillons, publication, proprietaireFormules(etudiant, false));
    expect(titre(vueEtu, "F009")).toBe(FORMULAS.find((f) => f.id === "F009")!.title);
    expect(titre(vueEtu, "F010")).toBe("Publiée");
    const vueB = vueFormules(brouillons, publication, "B");
    expect(titre(vueB, "F009")).not.toBe("Brouillon de A");
    expect(vueB.nonPubliees).toBe(false);
    expect(titre(vueFormules(brouillons, publication, "A"), "F009")).toBe("Brouillon de A");
  });

  it("rien publié, pas de brouillon : le cours", () => {
    const v = vueFormules({}, null, null);
    expect(v.liste).toHaveLength(FORMULAS.length);
    expect(v.nonPubliees).toBe(false);
  });
});

describe("magasin : brouillons par propriétaire, premier brouillon = copie de la publication", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
    useStore.getState().loadFormules();
  });

  it("modifier part de la publication : ce qui est publié n'est pas perdu", () => {
    const s = useStore.getState();
    s.definirFormulesPubliees(pub({ modifiees: { F010: fiche({ title: "Publiée" }) }, ajoutees: [] }));
    s.modifierFiche("A", "F009", fiche());
    const b = useStore.getState().formulesBrouillons.A;
    expect(Object.keys(b.modifiees).sort()).toEqual(["F009", "F010"]);
    expect(JSON.parse(localStorage.getItem("minebackfill_formules_brouillons")!).data.A.modifiees.F010.title).toBe("Publiée");
  });

  it("ajouter, modifier une fiche ajoutée, rétablir, supprimer, abandonner", () => {
    const s = useStore.getState();
    const id = s.ajouterFiche("A", fiche({ title: "Nouvelle" }));
    expect(id).toBe("E001");
    s.modifierFiche("A", "E001", fiche({ title: "Nouvelle bis" }));
    expect(useStore.getState().formulesBrouillons.A.ajoutees).toMatchObject([{ id: "E001", title: "Nouvelle bis" }]);
    s.modifierFiche("A", "F009", fiche());
    s.retablirFiche("A", "F009");
    expect(useStore.getState().formulesBrouillons.A.modifiees).toEqual({});
    s.supprimerFicheAjoutee("A", "E001");
    expect(useStore.getState().formulesBrouillons.A.ajoutees).toEqual([]);
    s.abandonnerBrouillon("A");
    expect(useStore.getState().formulesBrouillons.A).toBeUndefined();
  });

  it("deux enseignants : chacun son brouillon ; une publication reçue ne touche à aucun", () => {
    const s = useStore.getState();
    s.modifierFiche("A", "F009", fiche({ title: "de A" }));
    s.modifierFiche("B", "F009", fiche({ title: "de B" }));
    s.definirFormulesPubliees(pub(coucheVide()));
    const b = useStore.getState().formulesBrouillons;
    expect([b.A.modifiees.F009.title, b.B.modifiees.F009.title]).toEqual(["de A", "de B"]);
  });
});

describe("réception : une panne ne fait jamais perdre une publication valide", () => {
  const valide = pub({ modifiees: { F009: fiche() }, ajoutees: [] });
  const recevoir = (lecture: Parameters<typeof recevoirFormules>[0]) => {
    let copie: PublicationFormules | null = valide;
    const fait = recevoirFormules(lecture, (p) => { copie = p; });
    return { fait, copie };
  };

  it("absent (rien n'a jamais été publié) : le cours", () => {
    expect(recevoir({ etat: "absent" })).toEqual({ fait: "cours", copie: null });
  });

  it("erreur, version inconnue, contenu invalide : la copie valide est gardée", () => {
    expect(recevoir({ etat: "erreur" })).toEqual({ fait: "gardee", copie: valide });
    expect(recevoir({ etat: "ok", enveloppe: { v: 2, data: valide } })).toEqual({ fait: "gardee", copie: valide });
    expect(recevoir({ etat: "ok", enveloppe: { v: 1, data: pub({ modifiees: { F999: fiche() }, ajoutees: [] }) } })).toEqual({ fait: "gardee", copie: valide });
  });

  it("couche vide publiée : le cours ; publication valide : remplacée", () => {
    const vide = recevoir({ etat: "ok", enveloppe: { v: 1, data: pub(coucheVide()) } });
    expect(vide.fait).toBe("remplacee");
    expect(vide.copie?.couche).toEqual(coucheVide());
  });
});

describe("publication : copie figée, brouillon jamais réécrit", () => {
  const base = (envoyer: Parameters<typeof publierFormules>[0]["envoyer"], proprietaireCourant = () => "A" as string | null) => {
    let publiees: PublicationFormules | null = null;
    return {
      lire: () => publiees,
      o: {
        brouillon: { modifiees: { F009: fiche() }, ajoutees: [] } as CoucheFormules,
        proprietaire: "A", publieePar: "Prof", maintenant: new Date("2026-10-29T20:30:00Z"), envoyer,
        definirPubliees: (p: PublicationFormules) => { publiees = p; }, proprietaireCourant,
      },
    };
  };

  it("des rejets : rien n'est envoyé, la liste est rendue", async () => {
    let envoye = false;
    const t = base(async () => { envoye = true; return { error: null }; });
    const r = await publierFormules({ ...t.o, brouillon: { modifiees: { F999: fiche() }, ajoutees: [] } });
    expect(r).toEqual({ etat: "refusee", rejets: [{ id: "F999", raison: "pas une fiche du cours" }] });
    expect(envoye).toBe(false);
  });

  it("une modification faite pendant l'envoi est gardée : « Modifications non publiées »", async () => {
    let liberer!: () => void;
    const t = base(() => new Promise((ok) => { liberer = () => ok({ error: null }); }));
    const brouillon = t.o.brouillon;
    const envoi = publierFormules(t.o);
    brouillon.modifiees.F010 = fiche({ title: "pendant l'envoi" });
    liberer();
    const r = await envoi;
    expect(r.etat).toBe("ok");
    expect(Object.keys(t.lire()!.couche.modifiees)).toEqual(["F009"]);
    expect(vueFormules({ A: brouillon }, t.lire(), "A").nonPubliees).toBe(true);
  });

  it("changement de compte avant la réponse : pas de message chez le nouveau compte", async () => {
    let compte: string | null = "A";
    let liberer!: () => void;
    const t = base(() => new Promise((ok) => { liberer = () => ok({ error: null }); }), () => compte);
    const envoi = publierFormules(t.o);
    compte = "B";
    liberer();
    const r = await envoi;
    expect(r).toMatchObject({ etat: "ok", pourCeCompte: false });
  });

  it("erreur du serveur : rien n'est mis à jour", async () => {
    const t = base(async () => ({ error: "permission refusée" }));
    expect(await publierFormules(t.o)).toEqual({ etat: "erreur", message: "permission refusée" });
    expect(t.lire()).toBeNull();
  });
});

describe("recherche dans les fiches de l'enseignant", () => {
  it("une fiche ajoutée est trouvée par titre et par variable", () => {
    const liste = fusionnerFormules(FORMULAS, { modifiees: {}, ajoutees: [{ id: "E001", ...fiche({ title: "Rapport de cure accélérée", variables: [{ symbol: "t_{acc}", description: "Durée accélérée", unit: "h" }] }) }] });
    expect(searchFormulas("cure accélérée", liste)[0].formula.id).toBe("E001");
    expect(getSuggestions("t_{acc}", 8, liste).some((s) => s.formulaId === "E001")).toBe(true);
  });
});

describe("rendu KaTeX sûr", () => {
  const rendre = (tex: string) => katex.renderToString(tex, { ...OPTIONS_KATEX_SURES, displayMode: true });

  it("les 104 fiches du cours se rendent sans erreur avec les limites", () => {
    const enErreur = FORMULAS.filter((f) => rendre(f.equationLatex).includes("katex-error"));
    expect(enErreur.map((f) => f.id)).toEqual([]);
  });

  it("une équation de 2 000 caractères se rend en moins de 200 ms", () => {
    const tex = Array.from({ length: 200 }, (_, i) => `x_{${i}}+`).join("").slice(0, BORNES.equation - 1) + "1";
    expect(tex.length).toBeLessThanOrEqual(BORNES.equation);
    const t0 = performance.now();
    rendre(tex);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it("commande inconnue ou macro qui s'emballe : erreur visible, sans exception", () => {
    // Commande inconnue : affichée en rouge, le reste de l'équation se rend.
    expect(rendre("\\inconnue{x} = 1")).toMatch(/color:#cc0000;">\\inconnue/);
    expect(() => rendre("\\def\\a{\\a\\a}\\a")).not.toThrow();
    expect(rendre("\\def\\a{\\a\\a}\\a")).toContain("katex-error");
  });
});
