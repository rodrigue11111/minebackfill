import { describe, expect, it } from "vitest";
import { CONVENTION_PACKS, packById, solverVersionActive } from "./conventions";
import type { ConstantesCalcul } from "./store";

// Épingle le contenu des packs. Une dérive (côté frontend ou backend) doit
// casser CE test ET son homologue pytest (test_unit_solvers) — garde-fou de
// cohérence des deux côtés, comme pour les défauts de constantes.
describe("conventions — packs", () => {
  it("intra2017 : constantes physiques standard + règles Intra 2017", () => {
    const p = packById("intra2017")!;
    expect(p.solverVersion).toBe("intra2017-1.0");
    expect(p.constantes).toEqual({
      masse_volumique_eau_kg_m3: 1000.0,
      gravite_m_s2: 9.81,
      facteur_petit_cone_vers_grand_cone: 2.335,
      coefficient_modele_slump: 4.95e6,
      constante_modele_slump: 235.5122,
      essai_gs_convention: "base",
      essai_binder_rule: "solides_totaux",
      pack_id: "intra2017",
    });
  });

  it("gramme : mêmes constantes physiques, règle du liant « residu_ajoute »", () => {
    const p = packById("gramme")!;
    expect(p.solverVersion).toBe("gramme-1.0");
    expect(p.constantes.essai_binder_rule).toBe("residu_ajoute");
    expect(p.constantes.essai_gs_convention).toBe("base");
    expect(p.constantes.pack_id).toBe("gramme");
    // Constantes physiques identiques à intra2017.
    const intra = packById("intra2017")!.constantes;
    for (const k of ["masse_volumique_eau_kg_m3", "gravite_m_s2",
      "facteur_petit_cone_vers_grand_cone", "coefficient_modele_slump",
      "constante_modele_slump"] as const) {
      expect(p.constantes[k]).toBe(intra[k]);
    }
  });

  it("solverVersionActive suit le pack, sinon « personnalise »", () => {
    const base = packById("intra2017")!.constantes;
    expect(solverVersionActive(base)).toBe("intra2017-1.0");
    expect(solverVersionActive(packById("gramme")!.constantes)).toBe("gramme-1.0");
    const perso: ConstantesCalcul = { ...base, pack_id: "personnalise" };
    expect(solverVersionActive(perso)).toBe("intra2017-1.0-personnalise");
  });

  it("les deux packs sont exposés", () => {
    expect(CONVENTION_PACKS.map((p) => p.id)).toEqual(["intra2017", "gramme"]);
  });
});
