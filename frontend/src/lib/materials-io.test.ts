import { describe, expect, it } from "vitest";
import { materialsDepuisFichier } from "./materials-io";

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
