// Retours du 30 octobre : « Personnalisé » vide les champs remplis par la
// bibliothèque, la barre de composition porte le bon rang de recette, les
// entrées personnelles ont leur étiquette, un liant ajouté par l'enseignant
// est officiel.

import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BarresPhases from "@/components/analyse/BarresPhases";
import EtiquetteOrigine from "@/components/EtiquetteOrigine";
import { viderPreselection, type GranulatItem, type ResiduItem, type RetardateurItem } from "@/lib/materials";
import { RECIPE_COLORS } from "@/lib/recipe-theme";
import { useStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const residu: ResiduItem = { id: "r", nom: "Casa Berardi", gs: 3.05, w0_pct: 31.5789, origine: "officiel" };
const granulat: GranulatItem = { id: "g", nom: "Concassé", gs: 2.8, humidite_pct: 0, fraction_defaut_pct: 30, origine: "officiel" };
const retardateur: RetardateurItem = { id: "t", nom: "Standard", densite_g_ml: 1.2, dosage_d0_ml_100kg: 100, origine: "officiel" };

describe("« Personnalisé » après un matériau de la bibliothèque", () => {
  it("résidu : Gs et w₀ se vident", () => {
    expect(viderPreselection("residus", residu, { residue_sg: 3.05, residue_w_pct: 31.5789, solid_mass_pct: 70 }))
      .toEqual({ residue_sg: undefined, residue_w_pct: undefined });
  });

  it("granulat : la fraction tapée depuis reste ; l'humidité n'existe que dans Industrie", () => {
    expect(viderPreselection("granulats", granulat, { aggregate_sg: 2.8, aggregate_fraction_pct: 25 }))
      .toEqual({ aggregate_sg: undefined });
    expect(viderPreselection("granulats", granulat, { aggregate_sg: 2.8, aggregate_fraction_pct: 30 }))
      .toEqual({ aggregate_sg: undefined, aggregate_fraction_pct: undefined });
  });

  it("retardateur : densité et dosage remplis par la bibliothèque", () => {
    expect(viderPreselection("retardateurs", retardateur, { retarder_density: 1.2, retarder_d0: 100, cement_sg: 3.15 }))
      .toEqual({ retarder_density: undefined, retarder_d0: undefined });
  });

  it("page Industrie : « non saisi » vaut 0", () => {
    expect(viderPreselection("granulats", granulat, { aggregate_sg: 2.8, aggregate_w_pct: 0, aggregate_fraction_pct: 30 }, 0))
      .toEqual({ aggregate_sg: 0, aggregate_w_pct: 0, aggregate_fraction_pct: 0 });
  });
});

describe("barre de composition des Résultats : la recette choisie", () => {
  const r = { components: { residue_dry_mass_kg: 8, residue_wet_mass_kg: 10.7, binder_total_mass_kg: 0.26, water_total_mass_kg: 4.6 } } as unknown as Recipe;

  it("Recette 2 choisie : « Recette 2 », dans sa couleur", () => {
    const html = renderToStaticMarkup(createElement(BarresPhases, { recipes: [r], numeros: [1], base: "masse", compact: true }));
    expect(html).toContain("Recette 2");
    expect(html).not.toContain("Recette 1");
    expect(html).toContain(`color:${RECIPE_COLORS[1]}`);
  });

  it("sans rang : la numérotation d'avant (Analyse, toutes les recettes)", () => {
    const html = renderToStaticMarkup(createElement(BarresPhases, { recipes: [r, r], base: "masse" }));
    expect(html).toContain("Recette 1");
    expect(html).toContain("Recette 2");
  });
});

describe("étiquette d'origine des bibliothèques", () => {
  it("officiel et personnel, chacun expliqué", () => {
    const officiel = renderToStaticMarkup(createElement(EtiquetteOrigine, { officiel: true }));
    const perso = renderToStaticMarkup(createElement(EtiquetteOrigine, { officiel: false }));
    expect(officiel).toContain(">officiel<");
    expect(officiel).toContain("Fournie par l&#x27;enseignant");
    expect(perso).toContain(">personnel<");
    expect(perso).toContain("pas publiée à la classe");
  });
});

describe("liant ajouté en vue enseignant", () => {
  class MemStorage {
    private m = new Map<string, string>();
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string) { this.m.set(k, String(v)); }
    removeItem(k: string) { this.m.delete(k); }
    clear() { this.m.clear(); }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    get length() { return this.m.size; }
  }
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  });

  it("officiel en vue enseignant (donc publié), personnel sinon", () => {
    useStore.getState().ajouterLiant(true);
    expect(useStore.getState().catalogue_liants.at(-1)?.origine).toBe("officiel");
    useStore.getState().ajouterLiant();
    expect(useStore.getState().catalogue_liants.at(-1)?.origine).toBeUndefined();
  });
});
