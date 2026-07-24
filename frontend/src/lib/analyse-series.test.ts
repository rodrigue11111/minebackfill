import { describe, it, expect } from "vitest";
import { SORTIES, PARAMS, sortiesPour, paramsPour } from "./analyse-series";

// Copie locale de la liste CANONIQUE (source de vérité = backend
// app/core/analyse.py _SERIES, sentinelle backend test_balayage.py). Ce test
// vérifie que SORTIES et cette copie coïncident : quand on met à jour la liste
// suite à un changement backend, il force à déclarer libellé + unité ici.
const SERIES_CANONIQUE = [
  "solids_mass_pct", "wc_ratio", "void_ratio", "porosity",
  "saturation_pct", "bw_mass_pct", "bv_vol_pct", "w_mass_pct",
  "dry_density_kg_m3", "bulk_density_kg_m3",
  "aggregate_mass_pct", "aggregate_vol_pct_of_residue",
];

describe("analyse-series — anti-dérive backend/frontend", () => {
  it("les clés de SORTIES couvrent exactement la liste canonique du backend", () => {
    expect(SORTIES.map((s) => s.cle).sort()).toEqual([...SERIES_CANONIQUE].sort());
  });

  it("chaque sortie a un libellé, une unité et au moins une catégorie", () => {
    for (const s of SORTIES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.unite.length).toBeGreaterThan(0);
      expect(s.categories.length).toBeGreaterThan(0);
    }
  });

  it("les paramètres balayables ont des bornes par défaut cohérentes (min < max)", () => {
    for (const p of PARAMS) expect(p.defautMin).toBeLessThan(p.defautMax);
  });

  it("l'agrégat (Am) n'est proposé qu'en RPG", () => {
    expect(paramsPour("RPC").some((p) => p.cle === "aggregate_fraction_pct")).toBe(false);
    expect(paramsPour("RPG").some((p) => p.cle === "aggregate_fraction_pct")).toBe(true);
    expect(sortiesPour("RPC").some((s) => s.cle === "aggregate_mass_pct")).toBe(false);
    expect(sortiesPour("RPG").some((s) => s.cle === "aggregate_mass_pct")).toBe(true);
  });
});
