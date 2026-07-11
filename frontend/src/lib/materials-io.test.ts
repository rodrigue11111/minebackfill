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
});
