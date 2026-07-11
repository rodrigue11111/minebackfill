import { beforeEach, describe, expect, it } from "vitest";

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
import type { ResiduItem } from "./materials";

const s = () => useStore.getState();

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  s().loadMaterials();
  s().loadCatalogue();
});

describe("store — bibliothèque de matériaux", () => {
  it("ajout / modification / suppression d'un résidu perso", () => {
    const avant = s().catalogue_residus.length;
    s().addMaterial("residus");
    expect(s().catalogue_residus.length).toBe(avant + 1);
    const idx = s().catalogue_residus.length - 1;
    s().updateMaterial("residus", idx, { nom: "Test", gs: 3.2 } as Partial<ResiduItem>);
    expect(s().catalogue_residus[idx].nom).toBe("Test");
    expect(s().catalogue_residus[idx].gs).toBe(3.2);
    s().deleteMaterial("residus", idx);
    expect(s().catalogue_residus.length).toBe(avant);
  });

  it("les entrées officielles sont verrouillées (modif/suppr refusées)", () => {
    const nom0 = s().catalogue_residus[0].nom; // index 0 = officiel
    s().updateMaterial("residus", 0, { nom: "Piratage" } as Partial<ResiduItem>);
    expect(s().catalogue_residus[0].nom).toBe(nom0);
    const len = s().catalogue_residus.length;
    s().deleteMaterial("residus", 0);
    expect(s().catalogue_residus.length).toBe(len);
  });

  it("un matériau ajouté survit au rechargement", () => {
    s().addMaterial("granulats");
    const len = s().catalogue_granulats.length;
    useStore.setState({ catalogue_granulats: [] });
    s().loadMaterials();
    expect(s().catalogue_granulats.length).toBe(len);
  });

  it("l'import force « perso » et fusionne par id", () => {
    s().importMaterials("residus", [
      { id: "x1", nom: "Importé", gs: 3.0, w0_pct: 10, origine: "officiel" } as ResiduItem,
    ]);
    const imported = s().catalogue_residus.find((m) => m.id === "x1");
    expect(imported?.origine).toBe("perso");
  });

  it("l'import ne deverrouille pas un officiel : collision d'id re-clee (bug revue #1)", () => {
    const officiel = s().catalogue_residus[0]; // res_casa_berardi
    s().importMaterials("residus", [
      { id: officiel.id, nom: "Imposteur", gs: 2.5, w0_pct: 1, origine: "perso" } as ResiduItem,
    ]);
    const items = s().catalogue_residus;
    // L'officiel est intact.
    const off = items.find((m) => m.id === officiel.id);
    expect(off?.nom).toBe(officiel.nom);
    expect(off?.gs).toBe(officiel.gs);
    expect(off?.origine).toBe("officiel");
    // L'item importe existe a cote, re-clee en perso.
    const imposteur = items.find((m) => m.nom === "Imposteur");
    expect(imposteur).toBeDefined();
    expect(imposteur!.id).not.toBe(officiel.id);
    expect(imposteur!.origine).toBe("perso");
    // Aucun doublon d'id.
    const ids = items.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("restaurer les officiels ne cree pas de doublons d'id avec un imposteur herite", () => {
    // Donnees heritees d'avant le verrou : une perso portant un id officiel.
    const officiel = s().catalogue_residus[0];
    useStore.setState({
      catalogue_residus: [
        { ...officiel, nom: "Imposteur herite", gs: 2.4, origine: "perso" },
      ],
    });
    s().restoreOfficialMaterials("residus");
    const items = s().catalogue_residus;
    const ids = items.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length); // pas de doublon
    expect(items.find((m) => m.id === officiel.id)?.origine).toBe("officiel");
    expect(items.some((m) => m.nom === "Imposteur herite")).toBe(true); // conserve, re-clee
  });

  it("restaurer les officiels conserve les entrées perso", () => {
    s().addMaterial("residus");
    const persoAvant = s().catalogue_residus.filter((m) => m.origine === "perso").length;
    s().restoreOfficialMaterials("residus");
    expect(s().catalogue_residus.filter((m) => m.origine === "perso").length).toBe(persoAvant);
    expect(s().catalogue_residus.filter((m) => m.origine === "officiel").length).toBeGreaterThan(0);
  });
});

describe("store — migration du catalogue de liants v1 -> v2", () => {
  it("ajoute `origine` (officiel pour les codes par défaut)", () => {
    // Catalogue « v1 » brut : sans enveloppe de version, sans champ origine.
    localStorage.setItem("minebackfill_catalogue_liants", JSON.stringify([
      { id: "liant_cp10", code: "CP10", nom: "Ciment CP10", gs: 3.1543 },
      { id: "liant_x", code: "CUSTOM", nom: "Custom", gs: 3.0 },
    ]));
    s().loadCatalogue();
    const cat = s().catalogue_liants;
    expect(cat.find((l) => l.code === "CP10")?.origine).toBe("officiel");
    expect(cat.find((l) => l.code === "CUSTOM")?.origine).toBe("perso");
  });
});
