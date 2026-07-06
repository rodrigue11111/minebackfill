import { describe, expect, it } from "vitest";
import { construireSystemeLiant, gsLiant, gsParDefaut } from "./rpc_payload";
import { messageErreurApi } from "./api-error";
import type { GeneralInfo, LiantCatalogueItem } from "./store";

const CATALOGUE: LiantCatalogueItem[] = [
  { id: "l1", code: "GU", nom: "Ciment GU", gs: 3.15 },
  { id: "l2", code: "GGBFS", nom: "Slag", gs: 2.9 },
];

describe("construireSystemeLiant", () => {
  it("normalise les fractions à 1 (20/80)", () => {
    const g: GeneralInfo = {
      binder1_type: "GU", binder2_type: "GGBFS",
      binder1_fraction_pct: 20, binder2_fraction_pct: 80,
    };
    const sys = construireSystemeLiant(g, CATALOGUE);
    expect(sys.components).toHaveLength(2);
    expect(sys.components[0].mass_fraction).toBeCloseTo(0.2, 12);
    expect(sys.components[1].mass_fraction).toBeCloseTo(0.8, 12);
    expect(sys.components[0].specific_gravity).toBeCloseTo(3.15, 12);
    expect(sys.components.reduce((a, c) => a + c.mass_fraction, 0)).toBeCloseTo(1, 12);
  });

  it("fractions qui ne somment pas à 100 -> renormalisées", () => {
    const g: GeneralInfo = {
      binder1_type: "GU", binder2_type: "GGBFS",
      binder1_fraction_pct: 30, binder2_fraction_pct: 30,
    };
    const sys = construireSystemeLiant(g, CATALOGUE);
    expect(sys.components[0].mass_fraction).toBeCloseTo(0.5, 12);
    expect(sys.components.reduce((a, c) => a + c.mass_fraction, 0)).toBeCloseTo(1, 12);
  });

  it("aucune fraction -> repli sur un seul liant à 100 %", () => {
    const g: GeneralInfo = { binder1_type: "GU" };
    const sys = construireSystemeLiant(g, CATALOGUE);
    expect(sys.components).toHaveLength(1);
    expect(sys.components[0].mass_fraction).toBe(1.0);
  });

  it("code inconnu -> Gs par défaut", () => {
    expect(gsLiant("INTROUVABLE", CATALOGUE)).toBe(gsParDefaut);
    expect(gsLiant(null, CATALOGUE)).toBe(gsParDefaut);
  });
});

describe("messageErreurApi", () => {
  it("detail chaîne -> renvoyée telle quelle", () => {
    expect(messageErreurApi({ detail: "Type de contenant manquant." }, 422))
      .toBe("Type de contenant manquant.");
  });
  it("detail tableau Pydantic -> champs traduits", () => {
    const data = {
      detail: [
        { loc: ["body", "general", "container_height"], msg: "Field required" },
        { loc: ["body", "solids_mass_pct"], msg: "Input should be greater than 0" },
      ],
    };
    const msg = messageErreurApi(data, 422);
    expect(msg).toContain("hauteur du contenant");
    expect(msg).toContain("Cw%");
  });
  it("réponse vide -> repli générique avec le code HTTP", () => {
    expect(messageErreurApi(null, 500)).toBe("Erreur API (500)");
  });
});
