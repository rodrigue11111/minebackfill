import { describe, it, expect } from "vitest";
import { celluleCsv, versCsv, nomFichier } from "./export-fig";

describe("celluleCsv", () => {
  it("nombre -> décimale française (virgule)", () => {
    expect(celluleCsv(3.14)).toBe("3,14");
    expect(celluleCsv(1000)).toBe("1000"); // pas de séparateur de milliers
  });
  it("null/undefined/non fini -> vide", () => {
    expect(celluleCsv(null)).toBe("");
    expect(celluleCsv(undefined)).toBe("");
    expect(celluleCsv(Number.NaN)).toBe("");
    expect(celluleCsv(Infinity)).toBe("");
  });
  it("évite la notation scientifique pour les valeurs minuscules", () => {
    expect(celluleCsv(1e-8)).toBe("0,00000001");
    expect(celluleCsv(0.0000005)).toBe("0,0000005");
  });
  it("échappe les cellules contenant ; \" ou saut de ligne", () => {
    expect(celluleCsv("a;b")).toBe('"a;b"');
    expect(celluleCsv('a"b')).toBe('"a""b"');
    expect(celluleCsv("simple")).toBe("simple");
  });
});

describe("versCsv", () => {
  it("assemble avec « ; » et fins de ligne CRLF", () => {
    const csv = versCsv([["Bw", "W/C"], [5, 7], [6, 5.5]]);
    expect(csv).toBe("Bw;W/C\r\n5;7\r\n6;5,5");
  });
});

describe("nomFichier", () => {
  it("nettoie et horodate", () => {
    const d = new Date(2026, 6, 24, 10);
    expect(nomFichier("Analyse RPG / courbes", "csv", d)).toBe("Analyse-RPG-courbes_2026-07-24.csv");
  });

  it("date locale : un export à 23 h garde la date du jour (pas celle du lendemain en UTC)", () => {
    expect(nomFichier("x", "csv", new Date(2026, 9, 20, 23, 30))).toBe("x_2026-10-20.csv");
    expect(nomFichier("x", "csv", new Date(2026, 9, 21, 0, 5))).toBe("x_2026-10-21.csv");
  });
});
