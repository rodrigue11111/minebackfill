import { describe, expect, it } from "vitest";
import { materialsCsvTexte, materialsDepuisFichier } from "./materials-io";
import type { GranulatItem, ResiduItem } from "./materials";

// File-like minimal pour l'environnement node (materialsDepuisFichier n'utilise
// que `.name` et `.text()`).
const fauxFichier = (name: string, content: string) =>
  ({ name, text: async () => content }) as unknown as File;

describe("materials-io — import", () => {
  it("CSV résidus : champs texte et numériques, origine perso, id généré", async () => {
    const csv = "nom;gs;w0_pct;provenance;notes\nMon résidu;3.2;15;SiteA;note1";
    const items = await materialsDepuisFichier("residus", fauxFichier("r.csv", csv));
    expect(items.length).toBe(1);
    const r = items[0] as unknown as Record<string, unknown>;
    expect(r.nom).toBe("Mon résidu");
    expect(r.gs).toBe(3.2);
    expect(r.w0_pct).toBe(15);
    expect(r.provenance).toBe("SiteA");
    expect(r.origine).toBe("perso");
    expect(typeof r.id).toBe("string");
    expect((r.id as string).length).toBeGreaterThan(0);
  });

  it("CSV : valeurs entre guillemets contenant ; et ,", async () => {
    const csv = 'nom;gs;w0_pct;provenance;notes\n"Résidu; spécial";3;10;"A, B";x';
    const items = await materialsDepuisFichier("residus", fauxFichier("r.csv", csv));
    const r = items[0] as unknown as Record<string, unknown>;
    expect(r.nom).toBe("Résidu; spécial");
    expect(r.provenance).toBe("A, B");
  });

  it("JSON : tableau « materials » de granulats", async () => {
    const json = JSON.stringify({ materials: [{ id: "a", nom: "N", gs: 2.9, humidite_pct: 3 }] });
    const items = await materialsDepuisFichier("granulats", fauxFichier("g.json", json));
    const g = items[0] as unknown as Record<string, unknown>;
    expect(g.id).toBe("a");
    expect(g.gs).toBe(2.9);
    expect(g.humidite_pct).toBe(3);
    expect(g.origine).toBe("perso");
  });

  it("JSON : tableau brut accepté aussi", async () => {
    const json = JSON.stringify([{ nom: "Ret", densite_g_ml: 1.15 }]);
    const items = await materialsDepuisFichier("retardateurs", fauxFichier("x.json", json));
    expect((items[0] as unknown as Record<string, unknown>).densite_g_ml).toBe(1.15);
  });

  it("JSON illisible -> erreur explicite", async () => {
    await expect(materialsDepuisFichier("residus", fauxFichier("bad.json", "{pas json")))
      .rejects.toThrow();
  });

  it("virgule decimale (Excel FR) acceptee : 3,05 -> 3.05", async () => {
    const csv = "nom;gs;w0_pct;provenance;notes\nRes FR;3,05;31,5789;;";
    const items = await materialsDepuisFichier("residus", fauxFichier("r.csv", csv));
    const r = items[0] as unknown as Record<string, unknown>;
    expect(r.gs).toBe(3.05);
    expect(r.w0_pct).toBe(31.5789);
  });

  it("cellule entre guillemets contenant un retour a la ligne : pas d'item fantome", async () => {
    const csv = 'nom;gs;w0_pct;provenance;notes\n"Res multi";3;10;A;"ligne 1\nligne 2"\nRes B;2.9;5;B;x';
    const items = await materialsDepuisFichier("residus", fauxFichier("r.csv", csv));
    expect(items.length).toBe(2);
    const r0 = items[0] as unknown as Record<string, unknown>;
    expect(r0.notes).toBe("ligne 1\nligne 2");
    expect((items[1] as unknown as Record<string, unknown>).nom).toBe("Res B");
  });

  it("champ physique principal manquant ou nul -> erreur avec numero de ligne", async () => {
    const csv = "nom;gs;w0_pct;provenance;notes\nSans Gs;;10;;";
    await expect(materialsDepuisFichier("residus", fauxFichier("r.csv", csv)))
      .rejects.toThrow(/Ligne 1/);
    const json = JSON.stringify([{ nom: "Ret sans densite" }]);
    await expect(materialsDepuisFichier("retardateurs", fauxFichier("x.json", json)))
      .rejects.toThrow(/densite_g_ml/);
  });

  it("nom manquant -> erreur", async () => {
    const csv = "nom;gs;w0_pct;provenance;notes\n;3;10;;";
    await expect(materialsDepuisFichier("residus", fauxFichier("r.csv", csv)))
      .rejects.toThrow(/nom/);
  });
});

