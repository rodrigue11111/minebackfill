import { describe, expect, it } from "vitest";
import { borneCaracterisation } from "./MaterialCatalogueCard";
import { refusNombre } from "./ui/ChampNombre";
import { CARACTERISATION_GRANULAT, CARACTERISATION_RESIDU } from "@/lib/materials";

// Audit des valeurs impossibles (2026-10-25) : la caractérisation des
// matériaux est bornée à la saisie.
describe("catalogues : bornes de la caractérisation", () => {
  it("chaque champ numérique a une borne : % entre 0 et 100, taille de grain > 0", () => {
    for (const ch of [...CARACTERISATION_RESIDU, ...CARACTERISATION_GRANULAT].filter((c) => c.type === "nombre")) {
      expect([ch.cle, borneCaracterisation(ch)]).not.toEqual([ch.cle, undefined]);
    }
    const p20 = borneCaracterisation(CARACTERISATION_RESIDU.find((c) => c.cle === "p20_pct")!)!;
    expect(refusNombre(101, p20)).not.toBeNull();
    expect(refusNombre(-1, p20)).not.toBeNull();
    expect(refusNombre(45, p20)).toBeNull();
    const d50 = borneCaracterisation(CARACTERISATION_RESIDU.find((c) => c.cle === "d50_um")!)!;
    expect(refusNombre(0, d50)).not.toBeNull();
    expect(refusNombre(12.5, d50)).toBeNull();
  });
});
