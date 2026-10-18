import { describe, expect, it } from "vitest";
import { volumeMouleM3 } from "./contenant";

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
