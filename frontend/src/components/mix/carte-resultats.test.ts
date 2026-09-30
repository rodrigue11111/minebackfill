// Rendu de la carte « Résultats » (sans navigateur) : chiffres clés, tableau
// résumé, lien vers le rapport complet, RRC et état vide.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CarteResultats, { chiffreMasse, chiffresRecette } from "./CarteResultats";
import { lignesResume, nbLignesRapport, type ReportCtx } from "@/lib/report-schema";
import { DEFAULT_UNITS } from "@/lib/units";
import type { Recipe, RrcRecipe } from "@/lib/types";

const ctx: ReportCtx = {
  units: DEFAULT_UNITS, massLabel: "kg", volLabel: "L", densLabel: "g/cm3",
  binderName: (n) => `Liant ${n}`, isEssai: false, isRpg: false, bcount: 1,
};
const recette = (bw: number) => ({
  bw_mass_pct: bw, solids_mass_pct: 75, wc_ratio: 7.1, w_mass_pct: 33.3, void_ratio: 1.1, saturation_pct: 100,
  components: { residue_dry_mass_kg: 1380, binder_total_mass_kg: 69, water_total_mass_kg: 483 },
}) as unknown as Recipe;

const rendu = (props: Parameters<typeof CarteResultats>[0]) => renderToStaticMarkup(createElement(CarteResultats, props));

describe("report-schema — résumé et rapport complet", () => {
  it("nombre de lignes du rapport complet : 41 (RPC, 1 liant), 46 + 2b (RPG essai-erreur)", () => {
    expect(nbLignesRapport(ctx)).toBe(41);
    for (const b of [1, 2, 3]) {
      expect(nbLignesRapport({ ...ctx, isRpg: true, isEssai: true, bcount: b })).toBe(46 + 2 * b);
    }
  });

  it("résumé : Bw, Cw, E/L, e, w, Sr, puis les masses (ordre de la maquette)", () => {
    const l = lignesResume(ctx).map((r) => r.label(ctx));
    expect(l).toEqual([
      "Taux massique de liant Bw", "Pourcentage solide massique Cw", "Rapport eau/liant E/L", "Indice des vides e",
      "Teneur en eau massique w", "Degré de saturation Sr", "Liant Mb", "Eau totale Mw", "Résidu sec Mr",
    ]);
    const rpgEssai = { ...ctx, isRpg: true, isEssai: true };
    const l2 = lignesResume(rpgEssai).map((r) => r.label(rpgEssai));
    expect(l2).toContain("Granulat sec Ma");
    expect(l2).toContain("Liant à ajouter/retirer Mb-ad");
    expect(l2[0]).toBe("Taux massique de liant Bw atteint");
  });
});

describe("CarteResultats", () => {
  it("deux recettes : sélecteur, quatre chiffres clés, tableau résumé, lien du rapport complet", () => {
    const html = rendu({ sousTitre: "2 recettes", actions: null, donnees: { genre: "rpc", recipes: [recette(5), recette(6)], ctx } });
    expect(html).toContain('aria-label="Recette affichée"');
    expect(html).toContain("Recette 2");
    expect(html).toContain("Rapport E/L");
    expect(html).toContain("1\u202F380");
    expect(html).toContain("Rapport eau/liant E/L");
    expect(html).toContain("Voir les 41 lignes du rapport complet");
    // La recette choisie (1) est mise en valeur dans le tableau.
    expect(html).toContain("mix-col-choisie");
  });

  it("une seule recette : pas de sélecteur", () => {
    const html = rendu({ sousTitre: "1 recette", actions: null, donnees: { genre: "rpc", recipes: [recette(5)], ctx } });
    expect(html).not.toContain('aria-label="Recette affichée"');
  });

  it("plein écran : le rapport complet est déjà ouvert, en grille", () => {
    const html = rendu({ sousTitre: "", actions: null, pleinEcran: true, donnees: { genre: "rpc", recipes: [recette(5)], ctx } });
    expect(html).toContain("mix-rapport-grille");
    expect(html).toContain("Masses et poids volumiques");
    expect(html).not.toContain("Voir les");
  });

  it("RRC : ciment, eau, roches stériles, E/L du coulis et tableau RRC", () => {
    const rrc = { cement_mass_kg: 40, water_mass_kg: 16, waste_rock_mass_kg: 800, wc_ratio: 0.4, bw_mass_pct: 5 } as RrcRecipe;
    const html = rendu({ sousTitre: "", actions: null, donnees: { genre: "rrc", recipes: [rrc], massLabel: "kg", toMass: (kg) => kg ?? null } });
    for (const t of ["Ciment", "Roches stériles", "E/L du coulis", "Remblai rocheux cimenté (RRC)", "Rapport E/L du coulis (W/C)"]) {
      expect(html).toContain(t);
    }
  });

  it("état vide : tuiles à « — » et invitation à calculer", () => {
    const html = rendu({ sousTitre: "RPC", actions: null, donnees: null });
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Calculer");
  });
});

describe("chiffres clés", () => {
  it("décimales adaptées à la grandeur", () => {
    expect(chiffreMasse(1380.4)).toBe("1\u202F380");
    expect(chiffreMasse(13906501)).toBe("13\u202F906\u202F501");
    expect(chiffreMasse(-1234.5)).toBe("-1\u202F235");
    expect(chiffreMasse(12.345)).toBe("12.3");
    expect(chiffreMasse(1.2345)).toBe("1.23");
    expect(chiffreMasse(0.12345)).toBe("0.123");
    expect(chiffreMasse(undefined)).toBe("—");
  });

  it("les masses suivent l'unité choisie", () => {
    const g = chiffresRecette(recette(5), { ...ctx, units: { ...DEFAULT_UNITS, mass: "g" }, massLabel: "g" });
    expect(g[0]).toMatchObject({ libelle: "Liant", valeur: "69\u202F000", unite: "g" });
  });
});
