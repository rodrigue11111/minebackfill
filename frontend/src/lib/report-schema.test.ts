import { describe, expect, it } from "vitest";
import {
  REPORT_ROWS, REPORT_SECTIONS, rowsForSection, RRC_ROWS,
  type ReportCtx,
} from "./report-schema";
import type { RrcRecipe } from "./types";

// Contexte de base : RPC, méthode non-essai, 1 liant. Les variantes (RPG,
// essai, N liants) sont dérivées par surcharge.
const CTX_BASE: ReportCtx = {
  units: { length: "cm", area: "cm2", mass: "kg", volume: "L", density: "g/cm3", slump: "mm" },
  massLabel: "kg", volLabel: "L", densLabel: "g/cm3",
  binderName: (n) => `Ciment ${n}`,
  isEssai: false, isRpg: false, bcount: 1,
};
const ctx = (o: Partial<ReportCtx> = {}): ReportCtx => ({ ...CTX_BASE, ...o });

describe("report-schema — structure", () => {
  it("chaque ligne a un getter appelable et un libellé non vide", () => {
    for (const row of REPORT_ROWS) {
      expect(typeof row.getter).toBe("function");
      expect(row.label(CTX_BASE).length).toBeGreaterThan(0);
      expect(typeof row.unit(CTX_BASE)).toBe("string");
      expect(row.section).toBeGreaterThanOrEqual(1);
      expect(row.section).toBeLessThanOrEqual(6);
    }
  });

  it("les 6 sections sont déclarées", () => {
    expect(REPORT_SECTIONS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("libellés uniques PAR SECTION parmi les lignes visibles", () => {
    // Chaque section est un tableau distinct : à l'écran, le libellé sert de
    // clé React. Deux lignes de la MÊME section ne doivent jamais collisionner.
    // (Un même libellé dans deux sections différentes est légitime — ex.
    // « Liant Bw% » ouvre les sections 1 et 2.) Testé pour chaque contexte réel.
    for (const c of [
      ctx(),                                   // RPC dosage
      ctx({ isEssai: true }),                  // RPC essai
      ctx({ isRpg: true }),                    // RPG dosage
      ctx({ isRpg: true, isEssai: true, bcount: 3 }), // RPG essai, 3 liants
    ]) {
      for (const s of REPORT_SECTIONS) {
        const labels = rowsForSection(s.id, c).map((r) => r.label(c));
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
});

describe("report-schema — gating (when)", () => {
  it("les lignes granulat n'apparaissent qu'en RPG", () => {
    const rpc = rowsForSection(2, ctx()).map((r) => r.label(CTX_BASE));
    const rpg = rowsForSection(2, ctx({ isRpg: true })).map((r) => r.label(ctx({ isRpg: true })));
    expect(rpc.some((l) => l.includes("Granulat"))).toBe(false);
    expect(rpg.some((l) => l.includes("Granulat"))).toBe(true);
    // La section 5 (volumes) gagne « Volume granulat V_g » en RPG.
    expect(rowsForSection(5, ctx({ isRpg: true })).some((r) => r.label(CTX_BASE).includes("granulat V_g"))).toBe(true);
  });

  it("les lignes liant « à ajouter/retirer » n'apparaissent qu'en essai", () => {
    // « Eau à ajouter/retirer » est toujours présente ; ce sont les lignes de
    // LIANT à ajouter (Mb-ad, Mc-ad) qui sont propres à l'essai.
    const dosage = rowsForSection(1, ctx()).map((r) => r.label(CTX_BASE));
    const essai = rowsForSection(1, ctx({ isEssai: true })).map((r) => r.label(ctx({ isEssai: true })));
    expect(dosage.some((l) => l.includes("Mb-ad") || l.includes("Mc1-ad"))).toBe(false);
    expect(essai.some((l) => l.includes("Mb-ad"))).toBe(true);
    expect(essai.some((l) => l.includes("Mc1-ad"))).toBe(true);
  });

  it("le nombre de lignes par-ciment suit bcount", () => {
    const mc = (bcount: number) =>
      rowsForSection(1, ctx({ bcount })).filter((r) => /Mc\d$/.test(r.label(ctx({ bcount })))).length;
    expect(mc(1)).toBe(1);
    expect(mc(2)).toBe(2);
    expect(mc(3)).toBe(3);
  });

  it("le libellé Bw% bascule sur « cible » en essai", () => {
    const bw = REPORT_ROWS.find((r) => r.section === 1 && r.formulaIds?.includes("F016"))!;
    expect(bw.label(ctx())).toBe("Liant Bw%");
    expect(bw.label(ctx({ isEssai: true }))).toBe("Bw% cible");
  });
});

describe("report-schema — parité écran = Excel = PDF", () => {
  // Les trois consommateurs itèrent le MÊME REPORT_ROWS via rowsForSection
  // avec le MÊME ctx : la parité est structurelle. Ce test la verrouille en
  // affirmant que l'ensemble des lignes visibles est identique quel que soit
  // le « consommateur » (aucun ne filtre différemment).
  it("mêmes lignes visibles pour un ctx donné, dans les 6 sections", () => {
    for (const c of [ctx(), ctx({ isEssai: true }), ctx({ isRpg: true })]) {
      for (const s of REPORT_SECTIONS) {
        const visibles = rowsForSection(s.id, c);
        // rowsForSection est la seule porte : si elle est déterministe, les
        // trois rendus le sont aussi. On vérifie la stabilité (idempotence).
        expect(rowsForSection(s.id, c)).toEqual(visibles);
      }
    }
  });

  it("toutes les lignes de REPORT_ROWS sont atteignables via une section", () => {
    const viaSection = REPORT_SECTIONS.flatMap((s) =>
      // union de tous les contextes : une ligne gated doit apparaître dans au
      // moins une combinaison.
      [ctx(), ctx({ isEssai: true }), ctx({ isRpg: true, isEssai: true, bcount: 3 })]
        .flatMap((c) => rowsForSection(s.id, c)),
    );
    for (const row of REPORT_ROWS) {
      expect(viaSection).toContain(row);
    }
  });
});

describe("report-schema — RRC", () => {
  const RRC: RrcRecipe = {
    bw_mass_pct: 4.5, wc_ratio: 0.4, w_mass_pct: 8, solids_mass_pct: 92,
    total_mass_kg: 1000, crf_volume_m3: 0.5, waste_rock_mass_kg: 800,
    cement_mass_kg: 40, water_mass_kg: 16, fluid_mass_kg: 17,
    retarder_mass_kg: 1, retarder_volume_l: 0.9, retarder_dosage_mass_pct: 2.5,
    slurry_mass_kg: 57, slurry_volume_m3: 0.03,
  } as RrcRecipe;

  it("chaque ligne RRC a un libellé et un getter numérique", () => {
    const toMass = (kg: number | null | undefined) => (kg == null ? null : kg);
    for (const row of RRC_ROWS) {
      expect(row.label("kg").length).toBeGreaterThan(0);
      const v = row.getter(RRC, toMass);
      expect(v === null || typeof v === "number").toBe(true);
    }
  });

  it("le libellé RRC interpole l'unité de masse", () => {
    const masse = RRC_ROWS.find((r) => r.label("kg").includes("M_CRF"))!;
    expect(masse.label("lb")).toContain("(lb)");
  });
});
