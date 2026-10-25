// Rendu de la carte « Calcul analysé » (sans navigateur) : état vide, refus,
// méthode d'origine distincte de la méthode d'analyse, notes selon l'axe.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CarteCalculAnalyse from "./CarteCalculAnalyse";
import { baseDepuisCalcul, notesSource } from "@/lib/analyse-source";
import { packById } from "@/lib/conventions";
import type { GeneralInfo, SavedResult } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const recette = (p: Partial<Recipe> = {}): Recipe =>
  ({ solids_mass_pct: 74.2, saturation_pct: 100, bw_mass_pct: 4.5, total_backfill_volume_m3: 0.0123, ...p }) as Recipe;

const calcul = (p: Partial<SavedResult> = {}): SavedResult => ({
  id: "sr_1", savedAt: "2026-10-25T14:03:00.000Z", label: "Essai A", category: "RPC", method: "wb",
  general: { container_type: "volume", container_volume_m3: 0.002, binders: [{ id: "l1", code: "GU", fraction_pct: 100 }] } as GeneralInfo,
  recipes: [recette(), recette({ solids_mass_pct: 76.1, bw_mass_pct: 6 })],
  inputs: { residue_sg: 3.05, residue_w_pct: 20, saturation_pct: 100, binder_pct: [4.5, 6], wc_ratio: [7, 8.5], num_recipes: 2, desired_qty: 6, safety_factor: 1.1 },
  solverVersion: "gramme-1.1",
  catalogue_liants: [{ id: "l1", code: "GU", nom: "GU", gs: 3.15 }],
  constantes: packById("gramme")!.constantes,
  ...p,
});

const rendu = (sr: SavedResult | null, param = "binder_mass_pct", extra: Partial<Parameters<typeof CarteCalculAnalyse>[0]> = {}) => {
  const lecture = sr ? baseDepuisCalcul(sr, 0, []) : null;
  const notes = lecture?.ok ? notesSource(lecture.base.categorie, lecture.source, param) : [];
  return renderToStaticMarkup(createElement(CarteCalculAnalyse, {
    analysables: sr ? [sr] : [], calcul: sr, introuvable: false, indexRecette: 0, lecture, notes,
    onChoisir: () => {}, onRecette: () => {}, onRecharger: () => {}, ...extra,
  }));
};

describe("CarteCalculAnalyse", () => {
  it("aucun calcul sauvegardé : explique comment en obtenir un", () => {
    const html = rendu(null);
    expect(html).toContain("Aucun calcul sauvegardé à analyser.");
    expect(html).toContain("Sauvegarder");
    expect(html).toContain('href="/mix"');
  });

  it("calcul selon E/L : méthode d'origine et méthode d'analyse distinctes, valeurs de la recette, volume", () => {
    const html = rendu(calcul());
    expect(html).toContain("Calcul d&#x27;origine : <strong>Dosage selon E/L</strong>");
    expect(html).toContain("balayage selon la méthode Cw");
    expect(html).toContain("74,2");
    expect(html).toContain("12,3 L");
    expect(html).toContain("E/L n&#x27;est pas imposé");
    expect(html).toContain("Recette 2");
  });

  it("axe Cw : jamais « à Cw constant »", () => {
    const html = rendu(calcul(), "solids_mass_pct");
    expect(html).toContain("garde fixes Sr, Bw");
    expect(html).not.toMatch(/Cw constant|fixes Cw/);
  });

  it("une seule recette : pas de choix de recette ; calcul refusé : la raison", () => {
    expect(rendu(calcul({ recipes: [recette()] }))).not.toContain("Recette 1</option>");
    const refus = rendu(calcul({ method: "essai", constantes: { ...packById("gramme")!.constantes, essai_gs_convention: "base" } }));
    expect(refus).toContain("Calcul non analysable.");
    expect(refus).toContain("ancienne convention");
  });

  it("calcul demandé introuvable : bandeau", () => {
    expect(rendu(calcul(), "binder_mass_pct", { introuvable: true })).toContain("le plus récent est affiché");
  });
});
