import { describe, expect, it } from "vitest";
import { parametresVolume, volumeMouleM3, volumeTotalM3 } from "./contenant";

describe("volume d'un moule (même géométrie que le calcul)", () => {
  it("cylindre, section × hauteur, pavé, volume saisi ; dimensions incomplètes : null", () => {
    // Cylindre 76,2 × 152,4 mm : r = 3,81 cm, h = 15,24 cm.
    expect(volumeMouleM3({ container_type: "rayon_hauteur", container_radius: 3.81, container_height: 15.24 })!).toBeCloseTo(Math.PI * 0.0381 ** 2 * 0.1524, 12);
    expect(volumeMouleM3({ container_type: "section_hauteur", container_section: 80.45, container_height: 20.5 })!).toBeCloseTo(80.45 * 20.5 * 1e-6, 12);
    // Exemple Intra 2017 : 55 × 20 × 10 m = 11 000 m³.
    expect(volumeMouleM3({ container_type: "longueur_largeur_hauteur", container_length: 5500, container_width: 2000, container_height: 1000 })!).toBeCloseTo(11000, 6);
    expect(volumeMouleM3({ container_type: "volume", container_volume_m3: 1.65 })).toBe(1.65);
    expect(volumeMouleM3({ container_type: "rayon_hauteur", container_radius: 3.81 })).toBeNull();
    expect(volumeMouleM3({ container_type: "longueur_largeur_hauteur", container_length: 0, container_width: 1, container_height: 1 })).toBeNull();
    expect(volumeMouleM3({})).toBeNull();
  });
});

describe("volume total VT par recette (même formule que le calcul)", () => {
  it("VT = volume d'un moule × moules par recette × κ ; donnée manquante ou non positive : null", () => {
    expect(volumeTotalM3(0.002, 3, 1.05)).toBeCloseTo(0.0063, 12);
    expect(volumeTotalM3(null, 3, 1.05)).toBeNull();
    expect(volumeTotalM3(0.002, 0, 1.05)).toBeNull();
    expect(volumeTotalM3(0.002, 3, undefined)).toBeNull();
  });

  it("moules et κ de la méthode active ; l'essai-erreur prend sa méthode de base ; RRC : aucun", () => {
    const etat = {
      cw: { desired_qty: 3, safety_factor: 1.05 }, wb: { desired_qty: 2, safety_factor: 1.1 },
      essai: { base_method: "wb" }, rpgCw: { desired_qty: 4, safety_factor: 1 },
    };
    expect(parametresVolume({ ...etat, category: "RPC", method: "dosage_cw" })).toEqual({ moules: 3, kappa: 1.05 });
    expect(parametresVolume({ ...etat, category: "RPC", method: "essai" })).toMatchObject({ moules: 2, kappa: 1.1 });
    expect(parametresVolume({ ...etat, cw: { desired_qty: 3 }, category: "RPC", method: "dosage_cw" })).toEqual({ moules: 3, kappa: 1 }); // κ vide = 1
    expect(parametresVolume({ ...etat, category: "RPG", method: "dosage_cw" })).toMatchObject({ moules: 4, kappa: 1 });
    expect(parametresVolume({ ...etat, category: "RRC", method: "rrc" })).toBeNull();
  });
});
