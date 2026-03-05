// frontend/src/lib/units.ts — Pure unit conversion engine (no React / no store)

/* ── Type definitions ── */

export type LengthUnit  = "cm" | "mm" | "m" | "in";
export type AreaUnit    = "cm2" | "mm2" | "m2" | "in2";
export type MassUnit    = "kg" | "g" | "t" | "lb";
export type VolumeUnit  = "L" | "mL" | "m3" | "cm3";
export type DensityUnit = "g/cm3" | "kg/m3" | "t/m3";
export type SlumpUnit   = "mm" | "cm" | "in";

export interface UnitPreferences {
  length: LengthUnit;
  area: AreaUnit;
  mass: MassUnit;
  volume: VolumeUnit;
  density: DensityUnit;
  slump: SlumpUnit;
}

export const DEFAULT_UNITS: UnitPreferences = {
  length: "cm",
  area: "cm2",
  mass: "kg",
  volume: "L",
  density: "g/cm3",
  slump: "mm",
};

/* ── Conversion factor maps ──
   Each map gives the multiplier FROM the display unit TO the store unit.
   toStore(value) = value * factor
   fromStore(value) = value / factor
*/

// Store unit: cm
const LENGTH_FACTORS: Record<LengthUnit, number> = {
  cm: 1,
  mm: 0.1,
  m: 100,
  in: 2.54,
};

// Store unit: cm2
const AREA_FACTORS: Record<AreaUnit, number> = {
  cm2: 1,
  mm2: 0.01,
  m2: 10_000,
  in2: 6.4516,
};

// Store unit: kg
const MASS_FACTORS: Record<MassUnit, number> = {
  kg: 1,
  g: 0.001,
  t: 1000,
  lb: 0.453_592_37,
};

// Store unit: m3
const VOLUME_FACTORS: Record<VolumeUnit, number> = {
  L: 0.001,
  mL: 1e-6,
  m3: 1,
  cm3: 1e-6,
};

// Store unit: kg/m3
const DENSITY_FACTORS: Record<DensityUnit, number> = {
  "g/cm3": 1000,
  "kg/m3": 1,
  "t/m3": 1000,
};

// Store unit: mm
const SLUMP_FACTORS: Record<SlumpUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
};

/* ── Null-safe conversion helpers ── */

type Nullable = number | null | undefined;

function safeConvert(v: Nullable, factor: number, direction: "toStore" | "fromStore"): number | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return direction === "toStore" ? v * factor : v / factor;
}

/* ── Public conversion functions ── */

// Length (store = cm)
export const toStoreLength   = (v: Nullable, from: LengthUnit): number | null => safeConvert(v, LENGTH_FACTORS[from], "toStore");
export const fromStoreLength = (v: Nullable, to: LengthUnit): number | null   => safeConvert(v, LENGTH_FACTORS[to], "fromStore");

// Area (store = cm2)
export const toStoreArea   = (v: Nullable, from: AreaUnit): number | null => safeConvert(v, AREA_FACTORS[from], "toStore");
export const fromStoreArea = (v: Nullable, to: AreaUnit): number | null   => safeConvert(v, AREA_FACTORS[to], "fromStore");

// Mass (store = kg)
export const toStoreMass   = (v: Nullable, from: MassUnit): number | null => safeConvert(v, MASS_FACTORS[from], "toStore");
export const fromStoreMass = (v: Nullable, to: MassUnit): number | null   => safeConvert(v, MASS_FACTORS[to], "fromStore");

// Volume (store = m3)
export const toStoreVolume   = (v: Nullable, from: VolumeUnit): number | null => safeConvert(v, VOLUME_FACTORS[from], "toStore");
export const fromStoreVolume = (v: Nullable, to: VolumeUnit): number | null   => safeConvert(v, VOLUME_FACTORS[to], "fromStore");

// Density (store = kg/m3)
export const toStoreDensity   = (v: Nullable, from: DensityUnit): number | null => safeConvert(v, DENSITY_FACTORS[from], "toStore");
export const fromStoreDensity = (v: Nullable, to: DensityUnit): number | null   => safeConvert(v, DENSITY_FACTORS[to], "fromStore");

// Slump (store = mm)
export const toStoreSlump   = (v: Nullable, from: SlumpUnit): number | null => safeConvert(v, SLUMP_FACTORS[from], "toStore");
export const fromStoreSlump = (v: Nullable, to: SlumpUnit): number | null   => safeConvert(v, SLUMP_FACTORS[to], "fromStore");

/* ── Display labels ── */

export const LENGTH_LABELS: Record<LengthUnit, string> = { cm: "cm", mm: "mm", m: "m", in: "po" };
export const AREA_LABELS: Record<AreaUnit, string>     = { cm2: "cm\u00B2", mm2: "mm\u00B2", m2: "m\u00B2", in2: "po\u00B2" };
export const MASS_LABELS: Record<MassUnit, string>     = { kg: "kg", g: "g", t: "t", lb: "lb" };
export const VOLUME_LABELS: Record<VolumeUnit, string> = { L: "L", mL: "mL", m3: "m\u00B3", cm3: "cm\u00B3" };
export const DENSITY_LABELS: Record<DensityUnit, string> = { "g/cm3": "g/cm\u00B3", "kg/m3": "kg/m\u00B3", "t/m3": "t/m\u00B3" };
export const SLUMP_LABELS: Record<SlumpUnit, string>   = { mm: "mm", cm: "cm", in: "po" };

/* ── Settings UI metadata ── */

export const UNIT_CATEGORIES: {
  key: keyof UnitPreferences;
  label: string;
  options: string[];
  labels: Record<string, string>;
}[] = [
  { key: "length",  label: "Longueur",       options: ["cm", "mm", "m", "in"],            labels: LENGTH_LABELS },
  { key: "area",    label: "Aire (section)",  options: ["cm2", "mm2", "m2", "in2"],        labels: AREA_LABELS },
  { key: "mass",    label: "Masse",           options: ["kg", "g", "t", "lb"],             labels: MASS_LABELS },
  { key: "volume",  label: "Volume",          options: ["L", "mL", "m3", "cm3"],           labels: VOLUME_LABELS },
  { key: "density", label: "Masse volumique", options: ["g/cm3", "kg/m3", "t/m3"],         labels: DENSITY_LABELS },
  { key: "slump",   label: "Slump",           options: ["mm", "cm", "in"],                 labels: SLUMP_LABELS },
];