describe("materials-io : caractérisation (facultative)", () => {
  const residu: ResiduItem = {
    id: "r1", nom: "Résidus LaRonde", gs: 3.1, w0_pct: 25, provenance: "LaRonde", origine: "officiel",
    date_echantillonnage: "2026-09-15", d10_um: 2.4, d50_um: 18.5, d90_um: 95, p20_pct: 52.3, soufre_pct: 12.1, mineralogie: "Pyrite; quartz",
  };

  it("aller-retour CSV : les champs renseignés reviennent, les autres restent absents", async () => {
    const texte = materialsCsvTexte("residus", [residu]);
    expect(texte.split("\r\n")[0]).toBe("nom;gs;w0_pct;provenance;notes;date_echantillonnage;d10_um;d50_um;d80_um;d90_um;p20_pct;soufre_pct;phyllosilicates_pct;muscovite_pct;mineralogie");
    const [r] = await materialsDepuisFichier("residus", fauxFichier("r.csv", texte)) as ResiduItem[];
    expect(r).toMatchObject({ nom: "Résidus LaRonde", date_echantillonnage: "2026-09-15", d10_um: 2.4, d50_um: 18.5, d90_um: 95, p20_pct: 52.3, soufre_pct: 12.1, mineralogie: "Pyrite; quartz" });
    // Une case vide n'est JAMAIS un zéro (ce serait une mesure fausse).
    expect("d80_um" in r).toBe(false);
    expect("muscovite_pct" in r).toBe(false);
  });

  it("virgule décimale acceptée ; une valeur illisible est refusée avec son numéro de ligne", async () => {
    const csv = "nom;gs;w0_pct;d50_um;soufre_pct\nR;3,1;20;18,5;\nS;3;20;abc;1";
    await expect(materialsDepuisFichier("residus", fauxFichier("r.csv", csv))).rejects.toThrow(/Ligne 2 : « d50_um »/);
    const [r] = await materialsDepuisFichier("residus", fauxFichier("r.csv", "nom;gs;w0_pct;d50_um\nR;3,1;20;18,5")) as ResiduItem[];
    expect(r.d50_um).toBe(18.5);
  });

  it("un ancien fichier sans colonnes de caractérisation s'importe comme avant", async () => {
    const [r] = await materialsDepuisFichier("residus", fauxFichier("r.csv", "nom;gs;w0_pct;provenance;notes\nR;3,1;20;A;x")) as ResiduItem[];
    expect(r).toMatchObject({ nom: "R", gs: 3.1, w0_pct: 20 });
    expect(Object.keys(r).sort()).toEqual(["gs", "id", "nom", "notes", "origine", "provenance", "w0_pct"]);
  });

  it("granulats : Dmax, D50 et absorption voyagent aussi", async () => {
    const g: GranulatItem = { id: "g", nom: "Concassé", gs: 2.8, humidite_pct: 0, origine: "perso", dmax_mm: 20, d50_mm: 6.3, absorption_pct: 0.8 };
    const [r] = await materialsDepuisFichier("granulats", fauxFichier("g.csv", materialsCsvTexte("granulats", [g]))) as GranulatItem[];
    expect(r).toMatchObject({ dmax_mm: 20, d50_mm: 6.3, absorption_pct: 0.8 });
  });
});
