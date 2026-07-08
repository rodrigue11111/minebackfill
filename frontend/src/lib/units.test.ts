import { describe, expect, it } from "vitest";
import {
  toStoreLength, fromStoreLength,
  toStoreArea, fromStoreArea,
  toStoreMass, fromStoreMass,
  toStoreVolume, fromStoreVolume,
  toStoreDensity, fromStoreDensity,
  toStoreSlump, fromStoreSlump,
  type LengthUnit, type AreaUnit, type MassUnit,
  type VolumeUnit, type DensityUnit, type SlumpUnit,
} from "./units";

// Un facteur faux ici corrompt silencieusement tous les calculs envoyés au
// backend : on vérifie les aller-retours ET des valeurs de référence connues.

describe("aller-retour toStore/fromStore (identité)", () => {
  const CAS: [string, (v: number, u: never) => number | null, (v: number, u: never) => number | null, string[]][] = [
    ["longueur", toStoreLength as never, fromStoreLength as never, ["cm", "mm", "m", "in"]],
    ["aire", toStoreArea as never, fromStoreArea as never, ["cm2", "mm2", "m2", "in2"]],
    ["masse", toStoreMass as never, fromStoreMass as never, ["kg", "g", "t", "lb"]],
    ["volume", toStoreVolume as never, fromStoreVolume as never, ["L", "mL", "m3", "cm3", "mm3", "in3"]],
    ["densité", toStoreDensity as never, fromStoreDensity as never, ["g/cm3", "kg/m3", "t/m3"]],
    ["slump", toStoreSlump as never, fromStoreSlump as never, ["mm", "cm", "in"]],
  ];
  for (const [nom, to, from, unites] of CAS) {
    for (const u of unites) {
      it(`${nom} en ${u}`, () => {
        const v = 123.456;
        expect(from(to(v, u as never)!, u as never)).toBeCloseTo(v, 9);
      });
    }
  }
});

describe("valeurs de référence", () => {
  it("longueur : 1 in = 2.54 cm (unité du store)", () => {
    expect(toStoreLength(1, "in" as LengthUnit)).toBeCloseTo(2.54, 12);
  });
  it("aire : 1 m2 = 10 000 cm2", () => {
    expect(toStoreArea(1, "m2" as AreaUnit)).toBeCloseTo(10_000, 12);
  });
  it("masse : 1 t = 1000 kg ; 1 lb = 0.45359237 kg", () => {
    expect(toStoreMass(1, "t" as MassUnit)).toBeCloseTo(1000, 12);
    expect(toStoreMass(1, "lb" as MassUnit)).toBeCloseTo(0.45359237, 12);
  });
  it("volume : 1 po³ = 16.387 cm³ = 1.6387064e-5 m3", () => {
    expect(toStoreVolume(1, "in3" as VolumeUnit)).toBeCloseTo(1.6387064e-5, 15);
    // moule labo 2 po x 4 po (r=1 po, h=4 po) ≈ 12.566 po³ ≈ 205.9 cm³
    expect(fromStoreVolume(205.92591950522308e-6, "in3" as VolumeUnit)).toBeCloseTo(Math.PI * 1 * 4, 6);
  });
  it("volume : 1 mm³ = 1e-9 m3 ; 1 cm³ = 1000 mm³", () => {
    expect(toStoreVolume(1, "mm3" as VolumeUnit)).toBeCloseTo(1e-9, 18);
    expect(fromStoreVolume(1e-6, "mm3" as VolumeUnit)).toBeCloseTo(1000, 9);
  });
  it("volume : 1 L = 0.001 m3 (unité du store)", () => {
    expect(toStoreVolume(1, "L" as VolumeUnit)).toBeCloseTo(0.001, 12);
  });
  it("densité : 1 g/cm3 = 1000 kg/m3 ; 1 t/m3 = 1000 kg/m3", () => {
    expect(toStoreDensity(1, "g/cm3" as DensityUnit)).toBeCloseTo(1000, 12);
    expect(toStoreDensity(1, "t/m3" as DensityUnit)).toBeCloseTo(1000, 12);
  });
  it("slump : 1 in = 25.4 mm", () => {
    expect(toStoreSlump(1, "in" as SlumpUnit)).toBeCloseTo(25.4, 12);
  });
});

describe("valeurs nulles / invalides", () => {
  it("null et undefined passent sans exploser", () => {
    expect(toStoreMass(null, "kg" as MassUnit)).toBeNull();
    expect(fromStoreMass(undefined, "t" as MassUnit)).toBeNull();
    expect(toStoreMass(NaN, "kg" as MassUnit)).toBeNull();
  });
});
