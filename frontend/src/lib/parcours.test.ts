import { describe, expect, it } from "vitest";
import { etapeCalculs, PARCOURS } from "./parcours";

describe("parcours d'un calcul (2026-10-26)", () => {
  it("quatre étapes numérotées de 1 à 4, sans « Type »", () => {
    expect(PARCOURS.map((e) => e.n)).toEqual([1, 2, 3, 4]);
    expect(PARCOURS.map((e) => e.libelle)).toEqual(["Projet", "Données", "Calculer", "Sauvegarder / analyser"]);
    expect(PARCOURS.some((e) => e.libelle === "Type")).toBe(false);
  });

  it("« Données » réunit catégorie, méthode et paramètres", () => {
    const donnees = PARCOURS.find((e) => e.libelle === "Données");
    expect(donnees?.detail).toContain("méthode");
    expect(donnees?.detail).toContain("paramètres");
  });

  it("page Calculs : « Données » avant un résultat, « Sauvegarder / analyser » après", () => {
    expect(PARCOURS.find((e) => e.n === etapeCalculs(false))?.libelle).toBe("Données");
    expect(PARCOURS.find((e) => e.n === etapeCalculs(true))?.libelle).toBe("Sauvegarder / analyser");
  });
});
